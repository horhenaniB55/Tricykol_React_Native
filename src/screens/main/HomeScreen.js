import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, DRIVER_STATUS } from '../../constants';
import { MapView } from '../../components/map';
import { Loading, AppBar, LocationErrorModal } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getAuth } from '../../services/firebase';
import { checkLocationServices } from '../../utils/location';
import { AuthService } from '../../services/auth';

/**
 * Home screen component with map
 * 
 * @param {Object} props - Component props
 * @param {Object} props.navigation - Navigation object
 * @returns {React.ReactElement} HomeScreen component
 */
export const HomeScreen = ({ navigation }) => {
  const { driver, toggleDriverStatus } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const {
    startLocationTracking,
    stopLocationTracking,
    selectNearbyBookings,
    locationError,
    isTracking,
    selectCurrentLocation,
    setLocationError,
    clearLocationError,
    showLocationErrorModal,
    locationServicesEnabled,
  } = useLocationStore();

  const currentLocation = selectCurrentLocation();
  const nearbyBookings = selectNearbyBookings();
  const [isOnline, setIsOnline] = useState(false);

  // Toggle driver online/offline status
  const handleStatusToggle = async () => {
    try {
      setIsLoading(true);
      await toggleDriverStatus(); // This now handles everything
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await getAuth().signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add this effect to monitor location services
  useEffect(() => {
    if (!locationServicesEnabled && driver?.status === 'online') {
      // Update local UI state
      setIsOnline(false);
    }
  }, [locationServicesEnabled, driver?.status]);

  // Update the isOnline state to reflect the actual driver status
  useEffect(() => {
    if (driver) {
      setIsOnline(driver.status === 'online');
    }
  }, [driver?.status]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBar
          title={`Hello, ${driver?.name || 'Driver'}`}
          subtitle={isOnline ? 'You are online' : 'You are offline'}
          rightAction={
            <View style={styles.headerRight}>
              <Switch
                value={isOnline}
                onValueChange={handleStatusToggle}
                trackColor={{ false: COLORS.GRAY, true: COLORS.PRIMARY }}
                thumbColor={COLORS.WHITE}
                style={{ marginRight: 8 }}
              />
              <Text 
                style={styles.signOut}
                onPress={handleSignOut}
              >
                Sign Out
              </Text>
            </View>
          }
        />
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView />
        </View>

        {/* Bottom panel */}
        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>
            {isOnline
              ? nearbyBookings.length > 0
                ? 'Nearby Bookings'
                : currentLocation
                  ? 'No nearby bookings found'
                  : 'Getting your location...'
              : 'Go online to see nearby bookings'}
          </Text>

          {isOnline && (
            <View style={styles.emptyState}>
              {!currentLocation && (
                <Text style={styles.loadingText}>Getting your location...</Text>
              )}
              {currentLocation && nearbyBookings.length === 0 && (
                <Text style={styles.emptyStateText}>
                  No bookings found within 700m radius
                </Text>
              )}
              {nearbyBookings.map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={styles.bookingItem}
                  onPress={() => {
                    /* Handle booking selection */
                  }}>
                  <Text style={styles.bookingTitle}>
                    {booking.pickupLocation.name}
                  </Text>
                  <Text style={styles.bookingDistance}>
                    {Math.round(booking.distance)}m away
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <LocationErrorModal
          isVisible={showLocationErrorModal}
          onClose={clearLocationError}
          errorType={locationError}
        />
      </View>

      {isLoading && <Loading />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingText: {
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  bookingItem: {
    backgroundColor: COLORS.WHITE,
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  bookingDistance: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  signOut: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  bottomPanel: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
    minHeight: 150,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
});
