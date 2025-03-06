import { test, expect } from '../utils/electron-app'
import { MainWindow } from '../utils/page-objects'
import path from 'path'
import fs from 'fs'

test('应用启动后应显示预期的界面', async ({ firstWindow }) => {
  const mainWindow = new MainWindow(firstWindow)

  // 等待应用加载完成
  await mainWindow.waitForLoad()

  // 确保截图目录存在
  const screenshotsDir = path.join(process.cwd(), 'tests', 'fixtures')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }

  // 截取屏幕截图
  const screenshotPath = path.join(screenshotsDir, 'app-launch-snapshot.png')
  await firstWindow.screenshot({ path: screenshotPath })

  // 验证截图文件是否已创建
  expect(fs.existsSync(screenshotPath)).toBeTruthy()

  // 获取窗口标题并验证
  const title = await mainWindow.getTitle()
  console.log(`窗口标题: ${title}`)

  // 验证标题中是否包含应用名称
  expect(title).toContain('DeepChat')
})
