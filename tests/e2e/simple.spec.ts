import { test, expect } from '../utils/electron-app'

test('应用程序应该启动', async ({ electronApp }) => {
  // 检查 app 是否定义
  const appName = await electronApp.evaluate(async ({ app }) => {
    return app.getName()
  })

  expect(appName).not.toBeNull()
})
