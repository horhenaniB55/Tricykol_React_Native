/**
 * App-wide constants
 */

/**
 * Screen names for navigation
 */
export const SCREENS = {
  // Auth screens
  LOGIN: 'Login',
  OTP_VERIFICATION: 'OtpVerification',
  WEB_REGISTRATION: 'WebRegistration',
  
  // Main screens
  HOME: 'Home',
  PROFILE: 'Profile',
  WALLET: 'Wallet',
  BOOKINGS: 'Bookings',
  BOOKING_GROUP_DETAILS: 'BookingGroupDetails',
  TRIP_DETAILS: 'TripDetails',
  BOOKING_DETAILS: 'BookingDetails',
  REQUEST_SENT: 'RequestSent',
  TOP_UP_WALLET: 'TopUpWallet',
  TOP_UP_TICKET: 'TopUpTicket',
  TRIP_HISTORY: 'TripHistory',
  NOTIFICATIONS: 'Notifications',
  CURRENT_RIDE: 'CurrentRide',
};

/**
 * Colors used throughout the app
 */
export const COLORS = {
  PRIMARY: '#00BCD4',
  DARK_PRIMARY: '#263E61',
  SECONDARY: '#0097A7',
  ACCENT: '#FFC107',
  BACKGROUND: '#F5F5F5',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TEXT: '#212121',
  TEXT_SECONDARY: '#757575',
  ERROR: '#F44336',
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  GRAY_LIGHT: '#E0E0E0',
  GRAY: '#9E9E9E',
  GRAY_DARK: '#616161',
};

/**
 * API endpoints
 */
export const API = {
  OTP_SERVICE: 'https://otp-service-666017533126.asia-southeast1.run.app',
};

/**
 * Firestore collection names
 */
export const COLLECTIONS = {
  DRIVERS: 'drivers',
  WALLETS: 'wallets',
  BOOKINGS: 'bookings',
  TRIPS: 'trips',
  TRANSACTIONS: 'transactions',
  NOTIFICATIONS: 'notifications',
};

/**
 * Driver status options
 */
export const DRIVER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
};

/**
 * Booking status options
 */
export const BOOKING_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

/**
 * Driver request status options
 */
export const REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

/**
 * Trip status options
 */
export const TRIP_STATUS = {
  ON_THE_WAY: 'on_the_way',
  ARRIVED_AT_PICKUP: 'arrived_at_pickup',
  PICKED_UP: 'picked_up',
  IN_PROGRESS: 'in_progress',
  ARRIVED_AT_DROPOFF: 'arrived_at_dropoff',
  COMPLETED: 'completed',
};

/**
 * Fee and fare constants
 */
export const FEES = {
  BASE_FARE: 25, // 25 pesos for first 1 km
  ADDITIONAL_KM_RATE: 8, // 8 pesos for each km after the first 1 km
  SYSTEM_FEE_PERCENTAGE: 12, // 12% system fee
};

/**
 * Driver request status options
 */
export const DRIVER_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

/**
 * Notification types
 */
export const NOTIFICATION_TYPES = {
  DRIVER_REQUEST: 'driver_request',
  REQUEST_ACCEPTED: 'request_accepted',
  REQUEST_REJECTED: 'request_rejected',
};
