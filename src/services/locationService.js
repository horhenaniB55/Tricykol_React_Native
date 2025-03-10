import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistance } from 'geolib';
import firestore from '@react-native-firebase/firestore';
import { useAuthStore } from '../store/authStore';

// Constants
const SIGNIFICANT_DISTANCE = 30; // Increased from 20 to 30 meters for better stability
const LOCATION_CONFIG = {
  accuracy: Location.Accuracy.High, // Changed from Balanced to High
  timeInterval: 10000, // Increased from 5000 to 10000 ms (10 seconds) 
  distanceInterval: 10, // Increased from 5 to 10 meters
};

// Maximum acceptable accuracy value in meters (lower is better)
const MAX_ACCEPTABLE_ACCURACY = 25; 

const STORAGE_KEY = '@driver_location';

// Check if user is authenticated and registered
const isUserAuthenticated = () => {
  const { isAuthenticated, needsWebRegistration } = useAuthStore.getState();
  return isAuthenticated && !needsWebRegistration;
};

class LocationService {
  constructor() {
    this.locationSubscription = null;
    this.lastKnownLocation = null;
    console.log('[LocationService] Service initialized');
  }

  async initialize() {
    try {
      console.log('[LocationService] Starting initialization...');
      
      // Check if user is authenticated before requesting permissions
      if (!isUserAuthenticated()) {
        console.log('[LocationService] Not requesting location permissions - user not authenticated');
        throw new Error('User not authenticated');
      }
      
      // Request permissions
      console.log('[LocationService] Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[LocationService] Permission status:', status);
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Check if location services are enabled
      console.log('[LocationService] Checking location services...');
      const enabled = await Location.hasServicesEnabledAsync();
      console.log('[LocationService] Location services enabled:', enabled);
      if (!enabled) {
        throw new Error('Location services are disabled');
      }

      // Try to get location from storage first
      console.log('[LocationService] Checking stored location...');
      const storedLocation = await AsyncStorage.getItem(STORAGE_KEY);
      let lastLocation = storedLocation ? JSON.parse(storedLocation) : null;

      // Get current location with retries
      console.log('[LocationService] Getting current location...');
      let currentLocation = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!currentLocation && retryCount < maxRetries) {
        try {
          const location = await Location.getCurrentPositionAsync({
            ...LOCATION_CONFIG,
            accuracy: Location.Accuracy.High // Always use high accuracy
          });

          if (location && location.coords) {
            // Check if the accuracy is acceptable
            if (location.coords.accuracy <= MAX_ACCEPTABLE_ACCURACY) {
              currentLocation = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp,
                accuracy: location.coords.accuracy,
                heading: location.coords.heading,
                speed: location.coords.speed
              };
              console.log(`[LocationService] Got location with acceptable accuracy: ${location.coords.accuracy}m`);
              break;
            } else {
              console.log(`[LocationService] Accuracy too low: ${location.coords.accuracy}m, retrying...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer (2s) between retries
            }
          }
        } catch (error) {
          console.warn(`[LocationService] Retry ${retryCount + 1} failed:`, error);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between retries
        }
      }

      if (currentLocation) {
        console.log('[LocationService] Successfully got current location');
        // Update both storage and Firestore
        await this.updateStoredLocation(currentLocation);
        await this.updateFirestoreLocation(currentLocation);
        this.lastKnownLocation = currentLocation;
      } else if (lastLocation) {
        console.log('[LocationService] Using stored location as fallback');
        // Use stored location as fallback
        this.lastKnownLocation = lastLocation;
        // Try to update Firestore with stored location
        await this.updateFirestoreLocation(lastLocation);
      } else {
        console.warn('[LocationService] No location available after retries');
      }

      console.log('[LocationService] Initialization complete');
      return true;
    } catch (error) {
      console.error('[LocationService] Initialization error:', error);
      throw error;
    }
  }

  async startTracking() {
    if (this.locationSubscription) {
      console.log('[LocationService] Tracking already active');
      return;
    }

    try {
      console.log('[LocationService] Starting location tracking with config:', LOCATION_CONFIG);
      this.locationSubscription = await Location.watchPositionAsync(
        LOCATION_CONFIG,
        this.handleLocationUpdate
      );
      console.log('[LocationService] Location tracking started successfully');
    } catch (error) {
      console.error('[LocationService] Error starting location tracking:', error);
      throw error;
    }
  }

  stopTracking() {
    if (this.locationSubscription) {
      console.log('[LocationService] Stopping location tracking');
      this.locationSubscription.remove();
      this.locationSubscription = null;
      console.log('[LocationService] Location tracking stopped');
    }
  }

  isTracking() {
    return this.locationSubscription !== null;
  }

  handleLocationUpdate = async (location) => {
    console.log('[LocationService] Received new location update');
    
    // Skip updates with low accuracy
    if (location.coords.accuracy > MAX_ACCEPTABLE_ACCURACY) {
      console.log(`[LocationService] Skipping low accuracy update (${location.coords.accuracy}m)`);
      return;
    }
    
    const newLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed
    };

    // If we have a last known location, check if we've moved enough
    if (this.lastKnownLocation) {
      const distance = getDistance(
        {
          latitude: this.lastKnownLocation.latitude,
          longitude: this.lastKnownLocation.longitude
        },
        {
          latitude: newLocation.latitude,
          longitude: newLocation.longitude
        }
      );

      console.log(`[LocationService] Distance moved: ${distance}m (accuracy: ${newLocation.accuracy}m)`);

      // Apply additional confidence check: If distance moved is less than combined accuracy, likely noise
      const combinedAccuracy = this.lastKnownLocation.accuracy + newLocation.accuracy;
      if (distance < combinedAccuracy) {
        console.log(`[LocationService] Movement likely due to GPS noise (distance: ${distance}m < combined accuracy: ${combinedAccuracy}m)`);
        console.log('[LocationService] Movement below threshold, skipping update');
        return;
      }

      // Only update if we've moved more than SIGNIFICANT_DISTANCE meters
      if (distance >= SIGNIFICANT_DISTANCE) {
        console.log('[LocationService] Significant movement detected, updating location');
        // First save to local storage and remove old
        await this.updateStoredLocation(newLocation, true);
        // No longer push to Firestore on location changes - only update locally
        console.log('[LocationService] Location stored locally. Skipping Firestore update for regular location change.');
      } else {
        console.log('[LocationService] Movement below threshold, skipping update');
      }
    } else {
      console.log('[LocationService] First location update, storing location');
      // First save to local storage
      await this.updateStoredLocation(newLocation);
      // Only push to Firestore for initial location (first location after starting tracking)
      await this.updateFirestoreLocation(newLocation);
      console.log('[LocationService] Initial location pushed to Firestore (one-time)');
    }
  };

  async updateStoredLocation(newLocation, removeOld = false) {
    try {
      // Ensure we have accuracy information in the location
      if (newLocation && !newLocation.accuracy) {
        console.log('[LocationService] Warning: Location missing accuracy information');
        // Default to a reasonable accuracy value if missing
        newLocation.accuracy = 20;
      }
      
      // Replace direct store access with function parameter or AsyncStorage check
      // Get driverId from AsyncStorage if needed instead of the store
      
      // Always store the latest location in memory
      this.lastKnownLocation = newLocation;

      // Always update storage since driver is always online
      console.log('[LocationService] Updating stored location');
      if (removeOld) {
        console.log('[LocationService] Removing old location from storage');
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
      console.log('[LocationService] Location storage update complete');
    } catch (error) {
      console.error('[LocationService] Error updating stored location:', error);
    }
  }

  async updateFirestoreLocation(location) {
    try {
      // Skip update if location accuracy is poor
      if (location.accuracy > MAX_ACCEPTABLE_ACCURACY) {
        console.log(`[LocationService] Skipping Firestore update due to poor accuracy: ${location.accuracy}m`);
        return;
      }
      
      // Instead of getting driver from authStore, get the driverId from a parameter or AsyncStorage
      const driverId = await this.getDriverId();
      if (!driverId) {
        console.log('[LocationService] No authenticated driver, skipping Firestore update');
        return;
      }

      console.log('[LocationService] Updating location in Firestore');
      const locationData = {
        ...location,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        // Add TTL - 24 hours from now
        expiresAt: firestore.Timestamp.fromDate(
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        )
      };

      await firestore()
        .collection('drivers')
        .doc(driverId)
        .update({
          currentLocation: locationData,
          lastLocationUpdate: firestore.FieldValue.serverTimestamp()
        });

      console.log('[LocationService] Firestore location updated successfully');
    } catch (error) {
      console.error('[LocationService] Error updating Firestore location:', error);
      // If Firestore update fails, ensure we still have the location locally
      await this.updateStoredLocation(location);
    }
  }
  
  // Helper method to get driver ID from AsyncStorage
  async getDriverId() {
    try {
      const driverJson = await AsyncStorage.getItem('driver');
      if (driverJson) {
        const driver = JSON.parse(driverJson);
        return driver.id;
      }
      return null;
    } catch (error) {
      console.error('[LocationService] Error getting driver ID:', error);
      return null;
    }
  }

  async getLastKnownLocation() {
    try {
      // Check memory first
      if (this.lastKnownLocation) {
        console.log('[LocationService] Returning last known location from memory');
        return this.lastKnownLocation;
      }

      // Check AsyncStorage
      const storedLocation = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedLocation) {
        console.log('[LocationService] Found location in AsyncStorage');
        try {
          const location = JSON.parse(storedLocation);
          
          // Validate location data
          if (!location || 
              typeof location.latitude !== 'number' || 
              typeof location.longitude !== 'number' ||
              isNaN(location.latitude) || 
              isNaN(location.longitude)) {
            console.warn('[LocationService] Invalid location data in AsyncStorage:', location);
            // Remove invalid data
            await AsyncStorage.removeItem(STORAGE_KEY);
            return null;
          }
          
          // Validate location accuracy if available
          if (location.accuracy && location.accuracy > MAX_ACCEPTABLE_ACCURACY) {
            console.log(`[LocationService] Stored location has poor accuracy (${location.accuracy}m), but using as fallback`);
          }
          
          // Validate timestamp if available (older than 1 hour)
          if (location.timestamp && (new Date().getTime() - location.timestamp > 60 * 60 * 1000)) {
            console.log(`[LocationService] Stored location is old (${Math.round((new Date().getTime() - location.timestamp) / (60 * 1000))} minutes), but using as fallback`);
          }
          
          // Ensure location has a timestamp
          if (!location.timestamp) {
            location.timestamp = new Date().getTime();
          }
          
          this.lastKnownLocation = location;
          return location;
        } catch (error) {
          console.error('[LocationService] Error parsing location from AsyncStorage:', error);
          // Remove invalid data
          await AsyncStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }

      // Check Firestore as last resort
      const driverId = await this.getDriverId();
      if (driverId) {
        console.log('[LocationService] Checking Firestore as last resort');
        try {
          const driverDoc = await firestore()
            .collection('drivers')
            .doc(driverId)
            .get();

          if (driverDoc.exists) {
            const data = driverDoc.data();
            if (data.currentLocation) {
              console.log('[LocationService] Found location in Firestore');
              this.lastKnownLocation = data.currentLocation;
              // Save Firestore location to local storage
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data.currentLocation));
              return data.currentLocation;
            }
          }
        } catch (error) {
          console.error('[LocationService] Error getting location from Firestore:', error);
        }
      }

      console.log('[LocationService] No location found in any source');
      return null;
    } catch (error) {
      console.error('[LocationService] Error getting last known location:', error);
      return null;
    }
  }

  async updateLocation(location) {
    try {
      if (!location || 
          typeof location.latitude !== 'number' || 
          typeof location.longitude !== 'number' ||
          isNaN(location.latitude) || 
          isNaN(location.longitude)) {
        console.warn('[LocationService] Attempted to update with invalid location:', location);
        return false;
      }
      
      // Ensure location has a timestamp
      const locationWithTimestamp = {
        ...location,
        timestamp: location.timestamp || new Date().getTime()
      };
      
      // Update memory cache
      this.lastKnownLocation = locationWithTimestamp;
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locationWithTimestamp));
      console.log('[LocationService] Location updated and saved to AsyncStorage');
      
      return true;
    } catch (error) {
      console.error('[LocationService] Error updating location:', error);
      return false;
    }
  }

  cleanup() {
    console.log('[LocationService] Starting cleanup');
    this.stopTracking();
    this.lastKnownLocation = null;
    console.log('[LocationService] Cleanup complete');
  }
}

// Export singleton instance
export const locationService = new LocationService(); 