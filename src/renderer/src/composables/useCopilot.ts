// src/renderer/src/composables/useCopilot.ts

// The window.api object and its 'copilot' property are expected to be globally typed
// by the preload script's d.ts file (src/preload/index.d.ts).

export function useCopilot() {
  const getAuthMessage = (headers?: Record<string, string>) => {
    // Ensure window.api and window.api.copilot are available
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.getAuthMessage(headers)
  }

  const getCopilotToken = (device_code: string, headers?: Record<string, string>) => {
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.getCopilotToken(device_code, headers)
  }

  const saveCopilotToken = (access_token: string) => {
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.saveCopilotToken(access_token)
  }

  const getToken = (headers?: Record<string, string>) => {
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.getToken(headers)
  }

  const logout = () => {
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.logout()
  }

  const getUser = (token: string) => {
    if (!window.api || !window.api.copilot) {
      throw new Error(
        'Copilot API is not available. Ensure preload script is correctly loaded.'
      )
    }
    return window.api.copilot.getUser(token)
  }

  return {
    getAuthMessage,
    getCopilotToken,
    saveCopilotToken,
    getToken,
    logout,
    getUser
  }
}
