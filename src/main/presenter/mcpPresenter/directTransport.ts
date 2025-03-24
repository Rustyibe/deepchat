import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { EventEmitter } from 'node:events'

/**
 * DirectTransport的配置选项
 */
export interface DirectTransportOptions {
  /**
   * 处理消息的回调函数
   */
  handleMessage: (message: JSONRPCMessage) => Promise<JSONRPCMessage>

  /**
   * 关闭时的清理回调
   */
  onClose?: () => Promise<void>
}

/**
 * 直接在进程内调用类方法的Transport实现
 *
 * 这个Transport不使用子进程或I/O，而是直接在同一个进程中转发消息到DirectServer
 */
export class DirectTransport implements Transport {
  private _options: DirectTransportOptions
  private _emitter: EventEmitter = new EventEmitter()
  private _isConnected: boolean = false

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  constructor(options: DirectTransportOptions) {
    this._options = options
  }

  /**
   * 启动传输连接
   */
  async start(): Promise<void> {
    if (this._isConnected) {
      throw new Error('DirectTransport已经启动！')
    }

    this._isConnected = true
    this._emitter.on('response', (message: JSONRPCMessage) => {
      this.onmessage?.(message)
    })

    return Promise.resolve()
  }

  /**
   * 关闭传输连接
   */
  async close(): Promise<void> {
    if (!this._isConnected) {
      return
    }

    this._isConnected = false
    this._emitter.removeAllListeners()

    if (this._options.onClose) {
      await this._options.onClose()
    }

    this.onclose?.()
  }

  /**
   * 发送JSON-RPC消息
   * @param message 要发送的JSON-RPC消息
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._isConnected) {
      throw new Error('未连接')
    }

    try {
      // 直接调用处理器处理消息
      const response = await this._options.handleMessage(message)

      // 将响应通过事件发送回客户端
      this._emitter.emit('response', response)
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)))
    }
  }
}
