/**
 * Location related models and types
 */

/**
 * Location model
 * @typedef {Object} Location
 * @property {string} address - Human-readable address
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {string} [geohash] - Geohash for location-based queries
 */

/**
 * Driver location update model
 * @typedef {Object} DriverLocationUpdate
 * @property {string} driverId - ID of the driver
 * @property {number} latitude - Current latitude
 * @property {number} longitude - Current longitude
 * @property {number} heading - Direction in degrees (0-360)
 * @property {number} speed - Current speed in meters/second
 * @property {Date} timestamp - When the location was recorded
 */

/**
 * Route model
 * @typedef {Object} Route
 * @property {Location} origin - Starting location
 * @property {Location} destination - Ending location
 * @property {number} distance - Distance in kilometers
 * @property {number} duration - Duration in minutes
 * @property {Array<Location>} waypoints - Intermediate points along the route
 * @property {string} polyline - Encoded polyline for the route
 */

import { getDistance } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class LocationModel {
  /**
   * Calculate distance and estimated time between two points
   * @param {Object} point1 - First location point {latitude, longitude}
   * @param {Object} point2 - Second location point {latitude, longitude}
   * @returns {Object} Distance in meters and estimated time in minutes
   */
  static calculateDistanceAndTime(point1, point2) {
    try {
      // Validate input points
      if (!point1 || !point2 || 
          typeof point1?.latitude !== 'number' || 
          typeof point1?.longitude !== 'number' ||
          typeof point2?.latitude !== 'number' || 
          typeof point2?.longitude !== 'number') {
        
        // Only log as a warning if both points are provided but invalid 
        // Otherwise log as debug info (not a warning) since this is often expected during initialization
        if (point1 && point2) {
          console.warn('[LocationModel] Invalid points provided:', { point1, point2 });
        } else {
          // During initialization, this is often expected, so log as info instead of warning
          console.log('[LocationModel] Skipping distance calculation - points not fully initialized:', 
            { point1: point1 || 'null', point2: point2 || 'null' });
        }
        
        return {
          distance: 0,
          estimatedTime: 0
        };
      }

      // Calculate distance in meters
      const distanceInMeters = getDistance(
        { latitude: point1.latitude, longitude: point1.longitude },
        { latitude: point2.latitude, longitude: point2.longitude }
      );

      // Estimate time (assuming average speed of 20 km/h for tricycles)
      // Convert distance to km and multiply by time per km (3 minutes per km at 20 km/h)
      const estimatedMinutes = Math.ceil((distanceInMeters / 1000) * 3);

      return {
        distance: distanceInMeters,
        estimatedTime: estimatedMinutes
      };
    } catch (error) {
      console.error('[LocationModel] Error calculating distance and time:', error);
      return {
        distance: 0,
        estimatedTime: 0
      };
    }
  }

  /**
   * Format distance for display
   * @param {number} meters - Distance in meters
   * @returns {string} Formatted distance
   */
  static formatDistance(meters) {
    if (meters < 500) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  /**
   * Format time for display
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time
   */
  static formatTime(minutes) {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  /**
   * Gets route coordinates between two points using Google Directions API
   * @param {Object} origin - Origin coordinates {latitude, longitude}
   * @param {Object} destination - Destination coordinates {latitude, longitude}
   * @param {Object} options - Additional options {useSimulatedIfNoCache: boolean}
   * @returns {Promise<Array>} - Array of coordinates for the route
   */
  static getRouteCoordinates = async (origin, destination, options = {}) => {
    const { useSimulatedIfNoCache = false } = options;
    
    try {
      // Validate coordinates
      if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
        console.warn('[LocationModel] Invalid coordinates provided:', { origin, destination });
        return this.getSimulatedRoute(
          origin || { latitude: 0, longitude: 0 },
          destination || { latitude: 0, longitude: 0 }
        );
      }
      
      // Ensure coordinates are valid numbers
      const originClean = {
        latitude: Number(origin.latitude),
        longitude: Number(origin.longitude)
      };
      
      const destinationClean = {
        latitude: Number(destination.latitude),
        longitude: Number(destination.longitude)
      };
      
      // Double check that we now have valid numbers
      if (isNaN(originClean.latitude) || isNaN(originClean.longitude) || 
          isNaN(destinationClean.latitude) || isNaN(destinationClean.longitude)) {
        console.warn('[LocationModel] Coordinates contain NaN values after conversion');
        return this.getSimulatedRoute(origin, destination);
      }
      
      // Create a cache key based on coordinates (rounded to 5 decimal places for stability)
      const cacheKey = `route_${originClean.latitude.toFixed(5)}_${originClean.longitude.toFixed(5)}_to_${destinationClean.latitude.toFixed(5)}_${destinationClean.longitude.toFixed(5)}`;
      
      // Enhanced cache check with optimized error handling
      let cachedRoute = null;
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            
            // Validate cached coordinates
            if (parsedData?.coordinates && 
                Array.isArray(parsedData.coordinates) && 
                parsedData.coordinates.length >= 2 &&
                parsedData.coordinates.every(coord => 
                  coord && 
                  typeof coord.latitude === 'number' && 
                  typeof coord.longitude === 'number'
                )) {
              
              // Check if timestamp is valid (within 24 hours)
              const isTimestampValid = parsedData.timestamp && 
                                      (Date.now() - parsedData.timestamp < 24 * 60 * 60 * 1000);
              
              if (isTimestampValid) {
                console.log('[LocationModel] Using cached route');
                // Mark this route as coming from cache
                const cachedCoordinates = parsedData.coordinates;
                cachedCoordinates.fromCache = true;
                return cachedCoordinates;
              }
            }
          } catch (parseError) {
            // Silent error handling for cache parsing
          }
        }
      } catch (cacheError) {
        // Silent error handling for cache access
      }
      
      // If we're asked to use simulated route when no cache is available
      if (useSimulatedIfNoCache) {
        console.log('[LocationModel] Using simulated route for faster rendering');
        return this.getSimulatedRoute(originClean, destinationClean);
      }
      
      // Use Google Directions API to get the route
      console.log('[LocationModel] Fetching route from Google Directions API');
      
      // Add timeout to prevent hanging API calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout (reduced from 10s)
      
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originClean.latitude},${originClean.longitude}&destination=${destinationClean.latitude},${destinationClean.longitude}&key=${apiKey}`;
        
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`[LocationModel] HTTP error: ${response.status}`);
          return this.getSimulatedRoute(originClean, destinationClean);
        }
        
        const json = await response.json();
        
        if (json.status !== 'OK' || !json.routes || !json.routes[0]) {
          console.error('[LocationModel] Directions API error or invalid response:', json.status, json.error_message);
          return this.getSimulatedRoute(originClean, destinationClean);
        }
        
        // Handle case where overview_polyline might be missing
        if (!json.routes[0].overview_polyline || !json.routes[0].overview_polyline.points) {
          console.error('[LocationModel] No polyline in API response, using route legs as fallback');
          
          // Try to extract coordinates from route legs as a fallback
          if (json.routes[0].legs && json.routes[0].legs[0] && 
              json.routes[0].legs[0].steps && json.routes[0].legs[0].steps.length > 0) {
            
            // Extract start and end locations from each step
            const coordinates = [];
            
            // Add origin point
            coordinates.push({
              latitude: json.routes[0].legs[0].start_location.lat,
              longitude: json.routes[0].legs[0].start_location.lng
            });
            
            // Add each step's end location
            json.routes[0].legs[0].steps.forEach(step => {
              if (step.end_location && 
                  typeof step.end_location.lat === 'number' && 
                  typeof step.end_location.lng === 'number') {
                coordinates.push({
                  latitude: step.end_location.lat,
                  longitude: step.end_location.lng
                });
              }
            });
            
            // Validate the coordinates we extracted
            if (coordinates.length >= 2) {
              try {
                await AsyncStorage.setItem(cacheKey, JSON.stringify({
                  coordinates,
                  timestamp: Date.now()
                }));
              } catch (cacheError) {
                // Silent error for cache storing
              }
              
              return coordinates;
            }
          }
          
          // If we couldn't extract coordinates from legs, fall back to simulated route
          return this.getSimulatedRoute(originClean, destinationClean);
        }
        
        // Get the polyline string
        const polyline = json.routes[0].overview_polyline.points;
        
        // Use our improved polyline decoder
        const coordinates = polyline_decode(polyline);
        
        // Handle case where polyline decoding fails or returns invalid data
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
          console.error('[LocationModel] Invalid coordinates from polyline decoding');
          return this.getSimulatedRoute(originClean, destinationClean);
        }
        
        // Validate each coordinate
        const validCoordinates = coordinates.filter(coord => 
          coord && 
          typeof coord.latitude === 'number' && 
          typeof coord.longitude === 'number' &&
          !isNaN(coord.latitude) && 
          !isNaN(coord.longitude) &&
          Math.abs(coord.latitude) <= 90 && 
          Math.abs(coord.longitude) <= 180
        );
        
        // If we lost too many coordinates in validation, use simulated route
        if (validCoordinates.length < 2) {
          console.error('[LocationModel] Too few valid coordinates after filtering');
          return this.getSimulatedRoute(originClean, destinationClean);
        }
        
        // Cache the route with timestamp
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            coordinates: validCoordinates,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          // Silent error for cache storing
        }
        
        return validCoordinates;
      } catch (fetchError) {
        console.error('[LocationModel] API fetch error:', fetchError);
        clearTimeout(timeoutId);
        
        // Return simulated route on API error
        return this.getSimulatedRoute(originClean, destinationClean);
      }
    } catch (error) {
      console.error('[LocationModel] getRouteCoordinates error:', error);
      return this.getSimulatedRoute(origin, destination);
    }
  };

  /**
   * Creates a simulated route between two points (fallback method)
   * @param {Object} origin - Origin coordinates {latitude, longitude}
   * @param {Object} destination - Destination coordinates {latitude, longitude}
   * @param {number} [steps=8] - Number of points to generate (fewer for faster performance)
   * @returns {Array} - Array of coordinates for the route
   */
  static getSimulatedRoute(origin, destination, steps = 8) {
    // Create a faster but still realistic-looking route
    const coordinates = [];
    
    try {
      // Ensure coordinates are valid numbers
      const startLat = Number(origin.latitude) || 0;
      const startLng = Number(origin.longitude) || 0;
      const endLat = Number(destination.latitude) || 0;
      const endLng = Number(destination.longitude) || 0;
      
      // Add origin
      coordinates.push({
        latitude: startLat,
        longitude: startLng
      });
      
      // For very short distances, just use a straight line
      const distanceSquared = 
        Math.pow(endLat - startLat, 2) + 
        Math.pow(endLng - startLng, 2);
      
      if (distanceSquared < 0.00001) { // Very close points
        // Just add the destination point (even if identical to origin)
        coordinates.push({
          latitude: endLat,
          longitude: endLng
        });
        
        // If points are exactly the same, slightly offset the second point
        if (startLat === endLat && startLng === endLng) {
          coordinates[1] = {
            latitude: startLat + 0.00005,
            longitude: startLng + 0.00005
          };
        }
        
        return coordinates;
      }
      
      // Calculate perpendicular offset direction
      const dx = endLng - startLng;
      const dy = endLat - startLat;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // Normalized perpendicular vector
      const perpX = -dy / length;
      const perpY = dx / length;
      
      // Add fewer waypoints for better performance
      for (let i = 1; i < steps; i++) {
        const fraction = i / steps;
        
        // Linear interpolation between points
        let latitude = startLat + 
          (endLat - startLat) * fraction;
        let longitude = startLng + 
          (endLng - startLng) * fraction;
        
        // Add less randomness, focused in the middle
        const deviation = 0.0025 * Math.sin(fraction * Math.PI);
        
        // Apply perpendicular offset
        latitude += perpY * deviation;
        longitude += perpX * deviation;
        
        coordinates.push({
          latitude,
          longitude
        });
      }
      
      // Add destination
      coordinates.push({
        latitude: endLat,
        longitude: endLng
      });
      
      // Mark this as a simulated route
      coordinates.fromCache = false;
      
      return coordinates;
    } catch (error) {
      console.error('[LocationModel] Error creating simulated route:', error);
      return this.getSimulatedRoute(origin, destination, steps);
    }
  }

  /**
   * Decodes a Google encoded polyline string into an array of coordinates
   * This is a reliable implementation from the polyline library
   */
}

// Add this outside the class
function polyline_decode(str, precision) {
  try {
    // Check for empty or invalid polyline string
    if (!str || typeof str !== 'string' || str.length < 2) {
      console.warn('[polyline_decode] Invalid polyline string:', str);
      return null;
    }
    
    var index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision || 5);

    // Coordinates have variable length when encoded, so just keep
    // track of whether we've hit the end of the string. In each
    // loop iteration, a single coordinate is decoded.
    while (index < str.length) {
      try {
        // Reset shift, result, and byte
        byte = null;
        shift = 0;
        result = 0;

        do {
          byte = str.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
          byte = str.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        // Validate values before adding to coordinates
        const latitude = lat / factor;
        const longitude = lng / factor;
        
        // Ensure they're valid numbers and within reasonable bounds
        if (isFinite(latitude) && isFinite(longitude) &&
            Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
          coordinates.push({
            latitude,
            longitude
          });
        } else {
          console.warn('[polyline_decode] Invalid coordinate:', { latitude, longitude });
        }
      } catch (innerError) {
        // If we encounter an error on a specific coordinate, log but continue
        console.warn('[polyline_decode] Error decoding coordinate at index', index, innerError);
        // Try to continue with the next coordinate pair
        index = Math.min(index + 2, str.length);
      }
    }

    // Modified validation - accept single point for very short routes
    if (coordinates.length === 0) {
      console.error('[polyline_decode] No valid coordinates decoded');
      return null;
    } else if (coordinates.length === 1) {
      // If only one point, duplicate it to make a valid route
      console.warn('[polyline_decode] Only one valid coordinate, duplicating to create route');
      coordinates.push({...coordinates[0]});
    }

    return coordinates;
  } catch (error) {
    console.error('[polyline_decode] Error decoding polyline:', error);
    // Return null to signal error, which will trigger simulated route generation
    return null;
  }
}