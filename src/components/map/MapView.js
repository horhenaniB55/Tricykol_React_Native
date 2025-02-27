import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Callout } from 'react-native-maps';
import { COLORS } from '../../constants';
import useLocationStore from '../../store/locationStore';

/**
 * Map view component using Google Maps
 * 
 * @param {Object} props - Component props
 * @param {Object} [props.initialRegion] - Initial map region
 * @param {Array} [props.markers] - Array of markers to display
 * @param {Function} [props.onRegionChange] - Callback when map region changes
 * @param {Function} [props.onPress] - Callback when map is pressed
 * @param {Object} [props.style] - Additional container style
 * @returns {React.ReactElement} MapView component
 */
export const CustomMapView = ({
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
  const { 
    currentLocation, 
    locationError, 
    startLocationTracking, 
    stopLocationTracking,
    clearLocationError 
  } = useLocationStore();

  // Handle location errors
  useEffect(() => {
    if (locationError) {
      Alert.alert(
        'Location Error',
        locationError,
        [
          { 
            text: 'Retry', 
            onPress: () => {
              clearLocationError();
              startLocationTracking();
            }
          },
          { 
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  }, [locationError]);

  // Set up location tracking
  useEffect(() => {
    startLocationTracking();
    return () => stopLocationTracking();
  }, []);

  return (
    <View style={[styles.container, style]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || initialRegion.latitude,
          longitude: currentLocation?.longitude || initialRegion.longitude,
          latitudeDelta: 0.01, // Corresponds roughly to zoomLevel 14
          longitudeDelta: 0.01,
        }}
        onRegionChange={onRegionChange}
        onPress={onPress}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        loadingEnabled
        onMapReady={() => setIsMapReady(true)}
      >
        {markers.map((marker, index) => (
          <Marker
            key={`marker-${index}`}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker} />
            </View>
            <Callout>
              <Text>{marker.title}</Text>
            </Callout>
          </Marker>
        ))}
      </MapView>

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
};

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
