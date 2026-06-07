/**
 * AI 流式输出解析器
 * 支持两种推理模式：
 * 1. field 模式：DeepSeek R1 等，reasoning_content 和 content 分字段返回
 * 2. think-tag 模式：某些开源推理模型，推理内容用 <think/> 标签包裹在 content 中
 */

export interface AiStreamChunk {
  type: 'reasoning' | 'content' | 'error' | 'done';
  delta?: string;
}

export class ReasoningStreamParser {
  private buffer = '';
  private inThink = false;
  private mode: 'field' | 'think-tag' | 'none';

  constructor(mode: string) {
    this.mode = mode as 'field' | 'think-tag' | 'none';
  }

  feed(chunk: any): AiStreamChunk[] {
    if (this.mode === 'field') {
      return this.parseFieldChunk(chunk);
    } else if (this.mode === 'think-tag') {
      return this.parseThinkTagChunk(chunk);
    }
    // 普通模式：所有内容都是 content
    const content = chunk.choices?.[0]?.delta?.content || '';
    if (!content) return [];
    return [{ type: 'content', delta: content }];
  }

  private parseFieldChunk(chunk: any): AiStreamChunk[] {
    const delta = chunk.choices?.[0]?.delta || {};
    const results: AiStreamChunk[] = [];

    if (delta.reasoning_content) {
      results.push({ type: 'reasoning', delta: delta.reasoning_content });
    }
    if (delta.content) {
      results.push({ type: 'content', delta: delta.content });
    }
    return results;
  }

  private parseThinkTagChunk(chunk: any): AiStreamChunk[] {
    const text: string = chunk.choices?.[0]?.delta?.content || '';
    if (!text) return [];

    this.buffer += text;
    const results: AiStreamChunk[] = [];
    let remaining = this.buffer;
    let pendingBuffer = ''; // 只在遇到不完整前缀时设置

    while (remaining.length > 0) {
      if (!this.inThink) {
        // 查找 <think 标签，但排除 </think（前面不能是 /）
        let startIdx = -1;
        let searchFrom = 0;
        while (searchFrom < remaining.length) {
          const idx = remaining.indexOf('<think', searchFrom);
          if (idx === -1) break;
          // 检查 < 前面是否是 /，如果是则这是 </think，跳过
          if (idx > 0 && remaining[idx - 1] === '/') {
            searchFrom = idx + 1;
            continue;
          }
          startIdx = idx;
          break;
        }

        if (startIdx === -1) {
          // 没有找到完整的 <think 标签
          // 检查末尾是否是 <think 的不完整前缀（如 <, <t, <th, <thi, <thin）
          let prefixLen = 0;
          const prefixes = ['<thin', '<thi', '<th', '<t', '<'];
          for (const prefix of prefixes) {
            if (remaining.endsWith(prefix)) {
              prefixLen = prefix.length;
              break;
            }
          }

          if (prefixLen > 0) {
            const safeLen = remaining.length - prefixLen;
            if (safeLen > 0) {
              results.push({ type: 'content', delta: remaining.substring(0, safeLen) });
            }
            pendingBuffer = remaining.substring(safeLen);
            remaining = '';
          } else {
            results.push({ type: 'content', delta: remaining });
            remaining = '';
          }
        } else {
          // 找到 <think 标签
          if (startIdx > 0) {
            results.push({ type: 'content', delta: remaining.substring(0, startIdx) });
          }
          const tagEnd = remaining.indexOf('>', startIdx);
          if (tagEnd === -1) {
            pendingBuffer = remaining.substring(startIdx);
            remaining = '';
          } else {
            this.inThink = true;
            remaining = remaining.substring(tagEnd + 1);
          }
        }
      } else {
        // 在 <think/> 区域内
        const endIdx = remaining.indexOf('</think');
        if (endIdx === -1) {
          // 没有找到完整的 </think 标签
          // 检查末尾是否是 </think 的不完整前缀
          let prefixLen = 0;
          const prefixes = ['</think', '</thin', '</thi', '</th', '</t', '</', '<'];
          for (const prefix of prefixes) {
            if (remaining.endsWith(prefix)) {
              prefixLen = prefix.length;
              break;
            }
          }

          if (prefixLen > 0) {
            const safeLen = remaining.length - prefixLen;
            if (safeLen > 0) {
              results.push({ type: 'reasoning', delta: remaining.substring(0, safeLen) });
            }
            pendingBuffer = remaining.substring(safeLen);
            remaining = '';
          } else {
            results.push({ type: 'reasoning', delta: remaining });
            remaining = '';
          }
        } else {
          // 找到 </think
          if (endIdx > 0) {
            results.push({ type: 'reasoning', delta: remaining.substring(0, endIdx) });
          }
          const tagEnd = remaining.indexOf('>', endIdx);
          if (tagEnd === -1) {
            pendingBuffer = remaining.substring(endIdx);
            remaining = '';
          } else {
            this.inThink = false;
            remaining = remaining.substring(tagEnd + 1);
          }
        }
      }
    }

    this.buffer = pendingBuffer;
    return results;
  }

  reset() {
    this.buffer = '';
    this.inThink = false;
  }
}
