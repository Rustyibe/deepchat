import { ElectronApplication, Page, _electron as electron } from 'playwright'
import { test as base } from '@playwright/test'
import path from 'path'

// 扩展测试环境，添加Electron应用支持
export const test = base.extend<{
  electronApp: ElectronApplication
  firstWindow: Page
}>({
  // 为每个测试用例设置一个Electron应用实例
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  electronApp: async ({ browser }, use) => {
    // 应用路径
    const appPath = path.join(process.cwd(), 'out', 'main', 'index.js')

    // 启动Electron应用
    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        NODE_ENV: 'test'
      }
    })

    // 使用应用实例
    await use(electronApp)

    // 测试完成后关闭应用
    await electronApp.close()
  },

  // 获取应用的第一个窗口
  firstWindow: async ({ electronApp }, use) => {
    // 等待主窗口打开
    const window = await electronApp.firstWindow()

    // 等待窗口加载完成
    // 可以根据应用的特性调整，例如等待特定元素出现
    await window.waitForLoadState('domcontentloaded')

    // 使用该窗口进行测试
    await use(window)
  }
})

export { expect } from '@playwright/test'
