<template>
  <div class="copilot-settings-card">
    <h3 class="settings-heading">GitHub Copilot</h3>
    <div v-if="isLoading" class="loading-state">
      <p>Loading...</p> <!-- Replace with a spinner component if available -->
    </div>
    <div v-else-if="error" class="error-message">
      <p>Error: {{ error }}</p>
    </div>
    <div v-else>
      <div v-if="isAuthenticated && user" class="authenticated-state">
        <div class="user-info">
          <img v-if="user.avatar_url" :src="user.avatar_url" alt="User Avatar" class="avatar" />
          <span class="user-name">{{ user.login }}</span>
        </div>
        <button @click="handleLogout" class="action-button logout-button">Logout</button>
        <!-- Assuming Button component from Shadcn Vue or similar. Fallback to <button> -->
        <!-- <Button @click="handleLogout" variant="destructive">Logout</Button> -->
      </div>
      <div v-else class="unauthenticated-state">
        <div v-if="deviceCodeInfo" class="device-code-flow">
          <p>
            Please open the following URL in your browser:
            <a :href="deviceCodeInfo.verification_uri" target="_blank" class="verification-link">{{
              deviceCodeInfo.verification_uri
            }}</a>
          </p>
          <p>And enter this code:</p>
          <p class="user-code">{{ deviceCodeInfo.user_code }}</p>
          <button @click="handleCancelLogin" class="action-button cancel-button">
            Cancel Login
          </button>
          <!-- <Button @click="handleCancelLogin" variant="outline">Cancel Login</Button> -->
        </div>
        <div v-else>
          <button @click="handleLogin" class="action-button login-button">
            Login with GitHub
          </button>
          <!-- <Button @click="handleLogin">Login with GitHub</Button> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCopilotStore } from '../../../stores/copilotStore' // Adjusted path

const copilotStore = useCopilotStore()

const { isAuthenticated, user, deviceCodeInfo, isLoading, error } = storeToRefs(copilotStore)
const { login, logout, checkAuthStatus, cancelLoginPolling } = copilotStore

const handleLogin = () => {
  login().catch((loginError) => {
    // Error is already set in the store, but you can log it or handle UI specifics here if needed
    console.error('Login failed:', loginError)
  })
}
const handleLogout = () => logout()
const handleCancelLogin = () => cancelLoginPolling()

onMounted(() => {
  checkAuthStatus()
})
</script>

<style scoped>
.copilot-settings-card {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 20px;
  background-color: #f9f9f9;
}

.settings-heading {
  font-size: 1.25em;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
}

.loading-state p,
.error-message p {
  color: #555;
}

.error-message p {
  color: #d32f2f; /* Red for errors */
}

.authenticated-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 12px;
  border: 1px solid #ccc;
}

.user-name {
  font-size: 1.1em;
  font-weight: 500;
  color: #333;
}

.unauthenticated-state {
  margin-top: 10px;
}

.device-code-flow p {
  margin-bottom: 8px;
  font-size: 0.95em;
  color: #444;
}

.verification-link {
  color: #007bff;
  text-decoration: none;
}
.verification-link:hover {
  text-decoration: underline;
}

.user-code {
  font-size: 1.4em;
  font-weight: bold;
  color: #0056b3; /* Prominent color for the code */
  padding: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  display: inline-block;
  letter-spacing: 2px;
  margin-top: 4px;
  margin-bottom: 12px;
}

.action-button {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  font-size: 0.95em;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.login-button {
  background-color: #28a745; /* Green */
  color: white;
}
.login-button:hover {
  background-color: #218838;
}

.logout-button {
  background-color: #dc3545; /* Red */
  color: white;
}
.logout-button:hover {
  background-color: #c82333;
}

.cancel-button {
  background-color: #6c757d; /* Gray */
  color: white;
  margin-top: 8px;
}
.cancel-button:hover {
  background-color: #5a6268;
}

/* Basic button styling if not using a UI library */
button {
  padding: 8px 12px;
  margin-top: 5px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
