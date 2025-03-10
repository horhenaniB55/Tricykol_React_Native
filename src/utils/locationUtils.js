import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import firestore from '@react-native-firebase/firestore';

/**
 * Initializes driver location from available sources with priority:
 * 1. AsyncStorage
 * 2. Provided initial location
 * 3. Store location
 * 4. Current device position
 * 
 * @param {Object} options - Configuration options
 * @param {String} options.driverId - Driver ID
 * @param {Object} options.initialLocation - Initial location from navigation param
 * @param {Object} options.storeLocation - Location from store
 * @param {Function} options.setLocation - Function to set location in component
 * @param {Boolean} options.locationServicesEnabled - Whether location services are enabled
 * @returns {Promise<Object>} - The resolved location
 */
export const initializeDriverLocation = async (options) => {
  const { 
    driverId, 
    initialLocation, 
    storeLocation, 
    setLocation, 
    locationServicesEnabled = true 
  } = options;
  
  try {
    // Try to get location from different possible storage keys
    const locationKeys = [
      'driverLocation',
      'currentLocation',
      `driver_${driverId}_location`,
      'lastKnownLocation'
    ];

    let storedLocation = null;
    for (const key of locationKeys) {
      const storedLocationJson = await AsyncStorage.getItem(key);
      if (storedLocationJson) {
        const parsedLocation = JSON.parse(storedLocationJson);
        if (parsedLocation?.latitude && parsedLocation?.longitude) {
          console.log(`[LocationUtils] Using location from AsyncStorage key=${key}:`, parsedLocation);
          storedLocation = parsedLocation;
          break;
        }
      }
    }

    // If we found a stored location, use it
    if (storedLocation) {
      if (setLocation) setLocation(storedLocation);
      
      // Also save this location for future reference if not already saved
      if (!await AsyncStorage.getItem('driverLocation')) {
        await AsyncStorage.setItem('driverLocation', JSON.stringify(storedLocation));
      }
      
      return storedLocation;
    } else if (initialLocation) {
      // Fallback to initial location passed in route params
      console.log('[LocationUtils] Using initialLocation from params:', initialLocation);
      if (setLocation) setLocation(initialLocation);
      
      // Save this location for future reference
      await AsyncStorage.setItem('driverLocation', JSON.stringify(initialLocation));
      
      return initialLocation;
    } else if (storeLocation) {
      // Fallback to location store
      console.log('[LocationUtils] Using location from store:', storeLocation);
      if (setLocation) setLocation(storeLocation);
      
      // Save this location for future reference
      await AsyncStorage.setItem('driverLocation', JSON.stringify(storeLocation));
      
      return storeLocation;
    } else {
      // Try to get current position as last resort
      console.log('[LocationUtils] No stored location found, attempting to get current position');
      try {
        if (locationServicesEnabled) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 5000
          });
          
          if (position) {
            const newLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy
            };
            
            console.log('[LocationUtils] Got current position:', newLocation);
            if (setLocation) setLocation(newLocation);
            
            // Save the location for future reference
            await AsyncStorage.setItem('driverLocation', JSON.stringify(newLocation));
            
            return newLocation;
          }
        }
      } catch (error) {
        console.error('[LocationUtils] Error getting current position:', error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[LocationUtils] Error initializing driver location:', error);
    return null;
  }
};

/**
 * Updates driver location in AsyncStorage and optionally in Firestore if it has changed significantly
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.newLocation - New location
 * @param {Object} options.oldLocation - Previous known location
 * @param {String} options.driverId - Driver ID
 * @param {Number} options.minDistance - Minimum distance in meters to trigger update (default: 20)
 * @param {Boolean} options.updateFirestore - Whether to update Firestore (default: false, only set to true for initial updates)
 * @returns {Promise<Boolean>} - Whether location was updated
 */
export const updateDriverLocation = async (options) => {
  const { 
    newLocation, 
    oldLocation, 
    driverId, 
    minDistance = 20,
    updateFirestore = false
  } = options;
  
  try {
    if (!newLocation || !newLocation.latitude || !newLocation.longitude) {
      return false;
    }
    
    // If no old location, always update
    if (!oldLocation || !oldLocation.latitude || !oldLocation.longitude) {
      await AsyncStorage.setItem('driverLocation', JSON.stringify(newLocation));
      
      // Only update Firestore if explicitly requested (initial location)
      if (driverId && updateFirestore) {
        await firestore()
          .collection('drivers')
          .doc(driverId)
          .update({
            currentLocation: {
              ...newLocation,
              updatedAt: firestore.FieldValue.serverTimestamp()
            },
            lastLocationUpdate: firestore.FieldValue.serverTimestamp()
          });
      }
      
      return true;
    }
    
    // Calculate distance between old and new locations
    const lat1 = oldLocation.latitude;
    const lon1 = oldLocation.longitude;
    const lat2 = newLocation.latitude;
    const lon2 = newLocation.longitude;
    
    // Quick distance calculation (approximate)
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Only update if distance is greater than minimum threshold
    if (distance >= minDistance) {
      console.log(`[LocationUtils] Location changed by ${distance.toFixed(2)}m, updating storage`);
      
      await AsyncStorage.setItem('driverLocation', JSON.stringify(newLocation));
      
      // Only update Firestore if explicitly requested
      if (driverId && updateFirestore) {
        console.log('[LocationUtils] Updating Firestore with new location');
        await firestore()
          .collection('drivers')
          .doc(driverId)
          .update({
            currentLocation: {
              ...newLocation,
              updatedAt: firestore.FieldValue.serverTimestamp()
            },
            lastLocationUpdate: firestore.FieldValue.serverTimestamp()
          });
      } else {
        console.log('[LocationUtils] Skipping Firestore update as per configuration');
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[LocationUtils] Error updating driver location:', error);
    return false;
  }
};

/**
 * Validates if coordinates are valid numbers
 * 
 * @param {Object} coordinates - Location coordinates
 * @returns {Boolean} - Whether coordinates are valid
 */
export const isValidCoordinates = (coordinates) => {
  return coordinates && 
         typeof coordinates.latitude === 'number' && 
         typeof coordinates.longitude === 'number';
}; 