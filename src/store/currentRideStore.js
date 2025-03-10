import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationModel } from '../models/LocationModel';
import firestore from '@react-native-firebase/firestore';

const useCurrentRideStore = create(
  persist(
    (set, get) => ({
      // State
      activeTrip: null,
      pickupRoute: [],
      dropoffRoute: [],
      isLoading: false,
      isCompleteModalVisible: false,
      estimatedArrival: null,
      currentDistance: null,
      locationError: null,

      // Actions
      setActiveTrip: (trip) => set({ activeTrip: trip }),
      setPickupRoute: (route) => set({ pickupRoute: route }),
      setDropoffRoute: (route) => set({ dropoffRoute: route }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setIsCompleteModalVisible: (visible) => set({ isCompleteModalVisible: visible }),
      setEstimatedArrival: (arrival) => set({ estimatedArrival: arrival }),
      setCurrentDistance: (distance) => set({ currentDistance: distance }),
      setLocationError: (error) => set({ locationError: error }),

      // Helper functions
      isNearPickup: (currentLocation) => {
        const activeTrip = get().activeTrip;
        if (!activeTrip?.pickupLocation?.coordinates || !currentLocation) return false;

        const distance = LocationModel.calculateDistanceAndTime(
          currentLocation,
          activeTrip.pickupLocation.coordinates
        ).distance;

        return distance <= 50; // Within 50 meters of pickup location
      },

      isNearDropoff: (currentLocation) => {
        const activeTrip = get().activeTrip;
        if (!activeTrip?.dropoffLocation?.coordinates || !currentLocation) return false;

        const distance = LocationModel.calculateDistanceAndTime(
          currentLocation,
          activeTrip.dropoffLocation.coordinates
        ).distance;

        return distance <= 50; // Within 50 meters
      },

      // Reset store
      resetStore: () => {
        set({
          activeTrip: null,
          pickupRoute: [],
          dropoffRoute: [],
          isLoading: false,
          isCompleteModalVisible: false,
          estimatedArrival: null,
          currentDistance: null,
          locationError: null,
        });
      },

      // Hydrate store with data
      hydrateStore: async () => {
        try {
          const cachedTrip = await AsyncStorage.getItem('current_trip');
          const cachedRoutes = await AsyncStorage.getItem('trip_routes');
          
          if (cachedTrip) {
            const parsedTrip = JSON.parse(cachedTrip);
            set({ activeTrip: parsedTrip });
          }
          
          if (cachedRoutes) {
            const { pickupRoute, dropoffRoute } = JSON.parse(cachedRoutes);
            set({ 
              pickupRoute: pickupRoute || [],
              dropoffRoute: dropoffRoute || []
            });
          }
        } catch (error) {
          console.error('Error hydrating store:', error);
        }
      }
    }),
    {
      name: 'current-ride-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeTrip: state.activeTrip,
        pickupRoute: state.pickupRoute,
        dropoffRoute: state.dropoffRoute
      })
    }
  )
);

export default useCurrentRideStore; 