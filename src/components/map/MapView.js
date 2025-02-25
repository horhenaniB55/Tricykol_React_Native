import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { COLORS } from '../../constants';

/**
 * Map view component using Mapbox
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.initialRegion] - Initial map region
 * @param {Array} [props.markers] - Array of markers to display
 * @param {Function} [props.onRegionChange] - Callback when map region changes
 * @param {Function} [props.onPress] - Callback when map is pressed
 * @param {Object} [props.style] - Additional container style
 * @returns {React.ReactElement} MapView component
 */
export const MapView = ({
  initialRegion = {
    latitude: 15.6661,  // Paniqui coordinates
    longitude: 120.5586,
    zoomLevel: 14,
  },
  markers = [],
  onRegionChange,
  onPress,
  style,
}) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Get current location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const location = await Mapbox.locationManager.getLastKnownLocation();
        
        if (location) {
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };

    getLocation();
  }, []);

  // Handle map load
  const handleMapReady = () => {
    setIsMapReady(true);
  };

  return (
    <View style={[styles.container, style]}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onDidFinishLoadingMap={handleMapReady}
        onRegionDidChange={onRegionChange}
        onPress={onPress}
        compassEnabled
        zoomEnabled
        rotateEnabled
      >
        <Mapbox.Camera
          zoomLevel={initialRegion.zoomLevel}
          centerCoordinate={[
            currentLocation?.longitude || initialRegion.longitude,
            currentLocation?.latitude || initialRegion.latitude,
          ]}
          animationDuration={500}
        />

        {/* User location */}
        <Mapbox.UserLocation
          visible
          showsUserHeadingIndicator
          androidRenderMode="normal"
        />

        {/* Markers */}
        {markers.map((marker, index) => (
          <Mapbox.PointAnnotation
            key={`marker-${index}`}
            id={`marker-${index}`}
            coordinate={[marker.longitude, marker.latitude]}
            title={marker.title}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker} />
            </View>
            <Mapbox.Callout title={marker.title} />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>

      {!isMapReady && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
  markerContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    borderWidth: 2,
    borderColor: COLORS.WHITE,
  },
});
