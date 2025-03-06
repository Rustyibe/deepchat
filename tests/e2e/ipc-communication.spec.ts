import { test, expect } from '../utils/electron-app'
import { MainWindow } from '../utils/page-objects'
import { ElectronApplication } from 'playwright'

test.describe('IPC通信测试', () => {
  // 为测试套件定义函数，检查主进程是否能接收渲染进程的消息
  async function testIPCFromRenderer(electronApp: ElectronApplication, channel: string) {
    // 在主进程中设置一个标志，用于确认是否收到IPC消息
    await electronApp.evaluate(
      ({ ipcMain }, { channel }) => {
        // @ts-ignore - 全局变量用于测试
        global.__TEST_IPC_RECEIVED__ = false

        // 监听来自渲染进程的IPC消息
        ipcMain.once(channel, () => {
          // @ts-ignore - 全局变量用于测试
          global.__TEST_IPC_RECEIVED__ = true
        })
      },
      { channel }
    )

    // 返回检查函数，用于验证消息是否被接收
    return async () => {
      const received = await electronApp.evaluate(() => {
        // @ts-ignore - 访问全局测试变量
        return global.__TEST_IPC_RECEIVED__
      })

      return received
    }
  }

  test('渲染进程应能向主进程发送IPC消息', async ({ electronApp, firstWindow }) => {
    const mainWindow = new MainWindow(firstWindow)
    await mainWindow.waitForLoad()

    // 准备测试的IPC通道和数据
    const testChannel = 'test-channel'
    const testData = { message: 'hello from test' }

    // 设置IPC监听器并获取检查函数
    const checkIPCReceived = await testIPCFromRenderer(electronApp, testChannel)

    // 在渲染进程中发送IPC消息
    await firstWindow.evaluate(
      ({ channel, data }) => {
        // 渲染进程中发送IPC消息
        // @ts-ignore - 假设window.electron存在
        window.electron.ipcRenderer.send(channel, data)
      },
      { channel: testChannel, data: testData }
    )

    // 等待一段时间，确保消息有时间传递
    await firstWindow.waitForTimeout(500)

    // 验证主进程是否收到了消息
    const received = await checkIPCReceived()
    expect(received).toBeTruthy()
  })

  test('主进程应能向渲染进程发送IPC消息', async ({ electronApp, firstWindow }) => {
    const mainWindow = new MainWindow(firstWindow)
    await mainWindow.waitForLoad()

    // 在渲染进程中设置标志，用于确认是否收到来自主进程的IPC消息
    await firstWindow.evaluate(() => {
      // @ts-ignore - 全局变量用于测试
      window.__TEST_IPC_RECEIVED_FROM_MAIN__ = false

      // @ts-ignore - 假设window.electron存在
      window.electron.ipcRenderer.on('test-from-main', () => {
        // @ts-ignore - 全局变量用于测试
        window.__TEST_IPC_RECEIVED_FROM_MAIN__ = true
      })
    })

    // 从主进程发送IPC消息到渲染进程
    await electronApp.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].webContents.send('test-from-main', { message: 'hello from main' })
      }
    })

    // 等待一段时间，确保消息有时间传递
    await firstWindow.waitForTimeout(500)

    // 验证渲染进程是否收到了消息
    const received = await firstWindow.evaluate(() => {
      // @ts-ignore - 访问全局测试变量
      return window.__TEST_IPC_RECEIVED_FROM_MAIN__
    })

    expect(received).toBeTruthy()
  })
})
