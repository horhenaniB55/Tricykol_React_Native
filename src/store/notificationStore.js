import { create } from 'zustand';
import firestore from '@react-native-firebase/firestore';

const useNotificationStore = create((set, get) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  notificationListener: null,
  userIdListener: null,
  isInitialized: false,
  
  // Start real-time listener for unread notifications
  startNotificationListener: async (driverId) => {
    if (!driverId) return;
    
    console.log('[NotificationStore] Starting notification listener for driver:', driverId);
    
    // Clean up existing listeners if any
    const currentState = get();
    if (currentState.notificationListener || currentState.userIdListener) {
      currentState.stopNotificationListener();
    }

    // Initialize with current counts
    try {
      const [driverSnapshot, userSnapshot] = await Promise.all([
        firestore()
          .collection('notifications')
          .where('driverId', '==', driverId)
          .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
          .where('read', '==', false)
          .get(),
        firestore()
          .collection('notifications')
          .where('userId', '==', driverId)
          .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
          .where('read', '==', false)
          .get()
      ]);

      const initialDriverCount = driverSnapshot.size;
      const initialUserCount = userSnapshot.size;
      set({ unreadCount: initialDriverCount + initialUserCount });
    } catch (error) {
      console.error('[NotificationStore] Error getting initial counts:', error);
    }

    let driverIdCount = 0;
    let userIdCount = 0;
    
    // Set up real-time listeners for driverId notifications
    const unsubscribeDriverId = firestore()
      .collection('notifications')
      .where('driverId', '==', driverId)
      .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
      .where('read', '==', false)
      .onSnapshot(
        (driverIdSnapshot) => {
          if (!get().isInitialized) {
            set({ isInitialized: true });
          }
          driverIdCount = driverIdSnapshot.size;
          const totalCount = driverIdCount + userIdCount;
          console.log('[NotificationStore] Driver notifications updated:', driverIdCount, 'Total:', totalCount);
          set({ unreadCount: totalCount });
        },
        (error) => {
          console.error('[NotificationStore] Error in driverId listener:', error);
        }
      );

    // Set up real-time listeners for userId notifications
    const unsubscribeUserId = firestore()
      .collection('notifications')
      .where('userId', '==', driverId)
      .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
      .where('read', '==', false)
      .onSnapshot(
        (userIdSnapshot) => {
          userIdCount = userIdSnapshot.size;
          const totalCount = driverIdCount + userIdCount;
          console.log('[NotificationStore] User notifications updated:', userIdCount, 'Total:', totalCount);
          set({ unreadCount: totalCount });
        },
        (error) => {
          console.error('[NotificationStore] Error in userId listener:', error);
        }
      );
    
    // Store the unsubscribe functions
    set({ 
      notificationListener: unsubscribeDriverId,
      userIdListener: unsubscribeUserId
    });
  },
  
  // Stop notification listeners
  stopNotificationListener: () => {
    const { notificationListener, userIdListener } = get();
    if (notificationListener) {
      console.log('[NotificationStore] Stopping driverId listener');
      notificationListener();
    }
    if (userIdListener) {
      console.log('[NotificationStore] Stopping userId listener');
      userIdListener();
    }
    set({ 
      notificationListener: null,
      userIdListener: null,
      isInitialized: false
    });
  },

  markAsRead: async (notificationId) => {
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({ read: true });
      
      console.log('[NotificationStore] Marked notification as read:', notificationId);
    } catch (error) {
      console.error('[NotificationStore] Error marking notification as read:', error);
    }
  },
}));

export default useNotificationStore; 