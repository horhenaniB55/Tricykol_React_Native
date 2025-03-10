import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '../../components/common';
import { COLORS } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import firestore from '@react-native-firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

export const TripHistoryScreen = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { driver } = useAuthStore();

  const fetchTrips = async () => {
    try {
      const tripsSnapshot = await firestore()
        .collection('trips')
        .where('driverId', '==', driver.id)
        .orderBy('dropoffTime', 'desc')
        .limit(50)
        .get();

      const tripsData = tripsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTrips(tripsData);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const formatCurrency = (amount) => {
    return `₱${amount.toFixed(2)}`;
  };

  const renderTripItem = ({ item }) => {
    // Calculate driver's earning (fare - systemFee)
    const driverEarning = item.fareAmount - item.systemFee;
    
    return (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>{formatDate(item.dropoffTime)}</Text>
        <Text style={styles.tripAmount}>{formatCurrency(item.fareAmount)}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupLocation?.address || 'Unknown pickup location'}
          </Text>
        </View>
        <View style={styles.locationDivider} />
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={20} color={COLORS.ERROR} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.dropoffLocation?.address || 'Unknown dropoff location'}
          </Text>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{(item.distance / 1000).toFixed(2)} km</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Your Earnings</Text>
          <Text style={[styles.detailValue, styles.earningValue]}>{formatCurrency(driverEarning)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Passenger</Text>
          <Text style={styles.detailValue}>{item.passengerName}</Text>
        </View>
      </View>
    </View>
  )};

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <AppBar title="Trip History" 
        showBack
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <AppBar title="Trip History"
      showBack
      />
      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history" size={48} color={COLORS.GRAY} />
            <Text style={styles.emptyText}>No trips found</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  tripAmount: {
    fontSize: 16,
    color: COLORS.SUCCESS,
    fontWeight: '600',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  locationText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.TEXT,
  },
  locationDivider: {
    height: 16,
    width: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginLeft: 10,
  },
  tripDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  earningValue: {
    color: COLORS.SUCCESS,
    fontWeight: '600',
  },
}); 