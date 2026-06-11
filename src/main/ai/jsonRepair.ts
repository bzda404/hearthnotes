/**
 * 增量 JSON 修复状态机
 * 用于流式接收不完整的 JSON 字符串时，静默补齐缺失的闭合符号
 */
export class IncrementalJsonRepair {
  private chunks: string[] = []
  private stack: Array<{ char: string; type: 'object' | 'array' | 'string' }> = []
  private inString = false
  private escaped = false

  /**
   * 接收新的流式 chunk
   */
  push(chunk: string): void {
    this.chunks.push(chunk)
    // 更新内部状态栈
    for (const char of chunk) {
      if (this.escaped) {
        this.escaped = false
        continue
      }
      if (char === '\\' && this.inString) {
        this.escaped = true
        continue
      }
      if (char === '"') {
        if (this.inString) {
          this.inString = false
          // 如果栈顶是 string，弹出
          if (this.stack.length > 0 && this.stack[this.stack.length - 1].type === 'string') {
            this.stack.pop()
          }
        } else {
          this.inString = true
          this.stack.push({ char: '"', type: 'string' })
        }
        continue
      }
      if (this.inString) continue
      if (char === '{') {
        this.stack.push({ char: '{', type: 'object' })
      } else if (char === '[') {
        this.stack.push({ char: '[', type: 'array' })
      } else if (char === '}') {
        if (this.stack.length > 0 && this.stack[this.stack.length - 1].type === 'object') {
          this.stack.pop()
        }
      } else if (char === ']') {
        if (this.stack.length > 0 && this.stack[this.stack.length - 1].type === 'array') {
          this.stack.pop()
        }
      }
    }
  }

  /**
   * 获取修复后的完整 JSON 字符串
   * 静默补齐所有缺失的闭合符号
   */
  snapshot(): string {
    let result = this.chunks.join('')
    // 如果在字符串中，先闭合字符串
    if (this.inString) {
      result += '"'
    }
    // 从栈顶到底，补齐闭合符号
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const item = this.stack[i]
      if (item.type === 'object') result += '}'
      else if (item.type === 'array') result += ']'
    }
    return result
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.chunks = []
    this.stack = []
    this.inString = false
    this.escaped = false
  }

  /**
   * 尝试解析当前 snapshot 为 JSON
   * 返回 null 表示无法解析
   */
  tryParse<T = unknown>(): T | null {
    try {
      return JSON.parse(this.snapshot()) as T
    } catch {
      return null
    }
  }
}
