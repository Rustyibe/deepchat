import { Page } from 'playwright'

/**
 * 主窗口页面对象
 * 封装与应用主窗口的交互
 */
export class MainWindow {
  constructor(private page: Page) {}

  /**
   * 等待应用加载完成
   */
  async waitForLoad() {
    // 这里可以等待应用中的某个关键元素加载完成
    // 需根据实际应用UI结构调整
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(1000) // 额外等待以确保JS执行完成
  }

  /**
   * 获取窗口标题
   */
  async getTitle() {
    return await this.page.title()
  }

  /**
   * 检查元素是否可见
   * @param selector 元素选择器
   */
  async isElementVisible(selector: string) {
    return await this.page.isVisible(selector)
  }

  /**
   * 点击元素
   * @param selector 元素选择器
   */
  async clickElement(selector: string) {
    await this.page.click(selector)
  }

  /**
   * 输入文本
   * @param selector 元素选择器
   * @param text 要输入的文本
   */
  async typeText(selector: string, text: string) {
    await this.page.fill(selector, text)
  }

  /**
   * 获取元素文本
   * @param selector 元素选择器
   */
  async getElementText(selector: string) {
    return await this.page.textContent(selector)
  }
}
