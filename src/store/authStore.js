import { create } from 'zustand';
import firestore from '@react-native-firebase/firestore';
import useLocationStore from './locationStore';
import * as Location from 'expo-location';

/**
 * Authentication store using Zustand
 * Manages driver authentication state, loading state, and errors
 */
export const useAuthStore = create((set, get) => ({
  // Driver state
  driver: null,
  isAuthenticated: false,

  // UI states
  loading: false,
  error: null,
  walletUnsubscribe: null,

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
        error: null,
        walletUnsubscribe: unsubscribe,
      });
    } else {
      // Clear driver data
      set({
        driver: null,
        isAuthenticated: false,
        error: null,
        walletUnsubscribe: null,
      });
    }
  },

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
   * Update driver's online/offline status without global loading
   * @param {string} driverId - ID of the driver to update
   * @param {'online'|'offline'} status - New status to set
   */
  updateDriverStatus: async (driverId, status) => {
    // Check location services before allowing online status
    if (status === 'online') {
      const { locationServicesEnabled } = useLocationStore.getState();
      if (!locationServicesEnabled) {
        useLocationStore.getState().setLocationError('services');
        return; // Prevent status change and show modal
      }
    }

    // Update local state first for immediate UI feedback
    set((state) => ({
      driver: state.driver
        ? {
            ...state.driver,
            status,
          }
        : null,
    }));

    try {
      await firestore()
        .collection('drivers')
        .doc(driverId)
        .update({ status });
    } catch (error) {
      console.error('Error updating driver status:', error);
      // Revert status on error
      set((state) => ({
        driver: state.driver
          ? {
              ...state.driver,
              status: status === 'online' ? 'offline' : 'online',
            }
          : null,
        error: 'Failed to update status. Please try again.',
      }));
      throw error; // Re-throw for UI handling
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
      isAuthenticated: false,
      error: null,
      walletUnsubscribe: null,
    });
  },

  toggleDriverStatus: async () => {
    const { driver } = get();
    if (!driver) return;

    const newStatus = driver.status === 'online' ? 'offline' : 'online';
    const locationStore = useLocationStore.getState();

    try {
      // Only check location services when trying to go online
      if (newStatus === 'online') {
        // Use direct check instead of relying on store state
        const locationServicesEnabled = await Location.hasServicesEnabledAsync();
        
        if (!locationServicesEnabled) {
          console.log('Location services disabled in toggleDriverStatus, showing error modal');
          // Force the modal to show with explicit parameters
          locationStore.setLocationError('services');
          // Ensure we don't continue with the status change
          return;
        }

        // Check wallet balance
        if (driver.walletBalance < 50) {
          throw new Error('Insufficient balance. Minimum ₱50 required to go online.');
        }
      }

      // Update Firestore in background
      const updatePromise = firestore()
        .collection('drivers')
        .doc(driver.id)
        .update({ 
          status: newStatus,
          lastStatusUpdate: firestore.FieldValue.serverTimestamp()
        });

      // Update local state immediately for better UX
      set(state => ({
        driver: {
          ...state.driver,
          status: newStatus
        }
      }));

      // Handle location tracking based on new status
      if (newStatus === 'online') {
        await locationStore.startLocationTracking();
      } else {
        locationStore.stopLocationTracking();
      }

      // Wait for Firestore update to complete
      await updatePromise;

    } catch (error) {
      // Revert local state if there was an error
      set(state => ({
        driver: {
          ...state.driver,
          status: driver.status // Revert to original status
        }
      }));
      
      console.error('Error toggling driver status:', error);
      throw error;
    }
  }
}));
