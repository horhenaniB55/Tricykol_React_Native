import { create } from 'zustand';
import { auth } from '../services/firebase';
import firestore from '@react-native-firebase/firestore';
// Remove circular dependency
// import useLocationStore from './locationStore';
import * as Location from 'expo-location';
import { AuthService } from '../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Authentication store using Zustand
 * Manages driver authentication state, loading state, and errors
 */
export const useAuthStore = create((set, get) => ({
  // Driver state
  driver: null,
  user: null,
  isAuthenticated: false,
  needsWebRegistration: false,

  // UI states
  loading: false,
  error: null,
  walletUnsubscribe: null,
  initialized: false,

  /**
   * Initialize the auth store and set up listeners
   * @returns {Function} Unsubscribe function
   */
  initialize: () => {
    console.log('Initializing auth store...');
    // Set up auth state listener
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      set({ loading: true });
      
      if (user) {
        try {
          // User is signed in
          console.log('Auth state changed: User is signed in', user.uid);
          set({ user });
          
          // Get driver data
          const driverData = await AuthService.getCurrentDriver();
          if (driverData) {
            console.log('Driver profile found, setting driver data');
            get().setDriver(driverData);
            set({ needsWebRegistration: false });
            
            // Request location permissions for already authenticated users
            try {
              console.log('[AuthStore] Checking location permissions for existing user');
              const { status } = await Location.getForegroundPermissionsAsync();
              
              // Only request if not already granted
              if (status !== 'granted') {
                console.log('[AuthStore] Requesting location permissions for existing user');
                const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                console.log('[AuthStore] New location permission status:', newStatus);
              } else {
                console.log('[AuthStore] Location permissions already granted');
              }
            } catch (error) {
              console.error('[AuthStore] Error checking/requesting location permissions:', error);
            }
          } else {
            console.log('No driver profile found for authenticated user');
            // User is authenticated but has no driver profile
            // This means they need to register on the web
            set({ 
              needsWebRegistration: true,
              isAuthenticated: true, // They are authenticated, just not registered
              error: null
            });
          }
        } catch (error) {
          console.error('Error getting driver data:', error);
          set({ 
            error: error.message,
            needsWebRegistration: true, // Assume registration needed on error
            isAuthenticated: true // They are still authenticated
          });
        }
      } else {
        // User is signed out
        console.log('Auth state changed: User is signed out');
        get().clearAuth();
      }
      
      set({ loading: false, initialized: true });
    });
    
    // Return unsubscribe function
    return unsubscribe;
  },

  /**
   * Set the authenticated driver and start wallet subscription
   * @param {Object|null} driverData - Driver data or null when signed out
   */
  setDriver: (driverData) => {
    // Clean up any existing subscription
    const currentUnsubscribe = get().walletUnsubscribe;
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }

    if (driverData) {
      // Start new wallet subscription
      const unsubscribe = firestore()
        .collection('wallets')
        .doc(driverData.id)
        .onSnapshot(
          (doc) => {
            const walletData = doc.data();
            // Update driver state with new wallet balance
            set((state) => ({
              driver: state.driver
                ? {
                    ...state.driver,
                    walletBalance: walletData?.balance || 0,
                  }
                : null,
            }));
          },
          (error) => {
            console.error('Error in wallet subscription:', error);
          }
        );

      // Set driver data and store unsubscribe function
      set({
        driver: driverData,
        isAuthenticated: true,
        needsWebRegistration: false,
        error: null,
        walletUnsubscribe: unsubscribe,
      });
      
      // Store driver data in AsyncStorage for persistence
      AsyncStorage.setItem('driver', JSON.stringify(driverData));
      
      // Request location permissions after successful authentication
      // This ensures the permission dialog appears after the user is authenticated
      (async () => {
        try {
          console.log('[AuthStore] Requesting location permissions after authentication');
          const { status } = await Location.requestForegroundPermissionsAsync();
          console.log('[AuthStore] Location permission status:', status);
          
          if (status === 'granted') {
            console.log('[AuthStore] Location permissions granted');
            
            // We can also check if location services are enabled
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
              console.log('[AuthStore] Location services are disabled');
              // You could show a toast message here
            }
          } else {
            console.log('[AuthStore] Location permissions denied');
            // You could show a toast message here
          }
        } catch (error) {
          console.error('[AuthStore] Error requesting location permissions:', error);
        }
      })();
    } else {
      // Clear driver data
      set({
        driver: null,
        isAuthenticated: false,
        error: null,
        walletUnsubscribe: null,
      });
      
      // Remove from AsyncStorage
      AsyncStorage.removeItem('driver');
    }
  },

  /**
   * Set user data
   * @param {Object|null} userData - User data or null when signed out
   */
  setUser: (userData) => set({ user: userData }),

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
   * Clear error message
   */
  clearError: () => set({ error: null }),

  /**
   * Update driver's online/offline status without global loading
   * @param {string} driverId - ID of the driver to update
   * @param {'online'|'offline'} status - New status to set
   */
  updateDriverStatus: async (status) => {
    try {
      const { driver } = get();
      if (!driver?.id) return;

      // Always set status to online
      const updatedDriver = {
        ...driver,
        status: 'online'
      };

      // Update in Firestore
      await firestore()
        .collection('drivers')
        .doc(driver.id)
        .update({
          status: 'online',
          lastStatusUpdate: firestore.FieldValue.serverTimestamp()
        });

      // Update local state
      set({ driver: updatedDriver });
    } catch (error) {
      console.error('[AuthStore] Error updating driver status:', error);
      throw error;
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async () => {
    try {
      await AuthService.signOut();
      get().clearAuth();
    } catch (error) {
      console.error('Sign out error:', error);
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * Clear all authentication data (for logout)
   */
  clearAuth: () => {
    // Clean up wallet subscription
    const unsubscribe = get().walletUnsubscribe;
    if (unsubscribe) {
      unsubscribe();
    }

    // Clear state
    set({
      driver: null,
      user: null,
      isAuthenticated: false,
      needsWebRegistration: false,
      error: null,
      walletUnsubscribe: null,
    });
    
    // Clear AsyncStorage
    AsyncStorage.removeItem('driver');
  },

  /**
   * Toggle driver's online/offline status
   */
  toggleDriverStatus: async () => {
    try {
      const { driver } = get();
      if (!driver?.id) return;

      // Always keep status as online
      const updatedDriver = {
        ...driver,
        status: 'online'
      };

      // Update in Firestore
      await firestore()
        .collection('drivers')
        .doc(driver.id)
        .update({
          status: 'online',
          lastStatusUpdate: firestore.FieldValue.serverTimestamp()
        });

      // Update local state
      set({ driver: updatedDriver });
    } catch (error) {
      console.error('[AuthStore] Error toggling driver status:', error);
      throw error;
    }
  },
  
  /**
   * Update driver profile
   * @param {Object} driverData - Driver data to update
   * @returns {Promise<Object>} Result object
   */
  updateDriver: async (updates) => {
    try {
      const { driver } = get();
      if (!driver?.id) return;

      // Always ensure status is online
      updates.status = 'online';

      // Update in Firestore
      await firestore()
        .collection('drivers')
        .doc(driver.id)
        .update({
          ...updates,
          lastUpdate: firestore.FieldValue.serverTimestamp()
        });

      // Update local state
      set({ driver: { ...driver, ...updates } });
    } catch (error) {
      console.error('[AuthStore] Error updating driver:', error);
      throw error;
    }
  },
  
  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - Phone number with country code
   * @returns {Promise<Object>} Result object
   */
  sendOtp: async (phoneNumber) => {
    set({ error: null });
    try {
      console.log('Auth store: Sending OTP to', phoneNumber);
      const result = await AuthService.sendOtp(phoneNumber);
      
      if (!result.success) {
        console.error('Failed to send OTP:', result.error);
        set({ error: result.error });
      } else {
        console.log('OTP sent successfully');
      }
      return result;
    } catch (error) {
      console.error('Send OTP error:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Verify OTP
   * @param {string} otp - OTP code
   * @param {boolean} isRegistration - Whether this is for registration
   * @returns {Promise<Object>} Result object
   */
  verifyOtp: async (otp, isRegistration = false) => {
    set({ error: null });
    try {
      console.log('Auth store: Verifying OTP', otp, 'isRegistration:', isRegistration);
      const result = await AuthService.verifyOtp(otp, isRegistration);
      
      if (result.success) {
        console.log('OTP verification successful:', result);
        // Auth state listener will handle the rest
        
        // Request location permissions right after successful verification
        try {
          console.log('[AuthStore] Requesting location permissions after OTP verification');
          const { status } = await Location.requestForegroundPermissionsAsync();
          console.log('[AuthStore] Location permission status after OTP verification:', status);
        } catch (error) {
          console.error('[AuthStore] Error requesting location permissions after OTP verification:', error);
        }
      } else {
        console.error('OTP verification failed:', result.error);
        set({ error: result.error });
      }
      return result;
    } catch (error) {
      console.error('Verify OTP error:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * Initialize driver data from Firestore
   */
  initializeDriver: async () => {
    try {
      const { driver } = get();
      if (!driver?.id) return;

      // Get driver data from Firestore
      const driverDoc = await firestore()
        .collection('drivers')
        .doc(driver.id)
        .get();

      if (driverDoc.exists) {
        const driverData = driverDoc.data();
        // Always set status to online
        driverData.status = 'online';
        set({ driver: driverData });
      }
    } catch (error) {
      console.error('[AuthStore] Error initializing driver:', error);
    }
  },
}));
