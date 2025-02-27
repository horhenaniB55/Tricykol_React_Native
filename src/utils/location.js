import * as Location from 'expo-location';

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

// Add this configuration
const LOCATION_CONFIG = {
  accuracy: Location.Accuracy.Balanced,
  enableHighAccuracy: false, // Prevent accuracy prompts
  timeout: 15000,
  maximumAge: 10000
};

let locationInitialized = false;

export const initializeLocation = async () => {
  if (locationInitialized) return;

  try {
    const location = await Location.getCurrentPositionAsync({
      ...LOCATION_CONFIG,
      accuracy: Location.Accuracy.Balanced // Use balanced accuracy for initial position
    });
    
    locationInitialized = true;
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error initializing location:', error);
    throw error;
  }
};

// Update getCurrentLocation to use cached settings
export const getCurrentLocation = async (options = {}) => {
  try {
    const location = await Location.getCurrentPositionAsync({
      ...LOCATION_CONFIG,
      ...options
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
};

/**
 * Start watching location with error handling
 * 
 * @param {Function} onLocation - Callback for location updates
 * @param {Function} onError - Callback for errors
 * @param {Object} options - Watch options
 * @returns {Function} Cleanup function to stop watching
 */
export const watchLocation = async (
  onLocationChange,
  onError,
  options = {}
) => {
  try {
    const subscription = await Location.watchPositionAsync(
      {
        ...LOCATION_CONFIG,
        timeInterval: options.timeInterval || 5000,
        distanceInterval: options.distanceInterval || 10
      },
      (location) => {
        onLocationChange({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        });
      }
    );

    return subscription;
  } catch (error) {
    onError(error);
    throw error;
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

  return distance;
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
 * Calculate fare based on distance
 * 
 * @param {number} distanceInMeters - Distance in meters
 * @returns {Object} Fare details
 */
/**
 * Watch for changes in location services availability
 * 
 * @param {Function} onAvailabilityChange - Callback for service availability changes
 * @returns {Function} Cleanup function to stop watching
 */
export const watchLocationServices = (onAvailabilityChange) => {
  let isWatching = true;
  let previousState = false;

  const checkAvailability = async () => {
    try {
      if (!isWatching) return;
      
      const available = await Location.hasServicesEnabledAsync();
      
      // Only call callback if state changed
      if (available !== previousState) {
        previousState = available;
        onAvailabilityChange(available);
      }
    } catch (error) {
      console.error('Error checking location services:', error);
    }
  };

  // Initial check
  checkAvailability();

  // Set up interval to check periodically
  const intervalId = setInterval(checkAvailability, 1000);

  // Return cleanup function
  return () => {
    isWatching = false;
    clearInterval(intervalId);
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
