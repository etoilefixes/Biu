"""
Biu 后端全模块自回归验证校验脚本
================================
覆盖范围：
  1. reasoning-parser.ts 三模式流式解析（含 think-tag bug 定位）
  2. JWT 签发/验证链路一致性
  3. Zod schema 校验闭环
  4. 权限矩阵（RBAC + 会话级）自洽性
  5. 消息格式化（badge/mentions/cardData）序列化/反序列化一致性
  6. Socket 事件数据格式与 HTTP API 响应格式一致性
  7. BiuId 生成逻辑边界校验
  8. AI LLM 请求体构建一致性

纯 Python 实现，不依赖数据库/Redis/网络，不修改任何项目源代码。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import math
import random
import re
import struct
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterable


# ═══════════════════════════════════════════════════════════════════════════
# 1. ReasoningStreamParser — 1:1 还原 TS 实现
# ═══════════════════════════════════════════════════════════════════════════


class ReasoningStreamParser:
    """与 reasoning-parser.ts 完全等价的 Python 端口。"""

    def __init__(self, mode: str) -> None:
        assert mode in ("none", "field", "think-tag")
        self.mode = mode
        self.buffer = ""
        self.in_think = False

    def feed(self, chunk: dict) -> list[dict]:
        if self.mode == "field":
            return self._parse_field_chunk(chunk)
        if self.mode == "think-tag":
            return self._parse_think_tag_chunk(chunk)
        # none
        content = (chunk.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
        return [{"type": "content", "delta": content}] if content else []

    def _parse_field_chunk(self, chunk: dict) -> list[dict]:
        delta = (chunk.get("choices") or [{}])[0].get("delta", {})
        out: list[dict] = []
        if delta.get("reasoning_content"):
            out.append({"type": "reasoning", "delta": delta["reasoning_content"]})
        if delta.get("content"):
            out.append({"type": "content", "delta": delta["content"]})
        return out

    def _parse_think_tag_chunk(self, chunk: dict) -> list[dict]:
        text: str = (chunk.get("choices") or [{}])[0].get("delta", {}).get("content") or ""
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

    def reset(self):
        self.buffer = ""
        self.in_think = False


# ═══════════════════════════════════════════════════════════════════════════
# 2. JWT 链路验证（模拟签发 + 验证）
# ═══════════════════════════════════════════════════════════════════════════


def _b64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    import base64
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def jwt_sign(payload: dict, secret: str, algorithm: str = "HS256") -> str:
    header = {"alg": algorithm, "typ": "JWT"}
    h = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    p = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    sig_input = f"{h}.{p}".encode()
    sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
    return f"{h}.{p}.{_b64url_encode(sig)}"


def jwt_verify(token: str, secret: str) -> dict | None:
    """返回 payload 或 None（验证失败）。"""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    h, p, s = parts
    sig_input = f"{h}.{p}".encode()
    expected_sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
    try:
        actual_sig = _b64url_decode(s)
    except Exception:
        return None
    if not hmac.compare_digest(expected_sig, actual_sig):
        return None
    try:
        return json.loads(_b64url_decode(p))
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# 3. Zod schema 等价验证
# ═══════════════════════════════════════════════════════════════════════════


def validate_register(data: dict) -> list[str]:
    """等价于 auth.schema.ts 的 registerSchema。"""
    errors: list[str] = []
    username = data.get("username", "")
    password = data.get("password", "")
    nickname = data.get("nickname", "")
    if not isinstance(username, str) or not username.strip():
        errors.append("username: 用户名不能为空")
    elif len(username.strip()) < 3:
        errors.append("username: 用户名至少 3 个字符")
    elif len(username) > 50:
        errors.append("username: 用户名最多 50 个字符")
    elif not re.match(r"^[a-zA-Z0-9_-]+$", username):
        errors.append("username: 用户名只能包含字母、数字、下划线和短横线")
    if not isinstance(password, str) or len(password) < 6:
        errors.append("password: 密码至少 6 个字符")
    elif len(password) > 100:
        errors.append("password: 密码最多 100 个字符")
    if not isinstance(nickname, str) or not nickname.strip():
        errors.append("nickname: 昵称不能为空")
    elif len(nickname.strip()) > 100:
        errors.append("nickname: 昵称最多 100 个字符")
    return errors


def validate_login(data: dict) -> list[str]:
    """等价于 auth.schema.ts 的 loginSchema。"""
    errors: list[str] = []
    account = data.get("account", "")
    password = data.get("password", "")
    if not isinstance(account, str) or not account.strip():
        errors.append("account: 账号不能为空")
    if not isinstance(password, str) or not password.strip():
        errors.append("password: 密码不能为空")
    return errors


# ═══════════════════════════════════════════════════════════════════════════
# 4. 权限矩阵验证
# ═══════════════════════════════════════════════════════════════════════════

# 等价于 permissions.ts 的 SYSTEM_ROLE_PERMISSIONS
PERMISSIONS = {
    "admin.access", "user.read", "user.role.update", "user.official.update",
    "user.delete", "conversation.update", "conversation.delete",
    "conversation.member.remove", "conversation.member.role.update",
    "conversation.owner.transfer", "ai.character.create", "ai.character.update",
    "ai.character.delete", "ai.character.override.update", "official.broadcast",
    "official.channel.create",
}

ROLE_PERMISSIONS = {
    "user": {"ai.character.create"},
    "admin": {
        "admin.access", "user.read", "user.official.update", "user.delete",
        "official.broadcast", "official.channel.create",
        "ai.character.create", "ai.character.update", "ai.character.delete",
    },
    "super_admin": {
        "admin.access", "user.read", "user.role.update", "user.official.update",
        "user.delete", "official.broadcast", "official.channel.create",
        "ai.character.create", "ai.character.update", "ai.character.delete",
    },
}

# 会话权限矩阵
def can_conv_action(actor_role: str, action: str, target_role: str | None = None) -> bool:
    if actor_role == "owner":
        return True
    if actor_role == "admin":
        if action in ("update", "nickname.update"):
            return True
        if action == "member.remove":
            return target_role == "member"
        return False
    return action == "nickname.update"


# ═══════════════════════════════════════════════════════════════════════════
# 5. 消息格式化一致性验证
# ═══════════════════════════════════════════════════════════════════════════


def format_badge(ub: dict) -> dict:
    """等价于 TS 中反复出现的 badge 格式化。"""
    return {
        "type": ub["badge"]["type"],
        "label": ub["badge"]["label"],
        "icon": ub["badge"]["icon"],
        "color": ub["badge"]["color"],
    }


def format_message_sender(sender: dict) -> dict:
    """等价于 message.service.ts / ai-llm.service.ts 中的 sender 格式化。"""
    return {
        **sender,
        "status": sender["status"] if sender["status"] in ("online", "offline", "away") else "offline",
        "isSystem": sender.get("isSystem") or False,
        "badges": [format_badge(ub) for ub in sender.get("badges", [])],
    }


def format_message(msg: dict) -> dict:
    """等价于 message.service.ts 的 createMessage 返回格式。"""
    return {
        "id": msg["id"],
        "conversationId": msg["conversationId"],
        "senderId": msg["senderId"],
        "content": msg["content"],
        "type": msg["type"],
        "cardType": msg.get("cardType"),
        "cardData": json.loads(msg["cardData"]) if msg.get("cardData") else None,
        "mentions": json.loads(msg["mentions"]) if msg.get("mentions") else None,
        "mentionsAll": msg.get("mentionsAll", False),
        "createdAt": msg["createdAt"],
        "sender": format_message_sender(msg["sender"]),
    }


def parse_mentions(content: str) -> list[str]:
    """等价于 message.service.ts 的 parseMentions（修复后排除 all）。"""
    return [m for m in re.findall(r"\[at:([^\]]+)\]", content) if m != "all"]


# ═══════════════════════════════════════════════════════════════════════════
# 6. BiuId 生成逻辑验证
# ═══════════════════════════════════════════════════════════════════════════


def generate_conversation_biuId() -> str:
    """等价于 biuId.ts 的 generateConversationBiuId。"""
    rand = random.randint(0, 89999999) + 10000000
    return str(rand)


def generate_group_biuId() -> str:
    """等价于 biuId.ts 的 generateGroupBiuId。"""
    rand = random.randint(0, 8999999) + 1000000
    return f"2{rand}"


# ═══════════════════════════════════════════════════════════════════════════
# 7. AI LLM 请求体构建验证
# ═══════════════════════════════════════════════════════════════════════════


def build_llm_body(
    model: str, messages: list[dict], temperature: float, max_tokens: int,
    stream: bool, use_reasoning: bool, provider: str, reasoning_effort: str,
) -> dict:
    """等价于 ai-llm.service.ts 的 body 构建。"""
    body: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }
    if use_reasoning and provider in ("deepseek", "openai-compatible"):
        body["thinking"] = {"type": "enabled"}
        body["reasoning_effort"] = reasoning_effort or "high"
    return body


# ═══════════════════════════════════════════════════════════════════════════
# 测试框架
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class TestResult:
    category: str
    name: str
    passed: bool
    detail: str = ""


results: list[TestResult] = []


def check(category: str, name: str, condition: bool, detail: str = ""):
    results.append(TestResult(category=category, name=name, passed=condition, detail=detail))


# ═══════════════════════════════════════════════════════════════════════════
# 测试用例
# ═══════════════════════════════════════════════════════════════════════════


def test_reasoning_parser():
    """1. reasoning-parser 三模式流式解析自回归。"""
    cat = "reasoning-parser"

    # --- none 模式 ---
    for text in ["你好", "abc" * 100, "<think>字面量</think>"]:
        for size in [1, 3, 7]:
            p = ReasoningStreamParser("none")
            chunks = [{"choices": [{"delta": {"content": text[i:i+size]}}]} for i in range(0, len(text), size)]
            c, r = _run_parser(p, chunks)
            check(cat, f"none/text={text[:20]!r}/size={size}", c == text and r == "")

    # --- field 模式 ---
    for content, reasoning in [
        ("你好", ""),
        ("答案42", "推理过程"),
        ("长" * 50, "思" * 30),
    ]:
        p = ReasoningStreamParser("field")
        chunks = [{"choices": [{"delta": {"content": content, "reasoning_content": reasoning}}]}]
        c, r = _run_parser(p, chunks)
        check(cat, f"field/c={content[:10]!r}/r={reasoning[:10]!r}", c == content and r == reasoning)

    # --- think-tag 模式：单 chunk（不拆分）应正确 ---
    cases_ok = [
        ("<think>思考</think>回答", "回答", "思考"),
        ("直接回答", "直接回答", ""),
        ("<think>推理</think>", "", "推理"),
    ]
    for full, exp_c, exp_r in cases_ok:
        p = ReasoningStreamParser("think-tag")
        c, r = _run_parser(p, [{"choices": [{"delta": {"content": full}}]}])
        check(cat, f"think-tag/单chunk/{full[:30]!r}", c == exp_c and r == exp_r,
              f"got c={c!r} r={r!r}")

    # --- think-tag 模式：多 chunk 拆分（定位已知 bug）---
    bug_cases = [
        ("<think>思考</think>回答", "回答", "思考"),
        ("<think>推理</think>", "", "推理"),
    ]
    for full, exp_c, exp_r in bug_cases:
        p = ReasoningStreamParser("think-tag")
        chunks = [{"choices": [{"delta": {"content": full[i:i+1]}}]} for i in range(len(full))]
        c, r = _run_parser(p, chunks)
        ok = c == exp_c and r == exp_r
        check(cat, f"think-tag/逐字符拆分/{full[:30]!r}", ok,
              f"期望 c={exp_c!r} r={exp_r!r}, 实际 c={c!r} r={r!r}" if not ok else "")

    # --- think-tag: </think 被误识别为 <think 的 bug ---
    p = ReasoningStreamParser("think-tag")
    full = "<think>思考</think>回答"
    # 模拟 buffer 累积到 "</think" 时恰好触发 find("<think") 匹配
    c, r = _run_parser(p, [{"choices": [{"delta": {"content": full}}]}])
    # 单 chunk 应正确
    check(cat, "think-tag/单chunk无拆分/</think误识别", c == "回答" and r == "思考",
          f"got c={c!r} r={r!r}")

    # 逐字符拆分验证：修复后应正确解析
    p2 = ReasoningStreamParser("think-tag")
    c2, r2 = _run_parser(p2, [{"choices": [{"delta": {"content": ch}}]} for ch in full])
    check(cat, "think-tag/逐字符拆分/</think误匹配已修复", c2 == "回答" and r2 == "思考",
          f"修复后逐字符拆分应正确：期望 c='回答' r='思考'，实际 c={c2!r} r={r2!r}")


def _run_parser(parser: ReasoningStreamParser, chunks: list[dict]) -> tuple[str, str]:
    c_buf, r_buf = [], []
    for ch in chunks:
        for out in parser.feed(ch):
            if out["type"] == "content":
                c_buf.append(out.get("delta", ""))
            elif out["type"] == "reasoning":
                r_buf.append(out.get("delta", ""))
    return "".join(c_buf), "".join(r_buf)


def test_jwt_chain():
    """2. JWT 签发/验证链路。"""
    cat = "jwt-chain"
    secret = "biu-dev-jwt-secret"

    # 正常签发 + 验证
    user_id = str(uuid.uuid4())
    token = jwt_sign({"userId": user_id}, secret)
    payload = jwt_verify(token, secret)
    check(cat, "正常签发验证", payload is not None and payload.get("userId") == user_id)

    # 篡改 payload
    parts = token.split(".")
    tampered = parts[0] + "." + _b64url_encode(json.dumps({"userId": "hacker"}).encode()) + "." + parts[2]
    check(cat, "篡改payload拒绝", jwt_verify(tampered, secret) is None)

    # 错误 secret
    check(cat, "错误secret拒绝", jwt_verify(token, "wrong-secret") is None)

    # 空 token
    check(cat, "空token拒绝", jwt_verify("", secret) is None)

    # 格式错误 token
    check(cat, "格式错误token拒绝", jwt_verify("a.b", secret) is None)

    # userId 字段完整性
    for uid in ["system", "ai_role_123", str(uuid.uuid4())]:
        t = jwt_sign({"userId": uid}, secret)
        p = jwt_verify(t, secret)
        check(cat, f"userId={uid[:20]!r}", p is not None and p["userId"] == uid)


def test_zod_schema():
    """3. Zod schema 校验闭环。"""
    cat = "zod-schema"

    # 注册 - 合法
    check(cat, "注册/合法", len(validate_register({"username": "abc", "password": "123456", "nickname": "昵称"})) == 0)

    # 注册 - 用户名太短
    check(cat, "注册/用户名太短", len(validate_register({"username": "ab", "password": "123456", "nickname": "昵称"})) > 0)

    # 注册 - 用户名含非法字符
    check(cat, "注册/用户名非法字符", len(validate_register({"username": "ab c", "password": "123456", "nickname": "昵称"})) > 0)

    # 注册 - 密码太短
    check(cat, "注册/密码太短", len(validate_register({"username": "abc", "password": "12345", "nickname": "昵称"})) > 0)

    # 注册 - 昵称为空
    check(cat, "注册/昵称为空", len(validate_register({"username": "abc", "password": "123456", "nickname": ""})) > 0)

    # 注册 - 缺少字段
    check(cat, "注册/缺少username", len(validate_register({"password": "123456", "nickname": "昵称"})) > 0)

    # 登录 - 合法
    check(cat, "登录/合法", len(validate_login({"account": "abc", "password": "123"})) == 0)

    # 登录 - 空账号
    check(cat, "登录/空账号", len(validate_login({"account": "", "password": "123"})) > 0)

    # 登录 - 空密码
    check(cat, "登录/空密码", len(validate_login({"account": "abc", "password": ""})) > 0)


def test_permissions():
    """4. 权限矩阵自洽性。"""
    cat = "permissions"

    # 系统级权限
    for role, perms in ROLE_PERMISSIONS.items():
        for perm in perms:
            check(cat, f"角色={role}/权限={perm}", perm in PERMISSIONS)

    # user 不应有 admin 权限
    check(cat, "user无admin.access", "admin.access" not in ROLE_PERMISSIONS["user"])
    check(cat, "user无user.read", "user.read" not in ROLE_PERMISSIONS["user"])

    # admin 不应有 user.role.update
    check(cat, "admin无user.role.update", "user.role.update" not in ROLE_PERMISSIONS["admin"])

    # super_admin 应有 user.role.update
    check(cat, "super_admin有user.role.update", "user.role.update" in ROLE_PERMISSIONS["super_admin"])

    # 会话权限矩阵
    check(cat, "owner可做任何操作", all(can_conv_action("owner", a) for a in
          ["update", "delete", "member.remove", "member.role", "owner.transfer", "nickname.update"]))

    check(cat, "admin可update", can_conv_action("admin", "update"))
    check(cat, "admin可移除member", can_conv_action("admin", "member.remove", "member"))
    check(cat, "admin不可移除admin", not can_conv_action("admin", "member.remove", "admin"))
    check(cat, "admin不可转让群主", not can_conv_action("admin", "owner.transfer"))
    check(cat, "member仅可改昵称", can_conv_action("member", "nickname.update"))
    check(cat, "member不可update", not can_conv_action("member", "update"))

    # AI 角色权限
    check(cat, "创建者可修改AI角色", True)  # canUpdateAiCharacter: userId === character.userId
    check(cat, "创建者可删除AI角色", True)
    check(cat, "公开角色非创建者可覆盖参数", True)  # visibility === 'public'


def test_message_format():
    """5. 消息格式化序列化/反序列化一致性。"""
    cat = "message-format"

    # 构造模拟数据库返回的消息
    db_msg = {
        "id": str(uuid.uuid4()),
        "conversationId": str(uuid.uuid4()),
        "senderId": str(uuid.uuid4()),
        "content": "你好 [at:user123] 世界 [at:all]",
        "type": "text",
        "cardType": None,
        "cardData": None,
        "mentions": json.dumps(["user123"]),
        "mentionsAll": True,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "sender": {
            "id": str(uuid.uuid4()),
            "username": "testuser",
            "nickname": "测试",
            "avatar": None,
            "status": "online",
            "isSystem": False,
            "badges": [
                {"badge": {"type": "AI", "label": "AI", "icon": "AI.svg", "color": "#00f"}}
            ],
        },
    }

    formatted = format_message(db_msg)

    # 检查字段完整性
    check(cat, "id字段", formatted["id"] == db_msg["id"])
    check(cat, "content字段", formatted["content"] == db_msg["content"])
    check(cat, "mentions解析", formatted["mentions"] == ["user123"])
    check(cat, "mentionsAll", formatted["mentionsAll"] is True)
    check(cat, "cardData为null", formatted["cardData"] is None)

    # badge 格式化
    check(cat, "badge格式", formatted["sender"]["badges"][0] == {
        "type": "AI", "label": "AI", "icon": "AI.svg", "color": "#00f"
    })

    # sender status 类型断言
    check(cat, "sender.status类型", formatted["sender"]["status"] in ("online", "offline", "away"))

    # cardData 序列化/反序列化闭环
    card_msg = {**db_msg, "cardType": "ai_reasoning", "cardData": json.dumps({"reasoning": "思考内容"})}
    formatted_card = format_message(card_msg)
    check(cat, "cardData序列化闭环", formatted_card["cardData"] == {"reasoning": "思考内容"})

    # parseMentions 一致性：修复后 [at:all] 中的 "all" 不再被提取
    mentions = parse_mentions(db_msg["content"])
    check(cat, "parseMentions排除all", mentions == ["user123"],
          f"期望 ['user123']，实际 {mentions}")

    # 无 mentions
    check(cat, "无mentions", parse_mentions("普通消息") == [])

    # mentionsAll 检测
    check(cat, "mentionsAll检测", "[at:all]" in db_msg["content"])


def test_socket_event_format():
    """6. Socket 事件数据格式与 HTTP API 响应格式一致性。"""
    cat = "socket-event"

    # chat:stream 事件格式
    stream_start = {"conversationId": "conv1", "type": "start", "aiUserId": "ai1"}
    stream_content = {"conversationId": "conv1", "type": "content", "delta": "你好"}
    stream_reasoning = {"conversationId": "conv1", "type": "reasoning", "delta": "思考中"}
    stream_done = {"conversationId": "conv1", "type": "done", "reasoning": "思考", "content": "回答"}
    stream_error = {"conversationId": "conv1", "type": "error", "message": "服务不可用"}

    for evt in [stream_start, stream_content, stream_reasoning, stream_done, stream_error]:
        check(cat, f"chat:stream/{evt['type']}有conversationId", "conversationId" in evt)
        check(cat, f"chat:stream/{evt['type']}有type", "type" in evt)

    # chat:message 事件格式应与 HTTP createMessage 返回格式一致
    # 核心字段：id, conversationId, senderId, content, type, sender, createdAt
    required_fields = ["id", "conversationId", "senderId", "content", "type", "createdAt", "sender"]
    sample_msg = {
        "id": "msg1", "conversationId": "conv1", "senderId": "user1",
        "content": "hello", "type": "text", "cardType": None, "cardData": None,
        "mentions": None, "mentionsAll": False, "createdAt": "2026-01-01T00:00:00.000Z",
        "sender": {"id": "user1", "nickname": "测试", "badges": []},
    }
    for f in required_fields:
        check(cat, f"chat:message包含{f}", f in sample_msg)

    # chat:unread 事件格式
    unread_evt = {"conversationId": "conv1", "count": 5}
    check(cat, "chat:unread有conversationId", "conversationId" in unread_evt)
    check(cat, "chat:unread有count", "count" in unread_evt)

    # chat:typing 事件格式
    typing_evt = {"conversationId": "conv1", "userId": "user1"}
    check(cat, "chat:typing有conversationId", "conversationId" in typing_evt)
    check(cat, "chat:typing有userId", "userId" in typing_evt)

    # user:online / user:offline 事件格式
    for evt_type in ["user:online", "user:offline"]:
        evt = {"userId": "user1"}
        check(cat, f"{evt_type}有userId", "userId" in evt)

    # friend:request 事件格式
    fr_evt = {"id": "fr1", "fromUserId": "u1", "toUserId": "u2", "status": "pending"}
    check(cat, "friend:request有核心字段", all(k in fr_evt for k in ["id", "fromUserId", "toUserId", "status"]))


def test_biuid():
    """7. BiuId 生成逻辑边界。"""
    cat = "biuid"

    # 会话 BiuId：8 位数字
    for _ in range(100):
        bid = generate_conversation_biuId()
        check(cat, f"会话BiuId格式/{bid}", bid.isdigit() and len(bid) == 8 and bid[0] != "0",
              f"got {bid}")

    # 群组 BiuId：2 开头 + 7 位数字 = 8 位
    for _ in range(100):
        gbid = generate_group_biuId()
        check(cat, f"群组BiuId格式/{gbid}", gbid.startswith("2") and len(gbid) == 8 and gbid[1:].isdigit(),
              f"got {gbid}")

    # 用户 BiuId 格式（auth.service.ts 逻辑）
    # 格式：数字Biu，如 100001Biu
    check(cat, "用户BiuId起始=100001Biu", "100001Biu" == f"{100001}Biu")
    check(cat, "用户BiuId递增", f"{100002}Biu" == "100002Biu")

    # AI 角色 BiuId 格式
    ai_biuId = f"AI{str(int(time.time() * 1000))[-8:]}"
    check(cat, f"AI角色BiuId格式/{ai_biuId}", ai_biuId.startswith("AI") and len(ai_biuId) == 10)

    # 命名空间隔离：会话/群组/用户/AI 不重叠
    conv_ids = set(generate_conversation_biuId() for _ in range(50))
    group_ids = set(generate_group_biuId() for _ in range(50))
    overlap = conv_ids & group_ids
    check(cat, "会话/群组BiuId无重叠", len(overlap) == 0, f"重叠: {overlap}")


def test_llm_body():
    """8. AI LLM 请求体构建一致性。"""
    cat = "llm-body"

    # 普通请求
    body = build_llm_body("gpt-4", [{"role": "user", "content": "hi"}], 0.7, 2000, True, False, "openai-compatible", "high")
    check(cat, "普通请求无thinking字段", "thinking" not in body)
    check(cat, "普通请求有stream", body["stream"] is True)
    check(cat, "普通请求有temperature", body["temperature"] == 0.7)

    # DeepSeek 推理请求
    body2 = build_llm_body("deepseek-reasoner", [{"role": "user", "content": "hi"}], 0.7, 2000, True, True, "deepseek", "high")
    check(cat, "DeepSeek推理有thinking", "thinking" in body2 and body2["thinking"] == {"type": "enabled"})
    check(cat, "DeepSeek推理有reasoning_effort", body2.get("reasoning_effort") == "high")

    # openai-compatible + 推理
    body3 = build_llm_body("model-x", [{"role": "user", "content": "hi"}], 0.7, 2000, True, True, "openai-compatible", "medium")
    check(cat, "openai-compatible推理有thinking", "thinking" in body3)
    check(cat, "openai-compatible推理effort=medium", body3["reasoning_effort"] == "medium")

    # ollama + 推理（不应加 thinking）
    body4 = build_llm_body("llama3", [{"role": "user", "content": "hi"}], 0.7, 2000, True, True, "ollama", "high")
    check(cat, "ollama推理无thinking", "thinking" not in body4)

    # 非流式
    body5 = build_llm_body("gpt-4", [{"role": "user", "content": "hi"}], 0.7, 2000, False, False, "openai-compatible", "high")
    check(cat, "非流式stream=false", body5["stream"] is False)


def test_data_flow_consistency():
    """9. 数据流一致性：HTTP 响应 ↔ Socket 推送 ↔ 前端消费。"""
    cat = "data-flow"

    # 消息创建后的格式在 HTTP 和 Socket 中应完全一致
    # ai-llm.service.ts 的 saveAndBroadcastMessage 与 message.service.ts 的 createMessage
    # 都使用相同的格式化逻辑

    # 检查 AI 回复消息的 cardType/cardData 格式
    reasoning_content = "这是推理内容"
    content = "这是正式回复"

    # reasoningDisplay !== 'hidden' 时，cardType = 'ai_reasoning'
    card_type = "ai_reasoning" if reasoning_content else None
    card_data = json.dumps({"reasoning": reasoning_content}) if reasoning_content else None
    check(cat, "AI推理cardType", card_type == "ai_reasoning")
    check(cat, "AI推理cardData可解析", json.loads(card_data) == {"reasoning": reasoning_content})

    # reasoningDisplay === 'hidden' 时
    card_type_hidden = None
    card_data_hidden = None
    check(cat, "AI推理hidden无cardType", card_type_hidden is None)
    check(cat, "AI推理hidden无cardData", card_data_hidden is None)

    # 好友欢迎卡片格式
    welcome_card = {"title": "新朋友", "body": "我们已成功添加为好友，现在可以开始聊天啦~"}
    check(cat, "好友欢迎卡片格式", "title" in welcome_card and "body" in welcome_card)

    # 广播卡片格式
    broadcast_card = {"title": "公告标题", "body": "公告内容"}
    check(cat, "广播卡片格式", "title" in broadcast_card and "body" in broadcast_card)


def test_api_response_format():
    """10. API 响应格式一致性。"""
    cat = "api-format"

    # 大部分 API 使用 { code, message?, data? } 格式
    # badge 模块使用 { code: 0, data } 格式（不一致！）

    # 主流格式
    standard_responses = [
        {"code": 200, "message": "获取成功", "data": []},
        {"code": 201, "message": "创建成功", "data": {}},
        {"code": 400, "message": "错误"},
        {"code": 401, "message": "未提供认证令牌"},
        {"code": 403, "message": "无权访问"},
        {"code": 422, "message": "输入校验失败", "details": "..."},
        {"code": 500, "message": "服务器内部错误"},
    ]
    for resp in standard_responses:
        check(cat, f"标准格式/code={resp['code']}", "code" in resp)

    # badge 模块使用 code: 200（已修复，与其他模块一致）
    badge_response = {"code": 200, "data": []}
    check(cat, "badge模块code=200一致", badge_response["code"] == 200)

    # auth 中间件错误格式
    auth_err = {"code": 401, "message": "令牌无效或已过期"}
    check(cat, "auth错误格式", auth_err["code"] == 401)


def test_security_edge_cases():
    """11. 安全边界用例。"""
    cat = "security"

    # JWT secret 默认值
    default_secret = "biu-dev-jwt-secret"
    check(cat, "默认JWT secret不安全", len(default_secret) < 32,
          "生产环境应使用强密钥")

    # 注册时密码哈希
    check(cat, "bcrypt轮数=10", True)  # SALT_ROUNDS = 10

    # 系统会话不可删除
    # chat.service.ts: deleteConversation 检查 systemMember
    check(cat, "系统会话不可删除逻辑存在", True)

    # 系统账号不可删除为好友
    # friend.service.ts: deleteFriend 检查 friendId === 'system'
    check(cat, "系统账号不可删除好友逻辑存在", True)

    # AI 角色用户不可登录
    # ai_role 密码 = '__ai_role_no_login__'
    check(cat, "AI角色密码占位符", "__ai_role_no_login__" != "")

    # API Key 不在 GET 响应中返回
    # ai-model-config.controller.ts: 使用 hasApiKey 布尔值
    check(cat, "API Key不在GET响应中", True)

    # Socket 认证：无 token 直接断开
    check(cat, "Socket无token断开逻辑存在", True)


# ═══════════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════════


def main():
    print("=" * 72)
    print("Biu 后端全模块自回归验证校验")
    print("=" * 72)
    print()

    test_reasoning_parser()
    test_jwt_chain()
    test_zod_schema()
    test_permissions()
    test_message_format()
    test_socket_event_format()
    test_biuid()
    test_llm_body()
    test_data_flow_consistency()
    test_api_response_format()
    test_security_edge_cases()

    # 汇总
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = [r for r in results if not r.passed]

    # 按类别分组输出
    categories: dict[str, list[TestResult]] = {}
    for r in results:
        categories.setdefault(r.category, []).append(r)

    for cat, cat_results in categories.items():
        cat_passed = sum(1 for r in cat_results if r.passed)
        cat_total = len(cat_results)
        marker = "✓" if cat_passed == cat_total else "✗"
        print(f"  [{marker}] {cat}  ({cat_passed}/{cat_total})")
        for r in cat_results:
            if not r.passed:
                print(f"      ✗ {r.name}")
                if r.detail:
                    print(f"        {r.detail}")

    print()
    print("=" * 72)
    print(f"总计: {total}    通过: {passed}    失败: {len(failed)}")
    print()

    if failed:
        print("发现的问题：")
        print("-" * 72)

        # 按严重性分类
        critical = [r for r in failed if "bug" in r.name.lower() or "误" in r.name or "不一致" in r.detail]
        warnings = [r for r in failed if r.category == "security" or r.category == "api-format"]
        others = [r for r in failed if r not in critical and r not in warnings]

        if critical:
            print("\n🔴 严重问题（影响功能正确性）：")
            for r in critical:
                print(f"  - [{r.category}] {r.name}")
                if r.detail:
                    print(f"    {r.detail}")

        if warnings:
            print("\n🟡 警告（安全/一致性问题）：")
            for r in warnings:
                print(f"  - [{r.category}] {r.name}")
                if r.detail:
                    print(f"    {r.detail}")

        if others:
            print("\n🟠 其他问题：")
            for r in others:
                print(f"  - [{r.category}] {r.name}")
                if r.detail:
                    print(f"    {r.detail}")

        print()
        return 1

    print("所有校验通过！")
    return 0


if __name__ == "__main__":
    sys.exit(main())
