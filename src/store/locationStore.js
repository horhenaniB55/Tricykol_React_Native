import { create } from 'zustand';
import {
  getCurrentLocation,
  watchLocation,
  isWithinRadius,
  calculateDistance,
  checkLocationServices,
  getLocationPermissionStatus,
  watchLocationServices,
  initializeLocation
} from '../utils/location';
import firestore from '@react-native-firebase/firestore';
import { useAuthStore } from './authStore';
import * as Location from 'expo-location';

// Constants
const BOOKING_RADIUS = 700; // meters
const PICKUP_ARRIVAL_RADIUS = 50; // meters
const DROPOFF_ARRIVAL_RADIUS = 300; // meters

/**
 * Location store for managing location state and related functionality
 */
const useLocationStore = create((set, get) => ({
  // Location state
  currentLocation: null,
  isTracking: false,
  lastUpdate: null,
  nearbyBookings: [],
  activeTrip: null,
  bookingsUnsubscribe: null,
  locationServicesWatcher: null,
  locationInitialized: false,

  // Location status state
  locationPermission: 'undetermined',
  locationServicesEnabled: true,
  showLocationErrorModal: false,
  locationErrorType: null, // 'permission' or 'services'
  locationError: null,

  // Location status actions
  setLocationError: (errorType, error = null) => {
    console.log('Setting location error:', errorType);
    
    // Set this state immediately and explicitly
    set({
      locationErrorType: errorType,
      locationError: error,
      showLocationErrorModal: true
    });
  },

  clearLocationError: () => {
    console.log('Clearing location error state');
    set({
      locationErrorType: null,
      locationError: null,
      showLocationErrorModal: false
    });
  },

  startWatchingLocationAvailability: () => {
    const watcher = watchLocationServices(async (available) => {
      console.log('Location services availability changed:', available);
      set({ locationServicesEnabled: available });

      if (!available) {
        // Force driver offline when location is disabled
        const { driver } = useAuthStore.getState();
        if (driver?.status === 'online') {
          try {
            // Update Firestore
            await firestore()
              .collection('drivers')
              .doc(driver.id)
              .update({ 
                status: 'offline',
                lastStatusUpdate: firestore.FieldValue.serverTimestamp()
              });

            // Update local state
            useAuthStore.getState().setDriver({
              ...driver,
              status: 'offline'
            });

            // Stop tracking
            get().stopLocationTracking();
            
            console.log('Driver set to offline due to disabled location services');
          } catch (error) {
            console.error('Error setting driver offline:', error);
          }
        }
      } else {
        // Location services became available
        try {
          const location = await getCurrentLocation({
            accuracy: Location.Accuracy.Balanced,
            maximumAge: 10000
          });

          if (location) {
            set({ 
              currentLocation: location,
              locationInitialized: true,
              lastUpdate: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error getting location after services enabled:', error);
        }
      }
    });
    set({ locationServicesWatcher: watcher });
  },

  stopWatchingLocationAvailability: () => {
    const { locationServicesWatcher } = get();
    if (locationServicesWatcher) {
      locationServicesWatcher();
      set({ locationServicesWatcher: null });
    }
  },

  checkLocationStatus: async () => {
    try {
      // Check services first
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const permissionStatus = await getLocationPermissionStatus();

      set({
        locationServicesEnabled: servicesEnabled,
        locationPermission: permissionStatus.foreground,
        showLocationErrorModal: !servicesEnabled || permissionStatus.foreground !== "granted",
        locationErrorType: !servicesEnabled ? "services" : 
                         permissionStatus.foreground !== "granted" ? "permission" : null
      });

      return {
        ...permissionStatus,
        services: servicesEnabled ? 'enabled' : 'disabled'
      };
    } catch (error) {
      console.error('Error checking location status:', error);
      set({ locationError: error.message });
      return null;
    }
  },

  initializeLocation: async () => {
    // Don't try to initialize if location services are disabled
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      set({ 
        locationServicesEnabled: false,
        locationErrorType: 'services',
        showLocationErrorModal: true 
      });
      return null;
    }

    if (get().locationInitialized) return;

    try {
      const status = await get().checkLocationStatus();
      const location = await getCurrentLocation({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 10000
      });

      set({ 
        currentLocation: location,
        locationInitialized: true,
        locationServicesEnabled: true
      });

      return location;
    } catch (error) {
      console.error('Location initialization error:', error);
      set({ 
        locationError: error.message,
        locationServicesEnabled: false 
      });
      return null;
    }
  },

  // Location tracking actions with optimized subscription handling
  startLocationTracking: async () => {
    try {
      // Check location services first before trying to get location
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        set({ 
          locationServicesEnabled: false,
          locationErrorType: 'services',
          showLocationErrorModal: true 
        });
        return;
      }

      // Rest of tracking logic...
      if (!get().locationInitialized) {
        await get().initializeLocation();
      }

      const status = await get().checkLocationStatus();
      if (!status || status.foreground !== "granted") {
        return;
      }

      set({ isTracking: true });

      // Watch location with balanced accuracy
      return await watchLocation(
        (newLocation) => {
          set({
            currentLocation: newLocation,
            lastUpdate: new Date().toISOString(),
          });

          // If there's an active trip, check for arrival
          const activeTrip = get().activeTrip;
          if (activeTrip) {
            get().checkArrival(newLocation, activeTrip);
          }

          // Update nearby bookings if subscribed
          get().updateBookingsWithLocation(newLocation);
        },
        (error) => {
          console.log('watchLocation error', error);
          set({
            locationError: error.message,
            lastUpdate: new Date().toISOString(),
          });
        },
        {
          timeInterval: 5000,
          distanceInterval: 10,
          accuracy: Location.Accuracy.Balanced
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  },

  stopLocationTracking: () => {
    set({
      isTracking: false,
      lastUpdate: new Date().toISOString(),
    });
  },

  // Trip related actions
  setActiveTrip: (trip) => {
    set({ activeTrip: trip });
  },

  checkArrival: (currentLocation, trip) => {
    if (!currentLocation || !trip) return;

    const { dropoffLocation, pickupLocation, status } = trip;
    const location = status === 'picking_up' ? pickupLocation : dropoffLocation;

    // Check if arrived within 300m radius for dropoff
    if (status === 'in_progress') {
      const isNearDropoff = isWithinRadius(
        currentLocation,
        dropoffLocation,
        DROPOFF_ARRIVAL_RADIUS
      );

      if (isNearDropoff) {
        set({ arrivedAtDestination: true });
      }
    }

    // Check if arrived at pickup location
    if (status === 'picking_up') {
      const isAtPickup = isWithinRadius(
        currentLocation,
        pickupLocation,
        PICKUP_ARRIVAL_RADIUS
      );

      if (isAtPickup) {
        set({ arrivedAtPickup: true });
      }
    }
  },

  // Optimized booking subscription handling
  startBookingSubscription: () => {
    // Don't start a new subscription if one already exists
    if (get().bookingsUnsubscribe) {
      return;
    }

    try {
      // Query for pending bookings
      const bookingsQuery = firestore()
        .collection('bookings')
        .where('status', '==', 'pending');

      // Subscribe to bookings updates
      const unsubscribe = bookingsQuery.onSnapshot(
        (snapshot) => {
          if (!get().isTracking) return; // Don't process updates if not tracking

          const { currentLocation } = get();
          if (!currentLocation) return;

          const bookings = [];
          
          snapshot.docChanges().forEach(change => {
            const booking = {
              id: change.doc.id,
              ...change.doc.data(),
            };

            // Handle changes based on type
            switch (change.type) {
              case 'added':
              case 'modified':
                if (isWithinRadius(currentLocation, booking.pickupLocation, BOOKING_RADIUS)) {
                  bookings.push({
                    ...booking,
                    distance: calculateDistance(currentLocation, booking.pickupLocation),
                  });
                }
                break;
              // 'removed' is handled automatically since we only include current snapshot data
            }
          });

          // Merge with existing bookings and sort
          const existingBookings = get().nearbyBookings;
          const updatedBookings = [
            ...existingBookings.filter(b => !bookings.find(nb => nb.id === b.id)),
            ...bookings
          ].sort((a, b) => a.distance - b.distance);

          set({ nearbyBookings: updatedBookings });
        },
        (error) => {
          console.error('Error in bookings subscription:', error);
          set({ locationError: 'Failed to fetch nearby bookings' });
        }
      );

      set({ bookingsUnsubscribe: unsubscribe });
    } catch (error) {
      console.error('Error setting up bookings subscription:', error);
      set({ locationError: 'Failed to start booking updates' });
    }
  },

  stopBookingSubscription: () => {
    const { bookingsUnsubscribe } = get();
    if (bookingsUnsubscribe) {
      bookingsUnsubscribe();
      set({ bookingsUnsubscribe: null });
    }
  },

 
  updateBookingsWithLocation: (newLocation) => {
    const { nearbyBookings } = get();
    if (!nearbyBookings.length) return;

    const updatedBookings = nearbyBookings.map(booking => ({
      ...booking,
      distance: calculateDistance(newLocation, booking.pickupLocation),
    }))
    .filter(booking => booking.distance <= BOOKING_RADIUS)
    .sort((a, b) => a.distance - b.distance);

    set({ nearbyBookings: updatedBookings });
  },

  // State selectors
  selectNearbyBookings: () => get().nearbyBookings,
  selectCurrentLocation: () => get().currentLocation,
  selectLocationError: () => get().locationError,
  selectIsTracking: () => get().isTracking,
  selectLastUpdate: () => get().lastUpdate,
  selectActiveTrip: () => get().activeTrip,
}));

export default useLocationStore;
