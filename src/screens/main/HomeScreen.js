import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, DRIVER_STATUS } from '../../constants';
import { MapView } from '../../components/map';
import { Loading } from '../../components/common';
import { useAuthStore } from '../../store/authStore';
import { getAuth } from '../../services/firebase';

/**
 * Home screen component with map
 * 
 * @param {Object} props - Component props
 * @param {Object} props.navigation - Navigation object
 * @returns {React.ReactElement} HomeScreen component
 */
export const HomeScreen = ({ navigation }) => {
  const { driver } = useAuthStore();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nearbyBookings, setNearbyBookings] = useState([]);
  
  // Toggle driver online/offline status
  const toggleOnlineStatus = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, you would update the driver's status in Firestore
      // For now, we'll just toggle the local state
      setIsOnline(!isOnline);
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await getAuth().signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <Text style={styles.greeting}>Hello, {driver?.name || 'Driver'}</Text>
            <TouchableOpacity onPress={handleSignOut}>
              <Text style={styles.signOut}>Sign Out</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statusSection}>
            <Text style={styles.statusLabel}>
              {isOnline ? 'You are online' : 'You are offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: COLORS.GRAY, true: COLORS.PRIMARY }}
              thumbColor={COLORS.WHITE}
            />
          </View>
        </View>
        
        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView />
        </View>
        
        {/* Bottom panel */}
        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>
            {isOnline 
              ? nearbyBookings.length > 0 
                ? 'Nearby Bookings' 
                : 'No nearby bookings found'
              : 'Go online to see nearby bookings'}
          </Text>
          
          {/* This would be a list of nearby bookings in a real app */}
          {isOnline && nearbyBookings.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No bookings found within 700m radius
              </Text>
            </View>
          )}
        </View>
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
  header: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  signOut: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
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
});
