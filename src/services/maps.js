import { getDistance } from 'geolib';

class MapsService {
  constructor() {
    this.routeCache = new Map();
    this.CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    this.ROUTE_RECALC_THRESHOLD = 100; // 100 meters
  }

  getDirections = async (origin, destination) => {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(origin, destination);
      const cachedRoute = this.getValidCachedRoute(cacheKey, origin);
      
      if (cachedRoute) {
        return cachedRoute;
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Directions API error:', data);
        throw new Error(`Directions request failed: ${data.status}`);
      }

      const points = data.routes[0].overview_polyline.points;
      const coordinates = this.decodePolyline(points);

      const routeData = {
        coordinates,
        distance: data.routes[0].legs[0].distance.value,
        duration: data.routes[0].legs[0].duration.value,
        timestamp: Date.now(),
        originLocation: origin,
      };

      // Cache the route
      this.routeCache.set(cacheKey, routeData);

      return routeData;
    } catch (error) {
      console.error('Error fetching directions:', error);
      throw error;
    }
  };

  // Get cache key for route
  getCacheKey = (origin, destination) => {
    return `${origin.latitude},${origin.longitude}-${destination.latitude},${destination.longitude}`;
  };

  // Check if cached route is still valid
  getValidCachedRoute = (cacheKey, currentLocation) => {
    const cached = this.routeCache.get(cacheKey);
    
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_EXPIRY;
    if (isExpired) {
      this.routeCache.delete(cacheKey);
      return null;
    }

    // Check if we've deviated too far from the original route
    const distanceFromOriginal = getDistance(
      currentLocation,
      cached.originLocation
    );

    if (distanceFromOriginal > this.ROUTE_RECALC_THRESHOLD) {
      this.routeCache.delete(cacheKey);
      return null;
    }

    return cached;
  };

  // Google Maps polyline decoder
  decodePolyline = (encoded) => {
    const points = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let shift = 0, result = 0;

      do {
        let byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);

      lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

      shift = 0;
      result = 0;

      do {
        let byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);

      lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };
}

// Export singleton instance
export const mapsService = new MapsService(); 