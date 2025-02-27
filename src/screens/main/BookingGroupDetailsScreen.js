import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../../constants';
import { AppBar } from '../../components/common';

export const BookingGroupDetailsScreen = ({ route, navigation }) => {
  const { locationGroup, currentLocation, title } = route.params;

  const renderBookingCard = (booking) => (
    <View style={styles.bookingCard}>
      <View style={styles.leftAccent} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.serviceName}>Tricykol</Text>
          <Text style={styles.farePrice}>₱{booking.estimatedFare}</Text>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <View style={styles.iconColumn}>
              <Icon name="radio-button-checked" size={20} color="#4CAF50" />
              <View style={styles.verticalLine} />
              <Icon name="location-on" size={20} color="#2196F3" />
            </View>
            <View style={styles.locationsContent}>
              <View style={styles.locationItem}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {booking.pickupLocation?.name || 'Pickup location'}
                </Text>
              </View>
              <View style={styles.locationItem}>
                <Text style={styles.locationText} numberOfLines={1}>
                  {booking.dropoffLocation?.name || 'Drop off location'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBar 
        title={title || "Booking Details"}
        showBack
        onBack={() => navigation.goBack()}
        leftIcon="arrow-back"
      />
      <ScrollView style={styles.container}>
        {locationGroup.bookings.map((booking, index) => (
          <TouchableOpacity 
            key={booking.id || index}
            onPress={() => {
              // Handle booking selection
              // You can add additional navigation or actions here
            }}
          >
            {renderBookingCard(booking)}
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 14,
    color: '#757575',
    flex: 1,
  },
  farePrice: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
    marginLeft: 8,
  },
  locationContainer: {
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
  },
  iconColumn: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  verticalLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginVertical: 2,
  },
  locationsContent: {
    flex: 1,
    gap: 6,
  },
  locationItem: {
    justifyContent: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#212121',
  },
}); 