import Geolocation from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import { getDistance } from 'geolib';

class LocationService {
  constructor() {
    this.watchId = null;
    this.lastLocationUpdate = 0;
    this.lastKnownLocation = null;
    this.locationListeners = new Set();
    this.isTracking = false;
    this.retryAttempt = 0;
    this.maxRetries = 3;
    
    // Progressive accuracy configuration
    this.accuracyLevels = [
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
        distanceFilter: 50
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000,
        distanceFilter: 100
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 30000,
        distanceFilter: 150
      }
    ];
    
    // Configuration
    this.UPDATE_INTERVAL = 10000; // 10 seconds
    this.SIGNIFICANT_DISTANCE = 50; // 50 meters
    this.RETRY_DELAY = 1000; // 1 second
    
    // Initialize with highest accuracy
    this.LOCATION_OPTIONS = this.accuracyLevels[0];
  }

  // Start location tracking with progressive accuracy
  startTracking = async () => {
    if (this.isTracking) return;

    try {
      // Reset retry attempt
      this.retryAttempt = 0;
      
      // Try to get initial location
      await this.getCurrentLocation();
      
      // Start watching position
      this.watchId = Geolocation.watchPosition(
        this.handleLocationUpdate,
        this.handleLocationError,
        this.LOCATION_OPTIONS
      );
      
      this.isTracking = true;
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      this.handleLocationError(error);
    }
  };

  // Stop location tracking
  stopTracking = () => {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      this.retryAttempt = 0;
    }
  };

  // Handle location updates with throttling and distance filtering
  handleLocationUpdate = (position) => {
    // Reset retry attempt on successful update
    this.retryAttempt = 0;
    
    const now = Date.now();
    const newLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    };

    // Check if enough time has passed since last update
    if (now - this.lastLocationUpdate < this.UPDATE_INTERVAL) {
      return;
    }

    // Check if moved significant distance
    if (this.lastKnownLocation) {
      const distance = getDistance(
        this.lastKnownLocation,
        newLocation
      );
      
      if (distance < this.SIGNIFICANT_DISTANCE) {
        return;
      }
    }

    // Update timestamps and cache
    this.lastLocationUpdate = now;
    this.lastKnownLocation = newLocation;

    // Notify listeners
    this.notifyListeners(newLocation);
  };

  // Handle location errors with progressive fallback
  handleLocationError = async (error) => {
    console.warn('Location error:', error);
    
    // If we haven't exceeded max retries
    if (this.retryAttempt < this.maxRetries) {
      // Get next accuracy level
      const nextAccuracyLevel = this.accuracyLevels[this.retryAttempt];
      
      if (nextAccuracyLevel) {
        this.LOCATION_OPTIONS = nextAccuracyLevel;
        this.retryAttempt++;
        
        console.log(`Retrying with new options (attempt ${this.retryAttempt}/${this.maxRetries}):`, 
          this.LOCATION_OPTIONS);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        
        // Restart tracking with new options
        this.stopTracking();
        this.startTracking();
      }
    } else {
      // If all retries failed, notify listeners of the error
      this.notifyListenersError(error);
      
      // Reset to highest accuracy for next attempt
      this.LOCATION_OPTIONS = this.accuracyLevels[0];
      this.retryAttempt = 0;
    }
  };

  // Get current location with progressive accuracy
  getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      const tryGetLocation = (attempt = 0) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
            };
            this.lastKnownLocation = location;
            resolve(location);
          },
          async (error) => {
            if (attempt < this.maxRetries) {
              console.log(`Location attempt ${attempt + 1} failed, retrying...`);
              // Wait before retry
              await new Promise(r => setTimeout(r, this.RETRY_DELAY));
              // Try with next accuracy level
              this.LOCATION_OPTIONS = this.accuracyLevels[attempt];
              tryGetLocation(attempt + 1);
            } else {
              reject(error);
            }
          },
          this.LOCATION_OPTIONS
        );
      };

      tryGetLocation();
    });
  };

  // Add location update listener
  addLocationListener = (listener) => {
    this.locationListeners.add(listener);
  };

  // Remove location update listener
  removeLocationListener = (listener) => {
    this.locationListeners.delete(listener);
  };

  // Notify all listeners
  notifyListeners = (location) => {
    this.locationListeners.forEach(listener => {
      try {
        listener(location);
      } catch (error) {
        console.error('Error in location listener:', error);
      }
    });
  };

  // Notify listeners of errors
  notifyListenersError = (error) => {
    this.locationListeners.forEach(listener => {
      try {
        if (listener.onError) {
          listener.onError(error);
        }
      } catch (err) {
        console.error('Error in location error listener:', err);
      }
    });
  };
}

// Export singleton instance
export const locationService = new LocationService(); 