import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCopilot } from '../composables/useCopilot'

// Define interfaces based on the problem description and copilotProvider.ts
export interface UserResponse {
  login: string
  avatar_url: string
  name?: string
}

export interface AuthResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

// Copilot token is usually a JWT, but here it's just referred to as a string.
// The actual Copilot token response also includes expires_at and refresh_in.
export interface CopilotTokenDetails {
  token: string;
  expires_at: number;
  refresh_in: number;
}


export const useCopilotStore = defineStore('copilot', () => {
  const {
    getAuthMessage: apiGetAuthMessage,
    getCopilotToken: apiGetCopilotToken,
    saveCopilotToken: apiSaveCopilotToken,
    getToken: apiGetToken,
    logout: apiLogout,
    getUser: apiGetUser
  } = useCopilot()

  // --- State Properties ---
  const isAuthenticated = ref<boolean>(false)
  const user = ref<UserResponse | null>(null)
  const deviceCodeInfo = ref<AuthResponse | null>(null) // For login flow
  const copilotToken = ref<CopilotTokenDetails | null>(null) // Actual Copilot API token
  const githubAccessToken = ref<string | null>(null) // GitHub OAuth access token

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  let pollingIntervalId: NodeJS.Timeout | null = null;

  // --- Helper: Delay function ---
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


  // --- Actions ---

  async function fetchAndSetCopilotToken(): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const tokenDetails = await apiGetToken() // This gets the Copilot API token
      if (tokenDetails && tokenDetails.token) {
        copilotToken.value = tokenDetails
        // Note: The GitHub access token is used by the backend apiGetToken,
        // but not directly returned or stored here.
        // If needed for other frontend operations, it should be handled.
        return true
      } else {
        throw new Error('Failed to retrieve a valid Copilot token.')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch Copilot token.'
      copilotToken.value = null
      isAuthenticated.value = false // Ensure this on failure
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAndSetUser(ghToken: string): Promise<boolean> {
    // This function specifically needs the GitHub Access Token
    if (!ghToken) {
        error.value = 'GitHub access token is required to fetch user details.';
        // Do not set isLoading here as it's part of a larger flow or specific call
        return false;
    }
    //isLoading.value = true; // Manage loading state if called independently
    //error.value = null;
    try {
      const userData = await apiGetUser(ghToken)
      user.value = userData
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch user information.'
      // user.value = null; // Decide if user state should be cleared on error
      return false
    } finally {
      //isLoading.value = false; // Manage loading state if called independently
    }
  }

  async function login() {
    isLoading.value = true
    error.value = null
    if (pollingIntervalId) clearInterval(pollingIntervalId);


    try {
      const authData = await apiGetAuthMessage()
      deviceCodeInfo.value = authData

      const pollInterval = (authData.interval || 5) * 1000 // Default to 5 seconds
      const maxAttempts = Math.floor((authData.expires_in * 1000) / pollInterval) || 120; // e.g., 15 minutes / 5s interval = 180 attempts
      let attempts = 0

      return new Promise<void>((resolve, reject) => {
        pollingIntervalId = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollingIntervalId!);
            pollingIntervalId = null;
            error.value = 'Login timed out. Please try again.';
            isLoading.value = false;
            deviceCodeInfo.value = null; // Clear device code info
            reject(new Error(error.value));
            return;
          }

          if (!deviceCodeInfo.value) { // User might have cancelled
            clearInterval(pollingIntervalId!);
            pollingIntervalId = null;
            isLoading.value = false;
            reject(new Error('Login cancelled or device code info cleared.'));
            return;
          }

          try {
            const tokenResponse = await apiGetCopilotToken(deviceCodeInfo.value.device_code);
            if (tokenResponse && tokenResponse.access_token) {
              clearInterval(pollingIntervalId!);
              pollingIntervalId = null;
              deviceCodeInfo.value = null; // Clear after successful token retrieval

              githubAccessToken.value = tokenResponse.access_token; // Store GitHub token
              await apiSaveCopilotToken(githubAccessToken.value);

              const copilotTokenSuccess = await fetchAndSetCopilotToken();
              if (copilotTokenSuccess) {
                const userSuccess = await fetchAndSetUser(githubAccessToken.value);
                if (userSuccess) {
                  isAuthenticated.value = true;
                  isLoading.value = false;
                  resolve();
                } else {
                  // Failed to get user info, but got tokens
                  isAuthenticated.value = true; // Still authenticated in terms of tokens
                  isLoading.value = false;
                  // error is already set by fetchAndSetUser
                  reject(new Error(error.value || 'Failed to fetch user details after login.'));
                }
              } else {
                // Failed to get Copilot token
                isLoading.value = false;
                // error is already set by fetchAndSetCopilotToken
                reject(new Error(error.value || 'Failed to fetch Copilot token after login.'));
              }
            }
            // If tokenResponse.error is 'authorization_pending', continue polling (handled by absence of access_token)
            else if (tokenResponse && (tokenResponse as any).error) {
              // Handle other errors from polling like 'slow_down', 'expired_token' if necessary
              const apiError = (tokenResponse as any).error;
              if (apiError !== 'authorization_pending') {
                clearInterval(pollingIntervalId!);
                pollingIntervalId = null;
                error.value = `Login failed: ${apiError}`;
                isLoading.value = false;
                deviceCodeInfo.value = null;
                reject(new Error(error.value));
              }
            }
          } catch (pollError: any) {
            // This catches network errors or issues with apiGetCopilotToken itself
            // Don't clear interval if it's a one-off network glitch,
            // but if it's a persistent error, the maxAttempts will handle it.
            // For now, we let it continue polling unless maxAttempts is reached.
            // console.error('Polling error:', pollError); // Log for debugging
            // If the error is critical (e.g. device code invalid), stop polling.
            // The current backend does not explicitly return such errors yet.
          }
        }, pollInterval);
      });

    } catch (err: any) {
      error.value = err.message || 'Login failed during initial phase.'
      isLoading.value = false
      deviceCodeInfo.value = null;
      if (pollingIntervalId) clearInterval(pollingIntervalId);
      pollingIntervalId = null;
      throw err; // Re-throw for the component to handle if needed
    }
  }
  
  // Call this function to stop the login process, e.g. if the user closes a modal
  function cancelLoginPolling() {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
    deviceCodeInfo.value = null; // Clear auth prompt info
    isLoading.value = false;
    if (!isAuthenticated.value) { // Only set error if not already authenticated
        error.value = 'Login process cancelled by user.';
    }
  }

  async function logout() {
    isLoading.value = true
    error.value = null
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = null;

    try {
      await apiLogout()
    } catch (err: any) {
      // Even if API logout fails, clear local state
      console.warn('API logout failed, proceeding with local state clearing:', err.message);
    } finally {
      isAuthenticated.value = false
      user.value = null
      copilotToken.value = null
      githubAccessToken.value = null;
      deviceCodeInfo.value = null
      error.value = null // Clear any previous errors
      isLoading.value = false
    }
  }

  async function checkAuthStatus() {
    isLoading.value = true; // Start loading
    error.value = null;
    // Try to fetch the Copilot token. If successful, it means a GitHub token
    // was available and valid in the backend's secure storage.
    const hasCopilotToken = await fetchAndSetCopilotToken();

    if (hasCopilotToken && copilotToken.value) {
      isAuthenticated.value = true;
      // Now, attempt to fetch user information.
      // The backend's `getToken` uses the stored GitHub access token.
      // We need a way to get that same GitHub access token to pass to `apiGetUser`.
      // For this version, we'll assume that if checkAuthStatus needs user data,
      // the GitHub token must be retrieved first.
      // One approach: `apiGetToken` could be enhanced to also return the underlying GitHub token.
      // Or, a new API method `getStoredGitHubToken` could exist.
      // For now, we cannot directly call `fetchAndSetUser` without the GitHub token.
      // So, user info will only be fetched upon a new login or if explicitly called with a token.
      // This deviates slightly from the prompt's "calls fetchAndSetUser",
      // but adheres to the current API contracts and security.
      // To fulfill the "call fetchAndSetUser" part, we'd ideally have the gh token.
      // Let's assume for now that `fetchAndSetCopilotToken` also populates `githubAccessToken.value`
      // IF the backend's `getToken` was modified to return it.
      // Since it's not, we'll simulate trying to get it or acknowledge this limitation.

      // **Revised approach for checkAuthStatus to align with prompt's intent:**
      // We'll try to get the GitHub token by a placeholder mechanism.
      // In a real scenario, `apiGetToken` would also return the `githubAccessToken` it read.
      // Or, a separate call `apiGetStoredGitHubToken()` would be needed.
      // Let's assume `apiGetToken` is modified in the backend to return it for simplicity here.
      // So, IF `fetchAndSetCopilotToken` was successful, we'd need `githubAccessToken.value`
      // to be populated by it.

      // Since `fetchAndSetCopilotToken` in its current form (based on `useCopilot` and `copilotProvider`)
      // does *not* directly expose the GitHub access token to the frontend store,
      // we cannot reliably call `fetchAndSetUser(githubAccessToken.value)` here
      // without that token being explicitly set.

      // The most straightforward way without backend changes is to only set isAuthenticated.
      // User fetching would occur upon explicit login.
      // However, to follow the prompt as closely as possible:
      // We will assume that if `fetchAndSetCopilotToken` worked, a gh token *was* used.
      // But we don't have it. So we can't call `fetchAndSetUser(token)`.
      // The prompt implies `fetchAndSetUser` is called.
      // Let's make a concession: if the backend's `getUser` can work without a token
      // *if a session is already established by `getToken`*, then we can call it.
      // This is not how it's currently designed.

      // Safest path:
      // If `fetchAndSetCopilotToken` succeeded, we are "Copilot authenticated".
      // User details would require a separate flow or explicit token.
      // For the sake of the prompt, if isAuthenticated is true,
      // we can try to fetch user details, assuming the backend can handle it.
      // This is a design choice.
      // The original prompt says: "If successful, it implies a token exists, so call fetchAndSetUser".
      // This implies `fetchAndSetUser` might not need an explicit token passed in this context.
      // Let's make `fetchAndSetUser` callable without a token parameter for this specific scenario.

      // No, `fetchAndSetUser` requires a token.
      // The `checkAuthStatus` will set isAuthenticated, but `user.value` will remain null
      // unless `githubAccessToken.value` is somehow populated.
      // This is a limitation of not having the GitHub token directly available after `apiGetToken`.
      // The login flow *will* populate it.
      // So, checkAuthStatus will correctly set isAuthenticated, and user can be fetched later if needed.
      // The prompt might have a slight oversimplification of this step.

    } else {
      // If fetching Copilot token fails, ensure clean state
      isAuthenticated.value = false;
      user.value = null;
      copilotToken.value = null;
      githubAccessToken.value = null;
    }
    isLoading.value = false; // End loading
  }


  // --- Return state and actions ---
  return {
    isAuthenticated,
    user,
    deviceCodeInfo,
    copilotToken,
    githubAccessToken, // Expose for potential direct use if needed, though typically managed internally
    isLoading,
    error,

    login,
    fetchAndSetCopilotToken, // Might be used internally or for refresh scenarios
    fetchAndSetUser,       // Might be used internally or for refresh scenarios
    logout,
    checkAuthStatus,
    cancelLoginPolling, // Expose cancellation
  }
})
