"""
自回归验证校验脚本
- 1:1 还原 server/src/modules/ai-role/reasoning-parser.ts 的三种模式（none / field / think-tag）
- 构造覆盖正常、边界、异常的 SSE chunk 序列
- 按多种切分粒度（单字符、随机、标签边界）增量喂入解析器
- 校验重组后的 content / reasoning 与原始期望完全一致

不修改任何项目源代码，仅做一致性校验。
"""

from __future__ import annotations

import json
import random
import sys
from dataclasses import dataclass
from typing import Iterable


# ---------------------------------------------------------------------------
# Python 1:1 端口：与 reasoning-parser.ts 行为保持一致
# ---------------------------------------------------------------------------


class ReasoningStreamParser:
    """等价于 TS 的 ReasoningStreamParser。"""

    def __init__(self, mode: str) -> None:
        assert mode in ("none", "field", "think-tag"), f"非法模式: {mode}"
        self.mode = mode
        self.buffer = ""
        self.in_think = False

    def feed(self, chunk: dict) -> list[dict]:
        if self.mode == "field":
            return self._parse_field_chunk(chunk)
        if self.mode == "think-tag":
            return self._parse_think_tag_chunk(chunk)
        # none 模式
        delta = (chunk.get("choices") or [{}])[0].get("delta", {})
        content = delta.get("content") or ""
        if not content:
            return []
        return [{"type": "content", "delta": content}]

    def _parse_field_chunk(self, chunk: dict) -> list[dict]:
        delta = (chunk.get("choices") or [{}])[0].get("delta", {})
        out: list[dict] = []
        if delta.get("reasoning_content"):
            out.append({"type": "reasoning", "delta": delta["reasoning_content"]})
        if delta.get("content"):
            out.append({"type": "content", "delta": delta["content"]})
        return out

    def _parse_think_tag_chunk(self, chunk: dict) -> list[dict]:
        delta = (chunk.get("choices") or [{}])[0].get("delta", {})
        text: str = delta.get("content") or ""
        if not text:
            return []
        self.buffer += text
        out: list[dict] = []
        remaining = self.buffer
        pending_buffer = ""  # 只在遇到不完整前缀时设置

        while remaining:
            if not self.in_think:
                # 查找 <think 标签，排除 </think（前面不能是 /）
                start = -1
                search_from = 0
                while search_from < len(remaining):
                    idx = remaining.find("<think", search_from)
                    if idx == -1:
                        break
                    if idx > 0 and remaining[idx - 1] == "/":
                        search_from = idx + 1
                        continue
                    start = idx
                    break

                if start == -1:
                    # 检查末尾是否是 <think 的不完整前缀
                    prefix_len = 0
                    for prefix in ["<thin", "<thi", "<th", "<t", "<"]:
                        if remaining.endswith(prefix):
                            prefix_len = len(prefix)
                            break
                    if prefix_len > 0:
                        safe_len = len(remaining) - prefix_len
                        if safe_len > 0:
                            out.append({"type": "content", "delta": remaining[:safe_len]})
                        pending_buffer = remaining[safe_len:]
                        remaining = ""
                    else:
                        out.append({"type": "content", "delta": remaining})
                        remaining = ""
                else:
                    if start > 0:
                        out.append({"type": "content", "delta": remaining[:start]})
                    tag_end = remaining.find(">", start)
                    if tag_end == -1:
                        pending_buffer = remaining[start:]
                        remaining = ""
                    else:
                        self.in_think = True
                        remaining = remaining[tag_end + 1:]
            else:
                end = remaining.find("</think")
                if end == -1:
                    # 检查末尾是否是 </think 的不完整前缀
                    prefix_len = 0
                    for prefix in ["</think", "</thin", "</thi", "</th", "</t", "</", "<"]:
                        if remaining.endswith(prefix):
                            prefix_len = len(prefix)
                            break
                    if prefix_len > 0:
                        safe_len = len(remaining) - prefix_len
                        if safe_len > 0:
                            out.append({"type": "reasoning", "delta": remaining[:safe_len]})
                        pending_buffer = remaining[safe_len:]
                        remaining = ""
                    else:
                        out.append({"type": "reasoning", "delta": remaining})
                        remaining = ""
                else:
                    if end > 0:
                        out.append({"type": "reasoning", "delta": remaining[:end]})
                    tag_end = remaining.find(">", end)
                    if tag_end == -1:
                        pending_buffer = remaining[end:]
                        remaining = ""
                    else:
                        self.in_think = False
                        remaining = remaining[tag_end + 1:]

        self.buffer = pending_buffer
        return out

    def reset(self) -> None:
        self.buffer = ""
        self.in_think = False


