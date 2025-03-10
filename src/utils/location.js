import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useAuthStore } from '../store/authStore';
import geohash from 'ngeohash';
import { useEffect, useRef } from 'react';
import Geolocation from '@react-native-community/geolocation';

// Define the background location task name
export const LOCATION_TRACKING_TASK = 'background-location-tracking';

/**
 * Location utility functions with robust error handling and retry mechanism
 */

/**
 * Maximum number of retries for location fetch
 */
const MAX_RETRIES = 3;

/**
 * Delay between retries in milliseconds
 */
const RETRY_DELAY = 1000;

/**
 * Location permission status
 * @typedef {Object} LocationPermissionStatus
 * @property {string} foreground - Foreground permission status (granted/denied/undetermined)
 * @property {string} background - Background permission status (granted/denied/undetermined)
 * @property {string} services - Location services status (enabled/disabled)
 */

/**
 * Check if user is authenticated and registered
 * @returns {boolean} Whether the user is authenticated and registered
 */
const isUserAuthenticated = () => {
  const { isAuthenticated, needsWebRegistration } = useAuthStore.getState();
  return isAuthenticated && !needsWebRegistration;
};

/**
 * Check current location permission status without requesting
 * @returns {Promise<LocationPermissionStatus>} Current permission status
 */
export const getLocationPermissionStatus = async () => {
  try {
    const [
      foregroundStatus,
      backgroundStatus,
      servicesEnabled
    ] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Location.hasServicesEnabledAsync()
    ]);

    return {
      foreground: foregroundStatus.status,
      background: backgroundStatus.status,
      services: servicesEnabled ? 'enabled' : 'disabled'
    };
  } catch (error) {
    console.error('Error checking location permissions:', error);
    throw new Error('Failed to check location permissions status');
  }
};

/**
 * Check and request location permissions
 * @returns {Promise<LocationPermissionStatus>} Updated permission status
 */
export const ensureLocationPermissions = async () => {
  // Check if user is authenticated first
  if (!isUserAuthenticated()) {
    console.log('Not requesting location permissions - user not authenticated');
    return {
      foreground: 'undetermined',
      background: 'undetermined',
      services: 'disabled'
    };
  }
  
  try {
    // First check current status
    const currentStatus = await getLocationPermissionStatus();
    
    // Request permissions if needed
    const foreground = currentStatus.foreground !== 'granted'
      ? await Location.requestForegroundPermissionsAsync()
      : { status: currentStatus.foreground };

    const background = currentStatus.background !== 'granted'  
      ? await Location.requestBackgroundPermissionsAsync()
      : { status: currentStatus.background };

    const servicesEnabled = await Location.hasServicesEnabledAsync();

    return {
      foreground: foreground.status,
      background: background.status,
      services: servicesEnabled ? 'enabled' : 'disabled'
    };
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    throw new Error('Failed to request location permissions');
  }
};

/**
 * Granular check functions for specific location requirements
 */
export const checkLocationServices = async () => {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      throw new Error('location_services_disabled');
    }
    return true;
  } catch (error) {
    console.error('Error checking location services:', error);
    throw error.message === 'location_services_disabled'
      ? error
      : new Error('location_services_check_failed');
  }
};

// Update the existing LOCATION_CONFIG
const LOCATION_CONFIG = {
  // Basic config - use more conservative values
  accuracy: Location.Accuracy.Balanced, // Use Balanced instead of High accuracy
  enableHighAccuracy: false, // Don't force high accuracy
  timeout: 30000, // 30 seconds timeout (increased from 15000)
  maximumAge: 60000, // Accept locations up to 1 minute old (increased from 10000)
  
  // Throttling config - reduce frequency to save battery and reduce timeouts
  THROTTLE_INTERVAL: 10000, // 10 seconds (increased from 5 seconds)
  DISTANCE_INTERVAL: 20, // 20 meters (increased from 10)
  HEADING_THRESHOLD: 10, // 10 degrees (increased from 5)
  
  // Add new settings for background updates
  BACKGROUND_UPDATE_INTERVAL: 30000, // 30 seconds between background updates
  SIGNIFICANT_CHANGE_ONLY: true, // Only update when significant change in location
};

