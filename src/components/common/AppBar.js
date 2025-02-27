import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { reverseGeocode } from '../../utils/location';
import { truncateString } from '../../utils';

const APPBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 0;

// Screens that should show the custom header with location/booking status
const CUSTOM_HEADER_SCREENS = ['CurrentRide', 'Map', 'Rides', 'Wallet', 'Menu'];

/**
 * Component to display the custom status header with location/trip info and online toggle
 */
const StatusHeader = () => {
  const { driver, toggleDriverStatus } = useAuthStore();
  const { 
    activeTrip, 
    currentLocation,
    locationServicesEnabled,
    showLocationErrorModal,
    setLocationError,
    clearLocationError,
    startWatchingLocationAvailability,
    stopWatchingLocationAvailability
  } = useLocationStore();
  const [locationName, setLocationName] = useState("Loading...");
  const [isToggling, setIsToggling] = useState(false);
  const isOnline = driver?.status === "online";

  // Start watching location services when component mounts
  useEffect(() => {
    startWatchingLocationAvailability();
    return () => stopWatchingLocationAvailability();
  }, []);

  // Update location name whenever current location changes
  useEffect(() => {
    let isMounted = true;

    const updateLocationName = async () => {
      if (!currentLocation) {
        setLocationName("...");
        return;
      }

      try {
        const { latitude, longitude } = currentLocation;
        const geocodeResult = await reverseGeocode(latitude, longitude);
        
        if (isMounted) {
          if (geocodeResult && geocodeResult.length > 0) {
            const location = geocodeResult[0];
            
            // Prioritize street name, then fall back to city
            if (location.street) {
              setLocationName(location.street);
            } else if (location.city) {
              setLocationName(location.city);
            } else {
              setLocationName(location.subregion || "Unknown Location");
            }
          } else {
            setLocationName("Unknown Location");
          }
        }
      } catch (error) {
        console.error('Error updating location name:', error);
        if (isMounted) {
          setLocationName("Unknown Location");
        }
      }
    };

    updateLocationName();
    return () => { isMounted = false; };
  }, [currentLocation]);

  // Handle toggle status - make this handle the modal directly
  const handleToggle = async () => {
    if (isToggling) return;
    
    try {
      setIsToggling(true);
      
      // The problem is here - we need to check if we're trying to go online
      // with location disabled, not if we're already offline with location disabled
      
      // FIXED CONDITION: If currently offline (trying to go online) AND location is disabled
      if (driver?.status === 'offline' && !locationServicesEnabled) {
        console.log('Trying to go online with location disabled, showing error modal');
        
        // Force modal to show
        setLocationError('services');
        
        // Reset toggle state
        setIsToggling(false);
        return;
      }
      
      // Otherwise proceed with the toggle
      await toggleDriverStatus();
    } catch (error) {
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
    return locationName;
  };

  const MAX_LOCATION_LENGTH = 20; // Maximum characters for location name before truncating

  return (
    <View style={styles.container}>
      {/* Left section with status and balance */}
      <View style={styles.leftSection}>
        <Text style={styles.locationText} numberOfLines={1}>
          {truncateString(getStatusText(), MAX_LOCATION_LENGTH)} (₱{driver?.walletBalance?.toFixed(2) || '0.00'})
        </Text>
      </View>

      {/* Right section with online/offline toggle */}
      <View style={styles.rightSection}>
        <TouchableOpacity 
          onPress={handleToggle}
          disabled={isToggling}
          activeOpacity={0.7}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          style={[
            styles.toggleButtonContainer,
            isToggling && styles.toggleButtonDisabled
          ]}>
          <View style={[
            styles.toggleButton,
            { backgroundColor: isOnline ? COLORS.SUCCESS : COLORS.ERROR }
          ]}>
            <View style={styles.toggleTextContainer}>
              <Text style={[styles.toggleText, styles.toggleBoldText]}>
                {isOnline ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
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
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  const route = useRoute();
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
  toggleButtonContainer: {
    height: 35,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    width: 52,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 1,
    bottom: 0,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  toggleText: {
    color: COLORS.WHITE,
    fontSize: 12,
    fontWeight: Platform.select({
      ios: '900',
      android: 'bold'
    }),
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 1,
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
});
