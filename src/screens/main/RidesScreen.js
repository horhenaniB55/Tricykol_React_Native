import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import { AppBar } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import firestore from '@react-native-firebase/firestore';
import { calculateDistance } from '../../utils/location';

/**
 * Screen that displays nearby available bookings grouped by location
 * 
 * @returns {React.ReactElement} RidesScreen component
 */
export const RidesScreen = ({ navigation }) => {
  const { driver } = useAuthStore();
  const { currentLocation } = useLocationStore();
  const [nearbyBookings, setNearbyBookings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const bookingsListener = useRef(null);
  const SEARCH_RADIUS_METERS = 700;
  
  // Check if driver is online
  const isDriverOnline = driver?.status === 'online';

  // Group bookings by dropoff location
  const groupBookingsByLocation = useCallback((bookings) => {
    const groupedBookings = {};
    
    bookings.forEach(booking => {
      // Get the location name - prioritize name field, then street, then city
      const dropoffLocation = booking.dropoffLocation || {};
      let locationName = "Unknown Location";
      
      if (dropoffLocation.name && !dropoffLocation.name.startsWith("Dropoff at")) {
        locationName = dropoffLocation.name;
      } else if (dropoffLocation.street) {
        locationName = dropoffLocation.street;
      } else if (dropoffLocation.city) {
        locationName = dropoffLocation.city;
      } else if (dropoffLocation.formattedAddress) {
        // Extract meaningful part from formatted address
        const parts = dropoffLocation.formattedAddress.split(',');
        locationName = parts[0].trim();
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
    
    // Convert to array for FlatList
    return Object.values(groupedBookings);
  }, []);

  // Set up real-time listener for bookings
  const setupBookingsListener = useCallback(() => {
    // Only set up listener if driver is online
    if (!isDriverOnline) {
      setNearbyBookings([]);
      if (bookingsListener.current) {
        bookingsListener.current();
        bookingsListener.current = null;
      }
      return;
    }
    
    if (bookingsListener.current) {
      bookingsListener.current();
    }

    if (!currentLocation) return;

    try {
      const bookingsQuery = firestore()
        .collection('bookings')
        .where('status', '==', 'pending');

      bookingsListener.current = bookingsQuery.onSnapshot(
        snapshot => {
          // Process bookings in the background
          const bookings = [];
          snapshot.forEach(doc => {
            const booking = {
              id: doc.id,
              ...doc.data()
            };
            
            // Calculate distance
            const distance = calculateDistance(
              currentLocation,
              booking.pickupLocation
            );
            
            // Only include bookings within radius
            if (distance <= SEARCH_RADIUS_METERS) {
              bookings.push({
                ...booking,
                distance
              });
            }
          });
          
          // Sort by distance
          bookings.sort((a, b) => a.distance - b.distance);
          
          // Group by location
          const grouped = groupBookingsByLocation(bookings);
          setNearbyBookings(grouped);
          setError(null);
        },
        error => {
          console.error('Booking subscription error:', error);
          setError('Failed to subscribe to booking updates');
        }
      );
    } catch (error) {
      console.error('Error setting up bookings listener:', error);
      setError('Failed to set up bookings listener');
    }
  }, [currentLocation, groupBookingsByLocation, SEARCH_RADIUS_METERS, isDriverOnline]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setupBookingsListener();
    setRefreshing(false);
  }, [setupBookingsListener]);

  // Set up listener when screen is focused or location changes
  useFocusEffect(
    useCallback(() => {
      setupBookingsListener();
      
      return () => {
        if (bookingsListener.current) {
          bookingsListener.current();
          bookingsListener.current = null;
        }
      };
    }, [setupBookingsListener])
  );

  // Update listener when location changes or driver status changes
  useEffect(() => {
    setupBookingsListener();
  }, [currentLocation, setupBookingsListener, driver?.status]);

  const handleBookingPress = (locationGroup) => {
    navigation.navigate('BookingGroupDetails', { 
      locationGroup,
      currentLocation,
      title: locationGroup.locationName
    });
  };

  const renderBookingItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.bookingItem}
      onPress={() => handleBookingPress(item)}
    >
      <Text style={styles.locationName} numberOfLines={1}>
        {item.locationName}
      </Text>
      <Text style={styles.bookingCount}>
        {item.count}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBar title="Available Rides" />
      
      <View style={styles.container}>
        {!isDriverOnline ? (
          <View style={styles.emptyContainer}>
            <Icon name="offline-bolt" size={48} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyTitle}>You're Offline</Text>
            <Text style={styles.emptyMessage}>
              Go online from the Home screen to see available bookings.
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
          <View style={styles.emptyContainer}>
            <Image 
                  source={require('../../../assets/tricycle.png')} 
                  style={{ 
                    width: 24, 
                    height: 24, 
                    tintColor: COLORS.PRIMARY 
                  }} 
                  resizeMode="contain"
                />
            <Text style={styles.emptyTitle}>No Rides Available</Text>
            <Text style={styles.emptyMessage}>
              There are no bookings available nearby. Pull down to refresh.
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={handleRefresh}
            >
              <Text style={styles.emptyButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
  },
  bookingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 229, 229, 0.5)',
    backgroundColor: COLORS.WHITE,
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
  }
});
