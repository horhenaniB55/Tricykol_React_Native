import { create } from 'zustand';
import firestore from '@react-native-firebase/firestore';

const useMapStore = create((set, get) => ({
  nearbyBookings: [],
  cachedBookings: [],
  isLoading: false,
  error: null,
  bookingsListener: null,

  setNearbyBookings: (bookings) => set({ nearbyBookings: bookings }),
  setCachedBookings: (bookings) => set({ cachedBookings: bookings }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setBookingsListener: (listener) => set({ bookingsListener: listener }),

  // Function to calculate distance between two points
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
  },

  // Function to fetch and listen to nearby bookings
  setupBookingsListener: (currentLocation, isBookingsVisible) => {
    const MAX_DISTANCE = 700; // meters
    const { calculateDistance, setNearbyBookings, setCachedBookings, setError, bookingsListener } = get();

    // Clean up existing listener if any
    if (bookingsListener) {
      bookingsListener();
    }

    // Set up new listener
    const unsubscribe = firestore()
      .collection('bookings')
      .where('status', '==', 'pending')
      .onSnapshot(
        (snapshot) => {
          try {
            const bookings = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter(booking => {
                if (!booking.pickupLocation?.coordinates) return false;
                
                const distance = calculateDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  booking.pickupLocation.coordinates.latitude,
                  booking.pickupLocation.coordinates.longitude
                );
                
                booking.distance = distance;
                return distance <= MAX_DISTANCE;
              })
              .sort((a, b) => a.distance - b.distance);

            // Always update cache
            setCachedBookings(bookings);
            
            // Only update visible bookings if enabled
            if (isBookingsVisible) {
              setNearbyBookings(bookings);
            }
            
            setError(null);
          } catch (error) {
            console.error('[MapStore] Error processing bookings:', error);
            setError('Failed to process bookings');
          }
        },
        (error) => {
          console.error('[MapStore] Firestore listener error:', error);
          setError('Failed to fetch bookings');
        }
      );

    // Store the unsubscribe function
    set({ bookingsListener: unsubscribe });
    return unsubscribe;
  },

  // Cleanup function
  cleanup: () => {
    const { bookingsListener } = get();
    if (bookingsListener) {
      bookingsListener();
      set({ bookingsListener: null });
    }
  }
}));

export default useMapStore; 