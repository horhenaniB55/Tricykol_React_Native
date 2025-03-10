import { create } from 'zustand';

/**
 * Validates if a route is valid (has at least 2 coordinates with valid lat/lng values)
 * @param {Array} route - Array of coordinate objects
 * @returns {boolean} True if valid, false otherwise
 */
const isValidRoute = (route) => {
  // Return true for null routes - we're now allowing null for driver to pickup
  if (route === null) return true;
  
  // Check that it's an array with at least 2 coordinate points
  return Array.isArray(route) && 
         route.length >= 2 && 
         route.every(coord => 
           coord && 
           typeof coord.latitude === 'number' && 
           typeof coord.longitude === 'number'
         );
};

const useBookingDetailsStore = create((set) => ({
  driverToPickupRoute: null,
  pickupToDropoffRoute: null,
  driverRequest: null,
  bookingStatus: 'pending',
  setRoutes: (driverToPickup, pickupToDropoff) => {
    // Validate routes - both can be null now
    const isDriverToPickupValid = isValidRoute(driverToPickup);
    const isPickupToDropoffValid = isValidRoute(pickupToDropoff);
    
    // Log warnings for invalid routes (but only if they're not null)
    if (!isDriverToPickupValid && driverToPickup !== null) {
      console.warn('[bookingDetailsStore] Invalid driver to pickup route', driverToPickup);
    }
    
    if (!isPickupToDropoffValid) {
      console.warn('[bookingDetailsStore] Invalid pickup to dropoff route', pickupToDropoff);
    }
    
    set({ 
      driverToPickupRoute: isDriverToPickupValid ? driverToPickup : null, 
      pickupToDropoffRoute: isPickupToDropoffValid ? pickupToDropoff : null 
    });
  },
  setDriverRequest: (request) => set({ driverRequest: request }),
  setBookingStatus: (status) => set({ bookingStatus: status }),
  resetStore: () => set({ 
    driverToPickupRoute: null, 
    pickupToDropoffRoute: null, 
    driverRequest: null,
    bookingStatus: 'pending'
  })
}));

export default useBookingDetailsStore; 