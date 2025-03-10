import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import MapView from 'react-native-maps';
import useLocationStore from '../store/locationStore';
import LocationErrorModal from '../components/common/LocationErrorModal';

const MapScreen = () => {
  const { 
    locationPermission,
    locationServicesEnabled,
    locationError,
    initializeLocation,
    currentLocation,
    isInitializing,
    initializationError 
  } = useLocationStore();

  useEffect(() => {
    // Only initialize if we haven't checked permissions yet
    if (locationPermission === null) {
      initializeLocation();
    }
  }, []);

  // Show loading state
  if (isInitializing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Getting location...</Text>
      </View>
    );
  }

  // Show error state
  if (initializationError || locationError) {
    return <LocationErrorModal />;
  }

  // Show map only if we have both permissions and services enabled
  return (
    <View style={styles.container}>
      {locationPermission === 'granted' && locationServicesEnabled && currentLocation ? (
        <MapView 
          {...mapProps}
          initialRegion={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
          }}
        />
      ) : (
        <View style={styles.placeholderContainer}>
          <Text>Waiting for location access...</Text>
        </View>
      )}
    </View>
  );
};

export default MapScreen; 