import { GeoPoint } from '@react-native-firebase/firestore';

/**
 * Booking related models and types
 */

/**
 * Booking model
 * @typedef {Object} Booking
 * @property {string} id - Unique identifier
 * @property {string} passengerId - ID of the passenger who created the booking
 * @property {string} passengerName - Name of the passenger
 * @property {string} passengerPhone - Phone number of the passenger
 * @property {Location} pickupLocation - Pickup location details
 * @property {Location} dropoffLocation - Dropoff location details
 * @property {Date} dateTime - When the booking was created
 * @property {Date|null} scheduledTime - When the booking is scheduled for (optional)
 * @property {'pending'|'in_progress'|'completed'|'cancelled'} status - Current booking status
 * @property {string|null} driverId - ID of the assigned driver (if any)
 * @property {number} distance - Estimated distance in kilometers
 * @property {number} duration - Estimated duration in minutes
 * @property {number} fare - Calculated fare amount
 * @property {Date} createdAt - When the booking was created
 * @property {Date} updatedAt - When the booking was last updated
 */

/**
 * Driver request model
 * @typedef {Object} DriverRequest
 * @property {string} id - Unique identifier
 * @property {string} bookingId - ID of the booking
 * @property {string} driverId - ID of the driver making the request
 * @property {'pending'|'accepted'|'rejected'} status - Status of the request
 * @property {Date} createdAt - When the request was created
 * @property {Date} updatedAt - When the request was last updated
 */

/**
 * Trip status update model
 * @typedef {Object} TripStatusUpdate
 * @property {string} bookingId - ID of the booking
 * @property {'on_the_way'|'arrived_at_pickup'|'picked_up'|'in_progress'|'completed'} status - New status
 */

/**
 * Nearby booking search parameters
 * @typedef {Object} NearbyBookingParams
 * @property {GeoPoint} location - Current driver location
 * @property {number} radius - Search radius in meters (default: 700)
 */
