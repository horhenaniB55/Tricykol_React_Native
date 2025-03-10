import { create } from 'zustand';
import * as Location from 'expo-location';
import { locationService } from '../services/locationService';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useLocationStore = create((set, get) => ({
  // Location state
  currentLocation: null,
  isTracking: false,
  locationError: null,
  locationPermission: 'undetermined',
  locationServicesEnabled: true,
  showLocationErrorModal: false,
  locationErrorType: null,
  dismissedErrorTypes: new Set(),

  // Set current location and save to AsyncStorage
  updateCurrentLocation: (location) => {
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      console.log('[LocationStore] Updating current location');
      
      // Ensure location has a timestamp
      const locationWithTimestamp = {
        ...location,
        timestamp: location.timestamp || new Date().getTime()
      };
      
      // Update state
      set({ currentLocation: locationWithTimestamp });
      
      // Use locationService to save to AsyncStorage
      locationService.updateLocation(locationWithTimestamp)
        .then(success => {
          if (success) {
            console.log('[LocationStore] Location successfully updated and saved');
          }
        })
        .catch(error => {
          console.error('[LocationStore] Failed to update location:', error);
        });
    }
  },

  // Initialize location services
  initializeLocation: async () => {
    console.log('[LocationStore] Starting location initialization');
    try {
      await locationService.initialize();
      
      console.log('[LocationStore] Fetching last known location');
      // Get last known location from storage
      const lastLocation = await locationService.getLastKnownLocation();
      if (lastLocation) {
        console.log('[LocationStore] Setting last known location:', lastLocation);
        set({ currentLocation: lastLocation });
      } else {
        console.log('[LocationStore] No last known location available');
      }

      console.log('[LocationStore] Setting successful initialization state');
      set({ 
        locationServicesEnabled: true,
        locationPermission: 'granted',
        locationError: null,
        showLocationErrorModal: false
      });

      console.log('[LocationStore] Location initialization complete');
      return true;
    } catch (error) {
      console.error('[LocationStore] Location initialization error:', error);
      
      // Set appropriate error state
      if (error.message.includes('permission')) {
        console.log('[LocationStore] Setting permission denied error state');
        set({
          locationErrorType: 'permission',
          locationPermission: 'denied',
          showLocationErrorModal: true
        });
      } else if (error.message.includes('disabled')) {
        console.log('[LocationStore] Setting services disabled error state');
        set({
          locationErrorType: 'services',
          locationServicesEnabled: false,
          showLocationErrorModal: true
        });
      }
      
      set({ locationError: error.message });
      return false;
    }
  },

  // Start location tracking
  startLocationTracking: async () => {
    console.log('[LocationStore] Starting location tracking');
    try {
      // Check if already tracking
      if (get().isTracking) {
        console.log('[LocationStore] Already tracking, no need to start again');
        return;
      }

      // Get driver data from AsyncStorage instead of directly from authStore
      const driverJson = await AsyncStorage.getItem('driver');
      if (!driverJson) {
        console.log('[LocationStore] No authenticated driver found');
        throw new Error('Driver not authenticated');
      }
      
      const driver = JSON.parse(driverJson);
      if (!driver || !driver.id) {
        console.log('[LocationStore] Invalid driver data found');
        throw new Error('Driver not authenticated');
      }

      // Set tracking state to true without reinitializing services
      set({ isTracking: true });
      console.log('[LocationStore] Set tracking state to true');

      // Only update location in Firestore if we have a valid location
      const currentLocation = get().currentLocation;
      const hasValidLocation = currentLocation && 
                             currentLocation.latitude && 
                             currentLocation.longitude;
                             
      console.log('[LocationStore] Current location validity:', hasValidLocation);

      if (hasValidLocation) {
        // Initial update in Firestore with existing location (one-time only)
        console.log('[LocationStore] Initial Firestore update with existing location (one-time)');
        await firestore()
          .collection('drivers')
          .doc(driver.id)
          .update({
            currentLocation: {
              ...currentLocation,
              updatedAt: firestore.FieldValue.serverTimestamp()
            },
            lastLocationUpdate: firestore.FieldValue.serverTimestamp()
          });
      } else {
        // Only get a new location if we don't have a valid one
        console.log('[LocationStore] No valid location, attempting to get current position');
        try {
          const currentPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          
          if (currentPosition) {
            const newLocation = {
              latitude: currentPosition.coords.latitude,
              longitude: currentPosition.coords.longitude,
              timestamp: currentPosition.timestamp,
              accuracy: currentPosition.coords.accuracy
            };
            
            console.log('[LocationStore] Got new position, updating state');
            set({ currentLocation: newLocation });
            
            // Initial update in Firestore (one-time only)
            console.log('[LocationStore] Initial Firestore update with new position (one-time)');
            await firestore()
              .collection('drivers')
              .doc(driver.id)
              .update({
                currentLocation: {
                  ...newLocation,
                  updatedAt: firestore.FieldValue.serverTimestamp()
                },
                lastLocationUpdate: firestore.FieldValue.serverTimestamp()
              });
          }
        } catch (error) {
          console.error('[LocationStore] Error getting current position:', error);
          // Continue anyway - tracking will eventually get location
        }
      }

      // Only start location service tracking if not already tracking
      if (!locationService.isTracking()) {
        console.log('[LocationStore] Starting location service tracking');
        await locationService.startTracking();
        console.log('[LocationStore] Location tracking started successfully');
      } else {
        console.log('[LocationStore] Location service already tracking');
      }
    } catch (error) {
      console.error('[LocationStore] Error starting location tracking:', error);
      set({ locationError: error.message, isTracking: false });
    }
  },

  // Stop location tracking
  stopLocationTracking: async () => {
    console.log('[LocationStore] Stopping location tracking');
    try {
      // Get driver data from AsyncStorage instead of directly from authStore
      const driverJson = await AsyncStorage.getItem('driver');
      let driverId = null;
      
      if (driverJson) {
        const driver = JSON.parse(driverJson);
        driverId = driver?.id;
      }
      
      if (driverId) {
        console.log('[LocationStore] Updating last known location');
        // Update driver's last known location in Firestore
        await firestore()
          .collection('drivers')
          .doc(driverId)
          .update({ 
            lastLocationUpdate: firestore.FieldValue.serverTimestamp()
          });
      }

      console.log('[LocationStore] Stopping location service tracking');
      // Stop tracking but keep last known location
      locationService.stopTracking();
      set({ isTracking: false });
      console.log('[LocationStore] Location tracking stopped successfully');
    } catch (error) {
      console.error('[LocationStore] Error stopping location tracking:', error);
      set({ locationError: error.message });
    }
  },

  // Clear location error
  clearLocationError: () => {
    console.log('[LocationStore] Clearing location error state');
    set({
      locationError: null,
      locationErrorType: null,
      showLocationErrorModal: false
    });
  },

  // Get last known location
  getLastKnownLocation: async () => {
    console.log('[LocationStore] Fetching last known location');
    const location = await locationService.getLastKnownLocation();
    console.log('[LocationStore] Last known location:', location);
    return location;
  },

  // Cleanup resources
  cleanup: () => {
    console.log('[LocationStore] Starting cleanup');
    locationService.cleanup();
    set({
      isTracking: false,
      currentLocation: null,
      locationError: null,
      locationErrorType: null,
      showLocationErrorModal: false
    });
    console.log('[LocationStore] Cleanup complete');
  },

  // Set location error state
  setLocationError: ({ errorType, errorMessage, locationPermission, locationServicesEnabled }) => {
    console.log('[LocationStore] Setting location error:', errorType, errorMessage);
    set({
      locationError: errorMessage,
      locationErrorType: errorType,
      showLocationErrorModal: true,
      locationPermission: locationPermission || get().locationPermission,
      locationServicesEnabled: locationServicesEnabled !== undefined ? locationServicesEnabled : get().locationServicesEnabled
    });
  }
}));

export default useLocationStore;
