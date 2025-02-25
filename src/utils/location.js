/**
 * Location utility functions
 */

/**
 * Calculate distance between two coordinates in meters
 * 
 * @param {Object} coord1 - First coordinate
 * @param {number} coord1.latitude - Latitude of first coordinate
 * @param {number} coord1.longitude - Longitude of first coordinate
 * @param {Object} coord2 - Second coordinate
 * @param {number} coord2.latitude - Latitude of second coordinate
 * @param {number} coord2.longitude - Longitude of second coordinate
 * @returns {number} Distance in meters
 */
export const calculateDistance = (coord1, coord2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Check if a location is within a specified radius
 * 
 * @param {Object} center - Center coordinate
 * @param {number} center.latitude - Latitude of center
 * @param {number} center.longitude - Longitude of center
 * @param {Object} point - Point to check
 * @param {number} point.latitude - Latitude of point
 * @param {number} point.longitude - Longitude of point
 * @param {number} radius - Radius in meters
 * @returns {boolean} Whether the point is within the radius
 */
export const isWithinRadius = (center, point, radius) => {
  const distance = calculateDistance(center, point);
  return distance <= radius;
};

/**
 * Calculate fare based on distance
 * 
 * @param {number} distanceInMeters - Distance in meters
 * @returns {Object} Fare details
 */
export const calculateFare = (distanceInMeters) => {
  // Convert to kilometers
  const distanceInKm = distanceInMeters / 1000;
  
  // Base fare: 25 pesos for first 1 km
  const baseFare = 25;
  
  // Additional fare: 8 pesos per km after first 1 km
  const additionalDistance = Math.max(0, distanceInKm - 1);
  const additionalFare = Math.ceil(additionalDistance) * 8;
  
  // Total fare
  const totalFare = baseFare + additionalFare;
  
  // System fee: 12% of total fare
  const systemFee = Math.round(totalFare * 0.12);
  
  // Driver earnings
  const driverEarnings = totalFare - systemFee;
  
  return {
    totalFare,
    baseFare,
    additionalFare,
    systemFee,
    driverEarnings,
    distance: distanceInKm,
  };
};