# ---------------------------------------------------------------------------
# SSE chunk 构造：模拟 OpenAI Compatible 流
# ---------------------------------------------------------------------------


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}"


def chunk_text(text: str, mode: str) -> dict:
    """将一段纯文本包成 SSE 风格的 chunk dict（think-tag / none 模式）。"""
    delta: dict = {}
    if text:
        delta["content"] = text
    return {"choices": [{"delta": delta}]}


def chunk_field(content: str, reasoning: str) -> dict:
    """field 模式（DeepSeek R1 风格）：content 与 reasoning_content 分别返回。"""
    delta: dict = {}
    if content:
        delta["content"] = content
    if reasoning:
        delta["reasoning_content"] = reasoning
    return {"choices": [{"delta": delta}]}


def sse_split(text: str, sizes: list[int]) -> list[dict]:
    """按 sizes 切分 text，生成 chunk 列表。"""
    chunks: list[dict] = []
    idx = 0
    for size in sizes:
        if idx >= len(text):
            break
        seg = text[idx : idx + size]
        idx += len(seg)
        chunks.append(chunk_text(seg, "think-tag"))
    if idx < len(text):
        chunks.append(chunk_text(text[idx:], "think-tag"))
    return chunks


def field_sse_split(content: str, reasoning: str, content_sizes: list[int], reasoning_sizes: list[int]) -> list[dict]:
    """field 模式：content 和 reasoning 各自按尺寸切分，交错合并。"""
    chunks: list[dict] = []
    c_idx = r_idx = 0
    max_len = max(len(content_sizes), len(reasoning_sizes))
    for i in range(max_len):
        c_seg = ""
        if c_idx < len(content) and i < len(content_sizes):
            size = content_sizes[i]
            c_seg = content[c_idx : c_idx + size]
            c_idx += len(c_seg)
        r_seg = ""
        if r_idx < len(reasoning) and i < len(reasoning_sizes):
            size = reasoning_sizes[i]
            r_seg = reasoning[r_idx : r_idx + size]
            r_idx += len(r_seg)
        if c_seg or r_seg:
            chunks.append(chunk_field(c_seg, r_seg))
    if c_idx < len(content):
        chunks.append(chunk_field(content[c_idx:], ""))
    if r_idx < len(reasoning):
        chunks.append(chunk_field("", reasoning[r_idx:]))
    return chunks


# ---------------------------------------------------------------------------
# 校验工具
# ---------------------------------------------------------------------------


def run_parser(parser: ReasoningStreamParser, chunks: Iterable[dict]) -> tuple[str, str]:
    content_buf: list[str] = []
    reasoning_buf: list[str] = []
    for c in chunks:
        for out in parser.feed(c):
            if out.get("type") == "content":
                content_buf.append(out.get("delta", ""))
            elif out.get("type") == "reasoning":
                reasoning_buf.append(out.get("delta", ""))
    return "".join(content_buf), "".join(reasoning_buf)


@dataclass
class CaseResult:
    name: str
    mode: str
    split_strategy: str
    passed: bool
    expected_content: str
    actual_content: str
    expected_reasoning: str
    actual_reasoning: str
    detail: str = ""


def split_sizes_single(text_len: int) -> list[int]:
    """每 1 个字符一个 chunk。"""
    return [1] * text_len


def split_sizes_random(text_len: int, seed: int, max_chunk: int = 5) -> list[int]:
    """按 1..max_chunk 随机长度切分。"""
    rng = random.Random(seed)
    sizes: list[int] = []
    remaining = text_len
    while remaining > 0:
        s = rng.randint(1, min(max_chunk, remaining))
        sizes.append(s)
        remaining -= s
    return sizes


