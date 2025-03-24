import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { DirectServer } from './directServer'

/**
 * 演示如何使用DirectServer的示例
 */
async function directExample() {
  try {
    console.log('创建DirectServer实例...')
    // 创建DirectServer实例
    const server = new DirectServer({
      info: {
        name: 'direct-server-example',
        version: '1.0.0'
      }
    })

    console.log('创建Direct传输...')
    // 创建DirectTransport实例
    const transport = server.createDirectTransport()

    console.log('创建Client实例...')
    // 创建Client实例
    const client = new Client(
      { name: 'direct-client-example', version: '1.0.0' },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}
        }
      }
    )

    console.log('连接到服务器...')
    // 连接到服务器
    await client.connect(transport)
    console.log('连接成功')

    console.log('获取工具列表...')
    // 获取工具列表
    const toolsResult = await client.listTools()
    console.log('可用工具:', toolsResult.tools)

    console.log('调用sum工具...')
    // 调用sum工具
    const sumResult = await client.callTool({
      name: 'sum',
      arguments: {
        numbers: [1, 2, 3, 4, 5]
      }
    })
    console.log('求和结果:', sumResult)

    console.log('调用listPresenters工具...')
    // 调用listPresenters工具，查看项目中的Presenter
    const presentersResult = await client.callTool({
      name: 'listPresenters',
      arguments: {}
    })
    console.log('Presenter列表:', presentersResult)

    console.log('关闭连接...')
    // 关闭连接
    await transport.close()
    console.log('断开连接')
  } catch (error) {
    console.error('执行示例时出错:', error)
  }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  directExample()
}

export { directExample }
