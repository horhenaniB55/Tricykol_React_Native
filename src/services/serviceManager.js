import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { locationService } from './locationService';
import { bookingsService } from './bookings';
import useLocationStore from '../store/locationStore';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ServiceManager handles centralized initialization, monitoring, and recovery
 * of essential app services such as location and bookings.
 */
class ServiceManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize all required services at app startup
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.initialized) {
      console.log('[ServiceManager] Already initialized, skipping');
      return true;
    }

    console.log('[ServiceManager] Initializing services...');
    try {
      // We won't use explicit listeners since they may not be supported in all Expo versions
      // Instead, we'll rely on the AppState change handler in App.js
      console.log('[ServiceManager] Skipping explicit listeners setup, will use AppState changes');
      
      // Initialize location service
      const locationInitialized = await this.initializeLocationService();
      
      this.initialized = true;
      console.log('[ServiceManager] Services initialized successfully');
      return locationInitialized;
    } catch (error) {
      console.error('[ServiceManager] Initialization error:', error);
      return false;
    }
  }

  /**
   * Initialize location service and handle permissions
   */
  async initializeLocationService() {
    try {
      console.log('[ServiceManager] Initializing location service');
      
      // Check if user is authenticated before proceeding
      const { isAuthenticated, needsWebRegistration } = useAuthStore.getState();
      if (!isAuthenticated || needsWebRegistration) {
        console.log('[ServiceManager] Not initializing location services - user not fully authenticated');
        return false;
      }
      
      // Check for foreground permissions
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      console.log('[ServiceManager] Foreground permission status:', foregroundStatus);
      
      // Request permissions if not granted
      if (foregroundStatus !== 'granted') {
        console.log('[ServiceManager] Requesting foreground location permission');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[ServiceManager] Foreground permission denied');
          this.handleLocationError('permission');
          return false;
        }
      }
      
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      console.log('[ServiceManager] Location services enabled:', servicesEnabled);
      
      if (!servicesEnabled) {
        console.log('[ServiceManager] Location services disabled');
        this.handleLocationError('services');
        return false;
      }
      
      // Initialize the location service
      await locationService.initialize();
      
      return true;
    } catch (error) {
      console.error('[ServiceManager] Location service initialization error:', error);
      this.handleLocationError('unknown', error.message);
      return false;
    }
  }

  /**
   * Initialize bookings service
   * @param {string} driverId The current driver's ID
   */
  async initializeBookingsService(driverId) {
    if (!driverId) {
      try {
        // Try to get driver ID from AsyncStorage first
        const driverJson = await AsyncStorage.getItem('driver');
        if (driverJson) {
          const driver = JSON.parse(driverJson);
          if (driver && driver.id) {
            console.log('[ServiceManager] Using driver ID from AsyncStorage:', driver.id);
            driverId = driver.id;
          }
        }
        
        // If that fails, try from authStore
        if (!driverId) {
          const authStore = useAuthStore.getState();
          const currentDriver = authStore?.driver;
          if (currentDriver && currentDriver.id) {
            console.log('[ServiceManager] Using current driver ID:', currentDriver.id);
            driverId = currentDriver.id;
          } else {
            console.log('[ServiceManager] No driver ID available');
            return false;
          }
        }
      } catch (error) {
        console.error('[ServiceManager] Error getting driver ID:', error);
        return false;
      }
    }
    
    // Check if the bookings service is already initialized with the same driver ID
    if (bookingsService.isInitialized && bookingsService.userId === driverId) {
      console.log('[ServiceManager] Bookings service already initialized for driver:', driverId);
      
      // Even if already initialized, ensure we have location
      try {
        const locationStore = useLocationStore.getState();
        const currentLocation = locationStore?.currentLocation;
        
        if (currentLocation && !bookingsService.bookingsListener) {
          console.log('[ServiceManager] Restarting bookings listener with location:', currentLocation);
          bookingsService.startBookingsListener(currentLocation);
        }
      } catch (error) {
        console.error('[ServiceManager] Error checking location for initialized service:', error);
      }
      return;
    }
    
    console.log('[ServiceManager] Initializing bookings service for driver:', driverId);
    bookingsService.initialize(driverId);

    // Get current location from location store and start bookings listener
    try {
      // First try to get location from store
      const locationStore = useLocationStore.getState();
      let currentLocation = locationStore?.currentLocation;
      
      // If no location in store, try to get from location service
      if (!currentLocation) {
        console.log('[ServiceManager] No location in store, checking location service');
        try {
          currentLocation = await locationService.getLastKnownLocation();
          console.log('[ServiceManager] Got location from service:', currentLocation);
        } catch (error) {
          console.error('[ServiceManager] Error getting location from service:', error);
        }
      }
      
      if (currentLocation) {
        // Ensure location has required properties
        const formattedLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        };
        
        console.log('[ServiceManager] Starting bookings listener with location:', formattedLocation);
        bookingsService.startBookingsListener(formattedLocation);
      } else {
        console.log('[ServiceManager] No current location available for bookings service');
        
        // Set up a one-time check for location after a short delay
        setTimeout(async () => {
          try {
            const retryLocation = await locationService.getLastKnownLocation();
            if (retryLocation) {
              console.log('[ServiceManager] Got location on retry:', retryLocation);
              bookingsService.startBookingsListener({
                latitude: retryLocation.latitude,
                longitude: retryLocation.longitude
              });
            }
          } catch (error) {
            console.error('[ServiceManager] Error getting location on retry:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('[ServiceManager] Error getting location for bookings service:', error);
    }
  }
  
  /**
   * Check if the bookings service is already initialized
   * @returns {boolean} True if the bookings service is initialized
   */
  isBookingsServiceInitialized() {
    return bookingsService.isInitialized;
  }

  /**
   * Check if location services are available without reinitializing
   * @returns {Promise<boolean>} True if location services are available
   */
  async checkLocationStatus() {
    console.log('[ServiceManager] Checking location status');
    try {
      // Check for foreground permissions without requesting
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      console.log('[ServiceManager] Foreground permission status:', foregroundStatus);
      
      if (foregroundStatus !== 'granted') {
        console.log('[ServiceManager] Foreground permission not granted');
        this.handleLocationError('permission');
        return false;
      }
      
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      console.log('[ServiceManager] Location services enabled:', servicesEnabled);
      
      if (!servicesEnabled) {
        console.log('[ServiceManager] Location services disabled');
        this.handleLocationError('services');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[ServiceManager] Error checking location status:', error);
      this.handleLocationError('unknown', error.message);
      return false;
    }
  }

  /**
   * Handle location-related errors
   * @param {string} errorType The type of error (permission, services, accuracy, unknown)
   * @param {string} errorMessage Optional error message
   */
  handleLocationError(errorType, errorMessage = null) {
    console.log(`[ServiceManager] Handling location error: ${errorType}`, errorMessage);
    
    try {
      const locationStore = useLocationStore.getState();
      if (!locationStore) {
        console.error('[ServiceManager] Could not access locationStore');
        return;
      }
      
      // Update location store with error information
      let locationPermission = 'denied';
      let locationServicesEnabled = true;
      
      if (errorType === 'services') {
        locationServicesEnabled = false;
      }
      
      locationStore.setLocationError({
        errorType,
        errorMessage,
        locationPermission,
        locationServicesEnabled
      });
    } catch (error) {
      console.error('[ServiceManager] Error updating location store:', error);
    }
  }

  /**
   * Try to recover location services
   */
  async recoverLocationServices() {
    console.log('[ServiceManager] Attempting to recover location services');
    try {
      // Check permissions
      let status;
      try {
        const permissionResponse = await Location.getForegroundPermissionsAsync();
        status = permissionResponse.status;
        console.log('[ServiceManager] Permission status for recovery:', status);
      } catch (error) {
        console.error('[ServiceManager] Error checking permissions for recovery:', error);
        this.handleLocationError('unknown', 'Error checking location permissions');
        return false;
      }
      
      if (status !== 'granted') {
        console.log('[ServiceManager] Location permission still denied');
        this.handleLocationError('permission');
        return false;
      }
      
      // Check if location services are enabled
      let servicesEnabled;
      try {
        servicesEnabled = await Location.hasServicesEnabledAsync();
        console.log('[ServiceManager] Location services enabled for recovery:', servicesEnabled);
      } catch (error) {
        console.error('[ServiceManager] Error checking location services for recovery:', error);
        this.handleLocationError('unknown', 'Error checking if location services are enabled');
        return false;
      }
      
      if (!servicesEnabled) {
        console.log('[ServiceManager] Location services still disabled');
        this.handleLocationError('services');
        return false;
      }
      
      // Try to reinitialize location service
      try {
        await locationService.initialize();
      } catch (error) {
        console.error('[ServiceManager] Error initializing location service during recovery:', error);
        this.handleLocationError('unknown', 'Error initializing location services');
        return false;
      }
      
      // Update location store
      try {
        const locationStore = useLocationStore.getState();
        if (locationStore) {
          locationStore.clearLocationError();
        }
      } catch (error) {
        console.error('[ServiceManager] Error clearing location error:', error);
      }
      
      console.log('[ServiceManager] Location services recovered successfully');
      return true;
    } catch (error) {
      console.error('[ServiceManager] Error recovering location services:', error);
      try {
        this.handleLocationError('unknown', error.message || 'Unknown error during recovery');
      } catch (innerError) {
        console.error('[ServiceManager] Error handling location error during recovery:', innerError);
      }
      return false;
    }
  }

  /**
   * Check location status
   * Called when app comes to foreground to detect changes
   */
  async checkLocationStatus() {
    console.log('[ServiceManager] Checking location status');
    try {
      // Check permissions
      let status;
      try {
        const permissionResponse = await Location.getForegroundPermissionsAsync();
        status = permissionResponse.status;
        console.log('[ServiceManager] Permission status:', status);
      } catch (error) {
        console.error('[ServiceManager] Error checking permissions:', error);
        this.handleLocationError('unknown', 'Error checking location permissions');
        return false;
      }
      
      if (status !== 'granted') {
        this.handleLocationError('permission');
        return false;
      }
      
      // Check if location services are enabled
      let servicesEnabled;
      try {
        servicesEnabled = await Location.hasServicesEnabledAsync();
        console.log('[ServiceManager] Location services enabled:', servicesEnabled);
      } catch (error) {
        console.error('[ServiceManager] Error checking location services:', error);
        this.handleLocationError('unknown', 'Error checking if location services are enabled');
        return false;
      }
      
      if (!servicesEnabled) {
        this.handleLocationError('services');
        return false;
      }
      
      // Everything is fine, clear any existing errors
      try {
        const locationStore = useLocationStore.getState();
        if (locationStore && locationStore.locationError) {
          console.log('[ServiceManager] Clearing location errors');
          locationStore.clearLocationError();
        }
      } catch (error) {
        console.error('[ServiceManager] Error clearing location error:', error);
      }
      
      return true;
    } catch (error) {
      console.error('[ServiceManager] Error checking location status:', error);
      try {
        this.handleLocationError('unknown', error.message || 'Unknown error checking location status');
      } catch (innerError) {
        console.error('[ServiceManager] Error handling location error:', innerError);
      }
      return false;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('[ServiceManager] Cleaning up service manager');
    this.initialized = false;
  }
}

// Export singleton instance
export const serviceManager = new ServiceManager(); 