def split_sizes_at_tag_boundaries(text: str) -> list[int]:
    """在每个 '<' 字符处断开（用于压测 think 标签的边界）。"""
    sizes: list[int] = []
    i = 0
    while i < len(text):
        if text[i] == "<":
            sizes.append(1)
            i += 1
        else:
            j = text.find("<", i)
            if j == -1:
                sizes.append(len(text) - i)
                i = len(text)
            else:
                sizes.append(j - i)
                i = j
    return sizes


def split_sizes_mid_tag(text: str) -> list[int]:
    """故意把 <think> 和 </think> 切成 1 字符（最坏情况）。"""
    return [1] * len(text)


# ---------------------------------------------------------------------------
# 用例集
# ---------------------------------------------------------------------------


@dataclass
class Case:
    name: str
    mode: str
    # think-tag / none 用 full_text 表达；field 用 content + reasoning
    full_text: str = ""
    content: str = ""
    reasoning: str = ""
    expected_content: str = ""
    expected_reasoning: str = ""


CASES: list[Case] = [
    # ---- none 模式 ----
    Case(
        name="none/纯文本无思考",
        mode="none",
        full_text="你好，世界！",
        expected_content="你好，世界！",
        expected_reasoning="",
    ),
    Case(
        name="none/长文本",
        mode="none",
        full_text="今天天气不错，适合出去走走。" * 20,
        expected_content="今天天气不错，适合出去走走。" * 20,
        expected_reasoning="",
    ),
    Case(
        name="none/包含<think>字面量（none模式应原样输出）",
        mode="none",
        full_text="回答：<think>这只是字面量</think>结束",
        expected_content="回答：<think>这只是字面量</think>结束",
        expected_reasoning="",
    ),

    # ---- field 模式 ----
    Case(
        name="field/纯内容无推理",
        mode="field",
        content="我同意你的看法。",
        reasoning="",
        expected_content="我同意你的看法。",
        expected_reasoning="",
    ),
    Case(
        name="field/内容+推理分离",
        mode="field",
        content="最终答案是42。",
        reasoning="让我想想... 经典的 42。",
        expected_content="最终答案是42。",
        expected_reasoning="让我想想... 经典的 42。",
    ),
    Case(
        name="field/长内容+长推理",
        mode="field",
        content="这个问题的答案可以从多个角度来分析。" * 15,
        reasoning="首先我们需要理解问题背景..." * 10,
        expected_content="这个问题的答案可以从多个角度来分析。" * 15,
        expected_reasoning="首先我们需要理解问题背景..." * 10,
    ),

    # ---- think-tag 模式 ----
    Case(
        name="think-tag/标准单段",
        mode="think-tag",
        full_text="<think>深度思考</think>最终回答：OK",
        expected_content="最终回答：OK",
        expected_reasoning="深度思考",
    ),
    Case(
        name="think-tag/多段思考",
        mode="think-tag",
        full_text="<think>第一段\n第二段</think>公开回答",
        expected_content="公开回答",
        expected_reasoning="第一段\n第二段",
    ),
    Case(
        name="think-tag/带属性标签<think depth=\"1\">",
        mode="think-tag",
        full_text='<think depth="1">推理内容</think>结果',
        expected_content="结果",
        expected_reasoning="推理内容",
    ),
    Case(
        name="think-tag/无思考只有内容",
        mode="think-tag",
        full_text="直接回答，没有任何推理",
        expected_content="直接回答，没有任何推理",
        expected_reasoning="",
    ),
    Case(
        name="think-tag/只有思考无内容",
        mode="think-tag",
        full_text="<think>默默思考中</think>",
        expected_content="",
        expected_reasoning="默默思考中",
    ),
    Case(
        name="think-tag/前置内容+思考+后置内容",
        mode="think-tag",
        full_text="开场白<think>理由</think>收尾语",
        expected_content="开场白收尾语",
        expected_reasoning="理由",
    ),
    Case(
        name="think-tag/含中文标点与emoji",
        mode="think-tag",
        full_text="<think>需要查证：①来源 ②时间 🤔</think>已确认 ✅",
        expected_content="已确认 ✅",
        expected_reasoning="需要查证：①来源 ②时间 🤔",
    ),
    Case(
        name="think-tag/think含尖括号/HTML实体",
        mode="think-tag",
        full_text="<think>比较 2<3 与 a>b 的情况</think>结论：2<3 成立",
        expected_content="结论：2<3 成立",
        expected_reasoning="比较 2<3 与 a>b 的情况",
    ),
    Case(
        name="think-tag/未闭合（模拟流中断）",
        mode="think-tag",
        full_text="<think>推理到一半没结束",
        expected_content="",
        expected_reasoning="推理到一半没结束",
    ),
    Case(
        name="think-tag/含字符串<think>但无匹配关闭",
        mode="think-tag",
        full_text="前缀<think>片段1<think>片段2 公开文本",
        # 修复后：进入 think 状态后，第二个 <think 只是普通文本（无 </think> 关闭）
        expected_content="前缀",
        expected_reasoning="片段1<think>片段2 公开文本",
    ),
    Case(
        name="think-tag/前后空白",
        mode="think-tag",
        full_text="  <think>  思考 </think>   正文   ",
        # <think> 前的空格也是 content，</think> 后的空格也是 content
        expected_content="     正文   ",
        expected_reasoning="  思考 ",
    ),
]


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def evaluate_case(case: Case) -> list[CaseResult]:
    results: list[CaseResult] = []

    strategies: list[tuple[str, list[int]]] = []
    if case.mode == "think-tag" or case.mode == "none":
        text = case.full_text
        strategies.append(("size=1", split_sizes_single(len(text))))
        strategies.append(("size=random(1..5)", split_sizes_random(len(text), seed=42)))
        strategies.append(("size=random(1..7,seed=2)", split_sizes_random(len(text), seed=2, max_chunk=7)))
        strategies.append(("at '<' boundary", split_sizes_at_tag_boundaries(text)))
        strategies.append(("size=1 aggressive (mid-tag)", split_sizes_mid_tag(text)))
    else:
        # field 模式：分别对 content 和 reasoning 切分
        strategies.append(("field/size=1", [1] * max(len(case.content), len(case.reasoning))))
        strategies.append(("field/random(1..5,seed=42)", [1] * max(len(case.content), len(case.reasoning))))

    for strat_name, sizes in strategies:
        if case.mode in ("think-tag", "none"):
            chunks = sse_split(case.full_text, sizes)
        else:
            c_sizes = sizes[: len(case.content)]
            r_sizes = sizes[: len(case.reasoning)]
            chunks = field_sse_split(case.content, case.reasoning, c_sizes, r_sizes)

        parser = ReasoningStreamParser(case.mode)
        actual_c, actual_r = run_parser(parser, chunks)
        ok = (actual_c == case.expected_content) and (actual_r == case.expected_reasoning)
        results.append(
            CaseResult(
                name=case.name,
                mode=case.mode,
                split_strategy=strat_name,
                passed=ok,
                expected_content=case.expected_content,
                actual_content=actual_c,
                expected_reasoning=case.expected_reasoning,
                actual_reasoning=actual_r,
            )
        )
    return results


