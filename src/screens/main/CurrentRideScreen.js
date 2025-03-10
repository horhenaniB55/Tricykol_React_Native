import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { throttle } from 'lodash';
import { View, StyleSheet, Platform, Alert, Text, ActivityIndicator, AppState, Linking, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { AppBar, Button, LocationErrorModal } from '../../components/common';
import { COLORS, TRIP_STATUS } from '../../constants';
import { LocationModel } from '../../models/LocationModel';
import useLocationStore from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';
import useCurrentRideStore from '../../store/currentRideStore';
import firestore from '@react-native-firebase/firestore';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { SmsService } from '../../services/sms';
import { MapsService } from '../../services/maps';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { CurrentRideDetailsSheet } from '../../components/ride/CurrentRideDetailsSheet';
import Icon from 'react-native-vector-icons/Ionicons';

const FARE_CONSTANTS = {
  BASE_FARE: 25, // 25 pesos for first 1km
  BASE_DISTANCE: 1000, // 1km in meters
  ADDITIONAL_FARE_PER_KM: 8, // 8 pesos per additional km
  SYSTEM_FEE_PERCENTAGE: 0.12 // 12%
};

const calculateFareAndFees = (distanceInMeters) => {
  // Calculate base fare
  let totalFare = FARE_CONSTANTS.BASE_FARE;
  
  // Calculate additional fare for distance beyond 1km
  if (distanceInMeters > FARE_CONSTANTS.BASE_DISTANCE) {
    const additionalKm = (distanceInMeters - FARE_CONSTANTS.BASE_DISTANCE) / 1000;
    const additionalFare = Math.ceil(additionalKm) * FARE_CONSTANTS.ADDITIONAL_FARE_PER_KM;
    totalFare += additionalFare;
  }
  
  // Calculate system fee (12% of total fare)
  const systemFee = totalFare * FARE_CONSTANTS.SYSTEM_FEE_PERCENTAGE;
  
  return {
    fare: Math.round(totalFare), // Round to nearest peso
    systemFee: Math.round(systemFee), // Round to nearest peso
    totalDistance: distanceInMeters
  };
};

// Memoized ActionButton component to prevent unnecessary rerenders
const ActionButtonMemo = memo(({ buttonInfo, loading, style }) => {
  return (
    <Button
      title={buttonInfo.title}
      onPress={buttonInfo.onPress}
      loading={loading}
      disabled={buttonInfo.disabled}
      style={style}
    />
  );
});

export const CurrentRideScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const currentRideInitializedRef = useRef(false);
  const appState = useRef(AppState.currentState);
  // Force re-render state for button updates
  const [forceUpdate, setForceUpdate] = useState(false);
  // Add state for success screen visibility
  const [isSuccessScreenVisible, setIsSuccessScreenVisible] = useState(false);
  const [tripCompletionData, setTripCompletionData] = useState(null);
  // Ref for tracking distance changes
  const lastDistanceRef = useRef(null);
  
  // Location and driver state
  const { currentLocation, getLastKnownLocation, updateCurrentLocation } = useLocationStore();
  const { user } = useAuthStore();
  const {
    activeTrip,
    pickupRoute,
    dropoffRoute,
    isCompleteModalVisible,
    estimatedArrival,
    currentDistance,
    locationError,
    setActiveTrip,
    setPickupRoute,
    setDropoffRoute,
    setIsCompleteModalVisible,
    setEstimatedArrival,
    setCurrentDistance,
    setLocationError,
    isNearPickup,
    isNearDropoff,
    resetStore,
    hydrateStore
  } = useCurrentRideStore();
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const isFocused = useIsFocused();

  // Initialize location and trip data on mount
  useEffect(() => {
    let isMounted = true;
    
    const initializeLocation = async () => {
      try {
        console.log('[CurrentRideScreen] Initializing location data');
        setIsLoading(true);
        
        // Step 1: Try to get location from memory
        if (!currentLocation) {
          console.log('[CurrentRideScreen] No current location in memory, fetching from storage');
          
          // Step 2: Try to get location from AsyncStorage
          const lastLocation = await getLastKnownLocation();
          
          // Validate location data and check if it's not too old (> 30 minutes)
          const isLocationValid = lastLocation && 
                                 typeof lastLocation.latitude === 'number' && 
                                 typeof lastLocation.longitude === 'number' &&
                                 !isNaN(lastLocation.latitude) && 
                                 !isNaN(lastLocation.longitude);
                               
          const isLocationRecent = lastLocation && 
                                 lastLocation.timestamp && 
                                 (new Date().getTime() - lastLocation.timestamp < 30 * 60 * 1000);
          
          if (isLocationValid && isLocationRecent && isMounted) {
            console.log('[CurrentRideScreen] Got valid recent location from storage:', lastLocation);
            updateCurrentLocation(lastLocation);
          } else {
            // Log reason why stored location was rejected
            if (lastLocation) {
              if (!isLocationValid) {
                console.log('[CurrentRideScreen] Location from storage is invalid', lastLocation);
              } else if (!isLocationRecent) {
                console.log('[CurrentRideScreen] Location from storage is too old', {
                  stored: new Date(lastLocation.timestamp).toISOString(),
                  now: new Date().toISOString(),
                  ageMinutes: Math.round((new Date().getTime() - lastLocation.timestamp) / (60 * 1000))
                });
                
                // Still use old location temporarily to avoid null values, just update it
                if (isLocationValid) {
                  console.log('[CurrentRideScreen] Using old location temporarily while getting fresh one');
                  updateCurrentLocation({
                    ...lastLocation,
                    timestamp: new Date().getTime() // Update timestamp to prevent other components from rejecting it
                  });
                }
              }
            }
            
            console.log('[CurrentRideScreen] No valid recent location in storage, requesting current position');
            
            // Step 3: If no valid location in AsyncStorage, get from Geolocation
            try {
              // Check location permission
              const permissionResult = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
              
              if (permissionResult !== RESULTS.GRANTED) {
                const requestResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
                if (requestResult !== RESULTS.GRANTED) {
                  console.warn('[CurrentRideScreen] Location permission denied');
                  Toast.show({
                    type: 'error',
                    text1: 'Location Access Required',
                    text2: 'Please enable location services to use this feature',
                  });
                  return;
                }
              }
              
              // Get current position
              try {
                const position = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.High,
                  timeout: 15000,
                  maximumAge: 10000
                });
                
                const { latitude, longitude, accuracy } = position.coords;
                const currentLocation = { 
                  latitude, 
                  longitude,
                  accuracy,
                  timestamp: position.timestamp || new Date().getTime()
                };
                
                if (isMounted) {
                  console.log('[CurrentRideScreen] Got location from expo-location:', currentLocation);
                  updateCurrentLocation(currentLocation);
                }
              } catch (error) {
                console.error('[CurrentRideScreen] Location error:', error);
                throw error;
              }
            } catch (error) {
              console.error('[CurrentRideScreen] Error getting current location:', error);
              Toast.show({
                type: 'error',
                text1: 'Location Error',
                text2: 'Could not determine your current location',
              });
            }
          }
        } else {
          console.log('[CurrentRideScreen] Using existing location from memory');
        }
      } catch (error) {
        console.error('[CurrentRideScreen] Location initialization error:', error);
        Toast.show({
          type: 'error',
          text1: 'Error Initializing',
          text2: error.message || 'Something went wrong',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeLocation();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle screen focus - only initialize after location is loaded
  useEffect(() => {
    let isMounted = true;
    
    // Use a ref to track if the screen has been initialized already
    // This ensures we don't reinitialize when navigating back to this screen
    if (!currentRideInitializedRef.current) {
      const handleScreenFocus = async () => {
        if (!isMounted) return;
        
        // Before hydrating the store, make sure we have a valid location
        if (!currentLocation) {
          console.log('[CurrentRideScreen] No location available yet, waiting...');
          try {
            setIsLoading(true);
            // Try to initialize location once more
            await initializeLocation();
            
            // If still no location, show error
            if (!useLocationStore.getState().currentLocation) {
              console.warn('[CurrentRideScreen] Unable to get location data after retrying');
              Toast.show({
                type: 'error',
                text1: 'Location Error',
                text2: 'Please ensure location services are enabled',
              });
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('[CurrentRideScreen] Error getting location on focus:', error);
            setIsLoading(false);
            return;
          }
        }
        
        console.log('[CurrentRideScreen] Location available, initializing screen');
        setIsLoading(true);
        await hydrateStore();
        currentRideInitializedRef.current = true;
        setIsLoading(false);
      };

      if (isFocused && currentLocation) {
        handleScreenFocus();
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isFocused, currentLocation]);

  // Safely handle distance calculations with validation
  const calculateSafeDistance = useCallback((fromCoord, toCoord) => {
    // Use safeCoordinate to validate both coordinates
    const safeFrom = safeCoordinate(fromCoord);
    const safeTo = safeCoordinate(toCoord);
    
    if (!safeFrom || !safeTo) {
      // Only log once for better readability
      if (!safeFrom && !safeTo) {
        console.log('[CurrentRideScreen] Both origin and destination coordinates are invalid');
      } else if (!safeFrom) {
        console.log('[CurrentRideScreen] Origin coordinate is invalid');
      } else {
        console.log('[CurrentRideScreen] Destination coordinate is invalid');
      }
      return { distance: 0, estimatedTime: 0 };
    }
    
    // Both coordinates are valid, proceed with calculation
    return LocationModel.calculateDistanceAndTime(safeFrom, safeTo);
  }, [safeCoordinate]);

  // Function to handle toast notifications for distance changes
  const handleDistanceToast = useCallback((distance, isPickup) => {
    // Don't show toasts if we don't have a valid distance
    if (distance === null || distance === undefined) return;

    // Get the previous distance from our state
    const prevDistance = isPickup 
      ? handleDistanceToast.prevPickupDistance 
      : handleDistanceToast.prevDropoffDistance;
    
    // Show toast only if this is the first distance check or if we've crossed a threshold
    const shouldShowToast = (
      // First time checking
      prevDistance === undefined ||
      // Distance decreased significantly (we're getting closer)
      (prevDistance - distance > 100) ||
      // We've crossed a threshold (500m, 250m, 100m)
      (prevDistance > 500 && distance <= 500) ||
      (prevDistance > 250 && distance <= 250) ||
      (prevDistance > 100 && distance <= 100)
    );
    
    // Update our stored previous distance
    if (isPickup) {
      handleDistanceToast.prevPickupDistance = distance;
    } else {
      handleDistanceToast.prevDropoffDistance = distance;
    }
    
    // Show toast if necessary
    if (shouldShowToast) {
      const message = isPickup
        ? `You are ${Math.round(distance)}m from pickup location`
        : `You are ${Math.round(distance)}m from dropoff location`;
      
      Toast.show({
        type: 'info',
        position: 'top',
        text1: isPickup ? 'Approaching Pickup' : 'Approaching Dropoff',
        text2: message,
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 60,
      });
    }
  }, []);
  
  // Optimized distance calculation effect
  useEffect(() => {
    if (!activeTrip || !currentLocation) return;

    // Throttled function to update distance and UI
    const throttledUpdate = throttle(() => {
      try {
        let distanceToDestination = 0;
        const now = new Date();
        
        if (activeTrip.status === 'in_progress') {
          const result = LocationModel.calculateDistanceAndTime(
            currentLocation,
            activeTrip.dropoffLocation.coordinates
          );
          distanceToDestination = result.distance;
          setEstimatedArrival(new Date(now.getTime() + result.estimatedTime * 60000));
        } else {
          const result = LocationModel.calculateDistanceAndTime(
            currentLocation,
            activeTrip.pickupLocation.coordinates
          );
          distanceToDestination = result.distance;
          setEstimatedArrival(new Date(now.getTime() + result.estimatedTime * 60000));
        }

        // Only update state if distance changed significantly (>1m difference)
        if (Math.abs(currentDistance - distanceToDestination) > 1) {
          setCurrentDistance(distanceToDestination);
        }
      } catch (error) {
        console.error("Distance calculation error:", error);
      }
    }, 500); // Update every 500ms instead of 200ms

    // Initial call
    throttledUpdate();
    
    // Set up interval
    const intervalId = setInterval(throttledUpdate, 500);

    return () => {
      clearInterval(intervalId);
      throttledUpdate.cancel();
    };
  }, [currentLocation, activeTrip?.status, activeTrip?.pickupLocation, activeTrip?.dropoffLocation]);

  // Separate effect for Firestore updates
  useEffect(() => {
    if (!user?.id || !activeTrip?.id || !currentLocation) return;

    const updateFirestore = throttle(() => {
      firestore().collection('bookings').doc(activeTrip.id).update({
        driverCurrentLocation: {
          ...currentLocation,
          updatedAt: firestore.FieldValue.serverTimestamp()
        },
        currentDistance: currentDistance,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }).catch(error => {
        console.error('[CurrentRideScreen] Error updating location in Firestore:', error);
      });
    }, 3000); // Update Firestore every 3 seconds

    updateFirestore();

    return () => updateFirestore.cancel();
  }, [currentLocation, currentDistance, activeTrip?.id, user?.id]);

  // Memoized helper to check if we're near the dropoff location
  const checkDropoffProximity = useCallback(() => {
    if (!activeTrip?.status === 'in_progress' || !currentLocation || 
        !safeCoordinate(activeTrip?.dropoffLocation?.coordinates)) {
      return false;
    }
    
    const distance = LocationModel.calculateDistanceAndTime(
      currentLocation,
      activeTrip.dropoffLocation.coordinates
    ).distance;
    
    // Log distance for debugging when it changes significantly
    const lastDistance = checkDropoffProximity.lastLoggedDistance || 0;
    if (Math.abs(distance - lastDistance) > 0.5) { // Log more frequently - changed from 1 to 0.5
      console.log(`[CurrentRideScreen] Distance to dropoff: ${distance.toFixed(2)}m`);
      checkDropoffProximity.lastLoggedDistance = distance;
    }
    
    return distance <= 100; // changed from 4 to 100 meters for dropoff threshold
  }, [currentLocation, activeTrip]);

  // Add dedicated effect to monitor dropoff proximity for trip completion
  useEffect(() => {
    // Only run this effect during in_progress trips
    if (activeTrip?.status !== 'in_progress' || !currentLocation) return;
    
    // Create an interval to check proximity more frequently
    const intervalId = setInterval(() => {
      const nearDropoff = checkDropoffProximity();
      
      // Log when proximity changes (for debugging)
      if (nearDropoff !== useEffect.previousNearDropoffState) {
        console.log(`[CurrentRideScreen] Dropoff proximity changed: ${nearDropoff ? 'Near' : 'Not near'} - Complete Trip button ${nearDropoff ? 'enabled' : 'disabled'}`);
        useEffect.previousNearDropoffState = nearDropoff;
        
        // Force rerender of action button
        setForceUpdate(prev => !prev);
      }
    }, 500); // Check every 500ms
    
    // Cleanup interval
    return () => clearInterval(intervalId);
  }, [currentLocation, activeTrip?.status, checkDropoffProximity]);

  // Add AppState listener to refresh location when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground - refreshing location');
        const lastLocation = await getLastKnownLocation();
        if (lastLocation) {
          useLocationStore.setState({ currentLocation: lastLocation });
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Enhanced function to validate coordinates with detailed logging
  const safeCoordinate = (coord) => {
    if (!coord) {
      console.log('[CurrentRideScreen] Invalid coordinate: null or undefined');
      return null;
    }
    
    if (typeof coord !== 'object') {
      console.log(`[CurrentRideScreen] Invalid coordinate: not an object but ${typeof coord}`);
      return null;
    }
    
    if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
      console.log(`[CurrentRideScreen] Invalid coordinate: latitude/longitude not numbers`, 
        { lat: typeof coord.latitude, lng: typeof coord.longitude });
      return null;
    }
    
    if (isNaN(coord.latitude) || isNaN(coord.longitude)) {
      console.log('[CurrentRideScreen] Invalid coordinate: NaN values', 
        { lat: coord.latitude, lng: coord.longitude });
      return null;
    }
    
    return coord;
  };

  // Update routes effect to prevent duplicate updates
  useEffect(() => {
    if (!isMapReady || !activeTrip) return;

    let hasUpdated = false;

    // Only update if routes are not already set
    if (!hasUpdated && (
      (activeTrip.status !== 'in_progress' && pickupRoute.length === 0) ||
      dropoffRoute.length === 0
    )) {
      const updateMapAndRoutes = async () => {
        try {
          // Make sure we have current location before updating routes
          if (!safeCoordinate(currentLocation)) {
            console.log('[CurrentRideScreen] No valid location data, deferring map update');
            return;
          }

          // Update routes first
          if (activeTrip.status !== 'in_progress' && Array.isArray(activeTrip.pickupRoute) && activeTrip.pickupRoute.length > 0) {
            const validPickupRoute = activeTrip.pickupRoute.filter(coord => safeCoordinate(coord));
            if (validPickupRoute.length > 0) {
              console.log("[CurrentRideScreen] Initializing pickup route");
              setPickupRoute(validPickupRoute);
            }
          }
          
          if (Array.isArray(activeTrip.dropoffRoute) && activeTrip.dropoffRoute.length > 0) {
            const validDropoffRoute = activeTrip.dropoffRoute.filter(coord => safeCoordinate(coord));
            if (validDropoffRoute.length > 0) {
              console.log("[CurrentRideScreen] Initializing dropoff route");
              setDropoffRoute(validDropoffRoute);
            }
          }

          // Then fit map to coordinates once
          console.log("[CurrentRideScreen] Initial map fitting");
          fitToCoordinates();
          hasUpdated = true;
        } catch (error) {
          console.error('[CurrentRideScreen] Error updating map and routes:', error);
        }
      };

      updateMapAndRoutes();
    }
  }, [isMapReady, activeTrip?.id]); // Only depend on ID to prevent unnecessary updates

  // Remove the updateRoutes effect since it's handled by Firestore listener
  useEffect(() => {
    if (activeTrip && (pickupRoute.length === 0 || dropoffRoute.length === 0)) {
      ensureRouteData();
    }
  }, [activeTrip?.id, ensureRouteData]);

  // Update the Firestore listener to handle route updates
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;
    
    const setupFirestoreListener = async () => {
      try {
        // Get driver ID either from user object or from AsyncStorage as fallback
        let driverId = user?.id;
        
        // If no driver ID available from user object, try to get it from AsyncStorage
        if (!driverId) {
          console.log("[CurrentRideScreen] No user ID in state, checking AsyncStorage for driver data");
          const storedDriverJson = await AsyncStorage.getItem('driver');
          if (storedDriverJson) {
            const storedDriver = JSON.parse(storedDriverJson);
            driverId = storedDriver?.id;
            console.log("[CurrentRideScreen] Found driver ID in AsyncStorage:", driverId);
          }
        }
        
        // If still no driver ID, log and return
        if (!driverId) {
          console.log("[CurrentRideScreen] Driver ID not available from any source");
          return;
        }

        // First try to get cached trip data
        const cachedTrip = await AsyncStorage.getItem('current_trip');
        if (cachedTrip && isMounted) {
          const parsedTrip = JSON.parse(cachedTrip);
          setActiveTrip(parsedTrip);
          
          // Set initial routes from cache
          if (parsedTrip.pickupRoute?.length > 0) {
            setPickupRoute(parsedTrip.pickupRoute);
          }
          if (parsedTrip.dropoffRoute?.length > 0) {
            setDropoffRoute(parsedTrip.dropoffRoute);
          }
        }

        // Setup Firestore listener
        unsubscribe = firestore()
          .collection('bookings')
          .where('driverId', '==', driverId)
          .where('status', 'in', ['accepted', 'on_the_way', 'arrived', 'in_progress'])
          .onSnapshot(
            async snapshot => {
              if (!isMounted) return;

              const changes = snapshot.docChanges();
              
              // Only process if there are actual changes
              if (changes.length > 0) {
                const trips = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));

                console.log("Found active trips:", trips.length);

                if (trips.length > 0) {
                  const trip = trips[0];
                  
                  // Only update if trip data has actually changed
                  const currentTripStr = JSON.stringify(activeTrip);
                  const newTripStr = JSON.stringify(trip);
                  
                  if (currentTripStr !== newTripStr) {
                    console.log("Trip data changed, updating state");
                    
                    // Validate route data
                    const tripWithValidatedRoutes = {
                      ...trip,
                      pickupRoute: Array.isArray(trip.pickupRoute) ? trip.pickupRoute : [],
                      dropoffRoute: Array.isArray(trip.dropoffRoute) ? trip.dropoffRoute : []
                    };

                    // Check for status changes and show appropriate toast
                    handleTripStatusToast(activeTrip, tripWithValidatedRoutes);

                    // Cache the trip data
                    await AsyncStorage.setItem('current_trip', JSON.stringify(tripWithValidatedRoutes));

                    // Update state
                    setActiveTrip(tripWithValidatedRoutes);
                    setPickupRoute(tripWithValidatedRoutes.pickupRoute || []);
                    setDropoffRoute(tripWithValidatedRoutes.dropoffRoute || []);
                  }
                } else {
                  // Clear cached data when no active trips
                  await AsyncStorage.removeItem('current_trip');
                  await AsyncStorage.removeItem('trip_routes');
                  console.log("No active trips found, navigating to Map");
                  navigation.navigate('Map');
                }
              }
            },
            error => {
              if (!isMounted) return;
              console.error("Error fetching trips:", error);
              Toast.show({
                type: 'error',
                text1: 'Connection Error',
                text2: 'Failed to fetch trip data'
              });
            }
          );
      } catch (error) {
        if (!isMounted) return;
        console.error("Error in setupFirestoreListener:", error);
      }
    };

    setupFirestoreListener();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        console.log("Cleaning up Firestore listener");
        unsubscribe();
      }
    };
  }, [user?.id, navigation, handleTripStatusToast]);

  // Consolidate map ready and route update handling
  const handleMapReady = useCallback(() => {
    console.log("Map is ready");
    setIsMapReady(true);
  }, []);

  // Add effect for initial map fitting with performance optimization
  useEffect(() => {
    // Use a ref to track if initial fitting has been done
    if (isMapReady && activeTrip && !fitToCoordinates.initialFitDone) {
      // Delay slightly to ensure map and routes are ready
      const timer = setTimeout(() => {
        console.log("Performing initial map fitting");
        fitToCoordinates();
        fitToCoordinates.initialFitDone = true;
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isMapReady, activeTrip?.id]);

  // Optimize map fitting to reduce re-renders
  const fitToCoordinates = useCallback(() => {
    if (!mapRef.current || !activeTrip) {
      console.log("Map reference or active trip not available for fitting coordinates");
      return;
    }
    
    // Prevent frequent refits by using a debounce mechanism
    if (fitToCoordinates.lastFitTime && (Date.now() - fitToCoordinates.lastFitTime < 2000)) {
      console.log("Skipping map fit - too soon since last fit");
      return;
    }
    
    try {
      const coordinates = [];
      
      // Add currentLocation if available and valid
      const safeCurrentLocation = safeCoordinate(currentLocation);
      if (safeCurrentLocation) {
        coordinates.push(safeCurrentLocation);
      }
      // Add driver location from trip if available and current location not available
      else {
        const safeDriverLocation = safeCoordinate(activeTrip.driverCurrentLocation);
        if (safeDriverLocation) {
          coordinates.push(safeDriverLocation);
        }
      }

      // Add pickup location if available and valid
      const safePickupLocation = activeTrip.pickupLocation?.coordinates ? 
                                safeCoordinate(activeTrip.pickupLocation.coordinates) : null;
      if (safePickupLocation) {
        coordinates.push(safePickupLocation);
      }
      
      // Add dropoff location if available and valid
      const safeDropoffLocation = activeTrip.dropoffLocation?.coordinates ? 
                                 safeCoordinate(activeTrip.dropoffLocation.coordinates) : null;
      if (safeDropoffLocation) {
        coordinates.push(safeDropoffLocation);
      }

      if (coordinates.length > 1) {
        console.log("Fitting map to coordinates:", coordinates.length);
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
          },
          animated: true
        });
        
        // Record time of this fit operation
        fitToCoordinates.lastFitTime = Date.now();
      }
    } catch (error) {
      console.error("Error fitting coordinates:", error);
    }
  }, [activeTrip, currentLocation, mapRef.current]);

  const createNotification = async (userId, title, message, data = {}) => {
    try {
      // Determine if this is for the current driver or a passenger
      // If user is null, we can check if userId matches a local copy of driver ID
      let isForDriver = false;
      
      if (user?.id) {
        // If user object is available, compare with its ID
        isForDriver = userId === user.id;
      } else {
        // If user object is not available, check from AsyncStorage
        try {
          const storedDriverJson = await AsyncStorage.getItem('driver');
          if (storedDriverJson) {
            const storedDriver = JSON.parse(storedDriverJson);
            isForDriver = userId === storedDriver?.id;
          }
        } catch (err) {
          console.error('Error getting driver from AsyncStorage:', err);
        }
      }
      
      await firestore().collection('notifications').add({
        // If it's for our driver, use driverId, otherwise use userId (for passengers)
        ...(isForDriver ? { driverId: userId } : { userId }),
        title,
        message,
        data,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!activeTrip) return;

    // Create a local copy of the active trip for optimistic updates
    const optimisticTrip = { 
      ...activeTrip, 
      status: newStatus,
      updatedAt: new Date()
    };
    
    // Keep track of the original trip in case we need to revert
    const originalTrip = { ...activeTrip };
    
    // Show a loading toast for the status update
    const loadingToastId = Toast.show({
      type: 'info',
      position: 'top',
      text1: 'Updating trip status...',
      text2: `Changing to ${getTripStatusTitle(newStatus).toLowerCase()}`,
      visibilityTime: 10000, // Long timeout in case of slow connection
      autoHide: false,
      topOffset: 60,
    });
    
    try {
      // Optimistically update the UI without waiting for Firestore
      setActiveTrip(optimisticTrip);
      
      const tripRef = firestore().collection('bookings').doc(activeTrip.id);
      
      // Calculate and store routes only at specific status changes
      let routeData = {};
      if (newStatus === 'on_the_way') {
        // Calculate both pickup and dropoff routes when starting the trip
        const [driverToPickup, pickupToDropoff] = await Promise.all([
          LocationModel.getRouteCoordinates(
            currentLocation,
            activeTrip.pickupLocation.coordinates
          ),
          LocationModel.getRouteCoordinates(
            activeTrip.pickupLocation.coordinates,
            activeTrip.dropoffLocation.coordinates
          )
        ]);

        routeData = {
          pickupRoute: driverToPickup || [],
          dropoffRoute: pickupToDropoff || [],
          routesCalculatedAt: firestore.FieldValue.serverTimestamp()
        };
        
        // Optimistically update routes in UI
        setPickupRoute(driverToPickup || []);
        setDropoffRoute(pickupToDropoff || []);
      } else if (newStatus === 'in_progress') {
        // Recalculate only dropoff route from current location when trip starts
        const toDropoff = await LocationModel.getRouteCoordinates(
          currentLocation,
          activeTrip.dropoffLocation.coordinates
        );

        routeData = {
          dropoffRoute: toDropoff || [],
          routesCalculatedAt: firestore.FieldValue.serverTimestamp()
        };
        
        // Optimistically update routes in UI
        setDropoffRoute(toDropoff || []);
      }

      // Update trip status, driver request status, and routes in a single update
      await tripRef.update({
        status: newStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        [`driverRequests.${user.id}.status`]: newStatus === 'completed' ? 'completed' : 'accepted',
        ...(newStatus === 'in_progress' && {
          pickupTime: firestore.FieldValue.serverTimestamp()
        }),
        ...routeData
      });
      
      // Hide the loading toast
      Toast.hide(loadingToastId);
      
      // Show success toast
      Toast.show({
        type: 'success',
        position: 'top',
        text1: 'Status Updated',
        text2: `Trip is now ${getTripStatusTitle(newStatus).toLowerCase()}`,
        visibilityTime: 2000,
        topOffset: 60,
      });

      // If status is changing to in_progress (picked up), send SMS alert
      if (newStatus === 'in_progress') {
        // Check if guardian notification is enabled and guardian info exists
        if (activeTrip.notifyGuardian && activeTrip.guardianInfo) {
          console.log('Sending guardian alert to:', activeTrip.guardianInfo.phoneNumber);
          
          try {
            // Get driver data from user object or AsyncStorage
            let driverData = {
              fullName: user?.fullName || '',
              phoneNumber: user?.phoneNumber || '',
              plateNumber: user?.plateNumber || ''
            };
            
            // If user object doesn't have complete data, try to get from AsyncStorage
            if (!driverData.plateNumber) {
              try {
                const storedDriverJson = await AsyncStorage.getItem('driver');
                if (storedDriverJson) {
                  const storedDriver = JSON.parse(storedDriverJson);
                  driverData = {
                    ...driverData,
                    fullName: storedDriver.fullName || driverData.fullName,
                    phoneNumber: storedDriver.phoneNumber || driverData.phoneNumber,
                    plateNumber: storedDriver.plateNumber || driverData.plateNumber
                  };
                }
              } catch (error) {
                console.error('Error getting driver data from AsyncStorage:', error);
              }
            }
            
            // If still no complete data, try to fetch from Firestore
            if (!driverData.plateNumber || !driverData.fullName || !driverData.phoneNumber) {
              try {
                const driverDoc = await firestore().collection('drivers').doc(user.id).get();
                if (driverDoc.exists) {
                  const firestoreData = driverDoc.data();
                  driverData = {
                    fullName: firestoreData.fullName || driverData.fullName,
                    phoneNumber: firestoreData.phoneNumber || driverData.phoneNumber,
                    plateNumber: firestoreData.plateNumber || driverData.plateNumber
                  };
                  // Store updated driver data locally for future use
                  await AsyncStorage.setItem('driver', JSON.stringify(driverData));
                }
              } catch (error) {
                console.error('Error fetching driver data from Firestore:', error);
              }
            }
            
            // Log the data being sent for debugging
            console.log('Sending SMS with driver data:', {
              driverName: driverData.fullName,
              driverPhone: driverData.phoneNumber,
              plateNumber: driverData.plateNumber
            });
            
            const smsResponse = await SmsService.sendGuardianAlert(
              activeTrip.guardianInfo.phoneNumber,
              {
                passengerName: activeTrip.passengerName,
                driverName: driverData.fullName,
                driverPhone: driverData.phoneNumber,
                plateNumber: driverData.plateNumber || 'Not available',
                pickupLocation: activeTrip.pickupLocation.address,
                dropoffLocation: activeTrip.dropoffLocation.address,
                timestamp: firestore.Timestamp.now().toDate()
              }
            );
            
            console.log('SMS Response:', smsResponse);

            // Update booking with SMS status
            await tripRef.update({
              guardianSmsStatus: 'sent',
              guardianSmsTimestamp: firestore.FieldValue.serverTimestamp()
            });

            Toast.show({
              type: 'success',
              position: 'top',
              text1: 'Guardian Notified',
              text2: `SMS sent to guardian`,
              visibilityTime: 3000,
              autoHide: true,
              topOffset: 60,
            });
          } catch (smsError) {
            console.error('SMS Alert Error:', smsError);
            
            // Update booking with SMS error status
            await tripRef.update({
              guardianSmsStatus: 'failed',
              guardianSmsError: smsError.message
            });

            Toast.show({
              type: 'error',
              position: 'top',
              text1: 'SMS Alert Failed',
              text2: 'Guardian notification failed, but trip will continue',
              visibilityTime: 3000,
              autoHide: true,
              topOffset: 60,
            });
          }
        } else {
          console.log('Guardian notification not enabled or missing info:', {
            notifyGuardian: activeTrip.notifyGuardian,
            hasGuardianInfo: !!activeTrip.guardianInfo
          });
        }
      }

      // Create notifications based on status
      switch (newStatus) {
        case 'on_the_way':
          await createNotification(
            activeTrip.passengerId,
            'Driver On The Way',
            `${user.fullName} is on the way to pick you up`,
            { bookingId: activeTrip.id }
          );
          break;
        case 'arrived':
          await createNotification(
            activeTrip.passengerId,
            'Driver Arrived',
            `${user.fullName} has arrived at your pickup location`,
            { bookingId: activeTrip.id }
          );
          break;
        case 'in_progress':
          await createNotification(
            activeTrip.passengerId,
            'Trip Started',
            'Your trip has started',
            { 
              bookingId: activeTrip.id,
              guardianNotified: activeTrip.notifyGuardian && activeTrip.guardianInfo ? 'yes' : 'no'
            }
          );
          break;
        case 'completed':
          await createNotification(
            activeTrip.passengerId,
            'Trip Completed',
            'Your trip has been completed',
            { bookingId: activeTrip.id }
          );
          break;
      }
    } catch (error) {
      console.error('Error updating trip status:', error);
      
      // Show error toast
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Update Failed',
        text2: 'Could not update trip status. Please try again.',
        visibilityTime: 3000,
        topOffset: 60,
      });
      
      // If we optimistically updated the UI, revert back to the original state
      if (originalTrip) {
        setActiveTrip(originalTrip);
      }
    } finally {
      // No need to set isLoading(false) here as we're using toast for loading indicator
      // Only close the complete modal if it was open
      if (isCompleteModalVisible) {
        setIsCompleteModalVisible(false);
      }
    }
  };

  // New function to validate driver proximity and show toast if needed
  const validateProximity = async (status, action) => {
    // Show immediate feedback that we're checking location
    const loadingToastId = Toast.show({
      type: 'info',
      position: 'top',
      text1: 'Checking your location...',
      text2: 'Please wait a moment',
      visibilityTime: 5000, // Reduced timeout for better UX
      autoHide: false,
      topOffset: 60,
    });
    
    // Get the latest location for accurate validation
    try {
      // Check if we have a current location first
      if (!currentLocation) {
        Toast.hide(loadingToastId);
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Unable to get your current location. Please ensure location services are enabled.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60
        });
        return false;
      }
      
      // Check if current location is recent enough (within the last 5 seconds)
      const isCurrentLocationRecent = currentLocation.timestamp && 
                                     (new Date().getTime() - currentLocation.timestamp < 5000);
      
      // Use recent location directly if available to avoid unnecessary API calls
      if (isCurrentLocationRecent) {
        console.log('[validateProximity] Using recent location, skipping location update');
        // Hide the loading toast since we're using cached location
        Toast.hide(loadingToastId);
        return validateDistance(status, currentLocation, loadingToastId);
      }
      
      // Get a fresh location update for validation
      let locationToUse = currentLocation;
      let freshLocation = null;
      
      try {
        // Try to get a fast location first with balanced accuracy
        try {
          console.log('[validateProximity] Requesting location with balanced accuracy first');
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Use balanced accuracy first for speed
            timeout: 1500, // Shorter timeout for first attempt
            maximumAge: 0 // Always get fresh location
          });
          
          if (position && position.coords) {
            freshLocation = { 
              latitude: position.coords.latitude, 
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp || new Date().getTime()
            };
            console.log('[validateProximity] Got location with balanced accuracy');
          }
        } catch (firstError) {
          console.log('[validateProximity] Balanced accuracy failed, trying high accuracy');
          // If balanced accuracy fails or times out, try high accuracy
          try {
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeout: 2000, // Lower timeout from 3000 to 2000
              maximumAge: 0
            });
            
            if (position && position.coords) {
              freshLocation = { 
                latitude: position.coords.latitude, 
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp || new Date().getTime()
              };
              console.log('[validateProximity] Got location with high accuracy');
            }
          } catch (secondError) {
            console.log('[validateProximity] Both location attempts failed, using current location');
          }
        }
      } catch (locationError) {
        console.log('[validateProximity] Exception getting location:', locationError);
      }
      
      // If we got a fresh location, use it; otherwise use the current one
      if (freshLocation) {
        // Update location store for future use
        updateCurrentLocation(freshLocation);
        locationToUse = freshLocation;
      } else {
        console.log('[validateProximity] No fresh location available, using current location');
      }
      
      // Store the validated location for trip completion if this is for completing a trip
      if (status === 'in_progress') {
        // Save the validated location in a ref to use it when actually completing the trip
        validateProximity.lastValidatedLocation = locationToUse;
        console.log('[validateProximity] Stored validated location for trip completion');
      }
      
      // Hide the loading toast
      Toast.hide(loadingToastId);
      
      // Validate distance using the appropriate location
      return validateDistance(status, locationToUse, loadingToastId);
    } catch (error) {
      console.error('[validateProximity] Error validating proximity:', error);
      Toast.hide(loadingToastId);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to validate your location. Please try again.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60
      });
      return false;
    }
  };
  
  // Helper function to validate distance based on status
  const validateDistance = (status, location, toastId) => {
    // For arrived at pickup button
    if (status === 'on_the_way') {
      if (!activeTrip?.pickupLocation?.coordinates) {
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Pickup location is missing. Please contact support.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60
        });
        return false;
      }
      
      const distance = LocationModel.calculateDistanceAndTime(
        location,
        activeTrip.pickupLocation.coordinates
      ).distance;
      
      if (distance > 50) {
        Toast.show({
          type: 'info',
          text1: 'Not near pickup location',
          text2: `You need to be within 50m of the pickup location. Current distance: ${distance.toFixed(0)}m`,
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60
        });
        return false;
      }
    } 
    // For complete trip button
    else if (status === 'in_progress') {
      if (!activeTrip?.dropoffLocation?.coordinates) {
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Dropoff location is missing. Please contact support.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60
        });
        return false;
      }
      
      const distance = LocationModel.calculateDistanceAndTime(
        location,
        activeTrip.dropoffLocation.coordinates
      ).distance;
      
      if (distance > 50) {
        Toast.show({
          type: 'info',
          text1: 'Not near dropoff location',
          text2: `You need to be within 50m of the dropoff location. Current distance: ${distance.toFixed(0)}m`,
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60
        });
        return false;
      }
    }
    
    // Proximity check passed, continue with the action
    return true;
  };

  // Memoize distance warning text to prevent unnecessary recalculations
  const pickupDistanceWarning = useMemo(() => {
    if (activeTrip?.status === 'on_the_way' && 
        !isNearPickup(currentLocation) && 
        currentLocation && 
        activeTrip?.pickupLocation?.coordinates) {
      const distance = Math.round(LocationModel.calculateDistanceAndTime(
        currentLocation,
        activeTrip.pickupLocation.coordinates
      ).distance);
      return `${distance} meters to pickup location (need to be within 50m)`;
    }
    return null;
  }, [activeTrip?.status, activeTrip?.pickupLocation?.coordinates, currentLocation, isNearPickup]);
  
  // Memoize dropoff distance warning
  const dropoffDistanceWarning = useMemo(() => {
    if (activeTrip?.status === 'in_progress' && 
        !isNearDropoff(currentLocation) && 
        currentLocation && 
        activeTrip?.dropoffLocation?.coordinates) {
      const distance = Math.round(LocationModel.calculateDistanceAndTime(
        currentLocation,
        activeTrip.dropoffLocation.coordinates
      ).distance);
      return `${distance} meters to dropoff location (need to be within 50m)`;
    }
    return null;
  }, [activeTrip?.status, activeTrip?.dropoffLocation?.coordinates, currentLocation, isNearDropoff]);
  
  // Update the getActionButton to be more responsive with all buttons enabled
  const getActionButton = useCallback(() => {
    if (!activeTrip) return null;

    switch (activeTrip.status) {
      case 'accepted':
        return {
          title: 'OTW TO PICKUP',
          onPress: () => handleStatusUpdate('on_the_way'),
          disabled: false
        };
      case 'on_the_way': {
        // Check if we're within close proximity to avoid validation delay when clearly far away
        const isWithinRoughProximity = currentLocation && activeTrip.pickupLocation?.coordinates &&
          LocationModel.calculateDistanceAndTime(currentLocation, activeTrip.pickupLocation.coordinates).distance <= 100;
          
        return {
          title: 'ARRIVED AT PICKUP',
          onPress: async () => {
            // Quick pre-validation for better UX - avoid full validation if clearly far away
            if (currentLocation && activeTrip.pickupLocation?.coordinates) {
              const quickDistance = LocationModel.calculateDistanceAndTime(
                currentLocation, 
                activeTrip.pickupLocation.coordinates
              ).distance;
              
              // If driver is clearly too far away (>100m), show immediate feedback
              if (quickDistance > 100) {
                Toast.show({
                  type: 'info',
                  position: 'top',
                  text1: 'Too far from pickup location',
                  text2: `You need to be within 50m of the pickup location. Current distance: ${Math.round(quickDistance)}m`,
                  visibilityTime: 3000,
                  topOffset: 60,
                });
                return;
              }
            }
            
            // Show immediate feedback that button was pressed
            Toast.show({
              type: 'info',
              position: 'top',
              text1: 'Processing...',
              text2: 'Checking your location',
              visibilityTime: 2000,
              topOffset: 60,
            });
            
            // Reduce setTimeout delay for faster response
            setTimeout(async () => {
              const isValid = await validateProximity('on_the_way');
              if (isValid) {
                handleStatusUpdate('arrived');
              }
            }, 50); // Reduced from 100ms to 50ms
          },
          disabled: false // Always enabled
        };
      }
      case 'arrived':
        return {
          title: 'START TRIP',
          onPress: () => handleStatusUpdate('in_progress'),
          disabled: false
        };
      case 'in_progress': {
        return {
          title: 'COMPLETE TRIP',
          onPress: async () => {
            // Quick pre-validation for better UX - avoid full validation if clearly far away
            if (currentLocation && activeTrip.dropoffLocation?.coordinates) {
              const quickDistance = LocationModel.calculateDistanceAndTime(
                currentLocation, 
                activeTrip.dropoffLocation.coordinates
              ).distance;
              
              // If driver is clearly too far away (>100m), show immediate feedback
              if (quickDistance > 100) {
                Toast.show({
                  type: 'info',
                  position: 'top',
                  text1: 'Too far from dropoff location',
                  text2: `You need to be within 50m of the dropoff location. Current distance: ${Math.round(quickDistance)}m`,
                  visibilityTime: 3000,
                  topOffset: 60,
                });
                return;
              }
            }
            
            // Show immediate feedback that button was pressed
            Toast.show({
              type: 'info',
              position: 'top',
              text1: 'Processing...',
              text2: 'Checking your location',
              visibilityTime: 2000,
              topOffset: 60,
            });
            
            // Reduce setTimeout delay for faster response
            setTimeout(async () => {
              const isValid = await validateProximity('in_progress');
              if (isValid) {
                setIsCompleteModalVisible(true);
              }
            }, 50); // Reduced from 100ms to 50ms
          },
          disabled: false // Always enabled
        };
      }
      default:
        return null;
    }
  }, [activeTrip?.status, currentLocation, handleStatusUpdate, validateProximity]);

  // Memoize action button to prevent unnecessary re-renders
  const actionButton = useMemo(() => getActionButton(), [getActionButton]);

  // Add a useEffect to show a toast when button is disabled due to distance
  useEffect(() => {
    // Skip if no active trip or no current location
    if (!activeTrip || !currentLocation) return;
    
    // Track previous state to only show toast on changes
    const wasNearPickup = useEffect.wasNearPickup;
    const isNowNearPickup = isNearPickup(currentLocation);
    
    // Only show toast when status is 'on_the_way' and status changes from near to not near or on initial check
    if (activeTrip.status === 'on_the_way' && 
        ((wasNearPickup !== false && !isNowNearPickup) || 
         (wasNearPickup === undefined && !isNowNearPickup))) {
      
      // Store state to compare next time
      useEffect.wasNearPickup = isNowNearPickup;
      
      // Only show the toast if we're not near the pickup location
      Toast.show({
        type: 'info',
        position: 'top',
        text1: 'Not at Pickup Location',
        text2: 'Please arrive at the pickup location to proceed',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 60,
      });
    } else if (wasNearPickup !== isNowNearPickup) {
      // Update state but don't show toast
      useEffect.wasNearPickup = isNowNearPickup;
    }
  }, [activeTrip?.status, currentLocation, isNearPickup]);

  // Add an effect for dropoff location proximity
  useEffect(() => {
    // Skip if no active trip or no current location
    if (!activeTrip || !currentLocation) return;
    
    // Track previous state to only show toast on changes
    const wasNearDropoff = useEffect.wasNearDropoff;
    const isNowNearDropoff = isNearDropoff(currentLocation);
    
    // Only show toast when status is 'in_progress' and status changes from near to not near or on initial check
    if (activeTrip.status === 'in_progress' && 
        ((wasNearDropoff !== false && !isNowNearDropoff) || 
         (wasNearDropoff === undefined && !isNowNearDropoff))) {
      
      // Store state to compare next time
      useEffect.wasNearDropoff = isNowNearDropoff;
      
      // Only show the toast if we're not near the dropoff location
      Toast.show({
        type: 'info',
        position: 'top',
        text1: 'Not at Dropoff Location',
        text2: 'Please arrive at the dropoff location to complete the trip',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 60,
      });
    } else if (wasNearDropoff !== isNowNearDropoff) {
      // Update state but don't show toast
      useEffect.wasNearDropoff = isNowNearDropoff;
      
      // If we just arrived at dropoff, show a success toast
      if (activeTrip.status === 'in_progress' && isNowNearDropoff) {
        Toast.show({
          type: 'success',
          position: 'top',
          text1: 'Arrived at Dropoff',
          text2: 'You can now complete the trip',
          visibilityTime: 3000,
          autoHide: true,
          topOffset: 60,
        });
      }
    }
  }, [activeTrip?.status, currentLocation, isNearDropoff]);

  // Update the ensureRouteData function to prevent redundant calculations
  const ensureRouteData = useCallback(async () => {
    if (!activeTrip || !activeTrip.id) return;
    
    // Check if we actually need to fetch routes
    const needsPickupRoute = activeTrip.status !== 'in_progress' && 
                           (!Array.isArray(pickupRoute) || pickupRoute.length === 0);
    
    const needsDropoffRoute = (!Array.isArray(dropoffRoute) || dropoffRoute.length === 0);
    
    if (!needsPickupRoute && !needsDropoffRoute) return;

    // Add tracking for ongoing calculations to prevent duplicate calls
    if (ensureRouteData.isCalculating) {
      console.log('[CurrentRideScreen] Route calculation already in progress, skipping');
      return;
    }
    
    // Set calculation flag to prevent duplicate calls
    ensureRouteData.isCalculating = true;
    
    try {
      // First try to get cached routes
      const cachedRoutes = await AsyncStorage.getItem('trip_routes');
      if (cachedRoutes) {
        try {
          const { pickupRoute: cachedPickup, dropoffRoute: cachedDropoff } = JSON.parse(cachedRoutes);
          let updatedState = false;

          if (needsPickupRoute && Array.isArray(cachedPickup) && cachedPickup.length > 0) {
            setPickupRoute(cachedPickup);
            updatedState = true;
          }
          if (needsDropoffRoute && Array.isArray(cachedDropoff) && cachedDropoff.length > 0) {
            setDropoffRoute(cachedDropoff);
            updatedState = true;
          }

          if (updatedState) {
            console.log('[CurrentRideScreen] Using cached routes, skipping API calls');
            ensureRouteData.isCalculating = false;
            return;
          }
        } catch (error) {
          console.log('[CurrentRideScreen] Error parsing cached routes:', error);
          // Continue to fetch new routes if cache parsing fails
        }
      }
      
      // Calculate only the missing routes - but don't do both in parallel to reduce load
      let updatedRoutes = {};
      
      // Only calculate pickup route if needed and have valid coordinates
      if (needsPickupRoute && 
          safeCoordinate(currentLocation) && 
          safeCoordinate(activeTrip.pickupLocation?.coordinates)) {
        console.log('[CurrentRideScreen] Calculating pickup route');
        const routeCoords = await LocationModel.getRouteCoordinates(
          currentLocation,
          activeTrip.pickupLocation.coordinates
        );
        if (Array.isArray(routeCoords) && routeCoords.length > 0) {
          updatedRoutes.pickupRoute = routeCoords;
          setPickupRoute(routeCoords);
        }
      }
      
      // Only calculate dropoff route if needed and have valid coordinates
      if (needsDropoffRoute && 
          safeCoordinate(activeTrip.pickupLocation?.coordinates) && 
          safeCoordinate(activeTrip.dropoffLocation?.coordinates)) {
        console.log('[CurrentRideScreen] Calculating dropoff route');
        const routeCoords = await LocationModel.getRouteCoordinates(
          activeTrip.pickupLocation.coordinates,
          activeTrip.dropoffLocation.coordinates
        );
        if (Array.isArray(routeCoords) && routeCoords.length > 0) {
          updatedRoutes.dropoffRoute = routeCoords;
          setDropoffRoute(routeCoords);
        }
      }
      
      // Only cache if we have new routes
      if (Object.keys(updatedRoutes).length > 0) {
        const routesToCache = {
          pickupRoute: updatedRoutes.pickupRoute || pickupRoute,
          dropoffRoute: updatedRoutes.dropoffRoute || dropoffRoute
        };
        await AsyncStorage.setItem('trip_routes', JSON.stringify(routesToCache));
        
        // Only update Firestore if really needed (minimize writes)
        if (!activeTrip.routesCalculatedAt || Date.now() - activeTrip.routesCalculatedAt > 5 * 60 * 1000) {
          console.log('[CurrentRideScreen] Updating routes in Firestore');
          await firestore().collection('bookings').doc(activeTrip.id).update({
            ...updatedRoutes,
            routesCalculatedAt: firestore.FieldValue.serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error ensuring route data:", error);
    } finally {
      // Reset calculation flag regardless of outcome
      ensureRouteData.isCalculating = false;
    }
  }, [activeTrip, currentLocation, pickupRoute, dropoffRoute]);

  // Update the cleanup effect to not reset store on unmount
  useEffect(() => {
    return () => {
      console.log("CurrentRideScreen unmounting");
      // Only reset store if navigating to Map screen
      if (navigation.getState().routes.slice(-1)[0]?.name === 'Map') {
        resetStore();
        currentRideInitializedRef.current = false;
      }
    };
  }, [navigation, resetStore]);

  // Optimize map marker updates
  const MapMarkers = useMemo(() => {
    if (!activeTrip) return null;
    
    return (
      <>
        {activeTrip?.pickupLocation?.coordinates && safeCoordinate(activeTrip.pickupLocation.coordinates) && (
          <Marker
            key="pickup"
            coordinate={{
              latitude: activeTrip.pickupLocation.coordinates.latitude,
              longitude: activeTrip.pickupLocation.coordinates.longitude
            }}
            title="Pickup"
            description={activeTrip.pickupLocation.address || "Pickup Location"}
          >
            <MaterialIcons 
              name="location-history" 
              size={38} 
              color={COLORS.PRIMARY}
            />
          </Marker>
        )}
        
        {activeTrip?.dropoffLocation?.coordinates && safeCoordinate(activeTrip.dropoffLocation.coordinates) && (
          <Marker
            key="dropoff"
            coordinate={{
              latitude: activeTrip.dropoffLocation.coordinates.latitude,
              longitude: activeTrip.dropoffLocation.coordinates.longitude
            }}
            title="Dropoff"
            description={activeTrip.dropoffLocation.address || "Dropoff Location"}
          >
            <View style={styles.locationMarker}>
            </View>
          </Marker>
        )}
      </>
    );
  }, [activeTrip?.pickupLocation?.coordinates, activeTrip?.dropoffLocation?.coordinates]);

  // Optimize route polylines
  const RoutePolylines = useMemo(() => {
    if (!activeTrip) return null;
    
    return (
      <>
        {pickupRoute.length > 0 && 
          (activeTrip?.status === 'accepted' || 
           activeTrip?.status === 'on_the_way' || 
           activeTrip?.status === 'arrived') && (
          <Polyline
            key={`pickup-${activeTrip?.id}`}
            coordinates={pickupRoute}
            strokeColor={COLORS.PRIMARY}
            strokeWidth={10}
            lineDashPattern={[1, 10]} 
          />
        )}
        
        {dropoffRoute.length > 0 && (
          <Polyline
            key={`dropoff-${activeTrip?.id}`}
            coordinates={dropoffRoute}
            strokeColor={COLORS.PRIMARY}
            strokeWidth={10}
            lineDashPattern={[1, 10]}
          />
        )}
      </>
    );
  }, [activeTrip?.status, activeTrip?.id, pickupRoute, dropoffRoute]);

  // Add handlers for passenger contact
  const handleCallPassenger = useCallback(() => {
    if (activeTrip?.passengerPhone) {
      Linking.openURL(`tel:${activeTrip.passengerPhone}`);
    } else {
      Alert.alert(
        'Error',
        'Passenger phone number not available.'
      );
    }
  }, [activeTrip?.passengerPhone]);

  const handleMessagePassenger = useCallback(() => {
    if (activeTrip?.passengerPhone) {
      Linking.openURL(`sms:${activeTrip.passengerPhone}`);
    } else {
      Alert.alert(
        'Error',
        'Passenger phone number not available.'
      );
    }
  }, [activeTrip?.passengerPhone]);

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    
    try {
      setIsLoading(true);
      
      // Initialize driverId variable
      let driverId = user?.id;
      
      // If no driver ID available from user object, try to get it from AsyncStorage
      if (!driverId) {
        console.log("[handleCompleteTrip] No user ID in state, checking AsyncStorage for driver data");
        const storedDriverJson = await AsyncStorage.getItem('driver');
        if (storedDriverJson) {
          const storedDriver = JSON.parse(storedDriverJson);
          driverId = storedDriver?.id;
          console.log("[handleCompleteTrip] Found driver ID in AsyncStorage:", driverId);
        }
      }
      
      // If still no driver ID, show error and return
      if (!driverId) {
        console.error('[CurrentRideScreen] User ID not available for wallet query');
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Authentication Error',
          text2: 'Please log in again',
          topOffset: 60,
        });
        setIsLoading(false);
        return;
      }
      
      // Get driver wallet data
      const walletSnapshot = await firestore()
        .collection('wallets')
        .where('driverId', '==', driverId)
        .get();
      
      if (walletSnapshot.empty) {
        Toast.show({
          type: 'error',
          text1: 'Wallet not found',
          text2: 'Please contact support',
        });
        setIsLoading(false);
        return;
      }
      
      const walletDoc = walletSnapshot.docs[0];
      const walletData = walletDoc.data();
      const currentBalance = walletData.balance || 0;
      
      // Calculate final distance, fare and system fee
      let finalDistance;
      let fare, systemFee;
      
      // Get fresh location for accurate distance calculation
      let locationToUse = currentLocation;
      
      // First check if we have a previously validated location from validateProximity
      if (validateProximity.lastValidatedLocation) {
        locationToUse = validateProximity.lastValidatedLocation;
        console.log('[handleCompleteTrip] Using previously validated location for distance calculation');
      } else {
        try {
          // Try to get fresh location with high accuracy for final distance calculation
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 3000,
            maximumAge: 0
          });
          
          if (position && position.coords) {
            locationToUse = { 
              latitude: position.coords.latitude, 
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp || new Date().getTime()
            };
            console.log('[handleCompleteTrip] Got fresh location for distance calculation');
            
            // Update current location in store for consistency
            updateCurrentLocation(locationToUse);
          }
        } catch (locationError) {
          console.log('[handleCompleteTrip] Could not get fresh location, using current location:', locationError);
        }
      }
      
      // Clear the stored validated location after using it
      validateProximity.lastValidatedLocation = null;
      
      if (!safeCoordinate(activeTrip.pickupLocation?.coordinates) || 
          !safeCoordinate(activeTrip.dropoffLocation?.coordinates)) {
        console.error('[CurrentRideScreen] Invalid coordinates for distance calculation');
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Could not calculate trip distance. Using estimate.',
        });
        // Use current distance as fallback
        finalDistance = currentDistance || 1000; // Default to 1km if no distance
      } else {
        // Check if we have a tracked distance from the trip
        if (currentDistance && currentDistance > 0) {
          // Use the tracked distance which is more accurate for the actual path taken
          finalDistance = currentDistance;
          console.log(`[handleCompleteTrip] Using tracked distance: ${finalDistance}m for fare calculation`);
        } else {
          // Fallback: Calculate direct distance from pickup to dropoff
          finalDistance = LocationModel.calculateDistanceAndTime(
            activeTrip.pickupLocation.coordinates,
            activeTrip.dropoffLocation.coordinates
          ).distance;
          
          console.log(`[handleCompleteTrip] Using direct distance: ${finalDistance}m for fare calculation`);
        }
        
        // Log the calculated distance for debugging
        console.log(`[handleCompleteTrip] Final distance used: ${finalDistance}m`);
      }
      
      // Calculate fare and system fee based on the final distance
      const fareDetails = calculateFareAndFees(finalDistance);
      fare = fareDetails.fare;
      systemFee = fareDetails.systemFee;
      
      // Make sure driver has enough balance for system fee
      if (currentBalance < systemFee) {
        Toast.show({
          type: 'error',
          text1: 'Insufficient Balance',
          text2: `You need ₱${systemFee.toFixed(2)} to complete this trip`,
        });
        setIsLoading(false);
        return;
      }
      
      // Get safe driver details
      const driverName = user?.name || 'Driver';
      const driverPhone = user?.phoneNumber || 'N/A';
      const plateNumber = user?.tricycleDetails?.plateNumber || 'N/A';
      
      // Create trip history record
      const tripHistoryData = {
        passengerId: activeTrip.passengerId,
        passengerName: activeTrip.passengerName || 'Passenger',
        passengerCount: activeTrip.passengerCount || 1,
        passengerPhone: activeTrip.passengerPhone || 'N/A',
        driverId: driverId,
        driverName: driverName,
        driverPhone: driverPhone,
        fareAmount: fare,
        systemFee: systemFee,
        distance: finalDistance,
        baseFare: FARE_CONSTANTS.BASE_FARE,
        additionalKmFare: Math.max(0, fare - FARE_CONSTANTS.BASE_FARE),
        pickupLocation: activeTrip.pickupLocation,
        dropoffLocation: activeTrip.dropoffLocation,
        pickupTime: activeTrip.pickupTime || activeTrip.createdAt,
        dropoffTime: firestore.FieldValue.serverTimestamp(),
        status: 'completed',
        paymentMethod: activeTrip.paymentMethod || 'cash',
        plateNumber: plateNumber,
        notes: activeTrip.notes || '',
        rating: null,
        fareBreakdown: {
          baseFare: FARE_CONSTANTS.BASE_FARE,
          additionalKmFare: Math.max(0, fare - FARE_CONSTANTS.BASE_FARE),
          totalFare: fare,
          systemFee: systemFee,
          systemFeePercentage: FARE_CONSTANTS.SYSTEM_FEE_PERCENTAGE * 100,
          distance: finalDistance,
          baseDistance: FARE_CONSTANTS.BASE_DISTANCE,
          additionalKmRate: FARE_CONSTANTS.ADDITIONAL_FARE_PER_KM
        }
      };
      
      // Start a batch transaction
      const batch = firestore().batch();
      
      // 1. Create trip history document
      const tripRef = firestore().collection('trips').doc();
      batch.set(tripRef, tripHistoryData);
      
      // 2. Update driver wallet (deduct system fee)
      const newBalance = currentBalance - systemFee;
      batch.update(walletDoc.ref, { 
        balance: newBalance,
        lastUpdated: firestore.FieldValue.serverTimestamp()
      });
      
      // 3. Create transaction record for the system fee
      const transactionRef = firestore().collection('transactions').doc();
      batch.set(transactionRef, {
        driverId: driverId,
        amount: -systemFee,
        type: 'system_fee',
        description: `System fee for trip ${activeTrip.id} (₱${fare} fare @ 12%)`,
        status: 'completed',
        reference: tripRef.id,
        createdAt: firestore.FieldValue.serverTimestamp(),
        fareDetails: tripHistoryData.fareBreakdown
      });
      
      // 4. Delete the booking
      batch.delete(firestore().collection('bookings').doc(activeTrip.id));
      
      // Execute all operations atomically
      await batch.commit();
      
      // Create notifications with fare details
      if (activeTrip.passengerId) {
        await createNotification(
          activeTrip.passengerId,
          'Trip Completed',
          `Your trip has been completed. Total fare: ₱${fare}`,
          { 
            tripId: tripRef.id,
            fare,
            fareAmount: fare,
            distance: finalDistance,
            type: 'trip_completed'
          }
        );
      }
      
      await createNotification(
        driverId,
        'Trip Completed',
        `Trip completed. Fare: ₱${fare}, System fee deducted: ₱${systemFee}`,
        { 
          tripId: tripRef.id,
          fare,
          fareAmount: fare,
          systemFee,
          distance: finalDistance,
          type: 'trip_completed'
        }
      );
      
      // Clear trip data from AsyncStorage
      await AsyncStorage.removeItem('current_trip');
      await AsyncStorage.removeItem('trip_routes');
      
      // Show success message with fare details
      Toast.show({
        type: 'success',
        text1: 'Trip Completed',
        text2: `Collect ₱${fare} from passenger | System fee: ₱${systemFee}`,
        visibilityTime: 4000, // Show longer since it's important info
      });
      
      setIsCompleteModalVisible(false);
      setIsLoading(false);
      
      // Store trip completion data for the success screen
      setTripCompletionData({
        fare,
        systemFee,
        distance: finalDistance,
        earnings: fare - systemFee // Calculate driver's earnings
      });
      
      // Show success screen
      setIsSuccessScreenVisible(true);
      
      // Navigation to Map screen is now handled by the Continue button on success screen
    } catch (error) {
      console.error('Error completing trip:', error);
      setIsLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Failed to complete trip',
        text2: error.message || 'Please try again or contact support',
        visibilityTime: 4000,
      });
      
      // Log detailed error for debugging
      try {
        const errorDetails = {
          message: error.message,
          code: error.code,
          stack: error.stack,
          tripId: activeTrip?.id,
          driverId: driverId || 'not_available'
        };
        console.error('Complete trip error details:', JSON.stringify(errorDetails));
      } catch (logError) {
        console.error('Error logging details:', logError);
      }
    }
  };

  // Function to handle toast notifications for trip status changes
  const handleTripStatusToast = useCallback((oldTrip, newTrip) => {
    // Only process if we have both trips and there's a status change
    if (!oldTrip || !newTrip || oldTrip.status === newTrip.status) return;
    
    // Log status change
    console.log(`[CurrentRideScreen] Trip status changed: ${oldTrip.status} -> ${newTrip.status}`);
    
    // Show toast based on the new status
    switch(newTrip.status) {
      case 'on_the_way':
        Toast.show({
          type: 'info',
          position: 'top',
          text1: 'Status Updated',
          text2: 'You are on the way to pickup the passenger',
          visibilityTime: 3000,
          autoHide: true,
          topOffset: 60,
        });
        break;
      case 'arrived':
        Toast.show({
          type: 'success',
          position: 'top',
          text1: 'Arrived at Pickup',
          text2: 'You have arrived at the pickup location',
          visibilityTime: 3000,
          autoHide: true,
          topOffset: 60,
        });
        break;
      case 'in_progress':
        Toast.show({
          type: 'success',
          position: 'top',
          text1: 'Trip Started',
          text2: 'You have started the trip',
          visibilityTime: 3000,
          autoHide: true,
          topOffset: 60,
        });
        break;
    }
  }, []);

  // Add a more frequent map update effect for in-progress trips
  useEffect(() => {
    // Skip if map isn't ready or there's no trip or current location
    if (!isMapReady || !activeTrip || !currentLocation || !dropoffRoute.length) return;
    
    // Only update for in-progress trips (to dropoff)
    if (activeTrip.status !== 'in_progress') return;
    
    // Check if we need to update the map display
    const updateMapDisplay = () => {
      try {
        // Only update the map if we have moved significantly since last update
        if (!updateMapDisplay.lastUpdateLocation || 
            !LocationModel.areCoordinatesEqual(updateMapDisplay.lastUpdateLocation, currentLocation, 10)) {
          
          // Only update route if we haven't done it recently (limit to prevent excessive calculations)
          const shouldUpdateRoute = !updateMapDisplay.lastRouteUpdate || 
                                   (Date.now() - updateMapDisplay.lastRouteUpdate > 20000); // 20 seconds
          
          if (shouldUpdateRoute) {
            // Re-fetch route if we've moved significantly from the previous route
            console.log("[CurrentRideScreen] Updating dropoff route based on current location");
            
            // Update last route time
            updateMapDisplay.lastRouteUpdate = Date.now();
            
            // Only recalculate route if we're still a reasonable distance from the destination
            const distToDropoff = LocationModel.calculateDistanceAndTime(
              currentLocation,
              activeTrip.dropoffLocation.coordinates
            ).distance;
            
            if (distToDropoff > 200) { // Only update route if we're more than 200m from destination
              // Re-fetch route from current position to dropoff
              LocationModel.getRouteCoordinates(
                currentLocation,
                activeTrip.dropoffLocation.coordinates
              ).then(newRoute => {
                if (newRoute && newRoute.length > 0) {
                  setDropoffRoute(newRoute);
                }
              }).catch(err => {
                console.error("Error updating route:", err);
              });
            }
          }
          
          // Update map position to show current location and route
          fitToCoordinates();
          
          // Save current location as the last update location
          updateMapDisplay.lastUpdateLocation = { ...currentLocation };
        }
      } catch (error) {
        console.error("Error updating map display:", error);
      }
    };
    
    updateMapDisplay();
  }, [isMapReady, activeTrip?.status, currentLocation, activeTrip?.dropoffLocation?.coordinates, dropoffRoute.length, fitToCoordinates]);

  // Update the MapView render to use memoized components
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <AppBar 
        title={getTripStatusTitle(activeTrip?.status)} 
        showBack={false}
      />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          onMapReady={handleMapReady}
          showsMyLocationButton={true}
          showsUserLocation={true}
          initialRegion={currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : {
            latitude: 15.6,
            longitude: 120.5,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {MapMarkers}
          {RoutePolylines}
        </MapView>

        {/* Distance info overlay */}
        <DistanceOverlay 
          status={activeTrip?.status} 
          distance={currentDistance} 
        />
      </View>
      )}

      {!isLoading && actionButton && (
      <View style={styles.bottomContainer}>
          {pickupDistanceWarning && (
            <Text style={styles.distanceWarning}>{pickupDistanceWarning}</Text>
          )}
          
          {dropoffDistanceWarning && (
            <Text style={styles.distanceWarning}>{dropoffDistanceWarning}</Text>
          )}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => setIsDetailsVisible(true)}
            style={[styles.detailsButton, styles.outlineButton]}
          >
            <MaterialCommunityIcons 
              name="account-details-outline" 
              size={24} 
              color={COLORS.PRIMARY}
            />
          </TouchableOpacity>
          <ActionButtonMemo buttonInfo={actionButton} loading={isLoading} style={styles.actionButton} />
        </View>
      </View>
      )}

      {/* Complete trip modal */}
      <Modal
        visible={isCompleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCompleteModalVisible(false)}
      >
        <View style={styles.popupModalOverlay}>
          <View style={styles.popupModalContent}>
            <Text style={styles.modalTitle}>Complete Trip</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to complete this trip?
            </Text>
            {activeTrip && (
              <View style={styles.tripDetails}>
                <Text style={styles.tripDetailText}>
                  <Text style={styles.tripDetailLabel}>Estimated Fare: </Text>
                  ₱{calculateFareAndFees(currentDistance || 0).fare.toFixed(2)}
                </Text>
                <Text style={styles.tripDetailText}>
                  <Text style={styles.tripDetailLabel}>System Fee: </Text>
                  ₱{calculateFareAndFees(currentDistance || 0).systemFee.toFixed(2)}
                </Text>
                {/* Add this new earnings row */}
                <Text style={[styles.tripDetailText, styles.earningsValue]}>
                  <Text style={styles.tripDetailLabel}>Your Earnings: </Text>
                  ₱{(calculateFareAndFees(currentDistance || 0).fare - calculateFareAndFees(currentDistance || 0).systemFee).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setIsCompleteModalVisible(false)}
                type="outline"
                style={styles.modalButton}
              />
              <Button
                title="Complete"
                onPress={handleCompleteTrip}
                loading={isLoading}
                style={[styles.modalButton, styles.completeButton]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Trip Success Screen */}
      <Modal
        visible={isSuccessScreenVisible}
        animationType="fade"
        transparent={false}
      >
        <View style={styles.successScreenContainer}>
          <View style={styles.successContent}>
            <View style={styles.iconContainer}>
              <Icon name="checkmark-circle" size={100} color={COLORS.SUCCESS} />
            </View>
            <Text style={styles.successTitle}>Trip Successfully Completed!</Text>
            
            {tripCompletionData && (
              <View style={styles.successDetailsContainer}>
                <View style={styles.successDetail}>
                  <Text style={styles.successDetailLabel}>Fare:</Text>
                  <Text style={styles.successDetailValue}>₱{tripCompletionData.fare}</Text>
                </View>
                <View style={styles.successDetail}>
                  <Text style={styles.successDetailLabel}>System Fee:</Text>
                  <Text style={styles.successDetailValue}>₱{tripCompletionData.systemFee}</Text>
                </View>
                <View style={styles.successDetail}>
                  <Text style={styles.successDetailLabel}>Your Earnings:</Text>
                  <Text style={[styles.successDetailValue, styles.earningsValue]}>₱{tripCompletionData.earnings.toFixed(2)}</Text>
                </View>
                <View style={styles.successDetail}>
                  <Text style={styles.successDetailLabel}>Distance:</Text>
                  <Text style={styles.successDetailValue}>{(tripCompletionData.distance / 1000).toFixed(2)} km</Text>
                </View>
              </View>
            )}
            
            <Text style={styles.successMessage}>
              Thank you for providing excellent service. Your earnings have been added to your account.
            </Text>
            
            <Button
              title="Continue"
              onPress={() => {
                setIsSuccessScreenVisible(false);
                navigation.navigate('Map');
              }}
              buttonStyle={styles.successButtonStyle}
              containerStyle={styles.successButtonContainer}
            />
          </View>
        </View>
      </Modal>

      {/* Add the details sheet */}
      <CurrentRideDetailsSheet
        isVisible={isDetailsVisible}
        onClose={() => setIsDetailsVisible(false)}
        activeTrip={activeTrip}
        currentLocation={currentLocation}
        onCallPassenger={handleCallPassenger}
        onMessagePassenger={handleMessagePassenger}
      />
    </SafeAreaView>
  );
};

