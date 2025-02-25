import { create } from 'zustand';

/**
 * Authentication store using Zustand
 * Manages driver authentication state, loading state, and errors
 */
export const useAuthStore = create((set) => ({
  // Driver state
  driver: null,
  isAuthenticated: false,
  
  // UI states
  loading: false,
  error: null,
  
  /**
   * Set the authenticated driver
   * @param {Object|null} driverData - Driver data or null when signed out
   */
  setDriver: (driverData) => set({
    driver: driverData,
    isAuthenticated: !!driverData,
    error: null
  }),
  
  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading: (isLoading) => set({ loading: isLoading }),
  
  /**
   * Set error message
   * @param {string|null} errorMessage - Error message or null to clear
   */
  setError: (errorMessage) => set({ error: errorMessage }),
  
  /**
   * Clear all authentication data (for logout)
   */
  clearAuth: () => set({
    driver: null,
    isAuthenticated: false,
    error: null
  })
}));
