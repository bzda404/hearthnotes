/**
 * UDS 客户端 — 通过 Unix Domain Socket 连接 AinCore
 * 替代 HTTP fetch，绕过 TCP/IP 协议栈
 */
import { connect, type Socket } from 'net'
import { platform } from 'os'

const SOCKET_PATH = platform() === 'win32'
  ? '\\\\.\\pipe\\aincore'
  : '/tmp/aincore.sock'

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

export class UDSClient {
  private socket: Socket | null = null
  private buffer = ''
  private pendingCalls = new Map<number | string, PendingCall>()
  private requestId = 0
  private connected = false

  /**
   * 连接到 AinCore UDS 服务器
   */
  async connect(): Promise<boolean> {
    if (this.connected) return true

    return new Promise((resolve) => {
      try {
        this.socket = connect(SOCKET_PATH)

        this.socket.on('connect', () => {
          this.connected = true
          resolve(true)
        })

        this.socket.on('data', (data) => {
          this.buffer += data.toString()
          this.processBuffer()
        })

        this.socket.on('close', () => {
          this.connected = false
          this.socket = null
          // 拒绝所有挂起的调用
          for (const pending of this.pendingCalls.values()) {
            pending.reject(new Error('Connection closed'))
          }
          this.pendingCalls.clear()
        })

        this.socket.on('error', () => {
          this.connected = false
          resolve(false)
        })
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * 发送 JSON-RPC 请求并等待响应
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.connected || !this.socket) {
      const reconnected = await this.connect()
      if (!reconnected) throw new Error('无法连接到 AinCore')
    }

    const id = ++this.requestId
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject })
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.socket!.write(message)
    })
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
      this.connected = false
    }
  }

  private processBuffer(): void {
    const messages = this.buffer.split('\n')
    this.buffer = messages.pop() || ''

    for (const msg of messages) {
      if (!msg.trim()) continue
      try {
        const response = JSON.parse(msg)
        const pending = this.pendingCalls.get(response.id)
        if (pending) {
          this.pendingCalls.delete(response.id)
          if (response.error) {
            pending.reject(new Error(response.error.message))
          } else {
            pending.resolve(response.result)
          }
        }
      } catch {
        // 忽略无法解析的消息
      }
    }
  }
}

// 单例
export const udsClient = new UDSClient()
