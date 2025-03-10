import { create } from 'zustand';
import auth from '@react-native-firebase/auth';
import { AuthService } from '../services/passengerAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create((set, get) => ({
  user: null,
  passenger: null,
  isLoading: true,
  error: null,
  initialized: false,

  setUser: (user) => set({ user }),
  setPassenger: (passenger) => {
    set({ passenger });
    AsyncStorage.setItem('passenger', JSON.stringify(passenger));
  },
  setLoading: (isLoading) => set({ isLoading }),

  initialize: () => {
    // Set up auth state listener
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      set({ isLoading: true });
      
      if (user) {
        try {
          // User is signed in
          console.log('Auth state changed: User is signed in');
          set({ user });
          
          // Get passenger data
          const passengerData = await AuthService.getCurrentPassenger();
          set({ passenger: passengerData });
        } catch (error) {
          console.error('Error getting passenger data:', error);
        }
      } else {
        // User is signed out
        console.log('Auth state changed: User is signed out');
        set({ user: null, passenger: null });
      }
      
      set({ isLoading: false });
    });
    
    // Return unsubscribe function
    return unsubscribe;
  },

  signOut: async () => {
    try {
      await AuthService.signOut();
      set({ user: null, passenger: null });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  clearError: () => set({ error: null }),
})); 