// Helper function to get trip status title
const getTripStatusTitle = (status) => {
  switch (status) {
    case 'accepted':
      return 'Trip Accepted';
    case 'on_the_way':
      return 'On The Way';
    case 'arrived':
      return 'Arrived at Pickup';
    case 'in_progress':
      return 'Trip in Progress';
    default:
      return 'Current Trip';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  mapContainer: {
    flex: 1
  },
  map: {
    flex: 1
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  detailsButton: {
    flex: 1,
    marginBottom: Platform.OS === 'ios' ? 16 : 0,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    maxWidth: 50,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.WHITE,
  },
  detailsButtonText: {
    fontSize: 12,
  },
  actionButton: {
    flex: 2,
    marginBottom: Platform.OS === 'ios' ? 16 : 0
  },
  button: {
    marginBottom: Platform.OS === 'ios' ? 16 : 0
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 12
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 20
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12
  },
  modalButton: {
    flex: 1
  },
  completeButton: {
    backgroundColor: COLORS.SUCCESS
  },
  earningsValue: {
    color: COLORS.SUCCESS,
    fontWeight: '600',
  },
  distanceWarning: {
    color: COLORS.WARNING,
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
  },
  driverMarker: {
    padding: 8,
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  locationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: COLORS.WHITE,
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    // Add transition for smoother updates
    transition: '0.2s all ease-in-out',
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY
  },
  popupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupModalContent: {
    backgroundColor: COLORS.WHITE,
    padding: 20,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tripDetails: {
    marginBottom: 20,
  },
  tripDetailText: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
  tripDetailLabel: {
    fontWeight: '600',
    color: COLORS.TEXT
  },
  modalInfoText: {
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 20,
  },
  successScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successContent: {
    backgroundColor: COLORS.WHITE,
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.LIGHT_GRAY,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 20,
    textAlign: 'center',
  },
  successDetailsContainer: {
    marginBottom: 20,
    width: '100%',
    backgroundColor: COLORS.LIGHT_BACKGROUND,
    padding: 15,
    borderRadius: 8,
  },
  successDetail: {
    fontSize: 18,
    color: COLORS.TEXT,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  successDetailLabel: {
    fontWeight: '600',
  },
  successDetailValue: {
    fontWeight: '500',
  },
  successMessage: {
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  successButtonStyle: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 30,
    height: 50,
  },
  successButtonContainer: {
    marginTop: 20,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    justifyContent: 'center',
  },
});

// Memoized distance overlay component
const DistanceOverlay = memo(({ status, distance }) => {
  if (!distance || distance <= 0) return null;

  return (
    <View style={styles.distanceOverlay}>
      <Text style={styles.distanceText}>
        {status !== 'in_progress' ? 'To Pickup: ' : 'To Dropoff: '}
        {distance >= 500 
          ? `${(distance / 1000).toFixed(1)} km` 
          : `${Math.round(distance)} m`}
      </Text>
    </View>
  );
});
