/**
 * Driver related models and types
 */

/**
 * Driver model
 * @typedef {Object} Driver
 * @property {string} id - Unique identifier (matches Firebase Auth UID)
 * @property {string} name - Driver's full name
 * @property {string|null} profilePicture - URL to profile picture
 * @property {string|null} email - Driver's email (optional)
 * @property {'Male'|'Female'|'Other'} sex - Driver's gender
 * @property {Date} dateOfBirth - Driver's date of birth
 * @property {string} phoneNumber - Driver's phone number (E.164 format)
 * @property {string} plateNumber - Vehicle plate number
 * @property {string} licenseNumber - Driver's license number
 * @property {string|null} permitDocument - URL to permit document
 * @property {boolean} isVerified - Whether driver is verified
 * @property {boolean} permitVerified - Whether permit is verified
 * @property {'online'|'offline'|'busy'} status - Driver's current status
 * @property {Date} createdAt - When the driver account was created
 * @property {Date} updatedAt - When the driver account was last updated
 */

/**
 * Driver status update model
 * @typedef {Object} DriverStatusUpdate
 * @property {'online'|'offline'|'busy'} status - New status to set
 */

/**
 * Driver profile update model
 * @typedef {Object} DriverProfileUpdate
 * @property {string} [name] - Driver's full name
 * @property {string|null} [profilePicture] - URL to profile picture
 * @property {string|null} [email] - Driver's email
 * @property {'Male'|'Female'|'Other'} [sex] - Driver's gender
 * @property {Date} [dateOfBirth] - Driver's date of birth
 * @property {string} [plateNumber] - Vehicle plate number
 * @property {string} [licenseNumber] - Driver's license number
 */