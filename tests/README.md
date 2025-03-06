# DeepChat 自动化测试

本项目使用 Playwright 对 Electron 应用进行自动化测试。

## 测试结构

```
tests/
├── e2e/              # 端到端测试
│   ├── app-launch.spec.ts     # 应用启动测试
│   ├── simple.spec.ts         # 简单功能测试
│   ├── snapshot.spec.ts       # UI快照测试
│   └── ipc-communication.spec.ts  # IPC通信测试
├── fixtures/         # 测试数据和固定资源
├── utils/            # 测试工具函数
│   ├── electron-app.ts        # Electron应用启动工具
│   └── page-objects.ts        # 页面对象模式
└── setup/            # 测试环境设置
```

## 运行测试

首先确保已构建应用：

```bash
npm run build
```

然后运行测试：

```bash
# 运行所有测试
npm test

# 运行特定测试
npx playwright test tests/e2e/simple.spec.ts

# 使用调试模式运行测试
npm run test:debug

# 使用UI模式运行测试
npm run test:ui

# 查看测试报告
npm run test:report
```

## 测试用例说明

### 1. 简单启动测试 (simple.spec.ts)

验证应用是否能够正确启动，并检查应用名称是否符合预期。

### 2. 应用启动测试 (app-launch.spec.ts)

更详细地测试应用启动过程，并验证主窗口是否正确显示。

### 3. UI快照测试 (snapshot.spec.ts)

捕获应用启动后的窗口截图，用于UI回归测试。

### 4. IPC通信测试 (ipc-communication.spec.ts)

测试渲染进程和主进程之间的IPC通信是否正常工作：
- 从渲染进程向主进程发送消息
- 从主进程向渲染进程发送消息

## 创建新测试

1. 在 `tests/e2e` 目录下创建新的测试文件，命名格式为 `*.spec.ts`
2. 导入测试工具：
   ```typescript
   import { test, expect } from '../utils/electron-app';
   import { MainWindow } from '../utils/page-objects';
   ```
3. 编写测试用例，例如：
   ```typescript
   test('我的测试用例', async ({ firstWindow }) => {
     const mainWindow = new MainWindow(firstWindow);
     // 测试逻辑...
   });
   ```

## 测试最佳实践

1. 使用页面对象模式封装UI交互
2. 每个测试应该专注于测试一个功能
3. 使用有描述性的断言消息
4. 避免测试之间的依赖关系
5. 使用 `fixture` 目录存储测试数据

## 常见问题排查

1. **测试无法启动应用？**
   - 确保已经运行 `npm run build` 生成了应用
   - 检查 `tests/utils/electron-app.ts` 中的应用路径是否正确

2. **测试找不到元素？**
   - 确保元素选择器正确
   - 可能需要增加等待时间或等待特定元素可见
   - 使用 `test:debug` 模式查看页面状态

3. **如何模拟IPC通信？**
   - 在测试代码中使用 `electronApp.evaluate()` 在主进程中执行代码
   - 使用 `window.evaluate()` 在渲染进程中执行代码
