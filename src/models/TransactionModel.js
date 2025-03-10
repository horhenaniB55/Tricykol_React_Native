/**
 * Transaction related models and types
 */

/**
 * Transaction model
 * @typedef {Object} Transaction
 * @property {string} id - Unique identifier
 * @property {string} driverId - ID of the driver
 * @property {'trip_fee'|'top_up'} type - Type of transaction
 * @property {number} amount - Transaction amount in pesos
 * @property {'pending'|'completed'|'cancelled'|'expired'} status - Status of the transaction
 * @property {string|null} bookingId - ID of the related booking (for trip_fee type)
 * @property {string|null} referenceNumber - Reference number (for top_up type)
 * @property {string|null} description - Additional transaction details
 * @property {Date} createdAt - When the transaction was created
 * @property {Date} updatedAt - When the transaction was last updated
 */

/**
 * Transaction history parameters
 * @typedef {Object} TransactionHistoryParams
 * @property {string} driverId - ID of the driver
 * @property {'trip_fee'|'top_up'|'all'} [type='all'] - Type of transactions to fetch
 * @property {number} [limit=20] - Maximum number of transactions to fetch
 * @property {Date} [startDate] - Start date for filtering transactions
 * @property {Date} [endDate] - End date for filtering transactions
 */

import firestore from '@react-native-firebase/firestore';
import { COLLECTIONS } from '../constants';

export class TransactionModel {
  /**
   * Send a driver request for a booking
   * @param {string} bookingId - ID of the booking
   * @param {Object} driverData - Driver information
   * @returns {Promise<void>}
   */
  static async sendDriverRequest(bookingId, driverData) {
    try {
      const db = firestore();
      const batch = db.batch();
      
      // Get booking reference
      const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
      const bookingDoc = await bookingRef.get();
      
      if (!bookingDoc.exists) {
        throw new Error('Booking not found');
      }

      const bookingData = bookingDoc.data();
      
      // Generate unique ID for driver request
      const driverRequestId = db.collection(COLLECTIONS.BOOKINGS).doc().id;
      
      // Create driver request object
      const driverRequest = {
        id: driverRequestId,
        driverId: driverData.id,
        status: 'pending',
        timestamp: firestore.Timestamp.now()
      };

      // Update booking with new driver request
      batch.update(bookingRef, {
        [`driverRequests.${driverRequestId}`]: driverRequest,
        hasDriverRequests: true,
        lastDriverRequestAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now()
      });

      // Create notification for passenger
      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: bookingData.passengerId,
        type: 'driver_request',
        title: 'New Driver Request',
        message: `${driverData.fullName} wants to pick you up`,
        data: {
          bookingId,
          driverRequestId
        },
        read: false,
        created_at: firestore.Timestamp.now()
      });

      await batch.commit();
      return driverRequestId;
    } catch (error) {
      console.error('Error sending driver request:', error);
      throw error;
    }
  }

  /**
   * Handle passenger response to driver request
   * @param {string} bookingId - ID of the booking
   * @param {string} driverRequestId - ID of the driver request
   * @param {string} status - 'accepted' or 'rejected'
   */
  static async handleDriverRequestResponse(bookingId, driverRequestId, status) {
    try {
      const db = firestore();
      const bookingRef = db.collection(COLLECTIONS.BOOKINGS).doc(bookingId);
      const bookingDoc = await bookingRef.get();
      
      if (!bookingDoc.exists) {
        throw new Error('Booking not found');
      }

      const bookingData = bookingDoc.data();
      const driverRequest = bookingData.driverRequests?.[driverRequestId];

      if (!driverRequest) {
        throw new Error('Driver request not found');
      }

      const batch = db.batch();

      if (status === 'accepted') {
        // Update booking with accepted driver and reject other requests
        const updates = {
          status: 'accepted',
          [`driverRequests.${driverRequestId}.status`]: status,
          updatedAt: firestore.Timestamp.now()
        };

        // Reject all other pending requests
        Object.entries(bookingData.driverRequests || {}).forEach(([id, request]) => {
          if (id !== driverRequestId && request.status === 'pending') {
            updates[`driverRequests.${id}.status`] = 'rejected';
          }
        });

        batch.update(bookingRef, updates);
      } else {
        // Just update the specific request status
        batch.update(bookingRef, {
          [`driverRequests.${driverRequestId}.status`]: status,
          updatedAt: firestore.Timestamp.now()
        });
      }

      // Create notification for driver
      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: driverRequest.driverId,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        title: status === 'accepted' ? 'Request Accepted' : 'Request Rejected',
        message: status === 'accepted' 
          ? `Passenger accepted your request for booking #${bookingId}`
          : `Passenger rejected your request for booking #${bookingId}`,
        data: {
          bookingId,
          driverRequestId
        },
        read: false,
        created_at: firestore.Timestamp.now()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error handling driver request response:', error);
      throw error;
    }
  }

  /**
   * Listen to driver request status changes
   * @param {string} bookingId - ID of the booking
   * @param {string} driverRequestId - ID of the driver request
   * @param {Object} callbacks - Callback functions for different statuses
   * @returns {Unsubscribe} - Function to unsubscribe from the listener
   */
  static listenToDriverRequest(bookingId, driverRequestId, callbacks) {
    const unsubscribe = firestore()
      .collection(COLLECTIONS.BOOKINGS)
      .doc(bookingId)
      .onSnapshot(snapshot => {
        const booking = snapshot.data();
        const request = booking?.driverRequests?.[driverRequestId];
        
        if (request?.status === 'accepted') {
          callbacks.onAccepted(booking);
        } else if (request?.status === 'rejected') {
          callbacks.onRejected();
        }
      }, error => {
        console.error('Error listening to driver request:', error);
        callbacks.onError(error);
      });

    return unsubscribe;
  }
}