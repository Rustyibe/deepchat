import { clipboard, contextBridge, nativeImage, webUtils, webFrame, ipcRenderer } from 'electron'
import { exposeElectronAPI } from '@electron-toolkit/preload'

// 缓存变量
let cachedWindowId: number | undefined = undefined
let cachedWebContentsId: number | undefined = undefined

// Custom APIs for renderer
const api = {
  copilot: {
    getAuthMessage: (headers?: Record<string, string>) =>
      ipcRenderer.invoke('copilot:get-auth-message', headers),
    getCopilotToken: (device_code: string, headers?: Record<string, string>) =>
      ipcRenderer.invoke('copilot:get-copilot-token', device_code, headers),
    saveCopilotToken: (access_token: string) =>
      ipcRenderer.invoke('copilot:save-copilot-token', access_token),
    getToken: (headers?: Record<string, string>) =>
      ipcRenderer.invoke('copilot:get-token', headers),
    logout: () => ipcRenderer.invoke('copilot:logout'),
    getUser: (token: string) => ipcRenderer.invoke('copilot:get-user', token),
    completeStream: (
      prompt: string,
      token: string,
      onChunk: (chunk: any) => void,
      onError: (error: any) => void,
      onEnd: () => void
    ) => {
      ipcRenderer.send('copilot:request-stream', prompt, token)

      // Define named handlers to easily add and remove them
      const chunkHandler = (_event: any, chunk: any) => onChunk(chunk)
      const errorHandler = (_event: any, error: any) => {
        ipcRenderer.removeListener('copilot:stream-chunk', chunkHandler)
        ipcRenderer.removeListener('copilot:stream-error', errorHandler)
        ipcRenderer.removeListener('copilot:stream-end', endHandler)
        onError(error)
      }
      const endHandler = () => {
        ipcRenderer.removeListener('copilot:stream-chunk', chunkHandler)
        ipcRenderer.removeListener('copilot:stream-error', errorHandler)
        ipcRenderer.removeListener('copilot:stream-end', endHandler)
        onEnd()
      }

      ipcRenderer.on('copilot:stream-chunk', chunkHandler)
      ipcRenderer.on('copilot:stream-error', errorHandler)
      ipcRenderer.on('copilot:stream-end', endHandler)
    },
    cancelStream: () => {
      ipcRenderer.send('copilot:cancel-stream')
      // Removing listeners here might be redundant if end/error handlers always fire
      // upon cancellation from main process, but it's safer to ensure cleanup.
      ipcRenderer.removeAllListeners('copilot:stream-chunk')
      ipcRenderer.removeAllListeners('copilot:stream-error')
      ipcRenderer.removeAllListeners('copilot:stream-end')
    }
  },
  copyText: (text: string) => {
    clipboard.writeText(text)
  },
  copyImage: (image: string) => {
    const img = nativeImage.createFromDataURL(image)
    clipboard.writeImage(img)
  },
  getPathForFile: (file: File) => {
    return webUtils.getPathForFile(file)
  },
  getWindowId: () => {
    if (cachedWindowId !== undefined) {
      return cachedWindowId
    }
    cachedWindowId = ipcRenderer.sendSync('get-window-id')
    return cachedWindowId
  },
  getWebContentsId: () => {
    if (cachedWebContentsId !== undefined) {
      return cachedWebContentsId
    }
    cachedWebContentsId = ipcRenderer.sendSync('get-web-contents-id')
    return cachedWebContentsId
  }
}
exposeElectronAPI()

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
window.addEventListener('DOMContentLoaded', () => {
  webFrame.setVisualZoomLevelLimits(1, 1) // 禁用 trackpad 缩放
  webFrame.setZoomFactor(1)
})
