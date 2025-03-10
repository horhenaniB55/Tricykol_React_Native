import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS, SCREENS } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import useNotificationStore from '../../store/notificationStore';
import useBookingVisibilityStore from '../../store/bookingVisibilityStore';
import { reverseGeocode } from '../../utils/location';
import { truncateString } from '../../utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService } from '../../services/locationService';
import { serviceManager } from '../../services/serviceManager';
import * as Location from 'expo-location';

const APPBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 68;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 0;

// Screens that should show the custom header with location/booking status
const CUSTOM_HEADER_SCREENS = ['CurrentRide', 'Map', 'Bookings', 'Wallet', 'Menu'];

// Add these constants at the top of the file
const LOCATION_NAME_CACHE_KEY = '@location_name_cache';
const LOCATION_NAME_CACHE_EXPIRY = 1000 * 60 * 5; // 5 minutes

/**
 * Component to display the custom status header with location/trip info and online toggle
 */
const StatusHeader = () => {
  const navigation = useNavigation();
  const { driver } = useAuthStore();
  const { unreadCount, startNotificationListener, stopNotificationListener } = useNotificationStore();
  const { isBookingsVisible, setBookingsVisible } = useBookingVisibilityStore();
  const { 
    activeTrip, 
    currentLocation,
    locationServicesEnabled,
    locationPermission,
    showLocationErrorModal,
    locationError,
    locationErrorType,
    startLocationTracking,
    stopLocationTracking,
    initializeLocation,
    clearLocationError,
    getLastKnownLocation
  } = useLocationStore();
  const [locationName, setLocationName] = useState(null);
  const [isToggling, setIsToggling] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(true);

  // Start notification listener when component mounts
  useEffect(() => {
    let mounted = true;

    const initializeNotifications = async () => {
      if (driver?.id && mounted) {
        console.log('[AppBar] Starting notification listener for driver:', driver.id);
        await startNotificationListener(driver.id);
      }
    };

    initializeNotifications();
      
    // Cleanup listener when component unmounts
    return () => {
      mounted = false;
      console.log('[AppBar] Cleaning up notification listener');
      stopNotificationListener();
    };
  }, [driver?.id]);

  // Get initial location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      console.log('[AppBar] Fetching initial location');
      setIsLocationLoading(true);
      const location = await getLastKnownLocation();
      if (location) {
        await updateLocationName(location);
      }
      setIsLocationLoading(false);
    };
    fetchLocation();
  }, []);

  // Update location name when current location changes
  useEffect(() => {
    if (currentLocation) {
      setIsLocationLoading(true);
      updateLocationName(currentLocation);
    }
  }, [currentLocation]);

  const updateLocationName = async (location) => {
    try {
      const { latitude, longitude } = location;
      
      // Generate cache key
      const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
      
      // Try to get from cache first
      const cached = await AsyncStorage.getItem(`${LOCATION_NAME_CACHE_KEY}_${cacheKey}`);
      if (cached) {
        const { name, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < LOCATION_NAME_CACHE_EXPIRY) {
          setLocationName(name);
          setIsLocationLoading(false);
          return;
        }
      }

      const geocodeResult = await reverseGeocode(latitude, longitude);
      
      if (geocodeResult && geocodeResult.length > 0) {
        const locationData = geocodeResult[0];
        let name = "Unknown Location";
        
        if (locationData.street) {
          name = locationData.street;
        } else if (locationData.city) {
          name = locationData.city;
        } else if (locationData.subregion) {
          name = locationData.subregion;
        }

        // Cache the result
        await AsyncStorage.setItem(`${LOCATION_NAME_CACHE_KEY}_${cacheKey}`, JSON.stringify({
          name,
          timestamp: Date.now()
        }));

        setLocationName(name);
        setIsLocationLoading(false);
      }
    } catch (error) {
      console.error('[AppBar] Error updating location name:', error);
      setLocationName("Unknown Location");
      setIsLocationLoading(false);
    }
  };

  // Handle toggle
  const handleToggle = async () => {
    if (isToggling) return;
    
    try {
      setIsToggling(true);
      
      // Quick check of location permission and services without initialization
      const { status } = await Location.getForegroundPermissionsAsync();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      
      if (status !== 'granted' || !servicesEnabled) {
        console.log('[AppBar] Location services not available');
        Alert.alert(
          'Location Error', 
          'Please enable location services and permissions to show bookings.',
          [{ text: 'OK' }]
        );
        setIsToggling(false);
        return;
      }

      // Toggle visibility in both store and AsyncStorage
      const newVisibility = !isBookingsVisible;
      await AsyncStorage.setItem('bookings_visible', JSON.stringify(newVisibility));
      setBookingsVisible(newVisibility);
      
    } catch (error) {
      console.error('[AppBar] Error toggling visibility:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsToggling(false);
    }
  };

  const getStatusText = () => {
    if (activeTrip) {
      switch (activeTrip.status) {
        case 'picking_up':
          return 'OTW to pickup';
        case 'arrived':
          return 'Arrived';
        case 'in_progress':
          return 'On Trip';
        case 'completed':
          return 'Trip Completed';
        default:
          return activeTrip.status;
      }
    }
    
    // Return null if location is still loading
    if (isLocationLoading) {
      return null;
    }
    
    return locationName || "Unknown location";
  };

  const MAX_LOCATION_LENGTH = 20;

  return (
    <View style={styles.container}>
      {/* Left section with status and balance */}
      <View style={styles.leftSection}>
        {isLocationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.locationLoader} />
            <Text style={styles.locationText}> (₱{driver?.walletBalance?.toFixed(2) || '0.00'})</Text>
          </View>
        ) : (
          <Text style={styles.locationText} numberOfLines={1}>
            {truncateString(getStatusText(), MAX_LOCATION_LENGTH)} (₱{driver?.walletBalance?.toFixed(2) || '0.00'})
          </Text>
        )}
      </View>

      {/* Notification button with optimized badge */}
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={() => navigation.navigate('Notifications')}
      >
        <Icon name="notifications" size={24} color={COLORS.TEXT} />
        {typeof unreadCount === 'number' && unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Optimized toggle button */}
      <TouchableOpacity 
        onPress={handleToggle}
        disabled={isToggling}
        activeOpacity={0.8}
        style={[
          styles.statusButton,
          isBookingsVisible ? styles.onlineButton : styles.offlineButton,
          isToggling && styles.buttonDisabled
        ]}
      >
        <Text style={styles.statusText}>
          {isToggling ? <ActivityIndicator size="small" color={COLORS.GRAY_LIGHT} style={{ padding: 5 }} /> : isBookingsVisible ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Main AppBar component
 */
export const AppBar = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  showBack = false,
  onBack,
  style,
  titleStyle,
  subtitleStyle,
  showLocation = false,
}) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { driver } = useAuthStore();
  const currentLocation = useLocationStore(state => state.currentLocation);
  const [locationName, setLocationName] = useState('');

  useEffect(() => {
    const updateLocationName = async () => {
      if (!currentLocation?.latitude || !currentLocation?.longitude) {
        return;
      }

      try {
        const geocodeResult = await reverseGeocode(
          currentLocation.latitude,
          currentLocation.longitude
        );

        if (geocodeResult && geocodeResult[0]) {
          const { street, name, city } = geocodeResult[0];
          setLocationName(street || name || city || 'Unknown location');
        }
      } catch (error) {
        console.error('Error updating location name:', error);
      }
    };

    if (showLocation) {
      updateLocationName();
    }
  }, [currentLocation, showLocation]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  const showCustomHeader = CUSTOM_HEADER_SCREENS.includes(route.name);

  const renderLeft = () => {
    if (leftAction) return leftAction;
    if (showBack) {
      return (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-back" size={24} color={COLORS.TEXT} />
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (showCustomHeader) {
    return <StatusHeader />;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Left section */}
      <View style={styles.leftSection}>
        {renderLeft()}
      </View>

      {/* Title section */}
      <View style={styles.titleSection}>
        <Text style={[styles.title, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right section */}
      <View style={styles.rightSection}>{rightAction}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: APPBAR_HEIGHT + STATUSBAR_HEIGHT,
    paddingTop: STATUSBAR_HEIGHT,
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
  },
  leftSection: {
    flex: 1,
    paddingLeft: 8,
    height: APPBAR_HEIGHT,
    justifyContent: 'center',
  },
  rightSection: {
    minWidth: 48,
    height: APPBAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: 8,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '600',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  onlineButton: {
    backgroundColor: COLORS.SUCCESS,
  },
  offlineButton: {
    backgroundColor: COLORS.ERROR,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  statusText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleSection: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  actionButton: {
    padding: 10,
  },
  header: {
    height: APPBAR_HEIGHT + STATUSBAR_HEIGHT,
    paddingTop: STATUSBAR_HEIGHT,
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
  },
  backButton: {
    padding: 10,
  },
  rightSection: {
    minWidth: 48,
    height: APPBAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: 8,
  },
  locationLoader: {
    marginRight: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    padding: 8,
    marginRight: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
