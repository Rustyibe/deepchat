import axios from 'axios';
import { app, safeStorage } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// Constants and Configuration
const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const MAX_POLLING_ATTEMPTS = 10;
const INITIAL_POLLING_DELAY_MS = 5000; // 5 seconds
const POLLING_INTERVAL_MS = 5000; // 5 seconds

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'Content-Type': 'application/json',
  'editor-version': 'vscode/1.85.1',
  'editor-plugin-version': 'copilot-chat/0.11.1',
  'user-agent': 'GithubCopilot/0.11.1',
};

const API_URLS = {
  GITHUB_DEVICE_CODE: 'https://github.com/login/device/code',
  GITHUB_ACCESS_TOKEN: 'https://github.com/login/oauth/access_token',
  GITHUB_USER_INFO: 'https://api.github.com/user',
  COPILOT_TOKEN: 'https://api.github.com/copilot_internal/v2/token',
  COPILOT_CHAT_COMPLETIONS: 'https://api.githubcopilot.com/chat/completions', // Placeholder URL
};

// Interfaces
export interface UserResponse {
  login: string;
  avatar_url: string;
  name?: string;
}

export interface AuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  scope?: string;
}

export interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  refresh_in: number;
}

// Error Handling
export class CopilotServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopilotServiceError';
  }
}

// CopilotService Class
class CopilotService {
  private tokenFilePath: string;
  private headers: Record<string, string>;
  private currentAbortController: AbortController | null = null;

  constructor() {
    this.tokenFilePath = path.join(app.getPath('userData'), '.copilot_token');
    this.headers = { ...DEFAULT_HEADERS };
  }

