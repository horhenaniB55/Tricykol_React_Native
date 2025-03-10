import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, Linking, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView } from '../../components/map';
import { AppBar, Button } from '../../components/common';
import { COLORS } from '../../constants';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocationModel } from '../../models/LocationModel';
import { useAuthStore } from '../../store/authStore';
import useBookingDetailsStore from '../../store/bookingDetailsStore';
import { TransactionModel } from '../../models/TransactionModel';
import firestore from '@react-native-firebase/firestore';
import { SCREENS } from '../../constants';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLocationStore from '../../store/locationStore';
import * as Location from 'expo-location';
import { initializeDriverLocation, isValidCoordinates } from '../../utils/locationUtils';

// Add a static flag to track initialization across component instances
const hasInitializedLocation = { current: false };

export const BookingDetailsScreen = ({ route, navigation }) => {
  const { booking, currentLocation: initialLocation } = route.params;
  const { driver } = useAuthStore();
  const { currentLocation: storeLocation } = useLocationStore();
  const { 
    driverToPickupRoute, 
    pickupToDropoffRoute,
    driverRequest,
    bookingStatus,
    setRoutes,
    setDriverRequest,
    setBookingStatus,
    resetStore
  } = useBookingDetailsStore();
  
  const insets = useSafeAreaInsets();
  const [bottomSheetHeight, setBottomSheetHeight] = useState(0);
  const mapRef = useRef(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [hasAcceptedRequest, setHasAcceptedRequest] = useState(false);
  const routesCalculated = useRef(false);
  const [driverLocation, setDriverLocation] = useState(initialLocation || storeLocation);
  const locationInitialized = useRef(hasInitializedLocation.current);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Handle initial render completion
  useEffect(() => {
    if (isInitialRender) {
      // Use requestAnimationFrame to defer non-critical operations until after initial render
      requestAnimationFrame(() => {
        setIsInitialRender(false);
      });
    }
  }, [isInitialRender]);

  // Check for existing location in storage before initializing
  useEffect(() => {
    const checkLocationStorage = async () => {
      try {
        // If we already have a driver location or the location has been initialized globally, skip
        if (hasInitializedLocation.current || (driverLocation?.latitude && driverLocation?.longitude)) {
          console.log('[BookingDetailsScreen] Location already initialized, skipping initialization');
          locationInitialized.current = true;
          return;
        }

        // Check if location was stored in a previous session
        const storedLocationKey = `location_initialized_${driver.id}`;
        const storedInitialized = await AsyncStorage.getItem(storedLocationKey);
        
        if (storedInitialized === 'true') {
          console.log('[BookingDetailsScreen] Found stored location initialization state');
          
          // Check if we have a stored location
          const storedLocationJson = await AsyncStorage.getItem('driverLocation');
          if (storedLocationJson) {
            const storedLocation = JSON.parse(storedLocationJson);
            if (storedLocation?.latitude && storedLocation?.longitude) {
              console.log('[BookingDetailsScreen] Using stored location:', storedLocation);
              setDriverLocation(storedLocation);
              locationInitialized.current = true;
              hasInitializedLocation.current = true;
              return;
            }
          }
        }
        
        // If we reach here, we need to initialize location
        console.log('[BookingDetailsScreen] No stored location found, initializing');
        await setupLocation();
        
        // Remember initialization for future navigations
        await AsyncStorage.setItem(storedLocationKey, 'true');
      } catch (error) {
        console.error('[BookingDetailsScreen] Error checking stored location:', error);
      }
    };
    
    checkLocationStorage();
  }, [driver.id, initialLocation, storeLocation, driverLocation]);
  
  // Initialize driver location from AsyncStorage before loading the screen
  const setupLocation = async () => {
    // Skip if already initialized to prevent multiple executions
    if (locationInitialized.current) return;
    
    try {
      // Set loading state while fetching location
      setIsLoading(true);
      console.log('[BookingDetailsScreen] Starting location initialization');
      
      let locationData = null;
      
      // First attempt: Try to get current location using expo-location
      try {
        console.log('[BookingDetailsScreen] Attempting to get current position from device');
        
        // First check if location services are enabled
        const serviceStatus = await Location.hasServicesEnabledAsync();
        if (!serviceStatus) {
          console.log('[BookingDetailsScreen] Location services are disabled');
          throw new Error('Location services are disabled');
        }
        
        // Then request permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('[BookingDetailsScreen] Location permission status:', status);
        
        if (status === 'granted') {
          // Get last known location first as a quicker fallback
          const lastKnownPosition = await Location.getLastKnownPositionAsync({
            maxAge: 60000 // Use cached position from last minute if available
          }).catch(() => null);
          
          if (lastKnownPosition?.coords) {
            console.log('[BookingDetailsScreen] Using last known position');
            locationData = {
              latitude: lastKnownPosition.coords.latitude,
              longitude: lastKnownPosition.coords.longitude,
              timestamp: lastKnownPosition.timestamp,
              accuracy: lastKnownPosition.coords.accuracy
            };
          } else {
            // Try to get current position with increased timeout
            console.log('[BookingDetailsScreen] Getting current position with increased timeout');
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeout: 15000 // Increase timeout to 15 seconds
            });
            
            if (position?.coords) {
              locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: position.timestamp,
                accuracy: position.coords.accuracy
              };
              console.log('[BookingDetailsScreen] Successfully got current position:', locationData);
              
              // Save this fresh location for future use
              await AsyncStorage.setItem('driverLocation', JSON.stringify(locationData));
            } else {
              console.log('[BookingDetailsScreen] getCurrentPositionAsync returned empty result');
            }
          }
        } else {
          console.log('[BookingDetailsScreen] Location permission not granted, using fallbacks');
        }
      } catch (error) {
        console.log('[BookingDetailsScreen] Error getting current position, will use fallbacks:', error);
      }
      
      // Second attempt: If we couldn't get current location, use initializeDriverLocation for fallbacks
      if (!locationData) {
        console.log('[BookingDetailsScreen] Using fallback location sources');
        locationData = await initializeDriverLocation({
          driverId: driver.id,
          initialLocation: initialLocation,
          storeLocation: storeLocation,
          locationServicesEnabled: useLocationStore.getState().locationServicesEnabled
        });
      }
      
      // Use the location data we found
      if (locationData) {
        console.log('[BookingDetailsScreen] Setting location data:', locationData);
        setDriverLocation(locationData);
        
        // Mark as initialized to prevent multiple executions
        locationInitialized.current = true;
        hasInitializedLocation.current = true;
        
        // Only then fetch routes (will be skipped if already calculated)
        fetchRoutes();
      } else {
        console.warn('[BookingDetailsScreen] Failed to get location data from any source');
      }
    } catch (error) {
      console.error('[BookingDetailsScreen] Error in location setup:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset store on unmount
  useEffect(() => {
    return () => {
      resetStore();
    };
  }, []);

  // Update the useEffect for listening to booking updates
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const setupBookingListener = async () => {
      try {
        // Check local storage first
        const localBookingData = await AsyncStorage.getItem(`booking_${booking.id}`);
        if (localBookingData && isMounted) {
          const parsedData = JSON.parse(localBookingData);
          setBookingStatus(parsedData.status);
          setDriverRequest(parsedData.driverRequest);
          setRequestSent(!!parsedData.driverRequest);
        }

        // Set up Firestore listener
        unsubscribe = firestore()
          .collection('bookings')
          .doc(booking.id)
          .onSnapshot(async snapshot => {
            if (!isMounted) return;
            
            const bookingData = snapshot.data();
            if (!bookingData) return;

            // Update booking status
            setBookingStatus(bookingData.status);

            // Check if this driver has a request in the booking
            const driverRequest = bookingData.driverRequests?.[driver.id] || 
              Object.values(bookingData.driverRequests || {}).find(req => req.driverId === driver.id);

            // Update states based on booking data
            setDriverRequest(driverRequest);
            setRequestSent(!!driverRequest);

            // Store in local storage
            await AsyncStorage.setItem(`booking_${booking.id}`, JSON.stringify({
              status: bookingData.status,
              driverRequest
            }));

            // Handle status changes
            if (driverRequest?.status === 'accepted') {
              // Passenger has accepted the request
              setHasAcceptedRequest(true);
            }
          });
      } catch (error) {
        console.error('[BookingDetailsScreen] Error setting up booking listener:', error);
      }
    };

    setupBookingListener();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [booking.id, driver.id, navigation]);

  // Extract fetchRoutes to a separate function to be called after location initialization
  const fetchRoutes = async () => {
    // Skip if already calculated or no driver location
    if (routesCalculated.current || !driverLocation) return;
    
    try {
      // Mark as calculated immediately to prevent duplicate calls
      routesCalculated.current = true;
      
      // Validate coordinates - make sure they're properly extracted from booking
      console.log('[BookingDetailsScreen] Validating booking coordinates...');
      
      // Check if booking has the required coordinate data
      if (!booking?.pickupLocation?.coordinates?.latitude || 
          !booking?.pickupLocation?.coordinates?.longitude ||
          !booking?.dropoffLocation?.coordinates?.latitude ||
          !booking?.dropoffLocation?.coordinates?.longitude) {
        console.error('[BookingDetailsScreen] Missing or invalid coordinates in booking:', {
          pickup: booking?.pickupLocation?.coordinates,
          dropoff: booking?.dropoffLocation?.coordinates
        });
        return;
      }
      
      // Create proper coordinate objects with numeric values
      const pickupLocation = {
        latitude: Number(booking.pickupLocation.coordinates.latitude),
        longitude: Number(booking.pickupLocation.coordinates.longitude)
      };
      
      const dropoffLocation = {
        latitude: Number(booking.dropoffLocation.coordinates.latitude),
        longitude: Number(booking.dropoffLocation.coordinates.longitude)
      };

      // Make sure we have valid coordinates with both latitude and longitude
      const isDriverLocationValid = isValidCoordinates(driverLocation);
      const isPickupLocationValid = isValidCoordinates(pickupLocation);
      const isDropoffLocationValid = isValidCoordinates(dropoffLocation);

      // For pickup to dropoff route only
      if (isPickupLocationValid && isDropoffLocationValid) {
        // On first render, use simulated route for immediate display
        if (isInitialRender) {
          console.log('[BookingDetailsScreen] Using quick simulated route for initial render');
          const simulatedRoute = LocationModel.getSimulatedRoute(pickupLocation, dropoffLocation);
          setRoutes(null, simulatedRoute);
          
          // After a short delay, fetch the actual route
          setTimeout(async () => {
            console.log('[BookingDetailsScreen] Now fetching actual route in background');
            const actualRoute = await LocationModel.getRouteCoordinates(
              pickupLocation,
              dropoffLocation
            );
            
            if (actualRoute && actualRoute.length >= 2) {
              setRoutes(null, actualRoute);
            }
          }, 1000);
        } else {
          // Set a timeout to allow the screen transition to complete first
          setTimeout(async () => {
            console.log('[BookingDetailsScreen] Calculating route from pickup to dropoff');
            
            // First try to get from cache or use simulated for immediate display
            const quickRoute = await LocationModel.getRouteCoordinates(
              pickupLocation,
              dropoffLocation,
              { useSimulatedIfNoCache: true }
            );
            
            if (quickRoute) {
              setRoutes(null, quickRoute);
              
              // If we used a simulated route, fetch the actual one in background
              if (!quickRoute.fromCache) {
                setTimeout(async () => {
                  const actualRoute = await LocationModel.getRouteCoordinates(
                    pickupLocation,
                    dropoffLocation
                  );
                  
                  if (actualRoute && actualRoute.length > 0) {
                    setRoutes(null, actualRoute);
                  }
                }, 2000);
              }
            }
          }, 300);
        }
      } else {
        console.warn('[BookingDetailsScreen] Invalid location data:',
          { 
            pickupLocation: isPickupLocationValid ? 'valid' : 'invalid',
            dropoffLocation: isDropoffLocationValid ? 'valid' : 'invalid'
          }
        );
      }
    } catch (error) {
      console.error('[BookingDetailsScreen] Error fetching routes:', error);
    }
  };
  
  // Focus on current location when component mounts
  useEffect(() => {
    let timeoutId;
    if (driverLocation && mapRef.current) {
      timeoutId = setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }, 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [driverLocation]);

  // Measure content height
  const onBottomSheetLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    setBottomSheetHeight(height);
  }, []);

  // Show confirmation modal
  const handleRequestPress = () => {
    setIsConfirmModalVisible(true);
  };

  // Update handleSendRequest function
  const handleSendRequest = async () => {
    try {
      setIsLoading(true);

      // Check if driver already has an accepted booking
      const acceptedBookingsSnapshot = await firestore()
        .collection('bookings')
        .where('status', '==', 'accepted')
        .where(`driverRequests.${driver.id}.status`, '==', 'accepted')
        .get();

      if (!acceptedBookingsSnapshot.empty) {
        setIsLoading(false);
        setIsConfirmModalVisible(false);
        Alert.alert(
          'Cannot send request',
          'You already have an accepted request from a passenger.'
        );
        return;
      }

      const driverData = {
        driverId: driver.id,
        fullName: driver.fullName,
        phoneNumber: driver.phoneNumber,
        plateNumber: driver.plateNumber,
        profilePicture: driver.profilePicture,
        currentLocation: driverLocation,
        status: 'pending',
        timestamp: firestore.FieldValue.serverTimestamp()
      };

      // Update booking document with driver request
      await firestore()
        .collection('bookings')
        .doc(booking.id)
        .update({
          [`driverRequests.${driver.id}`]: driverData,
          hasDriverRequests: true,
          lastDriverRequestAt: firestore.FieldValue.serverTimestamp()
        });

      setRequestSent(true);
      setIsConfirmModalVisible(false);

      // Small delay to ensure Firestore update is processed
      setTimeout(() => {
        navigation.navigate(SCREENS.REQUEST_SENT);
      }, 500);

    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert(
        'Error',
        'Failed to send request. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate distances and times with validation - memoized
  const driverToPickup = React.useMemo(() => {
    if (!driverLocation || !booking.pickupLocation?.coordinates) {
      return { distance: 0, estimatedTime: 0 };
    }
    
    // Validate coordinates are numbers
    const isDriverLocationValid = isValidCoordinates(driverLocation);
    const isPickupLocationValid = isValidCoordinates(booking.pickupLocation?.coordinates);
    
    if (!isDriverLocationValid || !isPickupLocationValid) {
      console.warn('[BookingDetailsScreen] Invalid coordinates for driverToPickup calculation',
        { driverLocation, pickupLocation: booking.pickupLocation?.coordinates });
      return { distance: 0, estimatedTime: 0 };
    }
                               
    return LocationModel.calculateDistanceAndTime(
      driverLocation,
      booking.pickupLocation.coordinates
    );
  }, [driverLocation?.latitude, driverLocation?.longitude, booking.pickupLocation?.coordinates]);

  const pickupToDropoff = React.useMemo(() => {
    if (!booking.pickupLocation?.coordinates || !booking.dropoffLocation?.coordinates) {
      return { distance: 0, estimatedTime: 0 };
    }
    
    // Validate coordinates are numbers
    const isPickupLocationValid = isValidCoordinates(booking.pickupLocation?.coordinates);
    const isDropoffLocationValid = isValidCoordinates(booking.dropoffLocation?.coordinates);
    
    if (!isPickupLocationValid || !isDropoffLocationValid) {
      console.warn('[BookingDetailsScreen] Invalid coordinates for pickupToDropoff calculation',
        { pickupLocation: booking.pickupLocation?.coordinates, dropoffLocation: booking.dropoffLocation?.coordinates });
      return { distance: 0, estimatedTime: 0 };
    }
    
    return LocationModel.calculateDistanceAndTime(
      booking.pickupLocation.coordinates,
      booking.dropoffLocation.coordinates
    );
  }, [booking.pickupLocation?.coordinates, booking.dropoffLocation?.coordinates]);

  // Function to focus map on current location
  const focusOnCurrentLocation = useCallback(() => {
    if (mapRef.current && driverLocation) {
      // Animate to current location
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [driverLocation]);

  // Handle map ready event
  const handleMapReady = () => {
    console.log('[BookingDetailsScreen] Map is ready');
    setIsMapReady(true);
    
    // Focus on current location after a short delay to ensure the map is fully initialized
    setTimeout(() => {
      if (mapRef.current && driverLocation) {
        mapRef.current.animateToRegion({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 300);
      }
    }, 200);
  };

  // Update map markers and polylines when map becomes ready
  useEffect(() => {
    if (isMapReady && !isInitialRender && locationInitialized.current && !routesCalculated.current) {
      // Now that map is ready and initial render is complete, fetch routes
      fetchRoutes();
    }
  }, [isMapReady, isInitialRender, locationInitialized.current]);

  // Function to handle rejected request removal - doesn't rely on passed function
  const handleRemoveRejectedRequest = useCallback(async () => {
    try {
      setIsLoading(true);

      // Remove the driver request from the booking document
      await firestore()
        .collection('bookings')
        .doc(booking.id)
        .update({
          [`driverRequests.${driver.id}`]: firestore.FieldValue.delete(),
          updatedAt: firestore.FieldValue.serverTimestamp()
        });

      // Navigate back with parameters instead of calling a function
      navigation.navigate('Home', { 
        rejectRemoved: true, 
        bookingId: booking.id 
      });
    } catch (error) {
      console.error('[BookingDetailsScreen] Error removing request:', error);
      Alert.alert(
        'Error',
        'Failed to remove request. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [booking, navigation, driver.id]);

  // Function to handle calling the passenger
  const handleCallPassenger = () => {
    if (booking.passengerPhone) {
      Linking.openURL(`tel:${booking.passengerPhone}`);
    } else {
      Alert.alert(
        'Error',
        'Passenger phone number not available.'
      );
    }
  };

  // Function to handle sending SMS to the passenger
  const handleSendSMS = () => {
    if (booking.passengerPhone) {
      Linking.openURL(`sms:${booking.passengerPhone}`);
    } else {
      Alert.alert(
        'Error',
        'Passenger phone number not available.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBar 
        title="Booking Details"
        showBack
        onBack={() => navigation.goBack()}
      />
      
      {/* Map View - only show when we have valid driver location */}
      {isLoading || !driverLocation ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={[
            styles.map,
            { marginBottom: bottomSheetHeight }
          ]}
          onMapReady={handleMapReady}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          moveOnMarkerPress={false}
          liteMode={false} // Never use lite mode to ensure interactivity
          minZoomLevel={12} // Less restrictive minimum zoom level
          maxZoomLevel={20}
          initialRegion={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          markers={[


            // Only show other markers after initial render for performance
            ...(isMapReady ? [
              booking?.pickupLocation?.coordinates && {
                latitude: Number(booking.pickupLocation.coordinates.latitude),
                longitude: Number(booking.pickupLocation.coordinates.longitude),
                title: 'Pickup',
                iconName: 'location-history',
                pinColor: '#00BCD4'
              },
              booking?.dropoffLocation?.coordinates && {
                latitude: Number(booking.dropoffLocation.coordinates.latitude),
                longitude: Number(booking.dropoffLocation.coordinates.longitude),
                title: 'Dropoff',
                iconName: 'place',
                pinColor: '#FF6B6B'
              }
            ] : [])
          ].filter(Boolean)}
          polylines={[
            // Only show the polylines after the map is ready
            isMapReady && pickupToDropoffRoute && 
            Array.isArray(pickupToDropoffRoute) && 
            pickupToDropoffRoute.length >= 2 && {
              coordinates: pickupToDropoffRoute,
              strokeColor: '#00BCD4',
              strokeWidth: 10,
            }
          ].filter(Boolean)}
        />
      )}

      {/* Bottom Sheet */}
      <View 
        style={[
          styles.bottomSheet,
          { paddingBottom: insets.bottom }
        ]}
        onLayout={onBottomSheetLayout}
      >
        <View style={styles.handle} />
        
        {/* Content Container */}
        <View style={styles.content}>
          {/* Passenger Name and Fare */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.fareWithCash}>₱{booking.fare} in cash</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.passengerContainer}>
                <MaterialIcons name="person-outline" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.passengerCount}>{booking.passengerCount}</Text>
              </View>
            </View>
          </View>

          {/* Call and SMS buttons - only visible when booking has driver request and status is 'on_the_way' */}
          {bookingStatus === 'on_the_way' && driverRequest?.status === 'accepted' && (
            <View style={styles.contactButtonsContainer}>
              <TouchableOpacity 
                onPress={handleCallPassenger} 
                style={styles.contactButtonLarge}
                disabled={!booking.passengerPhone}
              >
                <MaterialIcons name="phone" size={20} color={COLORS.WHITE} />
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSendSMS} 
                style={styles.contactButtonLarge}
                disabled={!booking.passengerPhone}
              >
                <MaterialIcons name="message" size={20} color={COLORS.WHITE} />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}

          {driverRequest?.status === 'rejected' && (
            <View style={styles.rejectedBadge}>
              <Icon name="cancel" size={16} color={COLORS.ERROR} />
              <Text style={styles.rejectedText}>Request Rejected</Text>
            </View>
          )}

          {/* Locations */}
          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={styles.iconColumn}>
                <Icon name="radio-button-off" size={20} color={COLORS.DARK_PRIMARY} />
                <View style={styles.verticalLine} />
                <Icon name="radio-button-on" size={20} color={COLORS.DARK_PRIMARY} />
              </View>
              <View style={styles.locationsContent}>
                <View style={styles.locationItem}>
                  <Text style={styles.locationText}>
                    {booking.pickupLocation?.address}
                  </Text>
                  {driverLocation && booking.pickupLocation?.coordinates && (
                    <Text style={styles.distanceText}>
                      {(driverToPickup.distance / 1000).toFixed(1)}km • {LocationModel.formatTime(driverToPickup.estimatedTime)} away
                    </Text>
                  )}
                </View>
                <View style={styles.locationItem}>
                  <Text style={styles.locationText}>
                    {booking.dropoffLocation?.address}
                  </Text>
                  {booking.pickupLocation?.coordinates && booking.dropoffLocation?.coordinates && (
                    <Text style={styles.tripDetailsText}>
                      {(pickupToDropoff.distance / 1000).toFixed(1)}km • {LocationModel.formatTime(pickupToDropoff.estimatedTime)} trip
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Send Request Button */}
          <Button
            title={
              driverRequest?.status === 'rejected' ? "REMOVE" :
              bookingStatus === 'on_the_way' ? "DRIVER ON THE WAY" :
              bookingStatus === 'arrived' ? "DRIVER ARRIVED" :
              bookingStatus === 'in_progress' ? "TRIP IN PROGRESS" :
              bookingStatus === 'completed' ? "TRIP COMPLETED" :
              driverRequest ? "REQUEST SENT" :
              hasAcceptedRequest ? "ALREADY ACCEPTED ELSEWHERE" :
              requestSent ? "REQUEST PENDING" :
              "SEND REQUEST"
            }
            onPress={driverRequest?.status === 'rejected' ? handleRemoveRejectedRequest : handleRequestPress}
            disabled={
              driverRequest?.status === 'rejected' ? false : // Enable if it's a rejected request that can be removed
              hasAcceptedRequest || // Disable if driver has an accepted request elsewhere
              requestSent || // Disable if this request is pending
              driverRequest?.status === 'pending' || // Disable if this specific request is pending
              bookingStatus !== 'pending' // Disable if booking is not in pending status
            }
            style={[
              styles.requestButton,
              driverRequest?.status === 'rejected' && styles.removeButton,
              (!(driverRequest?.status === 'rejected') && (requestSent || hasAcceptedRequest || bookingStatus !== 'pending')) && styles.requestSentButton
            ]}
          />
          {requestSent && !driverRequest && !hasAcceptedRequest && (
            <Text style={styles.warningText}>
              Please wait for response to your other request
            </Text>
          )}
          {hasAcceptedRequest && (
            <Text style={styles.warningText}>
              You have an accepted request from a passenger
            </Text>
          )}
        </View>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={isConfirmModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !isLoading && setIsConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Request</Text>
            
            <Text style={styles.modalMessage}>
              Are you sure you want to send a pickup request to this passenger?
            </Text>
            
            <View style={styles.modalDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Passenger:</Text>
                <Text style={styles.detailValue}>{booking.passengerFirstName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance:</Text>
                <Text style={styles.detailValue}>
                  {(driverToPickup.distance / 1000).toFixed(1)}km
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Est. Time:</Text>
                <Text style={styles.detailValue}>
                  {LocationModel.formatTime(driverToPickup.estimatedTime)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fare:</Text>
                <Text style={styles.detailValue}>₱{booking.fare}</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                type="outline"
                onPress={() => setIsConfirmModalVisible(false)}
                disabled={isLoading}
                style={styles.modalButton}
              />
              <Button
                title="Send Request"
                onPress={handleSendRequest}
                loading={isLoading}
                style={[styles.modalButton, styles.confirmButton]}
              />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.WHITE,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    justifyContent: 'center',
    paddingTop: 4,
  },
  fareWithCash: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.GRAY,
    marginBottom: 4,
  },
  passengerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerCount: {
    fontSize: 22,
    color: COLORS.PRIMARY,
    marginLeft: 4,
    marginRight: 10,
  },
  farePrice: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  locationContainer: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconColumn: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 4,
  },
  verticalLine: {
    width: 2,
    height: 70,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginVertical: 4,
  },
  locationsContent: {
    flex: 1,
    gap: 16,
  },
  locationItem: {
    justifyContent: 'flex-start',
    minHeight: 32,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.TEXT,
    lineHeight: 22,
    flexWrap: 'wrap',
    paddingTop: 2,
  },
  distanceText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  tripDetailsText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  requestButton: {
    marginTop: 'auto',
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
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  modalDetails: {
    backgroundColor: COLORS.BACKGROUND,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  confirmButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  requestSentButton: {
    backgroundColor: COLORS.GRAY_LIGHT,
    opacity: 0.8,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.WARNING,
    textAlign: 'center',
    marginTop: 4,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ERROR_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  rejectedText: {
    color: COLORS.ERROR,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  removeButton: {
    backgroundColor: COLORS.ERROR,
  },
  contactButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  contactButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  contactButton: {
    marginLeft: 16,
  },
  contactButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  contactButtonText: {
    color: COLORS.WHITE,
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.TEXT,
    marginTop: 12,
  },
}); 