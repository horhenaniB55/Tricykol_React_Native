/**
 * Location related models and types
 */

/**
 * Location model
 * @typedef {Object} Location
 * @property {string} address - Human-readable address
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 * @property {string} [geohash] - Geohash for location-based queries
 */

/**
 * Driver location update model
 * @typedef {Object} DriverLocationUpdate
 * @property {string} driverId - ID of the driver
 * @property {number} latitude - Current latitude
 * @property {number} longitude - Current longitude
 * @property {number} heading - Direction in degrees (0-360)
 * @property {number} speed - Current speed in meters/second
 * @property {Date} timestamp - When the location was recorded
 */

/**
 * Route model
 * @typedef {Object} Route
 * @property {Location} origin - Starting location
 * @property {Location} destination - Ending location
 * @property {number} distance - Distance in kilometers
 * @property {number} duration - Duration in minutes
 * @property {Array<Location>} waypoints - Intermediate points along the route
 * @property {string} polyline - Encoded polyline for the route
 */