// Export the config
export { LOCATION_CONFIG };

/**
 * Detects device location capabilities and adjusts settings accordingly
 * This can help with devices that have trouble with location services
 */
export const detectLocationCapabilities = async () => {
  try {
    // Check if device can get a location fix at all
    const testLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeout: 5000
    }).catch(e => null);
    
    if (!testLocation) {
      console.log('Device struggling with location, will use conservative settings');
      
      // Update config for struggling devices
      LOCATION_CONFIG.accuracy = Location.Accuracy.Low;
      LOCATION_CONFIG.timeout = 60000; // 1 minute timeout
      LOCATION_CONFIG.THROTTLE_INTERVAL = 30000; // 30 seconds
      LOCATION_CONFIG.DISTANCE_INTERVAL = 50; // 50 meters
      
      return {
        hasGoodLocationCapability: false,
        suggestedAccuracy: 'Low'
      };
    }
    
    // If we got a location, check its accuracy
    const accuracy = testLocation.coords.accuracy || 100;
    
    if (accuracy < 20) { // Very accurate
      console.log('Device has excellent location capability');
      return {
        hasGoodLocationCapability: true,
        suggestedAccuracy: 'High' 
      };
    } else if (accuracy < 50) { // Decent accuracy
      console.log('Device has good location capability');
      return {
        hasGoodLocationCapability: true,
        suggestedAccuracy: 'Balanced'
      };
    } else { // Poor accuracy
      console.log('Device has limited location capability');
      
      // Update config for devices with poor GPS
      LOCATION_CONFIG.accuracy = Location.Accuracy.Low;
      LOCATION_CONFIG.THROTTLE_INTERVAL = 15000; // 15 seconds
      
      return {
        hasGoodLocationCapability: false,
        suggestedAccuracy: 'Low'
      };
    }
  } catch (error) {
    console.error('Error detecting location capabilities:', error);
    return {
      hasGoodLocationCapability: false,
      error: error.message
    };
  }
};

// Add throttle utility
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

// Throttled getCurrentLocation
export const getThrottledLocation = throttle(async (options = {}) => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: LOCATION_CONFIG.accuracy,
      ...options
    });
    return location;
  } catch (error) {
    console.error('Error getting throttled location:', error);
    throw error;
  }
}, LOCATION_CONFIG.THROTTLE_INTERVAL);

/**
 * Robust get current location with retry logic and error handling
 * @param {Object} options - Location options
 * @returns {Promise<Object>} Location object
 */
