import { test, expect } from '../utils/electron-app'
import { MainWindow } from '../utils/page-objects'

test.describe('应用启动测试', () => {
  test('应用应该成功启动并显示主窗口', async ({ firstWindow }) => {
    const mainWindow = new MainWindow(firstWindow)

    // 等待应用加载完成
    await mainWindow.waitForLoad()

    // 检查窗口标题是否包含应用名称
    const title = await mainWindow.getTitle()
    console.log(`窗口标题: ${title}`)

    // 验证应用已成功启动（标题中应包含应用名称）
    expect(title).toContain('DeepChat')

    // 截图保存
    await firstWindow.screenshot({ path: 'tests/fixtures/app-launch.png' })
  })

  test('应用的基本UI元素应该可见', async ({ firstWindow }) => {
    const mainWindow = new MainWindow(firstWindow)
    await mainWindow.waitForLoad()

    // 这里需要根据实际应用UI结构添加对关键UI元素的检查
    // 例如：检查侧边栏、头部导航、主内容区域等是否存在
    // 以下是示例，需要根据实际应用调整选择器

    // 示例：检查应用容器是否存在
    // const isContainerVisible = await mainWindow.isElementVisible('#app');
    // expect(isContainerVisible).toBeTruthy();

    // 更多UI元素检查...
  })
})