  public cancelCurrentStream() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  private updateHeaders(headers?: Record<string, string>) {
    if (headers) {
      this.headers = { ...this.headers, ...headers };
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getUser(_: Electron.IpcMainInvokeEvent, token: string): Promise<UserResponse> {
    try {
      const response = await axios.get<UserResponse>(API_URLS.GITHUB_USER_INFO, {
        headers: {
          ...this.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching GitHub user info:', error);
      throw new CopilotServiceError('Failed to fetch GitHub user info.');
    }
  }

  async getAuthMessage(
    _: Electron.IpcMainInvokeEvent,
    headers?: Record<string, string>,
  ): Promise<AuthResponse> {
    this.updateHeaders(headers);
    try {
      const response = await axios.post<AuthResponse>(
        API_URLS.GITHUB_DEVICE_CODE,
        {
          client_id: GITHUB_CLIENT_ID,
          scope: 'copilot',
        },
        { headers: this.headers },
      );
      return response.data;
    } catch (error) {
      console.error('Error getting GitHub device authorization message:', error);
      throw new CopilotServiceError('Failed to get GitHub device authorization message.');
    }
  }

  async getCopilotToken(
    _: Electron.IpcMainInvokeEvent,
    device_code: string,
    headers?: Record<string, string>,
  ): Promise<TokenResponse> {
    this.updateHeaders(headers);
    let attempts = 0;
    let currentDelay = INITIAL_POLLING_DELAY_MS;

    while (attempts < MAX_POLLING_ATTEMPTS) {
      try {
        const response = await axios.post<TokenResponse>(
          API_URLS.GITHUB_ACCESS_TOKEN,
          {
            client_id: GITHUB_CLIENT_ID,
            device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          },
          { headers: this.headers },
        );

        if (response.data && response.data.access_token) {
          return response.data;
        }
      } catch (error: any) {
        // Specific error handling for pending authorization based on typical GitHub API behavior
        if (error.response && error.response.data && error.response.data.error === 'authorization_pending') {
          // console.log('Authorization pending, retrying...');
        } else {
          console.error('Error polling for GitHub access token:', error);
          throw new CopilotServiceError('Failed to poll for GitHub access token.');
        }
      }

      await this.delay(currentDelay);
      currentDelay += POLLING_INTERVAL_MS; // Simple linear backoff, can be exponential
      attempts++;
    }
    throw new CopilotServiceError('Max polling attempts reached for GitHub access token.');
  }

  async saveCopilotToken(_: Electron.IpcMainInvokeEvent, token: string): Promise<void> {
    try {
      const encryptedToken = safeStorage.encryptString(token);
      await fs.writeFile(this.tokenFilePath, encryptedToken);
    } catch (error) {
      console.error('Error saving Copilot token:', error);
      throw new CopilotServiceError('Failed to save Copilot token.');
    }
  }

  async getToken(
    _: Electron.IpcMainInvokeEvent,
    headers?: Record<string, string>,
  ): Promise<CopilotTokenResponse> {
    this.updateHeaders(headers);
    try {
      const encryptedToken = await fs.readFile(this.tokenFilePath);
      const accessToken = safeStorage.decryptString(encryptedToken).toString();

      if (!accessToken) {
        throw new CopilotServiceError('No access token found.');
      }

      const response = await axios.get<CopilotTokenResponse>(API_URLS.COPILOT_TOKEN, {
        headers: {
          ...this.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      if (error instanceof CopilotServiceError) throw error;
      console.error('Error getting Copilot token:', error);
      // Check if the file simply does not exist (e.g. user not logged in)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new CopilotServiceError('Copilot token file not found. User might not be logged in.');
      }
      throw new CopilotServiceError('Failed to get Copilot token.');
    }
  }

  async logout(_: Electron.IpcMainInvokeEvent): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath);
    } catch (error) {
      // If the file doesn't exist, it's a successful logout in effect
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      console.error('Error logging out (deleting token file):', error);
      throw new CopilotServiceError('Failed to logout.');
    }
  }

  async *completeStream(
    prompt: string,
    copilotToken: string, // This is the token from COPILOT_TOKEN endpoint
  ): AsyncGenerator<string, void, undefined> {
    if (this.currentAbortController) {
      // If a stream is already in progress, cancel it before starting a new one.
      // This is a simplistic approach; a more robust solution might queue requests
      // or allow multiple concurrent streams if the UI/IPC mechanism supports it with IDs.
      this.cancelCurrentStream();
    }
    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    const requestBody = {
      model: 'gpt-4o-mini', // Or make this configurable
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    };

    const requestHeaders = {
      ...this.headers, // Includes default Copilot headers
      Authorization: `Bearer ${copilotToken}`,
      // Specific headers for chat completions if any, e.g., 'Accept: text/event-stream'
      // For now, relying on default headers and Content-Type: application/json
    };

    try {
      const response = await axios.post(API_URLS.COPILOT_CHAT_COMPLETIONS, requestBody, {
        headers: requestHeaders,
        responseType: 'stream',
        signal,
      });

      const stream = response.data as NodeJS.ReadableStream;
      let buffer = '';

      for await (const chunk of stream) {
        if (signal.aborted) {
          stream.destroy(); // Ensure the stream is properly closed on abort
          throw new CopilotServiceError('Stream cancelled by client.');
        }

        buffer += chunk.toString();
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);

          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(5);
            if (jsonStr === '[DONE]') {
              return; // Stream finished
            }
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                yield parsed.choices[0].delta.content;
              }
            } catch (e) {
              console.error('Error parsing stream JSON:', e, 'Original line:', jsonStr);
              // Decide if this error should stop the stream or just be logged
            }
          }
        }
      }
    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log('Copilot stream request cancelled:', error.message);
        // Error already thrown by signal.aborted check or will be handled by finally
      } else if (error instanceof CopilotServiceError && error.message === 'Stream cancelled by client.') {
        // Already handled, just rethrow
        throw error;
      }
      else {
        console.error('Error during Copilot stream completion:', error.message);
        throw new CopilotServiceError(`Copilot API request failed: ${error.message}`);
      }
    } finally {
      if (this.currentAbortController && this.currentAbortController.signal === signal) {
        this.currentAbortController = null; // Clear the controller if it's the one for this stream
      }
    }
  }
}

// Export an instance of CopilotService
export const copilotService = new CopilotService();
export default copilotService;