export const getCurrentLocation = async (options = {}) => {
  let retries = 0;
  let lastError = null;
  
  // Use a progressively increasing timeout strategy
  const baseTimeout = options.timeout || 10000; // 10 seconds base timeout
  let currentTimeout = baseTimeout;

  // Try to get location with retries
  while (retries < MAX_RETRIES) {
    try {
      // Check if location services are enabled before attempting to get location
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Location services are disabled');
      }

      console.log(`Attempting to get location (try ${retries + 1}/${MAX_RETRIES}), timeout: ${currentTimeout}ms`);
      
      // Create a promise that will reject after the timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), currentTimeout);
      });
      
      // Create the actual location request
      const locationPromise = Location.getCurrentPositionAsync({
        ...LOCATION_CONFIG,
        ...options,
        timeout: currentTimeout
      });
      
      // Race the location request against the timeout
      const location = await Promise.race([locationPromise, timeoutPromise]);
      
      // If we got a location, return it
      console.log('Successfully retrieved location');
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
    } catch (error) {
      lastError = error;
      console.warn(`Error getting location (attempt ${retries + 1}/${MAX_RETRIES}):`, error);
      
      // If this is a timeout error, increase the timeout for the next attempt
      if (error.code === 3 || error.message.includes('timed out')) {
        currentTimeout = currentTimeout * 1.5; // Increase timeout by 50%
        console.log(`Increasing timeout to ${currentTimeout}ms for next attempt`);
      }
      
      // If this is a Google Play services error or a timeout, try a different accuracy level
      if (error.message && (
          error.message.includes('Google Play services') || 
          error.message.includes('service disconnection') ||
          error.code === 3 ||
          error.message.includes('timed out')
      )) {
        // Use a lower accuracy on retry
        if (retries === 0) {
          options = {
            ...options,
            accuracy: Location.Accuracy.Balanced,
            enableHighAccuracy: false,
          };
        } else {
          options = {
            ...options,
            accuracy: Location.Accuracy.Low,
            enableHighAccuracy: false,
          };
        }
        console.log(`Lowering location accuracy for next attempt: ${options.accuracy}`);
      }
      
      // Wait before retrying with an increasing delay
      const delayMs = RETRY_DELAY * (retries + 1);
      console.log(`Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      retries++;
    }
  }

  // All retries failed, attempt to return last cached location instead
  console.error('All location attempts failed:', lastError);
  
  try {
    const cachedLocation = await getLocationCache();
    if (cachedLocation) {
      console.log('Returning cached location due to failed attempts');
      return cachedLocation;
    }
  } catch (cacheError) {
    console.error('Error retrieving cached location:', cacheError);
  }
  
  throw lastError;
};

// Update watchLocation to use the config
export const watchLocation = async (onLocationChange, onError, options = {}) => {
  if (!isUserAuthenticated()) {
    console.log('Not watching location - user not authenticated');
    return () => {};
  }
  
  try {
    const permissions = await ensureLocationPermissions();
    
    if (permissions.foreground !== 'granted') {
      throw new Error('Location permission not granted');
    }
    
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error('Location services are disabled');
    }
    
    // Use more conservative defaults to reduce timeouts
    const watchOptions = {
      accuracy: options.accuracy || LOCATION_CONFIG.accuracy,
      timeInterval: options.timeInterval || LOCATION_CONFIG.THROTTLE_INTERVAL,
      distanceInterval: options.distanceInterval || LOCATION_CONFIG.DISTANCE_INTERVAL,
      // Add timeout with a generous value
      timeout: options.timeout || 30000, // 30 seconds timeout
      // Explicitly add additional options that help with location reliability
      mayShowUserSettingsDialog: true, // Let the user enable location if needed
      // Accept higher age locations to prevent unnecessary GPS activations
      maximumAge: 60000 // 1 minute
    };
    
    console.log('Starting location watcher with options:', {
      accuracy: watchOptions.accuracy,
      timeInterval: watchOptions.timeInterval,
      distanceInterval: watchOptions.distanceInterval,
      timeout: watchOptions.timeout
    });
    
    let locationUpdateCount = 0;
    let lastLocationTimestamp = Date.now(); // Initialize with current time
    let subscription = null;
    let healthCheckIntervalId = null;
    
    // Create health check function
    const setupHealthCheck = () => {
      // Clear any existing interval
      if (healthCheckIntervalId) {
        clearInterval(healthCheckIntervalId);
      }
      
      // Set up new health check
      healthCheckIntervalId = setInterval(() => {
        const now = Date.now();
        // If we haven't received a location update in 2 minutes, there might be an issue
        if (now - lastLocationTimestamp > 120000) {
          console.warn('No location updates received for 2 minutes, watcher might be stuck');
          
          try {
            // Only try to remove if the subscription exists and has a remove method
            if (subscription && typeof subscription.remove === 'function') {
              subscription.remove();
              console.log('Removed potentially stuck location watcher');
            }
            
            // Clear this interval since we're restarting
            clearInterval(healthCheckIntervalId);
            healthCheckIntervalId = null;
            
            // Notify caller about restart
            onError(new Error('Location watcher restarted due to inactivity'));
          } catch (error) {
            console.error('Error while attempting to restart watcher:', error);
          }
        }
      }, 60000); // Check every minute
      
      return healthCheckIntervalId;
    };
    
    // First try to get a one-time location to ensure the GPS is working
    try {
      console.log('Getting initial location before starting watcher...');
      const initialLocation = await getCurrentLocation({
        accuracy: watchOptions.accuracy,
        timeout: 10000,
        maximumAge: 60000
      }).catch(e => null);
      
      if (initialLocation) {
        console.log('Initial location check successful');
        // Process the initial location
        onLocationChange(initialLocation);
        lastLocationTimestamp = Date.now();
      } else {
        console.log('Initial location check failed, continuing with watcher anyway');
      }
    } catch (error) {
      console.warn('Error getting initial location:', error);
      // Continue anyway - the watcher might still work
    }
    
    // Now start the continuous watcher
    try {
      subscription = await Location.watchPositionAsync(
        watchOptions,
        (location) => {
          if (!isUserAuthenticated()) {
            console.log('Ignoring location update - user not authenticated');
            return;
          }
          
          locationUpdateCount++;
          lastLocationTimestamp = Date.now();
          
          if (locationUpdateCount % 5 === 0) {
            console.log(`Received ${locationUpdateCount} location updates so far`);
          }
          
          onLocationChange(location);
        }
      );
      
      // Set up health check after subscription is created
      healthCheckIntervalId = setupHealthCheck();
    
      // Create a more robust cleanup function
      const cleanup = () => {
        try {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
          }
          
          if (healthCheckIntervalId) {
            clearInterval(healthCheckIntervalId);
          }
          
          console.log('Location watcher and health check removed');
        } catch (error) {
          console.warn('Error removing location watcher:', error);
        }
      };
      
      return cleanup;
    } catch (initialWatchError) {
      console.error('Error setting up location watcher:', initialWatchError);
      
      // If watchPositionAsync fails, try one more time with lower accuracy
      console.log('Retrying watcher with lower accuracy...');
      
      try {
        const fallbackOptions = {
          ...watchOptions,
          accuracy: Location.Accuracy.Low,
          timeInterval: watchOptions.timeInterval * 2,
          distanceInterval: watchOptions.distanceInterval * 2
        };
        
        console.log('Fallback watcher options:', fallbackOptions);
        
        subscription = await Location.watchPositionAsync(
          fallbackOptions,
          (location) => {
            if (!isUserAuthenticated()) {
              console.log('Ignoring location update - user not authenticated');
              return;
            }
            
            locationUpdateCount++;
            lastLocationTimestamp = Date.now();
            
            onLocationChange(location);
          }
        );
        
        // Set up health check for fallback watcher
        healthCheckIntervalId = setupHealthCheck();
        
        // Return cleanup function for fallback watcher
        return () => {
          try {
            if (subscription && typeof subscription.remove === 'function') {
              subscription.remove();
            }
            
            if (healthCheckIntervalId) {
              clearInterval(healthCheckIntervalId);
            }
            
            console.log('Fallback location watcher and health check removed');
          } catch (error) {
            console.warn('Error removing fallback location watcher:', error);
          }
        };
      } catch (fallbackError) {
        console.error('Fallback watcher also failed:', fallbackError);
        onError(fallbackError);
        return () => {};
      }
    }
  } catch (error) {
    console.error('Error watching location:', error);
    onError(error);
    return () => {};
  }
};

/**
 * Calculate distance between two coordinates in meters
 * 
 * @param {Object} coord1 - First coordinate
 * @param {number} coord1.latitude - Latitude of first coordinate
 * @param {number} coord1.longitude - Longitude of first coordinate
 * @param {Object} coord2 - Second coordinate
 * @param {number} coord2.latitude - Latitude of second coordinate
 * @param {number} coord2.longitude - Longitude of second coordinate
 * @returns {number} Distance in meters
 */
export const calculateDistance = (coord1, coord2) => {
  try {
    // Validate coordinates
    if (!coord1?.latitude || !coord1?.longitude || !coord2?.latitude || !coord2?.longitude) {
      console.error('Invalid coordinates:', { coord1, coord2 });
      return Infinity;
    }

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    console.log('Distance calculation:', {
      from: coord1,
      to: coord2,
      distance: distance.toFixed(2)
    });

    return distance;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return Infinity;
  }
};

/**
 * Check if a location is within a specified radius
 * 
 * @param {Object} center - Center coordinate
 * @param {number} center.latitude - Latitude of center
 * @param {number} center.longitude - Longitude of center
 * @param {Object} point - Point to check
 * @param {number} point.latitude - Latitude of point
 * @param {number} point.longitude - Longitude of point
 * @param {number} radius - Radius in meters
 * @returns {boolean} Whether the point is within the radius
 */
export const isWithinRadius = (center, point, radius) => {
  const distance = calculateDistance(center, point);
  return distance <= radius;
};

/**
 * Reverse geocode coordinates to get address information.
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Array|null>} Geocode result array or null if not found or on error
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    console.log(`Reverse geocoding: ${latitude}, ${longitude}`);
    const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    console.log("Geocode result:", geocode);
    return geocode.length > 0 ? geocode : null;
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return null; // Handle errors appropriately
  }
};

/**
 * Watch for changes in location services availability
 * 
 * @param {Function} onAvailabilityChange - Callback for service availability changes
 * @returns {Function} Cleanup function to stop watching
 */
export const watchLocationServices = (onAvailabilityChange) => {
  let isRunning = true;
  let intervalId = null;
  let lastValue = null;

  const checkAvailability = async () => {
    try {
      if (!isRunning) {
        return; // Don't continue if we've been cancelled
      }
      
      const available = await Location.hasServicesEnabledAsync();
      
      // Only call the callback if the value has changed
      if (lastValue === null || available !== lastValue) {
        lastValue = available;
        onAvailabilityChange(available);
      }
    } catch (error) {
      console.error('Error checking location services:', error);
    }
  };

  // Check immediately
  checkAvailability();
  
  // Setup polling with a more reasonable interval (15 seconds instead of 5)
  intervalId = setInterval(checkAvailability, 15000);
  
  // Return function to cancel subscription
  return () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

export const calculateFare = (distanceInMeters) => {
  // Convert to kilometers
  const distanceInKm = distanceInMeters / 1000;
  
  // Base fare: 25 pesos for first 1 km
  const baseFare = 25;
  
  // Additional fare: 8 pesos per km after first 1 km
  const additionalDistance = Math.max(0, distanceInKm - 1);
  const additionalFare = Math.ceil(additionalDistance) * 8;
  
  // Total fare
  const totalFare = baseFare + additionalFare;
  
  // System fee: 12% of total fare
  const systemFee = Math.round(totalFare * 0.12);
  
  // Driver earnings
  const driverEarnings = totalFare - systemFee;
  
  return {
    totalFare,
    baseFare,
    additionalFare,
    systemFee,
    driverEarnings,
    distance: distanceInKm,
  };
};

export const calculateGeohashRange = (location, radiusInMeters) => {
  const lat = location.latitude;
  const lng = location.longitude;
  
  // Convert radius to degrees (approximate)
  const radiusInDegrees = radiusInMeters / 111320;
  
  // Calculate bounding box
  const minLat = lat - radiusInDegrees;
  const maxLat = lat + radiusInDegrees;
  const minLng = lng - radiusInDegrees;
  const maxLng = lng + radiusInDegrees;
  
  // Calculate geohash precision based on radius
  const precision = Math.ceil(Math.log(111320 / radiusInMeters) / Math.log(2));
  
  return {
    lower: geohash.encode(minLat, minLng, precision),
    upper: geohash.encode(maxLat, maxLng, precision)
  };
};

export const useLocationWatcher = (onLocationUpdate) => {
  const locationWatcher = useRef(null);
  const watchdogTimer = useRef(null);

  useEffect(() => {
    const startLocationWatcher = () => {
      if (locationWatcher.current) {
        Geolocation.clearWatch(locationWatcher.current);
      }

      locationWatcher.current = Geolocation.watchPosition(
        (position) => {
          clearTimeout(watchdogTimer.current);
          onLocationUpdate(position);
          // Restart the watchdog timer
          watchdogTimer.current = setTimeout(() => {
            console.warn('No location updates received for 2 minutes, watcher might be stuck');
            startLocationWatcher(); // Restart the watcher
          }, 2 * 60 * 1000); // 2 minutes
        },
        (error) => {
          console.error('Location tracking error:', error);
          // Optionally restart the watcher on error
          startLocationWatcher();
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // meters
          interval: 10000, // milliseconds
          fastestInterval: 5000, // milliseconds
        }
      );
    };

    startLocationWatcher();

    return () => {
      if (locationWatcher.current) {
        Geolocation.clearWatch(locationWatcher.current);
      }
      clearTimeout(watchdogTimer.current);
    };
  }, [onLocationUpdate]);
};
