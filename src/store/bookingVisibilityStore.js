import { create } from 'zustand';

const useBookingVisibilityStore = create((set) => ({
  isBookingsVisible: true,
  setBookingsVisible: (visible) => set({ isBookingsVisible: visible }),
}));

export default useBookingVisibilityStore; 