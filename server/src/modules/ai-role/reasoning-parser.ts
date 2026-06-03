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

    while (remaining.length > 0) {
      if (!this.inThink) {
        const startIdx = remaining.indexOf('<think');
        if (startIdx === -1) {
          // 没有 <think 标签，当作正式回复
          results.push({ type: 'content', delta: remaining });
          remaining = '';
        } else {
          // 找到 <think 标签
          if (startIdx > 0) {
            // <think 之前的内容是正式回复
            results.push({ type: 'content', delta: remaining.substring(0, startIdx) });
          }
          // 跳过 <think...> 标签（可能带属性如 <think depth="1">）
          const tagEnd = remaining.indexOf('>', startIdx);
          if (tagEnd === -1) {
            // 标签不完整，保留在缓冲区
            this.buffer = remaining.substring(startIdx);
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
          // 还没遇到 </think，整段都是推理内容
          results.push({ type: 'reasoning', delta: remaining });
          remaining = '';
        } else {
          // 找到 </think
          if (endIdx > 0) {
            results.push({ type: 'reasoning', delta: remaining.substring(0, endIdx) });
          }
          // 跳过 </think...> 标签
          const tagEnd = remaining.indexOf('>', endIdx);
          if (tagEnd === -1) {
            // 标签不完整
            this.buffer = remaining.substring(endIdx);
            remaining = '';
          } else {
            this.inThink = false;
            remaining = remaining.substring(tagEnd + 1);
          }
        }
      }
    }

    // 如果还有未处理的缓冲区内容
    if (remaining.length > 0) {
      this.buffer = remaining;
    } else {
      this.buffer = '';
    }

    return results;
  }

  reset() {
    this.buffer = '';
    this.inThink = false;
  }
}
