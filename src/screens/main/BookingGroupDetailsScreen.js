import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import { AppBar, Button } from '../../components/common';
import { LocationModel } from '../../models/LocationModel';
import { TransactionModel } from '../../models/TransactionModel';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';
import { SCREENS } from '../../constants';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import useLocationStore from '../../store/locationStore';
import { initializeDriverLocation, isValidCoordinates } from '../../utils/locationUtils';

export const BookingGroupDetailsScreen = ({ route, navigation }) => {
  const { locationGroup, currentLocation: initialLocation, title } = route.params;
  const { driver } = useAuthStore();
  const { currentLocation: storeLocation } = useLocationStore();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [driverRequests, setDriverRequests] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [requestListener, setRequestListener] = useState(null);
  const [bookings, setBookings] = useState(locationGroup.bookings || []);
  const [driverLocation, setDriverLocation] = useState(initialLocation || storeLocation);
  const locationInitialized = useRef(false);
  const isNavigatingRef = useRef(false);

  // Initialize driver location from AsyncStorage before loading the screen
  useEffect(() => {
    let isMounted = true;
    
    const setupLocation = async () => {
      // Skip if already initialized to prevent multiple executions
      if (locationInitialized.current) return;
      
      try {
        // Use the shared utility function to initialize location
        await initializeDriverLocation({
          driverId: driver.id,
          initialLocation: initialLocation,
          storeLocation: storeLocation,
          setLocation: (location) => {
            if (isMounted) setDriverLocation(location);
          },
          locationServicesEnabled: useLocationStore.getState().locationServicesEnabled
        });
        
        // Mark as initialized to prevent multiple executions
        locationInitialized.current = true;
      } catch (error) {
        console.error('[BookingGroupDetailsScreen] Error in location setup:', error);
      }
    };
    
    setupLocation();
    
    return () => {
      isMounted = false;
    };
  }, [initialLocation, storeLocation, driver.id]);

  // Update driverLocation when storeLocation changes, but only after initialization
  useEffect(() => {
    if (locationInitialized.current && storeLocation?.latitude && storeLocation?.longitude) {
      setDriverLocation(prevLocation => {
        // Only update if the location has actually changed
        if (prevLocation?.latitude !== storeLocation.latitude || 
            prevLocation?.longitude !== storeLocation.longitude) {
          return storeLocation;
        }
        return prevLocation;
      });
    }
  }, [storeLocation?.latitude, storeLocation?.longitude]);

  // Set up Firestore listener once on mount with memoized function
  useEffect(() => {
    const bookingIds = locationGroup.bookings.map(booking => booking.id).filter(Boolean);
    
    // Only set up listener if we have booking IDs to watch
    if (bookingIds.length === 0) {
      return;
    }
    
    let isMounted = true;
    let unsubscribe = null;
    
    // Setup the Firestore listener
    const setupListener = async () => {
      try {
        console.log('[BookingGroupDetailsScreen] Setting up Firestore listener for bookings:', bookingIds);
        unsubscribe = firestore()
          .collection('bookings')
          .where(firestore.FieldPath.documentId(), 'in', bookingIds)
          .onSnapshot(snapshot => {
            if (!isMounted) return;

            // Create a flag to track if we need to process document changes
            let hasChanges = false;
            let updatedBookingsArray = [...bookings];
            
            // Handle modified documents to check for status changes
            snapshot.docChanges().forEach(change => {
              hasChanges = true;
              const bookingData = { ...change.doc.data(), id: change.doc.id };
              
              // If a booking status changed to 'accepted', navigate back immediately
              if (change.type === 'modified' && bookingData.status === 'accepted') {
                updatedBookingsArray = updatedBookingsArray.filter(b => b.id !== change.doc.id);
                
                // Navigate back immediately when status changes to 'accepted'
                // Use a timeout to prevent setState during render
                if (isMounted && !isNavigatingRef.current) {
                  // Mark that we're navigating
                  isNavigatingRef.current = true;
                  
                  console.log('[BookingGroupDetailsScreen] Booking accepted, navigating back');
                  setTimeout(() => {
                    navigation.goBack();
                  }, 0);
                  return; // Exit early
                }
              }
            });
            
            // Only if we have document changes that affect our list, process full snapshot
            if (hasChanges) {
              // Get updated bookings from the snapshot
              const snapshotBookings = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
              }))
              // Filter out accepted bookings
              .filter(booking => booking.status !== 'accepted');
              
              // Update the bookings state
              if (isMounted) {
                setBookings(snapshotBookings);
                
                // Update driver requests state based on bookings data
                const requests = {};
                snapshotBookings.forEach(booking => {
                  if (booking.driverRequests) {
                    const driverRequest = booking.driverRequests[driver.id] || 
                      Object.values(booking.driverRequests).find(req => req.driverId === driver.id);
                    if (driverRequest) {
                      requests[booking.id] = driverRequest;
                    }
                  }
                });
                setDriverRequests(requests);
              }
            }
          }, error => {
            console.error('Firestore snapshot error:', error);
          });
      } catch (error) {
        console.error('Error setting up Firestore listener:', error);
      }
    };

    // Call the setup function
    setupListener();
    
    // Clean up on unmount
    return () => {
      console.log('[BookingGroupDetailsScreen] Cleaning up Firestore listener');
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [locationGroup.bookings, driver.id, navigation]);

  // Show confirmation modal
  const handleRequestPress = (booking) => {
    setSelectedBooking(booking);
    setIsConfirmModalVisible(true);
  };

  // Update helper functions to use the correct request state
  const hasActiveRequests = useCallback(() => {
    return Object.values(driverRequests).some(request => 
      ['pending', 'accepted'].includes(request.status)
    );
  }, [driverRequests]);

  const hasAcceptedRequest = useCallback(() => {
    return Object.values(driverRequests).some(request => 
      request.status === 'accepted'
    );
  }, [driverRequests]);

  const getDriverRequestForBooking = useCallback((booking) => {
    return booking.driverRequests?.[driver.id] || 
      Object.values(booking.driverRequests || {}).find(req => req.driverId === driver.id);
  }, [driver.id]);

  const hasRequestBeenSent = useCallback((booking) => {
    const driverRequest = getDriverRequestForBooking(booking);
    return driverRequest && ['pending', 'accepted'].includes(driverRequest.status);
  }, [getDriverRequestForBooking]);

  const handleSendRequest = async () => {
    if (!selectedBooking) return;

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
        Toast.show({
          type: 'info',
          text1: 'Cannot send request',
          text2: 'You already have an accepted request from a passenger.',
          position: 'bottom',
          visibilityTime: 3000,
        });
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
        .doc(selectedBooking.id)
        .update({
          [`driverRequests.${driver.id}`]: driverData,
          hasDriverRequests: true,
          lastDriverRequestAt: firestore.FieldValue.serverTimestamp()
        });

      setSentRequests(prev => new Set([...prev, selectedBooking.passengerId]));
      setIsConfirmModalVisible(false);
      navigation.navigate(SCREENS.REQUEST_SENT);

    } catch (error) {
      console.error('Error sending request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send request. Please try again.',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setSelectedBooking(null);
    }
  };

  // Add refresh handler
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Reset states
      setSentRequests(new Set());
      setDriverRequests({});
      
      // Re-fetch bookings with driver requests
      const bookingsSnapshot = await firestore()
        .collection('bookings')
        .where(firestore.FieldPath.documentId(), 'in', locationGroup.bookings.map(b => b.id))
        .get();

      const requests = {};
      bookingsSnapshot.forEach(doc => {
        const booking = doc.data();
        if (booking.driverRequests) {
          const driverRequest = booking.driverRequests[driver.id] || 
            Object.values(booking.driverRequests).find(req => req.driverId === driver.id);
          if (driverRequest) {
            requests[booking.id] = driverRequest;
          }
        }
      });
      setDriverRequests(requests);

    } catch (error) {
      console.error('Error refreshing data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refresh. Pull down to try again.',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } finally {
      setRefreshing(false);
    }
  }, [driver.id, locationGroup.bookings]);

  // Clean up listener when component unmounts
  useEffect(() => {
    return () => {
      if (requestListener) {
        requestListener();
      }
    };
  }, []);

  // Function to remove a booking from the list - memoize to avoid recreation on rerenders
  const removeBookingById = useCallback((bookingId) => {
    console.log('[BookingGroupDetailsScreen] Removing booking:', bookingId);
    setBookings(prevBookings => prevBookings.filter(b => b.id !== bookingId));
  }, []);
  
  // Add a separate useEffect to handle navigation when bookings become empty
  useEffect(() => {
    // Prevent navigation if already navigating back
    if (bookings.length === 0 && !isNavigatingRef.current) {
      // Mark that we're navigating
      isNavigatingRef.current = true;
      
      // Use a small timeout to ensure this happens after the render cycle
      const timeoutId = setTimeout(() => {
        navigation.goBack();
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [bookings, navigation]);

  // Navigate to booking details without using non-serializable function
  const handleNavToBookingDetails = (booking) => {
    // Pre-validate coordinates for better performance
    const isValidDriverLocation = isValidCoordinates(driverLocation);
    const isValidPickupLocation = isValidCoordinates(booking?.pickupLocation?.coordinates);
    const isValidDropoffLocation = isValidCoordinates(booking?.dropoffLocation?.coordinates);
    
    // Prepare optimized booking object with only what's needed
    const optimizedBooking = {
      id: booking.id,
      fare: booking.fare,
      status: booking.status,
      passengerCount: booking.passengerCount,
      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
      pickupLocation: {
        address: booking.pickupLocation?.address,
        coordinates: isValidPickupLocation ? {
          latitude: Number(booking.pickupLocation.coordinates.latitude),
          longitude: Number(booking.pickupLocation.coordinates.longitude)
        } : null
      },
      dropoffLocation: {
        address: booking.dropoffLocation?.address,
        coordinates: isValidDropoffLocation ? {
          latitude: Number(booking.dropoffLocation.coordinates.latitude),
          longitude: Number(booking.dropoffLocation.coordinates.longitude)
        } : null
      }
    };
    
    // Prepare optimized driver location
    const optimizedDriverLocation = isValidDriverLocation ? {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude
    } : null;
    
    // Navigate with the optimized data
    navigation.navigate(SCREENS.BOOKING_DETAILS, {
      booking: optimizedBooking,
      currentLocation: optimizedDriverLocation,
    });
  };

  const renderBookingCard = (booking) => {
    // Validate coordinates are valid numbers 
    const isValidDriverLocation = isValidCoordinates(driverLocation);
    const isValidPickupLocation = isValidCoordinates(booking.pickupLocation?.coordinates);
    const isValidDropoffLocation = isValidCoordinates(booking.dropoffLocation?.coordinates);
    
    // Calculate distance and time from driver to pickup (for "away" text)
    const driverToPickup = isValidDriverLocation && isValidPickupLocation ? 
      LocationModel.calculateDistanceAndTime(
        driverLocation,
        booking.pickupLocation.coordinates
      ) : { distance: 0, estimatedTime: 0 };
    
    // Calculate distance and time from pickup to dropoff (for trip details)
    const pickupToDropoff = isValidPickupLocation && isValidDropoffLocation ?
      LocationModel.calculateDistanceAndTime(
        booking.pickupLocation.coordinates,
        booking.dropoffLocation.coordinates
      ) : { distance: 0, estimatedTime: 0 };

    // Check if this request is rejected
    const driverRequest = getDriverRequestForBooking(booking);
    const isRequestRejected = driverRequest && driverRequest.status === 'rejected';
    const hasActiveRequest = hasRequestBeenSent(booking) && !isRequestRejected;
    
    // Determine the status text based on booking status
    let statusText;
    switch (booking.status) {
      case 'pending':
        statusText = 'Pending';
        break;
      case 'accepted':
        statusText = 'Accepted';
        break;
      case 'on_the_way':
        statusText = 'Driver is on the way';
        break;
      case 'arrived':
        statusText = 'Arrived';
        break;
      case 'in_progress':
        statusText = 'Trip in progress';
        break;
      default:
        statusText = 'Unknown status';
    }

    return (
      <TouchableOpacity 
        style={[
          styles.bookingCard,
          isRequestRejected && styles.rejectedCard
        ]}
        onPress={() => handleNavToBookingDetails(booking)}
      >
        <View style={[
          styles.leftAccent,
          isRequestRejected && styles.rejectedAccent
        ]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.serviceName}>Tricykol</Text>
              <Text style={styles.passengerCount}>
                {booking.passengerCount} {booking.passengerCount > 1 ? 'passengers' : 'passenger'}
              </Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.farePrice}>₱{booking.fare}</Text>
              <Text style={styles.bookingStatus}>{statusText}</Text>
            </View>
          </View>

          {isRequestRejected && (
            <View style={styles.rejectedBadge}>
              <Icon name="cancel" size={16} color={COLORS.ERROR} />
              <Text style={styles.rejectedText}>Request Rejected</Text>
            </View>
          )}

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
                  <Text style={styles.distanceText}>
                    {(driverToPickup.distance / 1000).toFixed(1)}km • {LocationModel.formatTime(driverToPickup.estimatedTime)} away
                  </Text>
                </View>
                <View style={styles.locationItem}>
                  <Text style={styles.locationText}>
                    {booking.dropoffLocation?.address}
                  </Text>
                  <Text style={styles.tripDetailsText}>
                    {(pickupToDropoff.distance / 1000).toFixed(1)}km • {LocationModel.formatTime(pickupToDropoff.estimatedTime)} trip
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBar 
        title={title || "Booking Details"}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
            title="Pull to refresh"
            titleColor={COLORS.TEXT_SECONDARY}
          />
        }
      >
        {bookings.map((booking) => (
          <View key={booking.id}>
            {renderBookingCard(booking)}
          </View>
        ))}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        isVisible={isConfirmModalVisible}
        onBackdropPress={() => !isLoading && setIsConfirmModalVisible(false)}
        onBackButtonPress={() => !isLoading && setIsConfirmModalVisible(false)}
        useNativeDriver
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Request</Text>
          
          <Text style={styles.modalMessage}>
            Are you sure you want to send a pickup request to this passenger?
          </Text>
          
          {selectedBooking && (
            <View style={styles.modalDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Passenger:</Text>
                <Text style={styles.detailValue}>{selectedBooking.passengerFirstName}</Text>
              </View>
              {/* Validate coordinates before calculating distances */}
              {(() => {
                const isValidDriverLocation = isValidCoordinates(driverLocation);
                const isValidPickupLocation = isValidCoordinates(selectedBooking.pickupLocation?.coordinates);
                
                const driverToPickupDetails = isValidDriverLocation && isValidPickupLocation ?
                  LocationModel.calculateDistanceAndTime(
                    driverLocation,
                    selectedBooking.pickupLocation.coordinates
                  ) : { distance: 0, estimatedTime: 0 };
                
                return (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Distance:</Text>
                      <Text style={styles.detailValue}>
                        {LocationModel.formatDistance(driverToPickupDetails.distance)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Est. Time:</Text>
                      <Text style={styles.detailValue}>
                        {LocationModel.formatTime(driverToPickupDetails.estimatedTime)}
                      </Text>
                    </View>
                  </>
                );
              })()}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fare:</Text>
                <Text style={styles.detailValue}>₱{selectedBooking.fare}</Text>
              </View>
            </View>
          )}

          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              type="outline"
              onPress={() => {
                setIsConfirmModalVisible(false);
                setSelectedBooking(null);
              }}
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
      </Modal>

      {/* Add Toast at the bottom */}
      <Toast position="bottom" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    padding: 8,
  },
  bookingCard: {
    backgroundColor: COLORS.WHITE,
    marginBottom: 8,
    borderRadius: 8,
    borderColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
  },
  leftAccent: {
    width: 4,
    backgroundColor: COLORS.PRIMARY,
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
 
  passengerCount: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  farePrice: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconColumn: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 8,
  },
  verticalLine: {
    width: 2,
    height: 40,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginVertical: 2,
  },
  locationsContent: {
    flex: 1,
    gap: 12,
  },
  locationItem: {
    justifyContent: 'center',
    minHeight: 32,
    paddingVertical: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  tripDetailsText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  requestButton: {
    marginTop: 12,
  },
  modal: {
    margin: 0,
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
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
    textAlign: 'center',
  },
  rejectedCard: {
    opacity: 0.8,
    borderColor: COLORS.ERROR_LIGHT,
  },
  rejectedAccent: {
    backgroundColor: COLORS.ERROR,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ERROR_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  rejectedText: {
    color: COLORS.ERROR,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  bookingStatus: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
}); 