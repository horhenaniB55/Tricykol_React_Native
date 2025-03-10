import React, { useEffect, useState, forwardRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import RNMapView, { PROVIDER_GOOGLE, Marker, Callout, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import useLocationStore from '../../store/locationStore';

/**
 * Map view component using Google Maps
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.initialRegion] - Initial map region
 * @param {Array} [props.markers] - Array of markers to display
 * @param {Array} [props.polylines] - Array of polylines to display
 * @param {Function} [props.onRegionChange] - Callback when map region changes
 * @param {Function} [props.onPress] - Callback when map is pressed
 * @param {Object} [props.style] - Additional container style
 * @param {number} [props.minZoomLevel] - Minimum zoom level
 * @param {number} [props.maxZoomLevel] - Maximum zoom level
 * @param {Function} [props.onMapReady] - Callback when map is ready
 * @param {boolean} [props.zoomEnabled] - Whether to enable zoom gestures
 * @param {boolean} [props.scrollEnabled] - Whether to enable scroll gestures
 * @param {boolean} [props.pitchEnabled] - Whether to enable pitch gestures
 * @param {boolean} [props.rotateEnabled] - Whether to enable rotate gestures
 * @param {boolean} [props.moveOnMarkerPress] - Whether to move to marker on press
 * @param {boolean} [props.liteMode] - Whether to use lite mode for static maps
 * @returns {React.ReactElement} MapView component
 */
export const MapView = forwardRef(({
  initialRegion = {
    latitude: 15.6661,  // Paniqui coordinates
    longitude: 120.5586,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  },
  markers = [],
  polylines = [],
  onRegionChange,
  onPress,
  style,
  minZoomLevel = 12,
  maxZoomLevel = 20,
  onMapReady,
  zoomEnabled = true,
  scrollEnabled = true,
  pitchEnabled = true,
  rotateEnabled = true,
  moveOnMarkerPress = true,
  liteMode = false,
}, ref) => {
  const [isMapReady, setIsMapReady] = useState(false);
  const { 
    currentLocation, 
    locationError, 
    startLocationTracking, 
    stopLocationTracking,
    clearLocationError 
  } = useLocationStore();

  // Set up location tracking
  useEffect(() => {
    startLocationTracking();
    return () => stopLocationTracking();
  }, []);

  const handleMapReady = () => {
    setIsMapReady(true);
    if (onMapReady) {
      onMapReady();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <RNMapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || initialRegion.latitude,
          longitude: currentLocation?.longitude || initialRegion.longitude,
          latitudeDelta: initialRegion.latitudeDelta,
          longitudeDelta: initialRegion.longitudeDelta,
        }}
        onRegionChange={onRegionChange}
        onPress={onPress}
        showsUserLocation
        showsMyLocationButton={scrollEnabled}
        showsCompass={rotateEnabled}
        loadingEnabled
        minZoomLevel={minZoomLevel}
        maxZoomLevel={maxZoomLevel}
        onMapReady={handleMapReady}
        zoomEnabled={zoomEnabled}
        scrollEnabled={scrollEnabled}
        pitchEnabled={pitchEnabled}
        rotateEnabled={rotateEnabled}
        moveOnMarkerPress={moveOnMarkerPress}
        liteMode={liteMode}
      >
        {markers.map((marker, index) => (
          <Marker
            key={`marker-${index}`}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            pinColor={marker.pinColor}
          >
            {marker.iconName ? (
              <View style={styles.markerContainer}>
                <Icon name={marker.iconName} size={32} color={marker.pinColor} />
              </View>
            ) : null}
            <Callout>
              <Text>{marker.title}</Text>
            </Callout>
          </Marker>
        ))}
        
        {polylines.map((polyline, index) => (
          <Polyline
            key={`polyline-${index}`}
            coordinates={polyline.coordinates}
            strokeColor={polyline.strokeColor || '#000'}
            strokeWidth={polyline.strokeWidth || 2}
          />
        ))}
      </RNMapView>

      {(!isMapReady || locationError) && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {locationError || 'Loading map...'}
          </Text>
          {locationError && (
            <Text style={styles.errorText}>
              Please check your location settings and try again.
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

// Add display name for debugging
MapView.displayName = 'MapView';

const styles = StyleSheet.create({
  errorText: {
    fontSize: 14,
    color: COLORS.ERROR,
    textAlign: 'center',
    marginTop: 8,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
