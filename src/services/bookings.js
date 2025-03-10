import firestore from '@react-native-firebase/firestore';
import { getDistance } from 'geolib';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@driver_location';

class BookingsService {
  constructor() {
    this.bookingsListener = null;
    this.activeBookings = new Map();
    this.bookingListeners = new Set();
    this.currentLocation = null;
    this.searchRadius = 700; // 700m in meters
    this.userId = null;
    this.isInitialized = false;
    this.lastQueryLocation = null;
  }

  // Initialize the service with user ID
  initialize = async (userId) => {
    console.log('[BookingsService] Initializing with userId:', userId);
    this.userId = userId;
    
    try {
      // Try to get location from local storage
      const storedLocation = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedLocation) {
        const parsedLocation = JSON.parse(storedLocation);
        console.log('[BookingsService] Found stored location, starting listener:', parsedLocation);
        await this.startBookingsListener(parsedLocation);
      } else {
        console.log('[BookingsService] No stored location found during initialization');
      }
    } catch (error) {
      console.error('[BookingsService] Error during initialization:', error);
    }
    
    this.isInitialized = true;
  };

  // Start listening to nearby bookings
  startBookingsListener = async (location) => {
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      console.log('[BookingsService] Invalid location provided:', location);
      
      // Try to get location from local storage
      try {
        const storedLocation = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedLocation) {
          const parsedLocation = JSON.parse(storedLocation);
          console.log('[BookingsService] Using location from local storage:', parsedLocation);
          location = parsedLocation;
        } else {
          console.log('[BookingsService] No location found in local storage');
          return;
        }
      } catch (error) {
        console.error('[BookingsService] Error getting location from storage:', error);
        return;
      }
    }

    // Ensure location is in the correct format
    const formattedLocation = {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude)
    };

    console.log('[BookingsService] Starting bookings listener with formatted location:', formattedLocation);
    this.currentLocation = formattedLocation;
    this.lastQueryLocation = { ...formattedLocation };
    
    // Clean up existing listener if any
    this.stopBookingsListener();

    try {
      // Get Firestore collection reference
      const bookingsRef = firestore().collection('bookings');

      // Create a query for pending bookings
      const query = bookingsRef
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(50);

      // Set up the listener
      this.bookingsListener = query.onSnapshot(
        snapshot => {
          console.log('[BookingsService] Received bookings update');
          
          // Process all documents, not just changes
          snapshot.docs.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            
            // Check if this booking has a request from the current driver
            const driverRequest = booking.driverRequests?.[this.userId];
            const hasDriverPendingRequest = driverRequest?.status === 'pending';
            
            // Calculate distance only if we have pickup coordinates
            if (booking.pickupLocation?.coordinates) {
              const distance = getDistance(
                { 
                  latitude: this.currentLocation.latitude, 
                  longitude: this.currentLocation.longitude 
                },
                {
                  latitude: Number(booking.pickupLocation.coordinates.latitude),
                  longitude: Number(booking.pickupLocation.coordinates.longitude)
                }
              );
              
              console.log(`[BookingsService] Booking ${booking.id} distance: ${distance}m, radius: ${this.searchRadius}m`);
              
              // Include booking if it's within radius OR has a pending request from this driver
              if (distance <= this.searchRadius || hasDriverPendingRequest) {
                console.log(`[BookingsService] Adding/updating booking ${booking.id} (within radius: ${distance <= this.searchRadius}, has request: ${hasDriverPendingRequest})`);
                this.activeBookings.set(booking.id, { 
                  ...booking, 
                  distance,
                  hasDriverPendingRequest 
                });
              } else {
                console.log(`[BookingsService] Booking ${booking.id} outside radius (${distance}m)`);
                this.activeBookings.delete(booking.id);
              }
            } else {
              console.log(`[BookingsService] Booking ${booking.id} has no pickup coordinates`);
            }
          });

          // Sort bookings: pending requests first, then by distance
          const sortedBookings = Array.from(this.activeBookings.values())
            .sort((a, b) => {
              // First sort by pending request status
              if (a.hasDriverPendingRequest && !b.hasDriverPendingRequest) return -1;
              if (!a.hasDriverPendingRequest && b.hasDriverPendingRequest) return 1;
              // Then sort by distance
              return a.distance - b.distance;
            });

          console.log(`[BookingsService] Notifying listeners with ${sortedBookings.length} bookings`);
          this.bookingListeners.forEach(listener => {
            try {
              listener(sortedBookings);
            } catch (error) {
              console.error('[BookingsService] Listener callback error:', error);
            }
          });
        },
        error => {
          console.error('[BookingsService] Listener error:', error);
          // Attempt to restart listener after error
          setTimeout(() => {
            if (this.currentLocation) {
              this.startBookingsListener(this.currentLocation);
            }
          }, 5000);
        }
      );

      console.log('[BookingsService] Listener setup complete');
    } catch (error) {
      console.error('[BookingsService] Setup error:', error);
    }
  };

  // Stop listening to bookings
  stopBookingsListener = () => {
    if (this.bookingsListener) {
      console.log('[BookingsService] Stopping bookings listener');
      this.bookingsListener();
      this.bookingsListener = null;
      this.activeBookings.clear();
    }
  };

  // Add booking update listener
  addBookingListener = (listener) => {
    this.bookingListeners.add(listener);
  };

  // Remove booking update listener
  removeBookingListener = (listener) => {
    this.bookingListeners.delete(listener);
  };

  // Notify all listeners
  notifyListeners = () => {
    const bookings = Array.from(this.activeBookings.values());
    this.bookingListeners.forEach(listener => {
      try {
        listener(bookings);
      } catch (error) {
        console.error('[BookingsService] Listener callback error:', error);
      }
    });
  };

  // Update booking status
  updateBookingStatus = async (bookingId, status) => {
    try {
      await firestore()
        .collection('bookings')
        .doc(bookingId)
        .update({
          status,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('[BookingsService] Status update error:', error);
      throw error;
    }
  };
}

// Export singleton instance
export const bookingsService = new BookingsService(); 