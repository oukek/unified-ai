import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // Error handling state
  const error = ref('')
  const errorTimer = ref<number | null>(null)

  // Clear error timer
  const clearErrorTimer = () => {
    if (errorTimer.value) {
      clearTimeout(errorTimer.value)
      errorTimer.value = null
    }
  }

  // Show error with auto-clear
  const showError = (message: string) => {
    error.value = message
    clearErrorTimer()
    errorTimer.value = window.setTimeout(() => {
      error.value = ''
      errorTimer.value = null
    }, 5000)
  }

  return {
    // State
    error,

    // Actions
    showError,
    clearErrorTimer,
  }
})
