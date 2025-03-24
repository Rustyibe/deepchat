import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { DirectTransport, DirectTransportOptions } from './directTransport'
import { EventEmitter } from 'node:events'
import { presenter } from '@/presenter'

/**
 * DirectServer的配置选项
 */
export interface DirectServerOptions {
  /**
   * 服务器信息
   */
  info: {
    name: string
    version: string
  }

  /**
   * 可选的初始化时注册的工具
   */
  tools?: Array<{
    name: string
    description: string
    handler: (args: Record<string, unknown>) => Promise<unknown>
    inputSchema: Record<string, unknown>
  }>
}

// 消息处理函数类型
type MessageHandler = (message: JSONRPCMessage) => Promise<JSONRPCMessage>

/**
 * 直接服务器实现
 *
 * 继承自MCP SDK的Server类，但无需子进程，直接在同一进程中处理请求
 */
export class DirectServer extends Server {
  private _emitter: EventEmitter = new EventEmitter()
  private _toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> =
    new Map()
  private _tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
  }> = []
  private _messageHandlers: Map<string, MessageHandler> = new Map()

  /**
   * 构造函数
   * @param options 服务器选项
   */
  constructor(options: DirectServerOptions) {
    // 调用父类构造函数，传入服务器信息和能力
    super(options.info, {
      capabilities: {
        tools: {}
      }
    })

    // 自定义工具调用处理
    this._registerCallToolHandler()

    // 自定义工具列表处理
    this._registerListToolsHandler()

    // 初始化注册工具
    if (options.tools && options.tools.length > 0) {
      options.tools.forEach((tool) => {
        this.registerTool(tool.name, tool.description, tool.handler, tool.inputSchema)
      })
    }

    // 注册内置工具
    this.registerBuiltinTools()
  }

  /**
   * 注册工具调用处理器
   */
  private _registerCallToolHandler(): void {
    // 这里我们不使用Server的setRequestHandler方法，而是自己管理处理器
    this._messageHandlers.set('call_tool', async (message: JSONRPCMessage) => {
      if (!('method' in message) || !('params' in message)) {
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'null',
          error: {
            code: -32600,
            message: '无效的请求'
          }
        } as JSONRPCMessage
      }

      try {
        const params = message.params || {}
        const name = params.name as string
        const args = (params.arguments as Record<string, unknown>) || {}

        // 获取对应的工具处理器
        const handler = this._toolHandlers.get(name)
        if (!handler) {
          throw new Error(`工具不存在: ${name}`)
        }

        // 调用工具处理器
        const result = await handler(args)

        // 处理返回结果
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'call_tool',
          result: {
            content: Array.isArray(result)
              ? result
              : [{ type: 'text', text: JSON.stringify(result) }]
          }
        } as JSONRPCMessage
      } catch (error) {
        console.error('工具调用失败:', error)
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'error',
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error)
          }
        } as JSONRPCMessage
      }
    })
  }

  /**
   * 注册工具列表处理器
   */
  private _registerListToolsHandler(): void {
    this._messageHandlers.set('list_tools', async (message: JSONRPCMessage) => {
      if (!('method' in message)) {
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'null',
          error: {
            code: -32600,
            message: '无效的请求'
          }
        } as JSONRPCMessage
      }

      try {
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'list_tools',
          result: {
            tools: Array.from(this._toolHandlers.keys()).map((name) => {
              const tool = this._tools.find((t) => t.name === name)
              return {
                name,
                description: tool?.description || `工具 ${name}`,
                inputSchema: tool?.inputSchema || { type: 'object', properties: {}, required: [] }
              }
            })
          }
        } as JSONRPCMessage
      } catch (error) {
        console.error('获取工具列表失败:', error)
        return {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : 'error',
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error)
          }
        } as JSONRPCMessage
      }
    })
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    // 1. 计算加法工具
    this.registerTool(
      'sum',
      '计算一组数字的总和',
      async (args) => {
        const numbers = args.numbers
        if (!Array.isArray(numbers)) {
          throw new Error('参数必须是一个数字数组')
        }

        const sum = numbers.reduce((acc, curr) => {
          const num = Number(curr)
          if (isNaN(num)) {
            throw new Error(`数组中包含非数字值: ${curr}`)
          }
          return acc + num
        }, 0)

        return { sum }
      },
      {
        type: 'object',
        properties: {
          numbers: {
            type: 'array',
            items: {
              type: 'number'
            },
            description: '要计算总和的数字数组'
          }
        },
        required: ['numbers']
      }
    )

    // 2. 获取项目中的Presenter工具
    this.registerTool(
      'listPresenters',
      '获取当前项目中所有可用的Presenter',
      async () => {
        // 获取全局presenter对象的所有属性名
        const presenterKeys = Object.keys(presenter)

        // 过滤掉私有属性和非Presenter属性
        const presenters = presenterKeys
          .filter((key) => !key.startsWith('_') && typeof presenter[key] === 'object')
          .map((key) => {
            const p = presenter[key]
            return {
              name: key,
              type: p?.constructor?.name || typeof p,
              methodCount: p ? Object.getOwnPropertyNames(Object.getPrototypeOf(p)).length : 0
            }
          })

        return { presenters }
      },
      {
        type: 'object',
        properties: {},
        required: []
      }
    )
  }

  /**
   * 处理JSON-RPC请求
   * @param message JSON-RPC请求消息
   * @returns JSON-RPC响应消息
   */
  async handleRequest(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!('method' in message)) {
      return {
        jsonrpc: '2.0',
        id: 'id' in message ? message.id : 'error',
        error: {
          code: -32600,
          message: '无效的请求：缺少method'
        }
      } as JSONRPCMessage
    }

    const { method } = message
    const handler = this._messageHandlers.get(method)

    if (handler) {
      return await handler(message)
    }

    // 没有找到处理器，返回方法不存在错误
    return {
      jsonrpc: '2.0',
      id: 'id' in message ? message.id : 'error',
      error: {
        code: -32601,
        message: `方法不存在: ${method}`
      }
    } as JSONRPCMessage
  }

  /**
   * 注册工具
   * @param name 工具名称
   * @param description 工具描述
   * @param handler 工具处理函数
   * @param inputSchema 输入模式
   */
  registerTool(
    name: string,
    description: string,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
    inputSchema: Record<string, unknown>
  ): void {
    // 注册工具处理器
    this._toolHandlers.set(name, handler)

    // 存储工具信息
    this._tools.push({
      name,
      description,
      inputSchema
    })
  }

  /**
   * 获取工具列表
   */
  get tools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return this._tools
  }

  /**
   * 创建与此服务器直接通信的传输
   * @returns DirectTransport实例
   */
  createDirectTransport(): DirectTransport {
    const transportOptions: DirectTransportOptions = {
      handleMessage: async (message) => {
        // 将消息发送给服务器处理
        return await this.handleRequest(message)
      },
      onClose: async () => {
        // 清理资源
        this._emitter.removeAllListeners()
      }
    }

    return new DirectTransport(transportOptions)
  }
}
