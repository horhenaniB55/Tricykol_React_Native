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
import { useNavigation } from '@react-navigation/native';
import { firestore } from '../../services/firebase';

/**
 * Home screen component with map
 * 
 * @param {Object} props - Component props
 * @param {Object} props.navigation - Navigation object
 * @returns {React.ReactElement} HomeScreen component
 */
export const HomeScreen = () => {
  const navigation = useNavigation();
  const { driver } = useAuthStore();
  const { locationServicesEnabled } = useLocationStore();
  const [isBookingsVisible, setIsBookingsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalEarnings: 0,
    rating: 0
  });

  // Update stats when driver data changes
  useEffect(() => {
    if (!driver?.id) return;
    
    const fetchStats = async () => {
      try {
        const statsDoc = await firestore()
          .collection('driver_stats')
          .doc(driver.id)
          .get();
          
        if (statsDoc.exists) {
          setStats(statsDoc.data());
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    
    fetchStats();
  }, [driver?.id]);

  // Handle location service changes
  useEffect(() => {
    if (!locationServicesEnabled) {
      setIsBookingsVisible(false);
    }
  }, [locationServicesEnabled]);

  // Handle toggle
  const handleToggle = async () => {
    try {
      setIsLoading(true);
      setIsBookingsVisible(!isBookingsVisible);
    } catch (error) {
      console.error('Error toggling visibility:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBar 
        title="Home"
        subtitle={isBookingsVisible ? 'Bookings Visible' : 'Bookings Hidden'}
      />
      <View style={styles.content}>
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Show Available Bookings</Text>
          <Switch
            value={isBookingsVisible}
            onValueChange={handleToggle}
            disabled={isLoading}
            trackColor={{ false: COLORS.GRAY_LIGHT, true: COLORS.SUCCESS }}
            thumbColor={COLORS.WHITE}
          />
        </View>

        {isBookingsVisible && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₱{stats.totalEarnings.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        )}

        {isBookingsVisible && (
          <View style={styles.mapPreviewContainer}>
            <Text style={styles.mapPreviewTitle}>Current Location</Text>
            <TouchableOpacity 
              style={styles.mapPreview}
              onPress={() => navigation.navigate('Map')}
            >
              {/* Map preview content */}
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginRight: 16,
  },
  statsContainer: {
    padding: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  mapPreviewContainer: {
    padding: 16,
  },
  mapPreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  mapPreview: {
    backgroundColor: COLORS.WHITE,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
  },
});