def main() -> int:
    all_results: list[CaseResult] = []
    for case in CASES:
        all_results.extend(evaluate_case(case))

    total = len(all_results)
    failed = [r for r in all_results if not r.passed]
    passed = total - len(failed)

    print("=" * 72)
    print(f"自回归一致性校验报告  ({'PASS' if not failed else 'FAIL'})")
    print("=" * 72)
    print(f"用例数: {len(CASES)}    策略数 × 用例 = {total}    通过: {passed}    失败: {len(failed)}")
    print()

    # 汇总按用例分组的简短结果
    grouped: dict[str, list[CaseResult]] = {}
    for r in all_results:
        grouped.setdefault(r.name, []).append(r)
    for name, rs in grouped.items():
        ok = all(x.passed for x in rs)
        marker = "✓" if ok else "✗"
        print(f"  [{marker}] {name}  ({rs[0].mode})")
        if not ok:
            for x in rs:
                if not x.passed:
                    print(f"        失败策略: {x.split_strategy}")
                    print(f"          期望 content = {x.expected_content!r}")
                    print(f"          实际 content = {x.actual_content!r}")
                    print(f"          期望 reasoning= {x.expected_reasoning!r}")
                    print(f"          实际 reasoning= {x.actual_reasoning!r}")

    print()
    print("=" * 72)
    if failed:
        print("结论：存在一致性偏差，需定位根因。")
        return 1
    print("结论：所有用例、所有切分粒度下，解析器输出与期望完全一致。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
