import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import { AppBar } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import useBookingVisibilityStore from '../../store/bookingVisibilityStore';
import firestore from '@react-native-firebase/firestore';
import { calculateDistance, calculateGeohashRange } from '../../utils/location';
import { TransactionModel } from '../../models/TransactionModel';
import { Toast } from 'react-native-toast-message';
import { SCREENS } from '../../constants';
import { bookingsService } from '../../services/bookings';
import { serviceManager } from '../../services/serviceManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeDriverLocation, isValidCoordinates } from '../../utils/locationUtils';

/**
 * Screen that displays nearby available bookings grouped by location
 * 
 * @returns {React.ReactElement} RidesScreen component
 */
export const RidesScreen = () => {
  const navigation = useNavigation();
  const { driver } = useAuthStore();
  const { currentLocation, startLocationTracking } = useLocationStore();
  const { isBookingsVisible } = useBookingVisibilityStore();
  const [nearbyBookings, setNearbyBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nearbyBookingsCount, setNearbyBookingsCount] = useState(0);
  const [cachedBookings, setCachedBookings] = useState([]);
  const [localLocation, setLocalLocation] = useState(currentLocation);
  const locationInitialized = useRef(false);

  // Initialize location from AsyncStorage at startup
  useEffect(() => {
    let isMounted = true;
    
    const setupLocation = async () => {
      // Skip if already initialized to prevent multiple executions
      if (locationInitialized.current) return;
      
      try {
        console.log('[RidesScreen] Initializing location from AsyncStorage');
        
        // Use the shared utility function to initialize location
        const location = await initializeDriverLocation({
          driverId: driver?.id,
          initialLocation: null, // No initial location from navigation
          storeLocation: currentLocation,
          setLocation: (location) => {
            if (isMounted) {
              setLocalLocation(location);
              
              // Initialize services with our location if driver is verified
              if (driver?.isVerified && location && isValidCoordinates(location)) {
                console.log('[RidesScreen] Initializing services with location from storage:', location);
                
                // Try to start tracking with this location
                startLocationTracking();
                
                // Only initialize bookings if the driver is verified
                if (bookingsService && !bookingsService.isInitialized) {
                  const formattedLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude
                  };
                  console.log('[RidesScreen] Initializing bookings service with location:', formattedLocation);
                  try {
                    bookingsService.startBookingsListener(formattedLocation)
                      .catch(error => {
                        console.error('[RidesScreen] Error starting bookings listener:', error);
                        setError('Failed to start bookings listener');
                      });
                  } catch (error) {
                    console.error('[RidesScreen] Error starting bookings listener:', error);
                    setError('Failed to start bookings listener');
                  }
                }
              }
            }
          },
          locationServicesEnabled: true
        });
        
        // Mark as initialized to prevent multiple executions
        locationInitialized.current = true;
      } catch (error) {
        console.error('[RidesScreen] Error initializing location:', error);
      }
    };
    
    setupLocation();
    
    return () => {
      isMounted = false;
    };
  }, [driver?.id, driver?.isVerified, currentLocation, startLocationTracking]);

  // Component cleanup
  useEffect(() => {
    return () => {
      // Perform any cleanup when component unmounts
      console.log('[RidesScreen] Component cleanup');
      
      // No need to reset locationInitialized as it will be garbage collected when component unmounts
    };
  }, []);

  // Update localLocation when currentLocation changes in the store, but only if we're initialized
  useEffect(() => {
    if (locationInitialized.current && currentLocation && isValidCoordinates(currentLocation)) {
      // Only update if coordinates have actually changed to prevent unnecessary re-renders
      if (!localLocation || 
          localLocation.latitude !== currentLocation.latitude || 
          localLocation.longitude !== currentLocation.longitude) {
        console.log('[RidesScreen] Updating local location from store:', currentLocation);
        setLocalLocation(currentLocation);
      }
    }
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Group bookings by location
  const groupBookingsByLocation = useCallback((bookings) => {
    console.log('Grouping bookings:', bookings.length);
    const groupedBookings = {};
    
    // Double-check to ensure accepted bookings are filtered out
    const availableBookings = bookings.filter(booking => {
      if (booking.status === 'accepted') {
        console.log(`[RidesScreen] Filtering out accepted booking: ${booking.id}`);
        return false;
      }
      return true;
    });
    
    availableBookings.forEach(booking => {
      // Get the location name from dropoff location
      const dropoffLocation = booking.dropoffLocation || {};
      let locationName = "Unknown Location";
      
      if (dropoffLocation.address) {
        locationName = dropoffLocation.address;
      } else if (dropoffLocation.name && !dropoffLocation.name.startsWith("Dropoff at")) {
        locationName = dropoffLocation.name;
      }
      
      // Create a key for the location
      const key = locationName;
      
      if (!groupedBookings[key]) {
        groupedBookings[key] = {
          locationName,
          count: 0,
          bookings: []
        };
      }
      
      groupedBookings[key].count += 1;
      groupedBookings[key].bookings.push(booking);
    });
    
    // Remove empty groups and convert to array
    const filteredGroups = Object.values(groupedBookings)
      .filter(group => {
        // Ensure all empty groups are removed
        const hasBookings = group.bookings.length > 0;
        if (!hasBookings) {
          console.log(`[RidesScreen] Removing empty group: ${group.locationName}`);
        }
        return hasBookings;
      });
    
    // Sort by distance
    return filteredGroups.sort((a, b) => {
      const aMinDistance = Math.min(...a.bookings.map(b => b.distance));
      const bMinDistance = Math.min(...b.bookings.map(b => b.distance));
      return aMinDistance - bMinDistance;
    });
  }, []);

  // Handle bookings updates
  const handleBookingsUpdate = useCallback((bookings) => {
    console.log('[RidesScreen] Received bookings update:', bookings.length);
    
    // Filter out accepted bookings
    const availableBookings = bookings.filter(booking => booking.status !== 'accepted');
    console.log('[RidesScreen] Available bookings after filtering accepted:', availableBookings.length);
    
    // Group available bookings by location
    const grouped = groupBookingsByLocation(availableBookings);
    console.log('[RidesScreen] Grouped locations count:', grouped.length);
    
    // Always store the latest bookings in the cache
    setCachedBookings(grouped);
    
    // Only show bookings in the UI if they are visible
    if (isBookingsVisible) {
      // Force update the state to ensure the UI refreshes
      setNearbyBookings(prevBookings => {
        // Check if we need to update (avoid unnecessary re-renders)
        const prevIds = new Set(prevBookings.flatMap(group => group.bookings.map(b => b.id)));
        const newIds = new Set(grouped.flatMap(group => group.bookings.map(b => b.id)));
        
        const needsUpdate = 
          prevBookings.length !== grouped.length || 
          prevIds.size !== newIds.size ||
          !Array.from(prevIds).every(id => newIds.has(id));
        
        console.log('[RidesScreen] UI needs update:', needsUpdate);
        return needsUpdate ? [...grouped] : prevBookings;
      });
      
      setNearbyBookingsCount(availableBookings.length);
    } else {
      // When hidden, don't show bookings in the UI but keep them cached
      setNearbyBookingsCount(0);
    }
  }, [isBookingsVisible, groupBookingsByLocation]);

  // Update UI when visibility changes
  useEffect(() => {
    if (isBookingsVisible && cachedBookings.length > 0) {
      setNearbyBookings(cachedBookings);
      setNearbyBookingsCount(cachedBookings.reduce((total, group) => total + group.count, 0));
    } else {
      setNearbyBookings([]);
      setNearbyBookingsCount(0);
    }
  }, [isBookingsVisible, cachedBookings]);

  // Add verification status listener
  useEffect(() => {
    if (!driver?.id) return;
    
    console.log('[RidesScreen] Setting up driver verification status listener for driver:', driver.id);
    
    // Subscribe to real-time updates of the driver document
    const unsubscribe = firestore()
      .collection('drivers')
      .doc(driver.id)
      .onSnapshot(
        (docSnapshot) => {
          if (docSnapshot.exists) {
            const driverData = docSnapshot.data();
            // Check if verification status has changed
            if (driverData.isVerified !== driver.isVerified) {
              console.log('[RidesScreen] Driver verification status changed:', driverData.isVerified);
              
              // Update driver in auth store without triggering re-initialization
              useAuthStore.setState(state => ({
                driver: {
                  ...state.driver,
                  isVerified: driverData.isVerified
                }
              }));

              // Only initialize services if driver becomes verified
              if (driverData.isVerified) {
                // Create verification notification
                firestore()
                  .collection('notifications')
                  .add({
                    type: 'verification',
                    driverId: driver.id,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    read: false,
                    data: {
                      driverName: driver.fullName,
                      phoneNumber: driver.phoneNumber,
                      plateNumber: driver.plateNumber
                    }
                  })
                  .catch(error => {
                    console.error('[RidesScreen] Error creating verification notification:', error);
                  });

                // Initialize bookings service if we have location
                if (localLocation && isValidCoordinates(localLocation)) {
                  const formattedLocation = {
                    latitude: localLocation.latitude,
                    longitude: localLocation.longitude
                  };
                  console.log('[RidesScreen] Initializing bookings service with location:', formattedLocation);
                  try {
                    bookingsService.startBookingsListener(formattedLocation)
                      .catch(error => {
                        console.error('[RidesScreen] Error starting bookings listener:', error);
                        setError('Failed to start bookings listener');
                      });
                  } catch (error) {
                    console.error('[RidesScreen] Error starting bookings listener:', error);
                    setError('Failed to start bookings listener');
                  }
                }
              }
            }
          }
        },
        (error) => {
          console.error('[RidesScreen] Error listening to driver verification status:', error);
        }
      );
    
    // Clean up the listener when component unmounts
    return () => {
      console.log('[RidesScreen] Cleaning up driver verification status listener');
      unsubscribe();
    };
  }, [driver?.id, localLocation]);
  
  // Check for hidden bookings at startup - only if driver is already verified
  useFocusEffect(
    useCallback(() => {
      if (driver?.isVerified && bookingsService.isInitialized) {
        console.log('[RidesScreen] Checking for hidden bookings at startup');
        const activeBookings = Array.from(bookingsService.activeBookings.values());
        if (activeBookings.length > 0) {
          console.log('[RidesScreen] Found hidden bookings at startup:', activeBookings.length);
          const grouped = groupBookingsByLocation(activeBookings);
          setCachedBookings(grouped);
          if (isBookingsVisible) {
            setNearbyBookings(grouped);
            setNearbyBookingsCount(activeBookings.length);
          }
        }
      }
    }, [driver?.isVerified, bookingsService.isInitialized, isBookingsVisible])
  );
  
  // Listen for bookings updates - only if driver is already verified
  useEffect(() => {
    if (!driver?.isVerified) {
      console.log('[RidesScreen] Driver not verified, skipping bookings listener setup');
      setNearbyBookings([]);
      setCachedBookings([]);
      setNearbyBookingsCount(0);
      return;
    }

    console.log('[RidesScreen] Setting up bookings listener for verified driver');
    bookingsService.addBookingListener(handleBookingsUpdate);
    
    return () => {
      console.log('[RidesScreen] Cleaning up bookings listener');
      bookingsService.removeBookingListener(handleBookingsUpdate);
    };
  }, [driver?.isVerified]);

  // Memoize booking IDs to prevent unnecessary re-renders
  const currentBookingIds = useMemo(() => {
    if (!isBookingsVisible || nearbyBookings.length === 0) return [];
    
    return nearbyBookings.flatMap(group => 
      group.bookings.map(booking => booking.id)
    );
  }, [nearbyBookings, isBookingsVisible]);

  // Add this effect to watch for status changes in currently displayed bookings
  useEffect(() => {
    // Skip if no booking IDs to watch or bookings not visible
    if (currentBookingIds.length === 0) return;
    
    console.log('[RidesScreen] Setting up real-time listeners for', currentBookingIds.length, 'bookings');
    
    // Create a collection of listener unsubscribe functions
    const unsubscribes = [];
    
    // For each booking that is currently displayed, add a direct listener
    currentBookingIds.forEach(bookingId => {
      const unsubscribe = firestore()
        .collection('bookings')
        .doc(bookingId)
        .onSnapshot(
          (docSnapshot) => {
            if (!docSnapshot.exists) {
              console.log(`[RidesScreen] Booking ${bookingId} no longer exists`);
              // Remove this booking from any groups
              updateBookingGroups(bookingId, null);
              return;
            }
            
            const updatedBooking = { id: bookingId, ...docSnapshot.data() };
            
            // Check for statuses that should trigger removal from the UI
            const statusesToRemove = ['accepted', 'on_the_way', 'arrived', 'in_progress'];
            
            if (statusesToRemove.includes(updatedBooking.status)) {
              console.log(`[RidesScreen] Booking ${bookingId} status changed to '${updatedBooking.status}', removing from groups`);
              // Remove this booking from any groups it's in
              updateBookingGroups(bookingId, null);
            }
          },
          (error) => {
            console.error(`[RidesScreen] Error watching booking ${bookingId}:`, error);
          }
        );
        
      unsubscribes.push(unsubscribe);
    });
    
    // Cleanup function to remove all listeners when the component unmounts or dependencies change
    return () => {
      console.log('[RidesScreen] Cleaning up booking status listeners:', unsubscribes.length);
      unsubscribes.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (e) {
          console.error('[RidesScreen] Error during listener cleanup:', e);
        }
      });
    };
  }, [currentBookingIds, updateBookingGroups]);

  // Helper function to update booking groups when a booking status changes
  const updateBookingGroups = useCallback((bookingId, updatedBooking) => {
    setNearbyBookings(prevGroups => {
      // Create a map to track how many bookings remain in each group after filtering
      const groupBookingCounts = new Map();
      
      // Create new groups with the updated or removed booking
      const newGroups = prevGroups.map(group => {
        // Find if this group contains the booking that changed
        const hasTargetBooking = group.bookings.some(b => b.id === bookingId);
        
        if (!hasTargetBooking) {
          // This group doesn't contain the booking, keep it as is
          groupBookingCounts.set(group.locationName, group.bookings.length);
          return group;
        }
        
        // This group contains the booking
        if (updatedBooking === null) {
          // We want to remove the booking entirely
          const filteredBookings = group.bookings.filter(b => b.id !== bookingId);
          groupBookingCounts.set(group.locationName, filteredBookings.length);
          
          return {
            ...group,
            bookings: filteredBookings,
            count: filteredBookings.length
          };
        } else {
          // We want to update the booking
          const updatedBookings = group.bookings.map(b => 
            b.id === bookingId ? updatedBooking : b
          );
          groupBookingCounts.set(group.locationName, updatedBookings.length);
          
          return {
            ...group,
            bookings: updatedBookings,
            count: updatedBookings.length
          };
        }
      });
      
      // Filter out any groups that now have zero bookings
      const filteredGroups = newGroups.filter(group => {
        const count = groupBookingCounts.get(group.locationName) || 0;
        const shouldKeep = count > 0;
        
        if (!shouldKeep) {
          console.log(`[RidesScreen] Removing empty group: ${group.locationName}`);
        }
        
        return shouldKeep;
      });
      
      console.log(`[RidesScreen] Updated booking groups: ${filteredGroups.length} groups remaining`);
      return filteredGroups;
    });
  }, []);

  // Make sure to check for accepted bookings on refresh
  const handleRefresh = useCallback(() => {
    if (!isBookingsVisible || !driver?.isVerified) return;
    
    setRefreshing(true);
    
    if (localLocation && isValidCoordinates(localLocation)) {
      const formattedLocation = {
        latitude: localLocation.latitude,
        longitude: localLocation.longitude
      };
      console.log('[RidesScreen] Refreshing bookings with formatted location:', formattedLocation);
      try {
        bookingsService.startBookingsListener(formattedLocation)
          .catch(error => {
            console.error('[RidesScreen] Error refreshing bookings:', error);
            setError('Failed to refresh bookings');
          });
      } catch (error) {
        console.error('[RidesScreen] Error refreshing bookings:', error);
        setError('Failed to refresh bookings');
      }
    }
    
    setRefreshing(false);
  }, [isBookingsVisible, driver?.isVerified, localLocation]);

  const handleBookingPress = (locationGroup) => {
    if (!localLocation || !isValidCoordinates(localLocation)) {
      console.warn('[RidesScreen] Invalid location data for handleBookingPress:', localLocation);
      // Attempt to use the latest data from AsyncStorage
      initializeDriverLocation({
        driverId: driver?.id,
        storeLocation: currentLocation,
        setLocation: (location) => {
          if (location && isValidCoordinates(location)) {
            navigation.navigate(SCREENS.BOOKING_GROUP_DETAILS, {
              locationGroup: locationGroup,
              currentLocation: location,
              title: locationGroup.locationName
            });
          } else {
            // If we still don't have valid coordinates, show an error
            Toast.show({
              type: 'error',
              text1: 'Location Error',
              text2: 'Unable to get your current location. Please try again.'
            });
          }
        }
      });
      return;
    }
    
    // Navigate with valid coordinates
    navigation.navigate(SCREENS.BOOKING_GROUP_DETAILS, {
      locationGroup,
      currentLocation: localLocation,
      title: locationGroup.locationName
    });
  };

  const handleSendRequest = async (booking) => {
    try {
      // Validate that we have a valid location before proceeding
      if (!localLocation || !isValidCoordinates(localLocation)) {
        console.warn('[RidesScreen] Invalid location data for send request:', localLocation);
        Toast.show({
          type: 'error',
          text1: 'Location Error',
          text2: 'Unable to get your current location. Please try again.'
        });
        return;
      }
      
      const driverData = {
        id: driver.id,
        fullName: driver.fullName,
        phoneNumber: driver.phoneNumber,
        plateNumber: driver.plateNumber,
        profilePicture: driver.profilePicture,
        currentLocation: localLocation,
        // Add other required driver details
      };

      await TransactionModel.sendDriverRequest(booking.id, driverData);
      
      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Request Sent',
        text2: 'Waiting for passenger confirmation'
      });

    } catch (error) {
      console.error('Error sending request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send request. Please try again.'
      });
    }
  };

  // Add toggle handler
  const handleStatusToggle = async () => {
    try {
      setIsLoading(true);
      setIsBookingsVisible(!isBookingsVisible);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBookingItem = ({ item }) => {
    const hasRejectedRequest = item.bookings.some(booking => {
      const driverRequest = booking.driverRequests?.[driver.id] || 
        Object.values(booking.driverRequests || {}).find(req => req.driverId === driver.id);
      return driverRequest?.status === 'rejected';
    });

    // Ensure we have a valid location before navigating to details
    const handleBookingItemPress = () => {
      if (!localLocation || !isValidCoordinates(localLocation)) {
        console.warn('[RidesScreen] Invalid location data for navigation:', localLocation);
        // Attempt to use the latest data from AsyncStorage
        initializeDriverLocation({
          driverId: driver?.id,
          storeLocation: currentLocation,
          setLocation: (location) => {
            if (location && isValidCoordinates(location)) {
              navigation.navigate(SCREENS.BOOKING_GROUP_DETAILS, {
                locationGroup: item,
                currentLocation: location
              });
            } else {
              // If we still don't have valid coordinates, show an error
              Toast.show({
                type: 'error',
                text1: 'Location Error',
                text2: 'Unable to get your current location. Please try again.'
              });
            }
          }
        });
        return;
      }
      
      // Navigate with valid coordinates
      navigation.navigate(SCREENS.BOOKING_GROUP_DETAILS, {
        locationGroup: item,
        currentLocation: localLocation
      });
    };

    return (
      <TouchableOpacity
        style={styles.bookingItem}
        onPress={handleBookingItemPress}
      >
        <View style={[styles.leftAccent, hasRejectedRequest && styles.rejectedAccent]} />
        <View style={styles.bookingContent}>
          <Text style={styles.locationName}>{item.locationName}</Text>
          <Text style={[
            styles.bookingCount,
            hasRejectedRequest && styles.rejectedBookingCount
          ]}>
            {item.count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <AppBar nearbyBookingsCount={nearbyBookingsCount} />
      
      <View style={styles.container}>
        {!driver?.isVerified ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={() => (
              <View style={styles.verificationNoticeContainer}>
                <Text style={styles.emptyTitle}>Your account is under verification</Text>
                <Text style={styles.verificationNoticeText}>
                  Verification is in progress. This may take a little while. Please be patient.
                </Text>
              </View>
            )}
            contentContainerStyle={styles.listContentEmpty}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        ) : !isBookingsVisible ? (
          <View style={styles.emptyContainer}>
            <Icon name="near-me-disabled" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyTitle}>You're offline</Text>
            <Text style={styles.emptyMessage}>
              Go online to see available bookings nearby.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Icon name="error" size={48} color={COLORS.ERROR} />
            <Text style={styles.emptyTitle}>Error</Text>
            <Text style={styles.emptyMessage}>{error}</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={handleRefresh}
            >
              <Text style={styles.emptyButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : nearbyBookings.length === 0 ? (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Rides Available</Text>
                <Text style={styles.emptyMessage}>
                  There are no bookings available nearby. Pull down to refresh.
                </Text>
              </View>
            )}
            contentContainerStyle={styles.listContentEmpty}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        ) : (
          <FlatList
            data={nearbyBookings}
            renderItem={renderBookingItem}
            keyExtractor={(item) => item.locationName}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </View>

      {isLoading && <Loading />}
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
  },
  listContent: {
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 8,
  },
  bookingItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 8,
    borderColor: COLORS.GRAY_LIGHT,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leftAccent: {
    width: 4,
    backgroundColor: COLORS.PRIMARY,
  },
  rejectedAccent: {
    backgroundColor: COLORS.ERROR,
  },
  bookingContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  locationName: {
    fontSize: 14,
    color: COLORS.TEXT,
    flex: 1,
  },
  bookingCount: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    marginLeft: 8,
  },
  rejectedBookingCount: {
    color: COLORS.ERROR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  emptyButtonText: {
    color: COLORS.WHITE,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  verificationNoticeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verificationNoticeText: {
    fontSize: 16,
    color: COLORS.TEXT,
    textAlign: 'center',
  },
});
