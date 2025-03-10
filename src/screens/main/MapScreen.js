import React, { useEffect, useRef, useState, useCallback } from 'react';
import { throttle } from 'lodash';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { AppBar } from '../../components/common';
import { COLORS } from '../../constants';
import useLocationStore from '../../store/locationStore';
import { useAuthStore } from '../../store/authStore';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import useMapStore from '../../store/mapStore';
import { locationService } from '../../services/locationService';

export const MapScreen = () => {
    const mapRef = useRef(null);
    const { currentLocation } = useLocationStore();
    const { driver } = useAuthStore();
    const [region, setRegion] = useState({
        latitude: 15.6661,  // Paniqui coordinates
        longitude: 120.5586,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    });
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [isBookingsVisible, setIsBookingsVisible] = useState(true);
    
    // Use map store with memoized cleanup to prevent function recreation
    const { 
        nearbyBookings,
        setupBookingsListener,
        cleanup: cleanupMapStore,
        setNearbyBookings
    } = useMapStore();

    // Memoize listener setup function to prevent unnecessary recreations
    const setupListener = useRef(null);
    
    // Optimize booking listener setup with better cleanup and dependencies
    useEffect(() => {
        let unsubscribe = null;
        let isMounted = true;

        const initializeBookings = async () => {
            // Don't set up listener if we're missing data or if bookings shouldn't be visible
            if (!currentLocation || !driver?.id || !isBookingsVisible) {
                if (isMounted) setNearbyBookings([]);
                return;
            }

            // Set up the bookings listener
            unsubscribe = setupBookingsListener(currentLocation, true);
        };

        initializeBookings();

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [currentLocation?.latitude, currentLocation?.longitude, driver?.id, isBookingsVisible]);

    // Update UI when visibility changes - with better cleanup
    useEffect(() => {
        if (!isBookingsVisible) {
            setNearbyBookings([]);
        }
    }, [isBookingsVisible]);

    // Optimized location fetching with priority order
    useEffect(() => {
        let isMounted = true;
        const fetchLocation = async () => {
            if (!driver?.id) {
                if (isMounted) setIsLocationLoading(false);
                return;
            }

            try {
                // 1. Try Expo Location first
                console.log('[MapScreen] Attempting to get current location via Expo');
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                        timeout: 10000
                    });
                    
                    if (location?.coords && isMounted) {
                        console.log('[MapScreen] Using Expo location');
                        const newLocation = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            timestamp: Date.now()
                        };
                        
                        await AsyncStorage.setItem('last_known_location', JSON.stringify(newLocation));
                        useLocationStore.setState({ currentLocation: newLocation });
                        setRegion({
                            ...newLocation,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02
                        });
                        setIsLocationLoading(false);
                        return;
                    }
                }
            } catch (expoError) {
                console.log('[MapScreen] Expo location failed:', expoError);
            }

            try {
                // 2. Fallback to AsyncStorage
                console.log('[MapScreen] Trying AsyncStorage fallback');
                const storedLocation = await AsyncStorage.getItem('last_known_location');
                if (storedLocation && isMounted) {
                    const parsedLocation = JSON.parse(storedLocation);
                    if (parsedLocation?.latitude && parsedLocation?.longitude) {
                        console.log('[MapScreen] Using AsyncStorage location');
                        useLocationStore.setState({ currentLocation: parsedLocation });
                        setRegion({
                            ...parsedLocation,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02
                        });
                        setIsLocationLoading(false);
                        return;
                    }
                }
            } catch (storageError) {
                console.log('[MapScreen] AsyncStorage fallback failed:', storageError);
            }

            try {
                // 3. Final fallback to Firestore
                console.log('[MapScreen] Trying Firestore fallback');
                const doc = await firestore()
                    .collection('drivers')
                    .doc(driver.id)
                    .get();

                if (doc.exists && isMounted) {
                    const firestoreLocation = doc.data()?.currentLocation;
                    if (firestoreLocation?.latitude && firestoreLocation?.longitude) {
                        console.log('[MapScreen] Using Firestore location');
                        const locationData = {
                            latitude: firestoreLocation.latitude,
                            longitude: firestoreLocation.longitude,
                            timestamp: Date.now()
                        };
                        
                        await AsyncStorage.setItem('last_known_location', JSON.stringify(locationData));
                        useLocationStore.setState({ currentLocation: locationData });
                        setRegion({
                            ...locationData,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02
                        });
                    }
                }
            } catch (firestoreError) {
                console.log('[MapScreen] Firestore fallback failed:', firestoreError);
            }

            if (isMounted) setIsLocationLoading(false);
        };

        fetchLocation();

        return () => {
            isMounted = false;
        };
    }, [driver?.id]); // Only trigger when driver ID changes

    // Memoize and debounce map animation to reduce lag
    const lastAnimationTime = useRef(0);
    const animationTimeoutRef = useRef(null);
    
    // Optimize map animation with debouncing to prevent rapid re-renders
    useEffect(() => {
        let isMounted = true;
        
        if (currentLocation?.latitude && currentLocation?.longitude && isMounted) {
            const now = Date.now();
            
            // Only animate if it's been at least 300ms since the last animation
            if (now - lastAnimationTime.current > 300) {
                // If map is ready, animate to the new location
                if (mapRef.current) {
                    // Clear any pending animation
                    if (animationTimeoutRef.current) {
                        clearTimeout(animationTimeoutRef.current);
                    }
                    
                    mapRef.current.animateToRegion({
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                    }, 1000); // Smooth animation over 1 second
                    
                    lastAnimationTime.current = now;
                }
                
                // Update region state to match current location but with a delay
                // to prevent re-rendering during animation
                animationTimeoutRef.current = setTimeout(() => {
                    if (isMounted) {
                        setRegion({
                            latitude: currentLocation.latitude,
                            longitude: currentLocation.longitude,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.02,
                        });
                    }
                    animationTimeoutRef.current = null;
                }, 1000);
            }
        }
        
        return () => {
            isMounted = false;
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
                animationTimeoutRef.current = null;
            }
        };
    }, [currentLocation?.latitude, currentLocation?.longitude]);

    // Keep the timeout to prevent showing loading indefinitely
    useEffect(() => {
        let timeoutId;
        let isMounted = true;

        if (isLocationLoading && isMounted) {
            timeoutId = setTimeout(() => {
                if (isLocationLoading && isMounted) {
                    console.log('[MapScreen] Location loading timeout reached');
                    setIsLocationLoading(false);
                }
            }, 10000); // 10 second timeout
        }
        
        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isLocationLoading]);

    // Memoize handler functions to prevent unnecessary re-renders
    const handleMapReady = useRef(() => {
        if (mapRef.current && currentLocation) {
            mapRef.current.animateToRegion({
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            });
        }
    }).current;

    // Optimized center location handler with throttling and cleanup
    const handleCenterLocation = useCallback(async () => {
      try {
        if (isLocationLoading) return; // Prevent multiple simultaneous requests
        
        setIsLocationLoading(true);
        console.log('[MapScreen] Manual location refresh initiated');
        
        // Get fresh location with priority: GPS → Storage → Firestore
        const latestLocation = await locationService.getLastKnownLocation();
        
        if (!latestLocation) {
          console.log('[MapScreen] No location available for centering');
          setIsLocationLoading(false);
          return;
        }

        // Optimized update sequence
        if (mapRef.current) {
          // Direct map animation without state updates
          mapRef.current.animateToRegion({
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 350);
        }

        // Debounced storage update
        const updateStorage = throttle(async (location) => {
          await AsyncStorage.setItem('last_known_location', JSON.stringify(location));
          useLocationStore.setState({ currentLocation: location });
        }, 1000);

        updateStorage({
          ...latestLocation,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('[MapScreen] Location centering error:', error);
      } finally {
        // Ensure loading state clears even if component unmounts
        requestAnimationFrame(() => setIsLocationLoading(false));
      }
    }, [isLocationLoading]); // Only dependency is loading state
    
    // Cleanup all listeners, timers and throttled operations
    useEffect(() => {
        return () => {
            cleanupMapStore();
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
            // Cancel any pending storage updates
            updateStorage?.cancel();
        };
    }, []);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
            <AppBar />
            <View style={styles.container}>
                {/* Custom My Location Button */}
                <View style={styles.myLocationButtonContainer}>
                    <TouchableOpacity 
                        style={styles.myLocationButton}
                        onPress={handleCenterLocation}
                        activeOpacity={0.7} // Add visual feedback
                    >
                        <MaterialIcons 
                            name="my-location" 
                            size={24} 
                            color={isLocationLoading ? COLORS.GRAY : COLORS.PRIMARY} 
                        />
                    </TouchableOpacity>
                </View>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={region}
                    region={region}
                    onMapReady={handleMapReady}
                    showsUserLocation={false}
                    showsMyLocationButton={true}
                    showsCompass={true}
                    loadingEnabled={true}
                    minZoomLevel={12}
                    maxZoomLevel={20}
                    scrollEnabled={true}
                    rotateEnabled={false}
                    zoomEnabled={true}
                    pitchEnabled={false}
                    mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                    {currentLocation && (
                        <Marker
                            coordinate={{
                                latitude: currentLocation.latitude,
                                longitude: currentLocation.longitude
                            }}
                            title="You"
                            description={driver?.plateNumber || ""}
                            tracksViewChanges={true}
                            tracksInfoWindowChanges={true}
                            showCallout={true}
                        >
                            <MaterialIcons 
                                name="location-history" 
                                size={38} 
                                color={isBookingsVisible ? COLORS.SUCCESS : COLORS.GRAY}
                            />
                        </Marker>
                    )}
                    
                    {/* Nearby booking markers */}
                    {nearbyBookings.map(booking => (
                        <Marker
                            key={booking.id}
                            coordinate={booking.pickupLocation.coordinates}
                            title={`Pickup: ${booking.passengerName || 'Passenger'}`}
                            description={`${Math.round(booking.distance)} meters away${booking.pickupLocation.address ? ` • ${booking.pickupLocation.address.substring(0, 30)}${booking.pickupLocation.address.length > 30 ? '...' : ''}` : ''}`}
                            tracksViewChanges={true}
                            tracksInfoWindowChanges={true}
                            showCallout={false}
                        >
                            <MaterialIcons 
                                name="location-history" 
                                size={30} 
                                color={COLORS.PRIMARY}
                            />
                        </Marker>
                    ))}
                </MapView>
                
                {/* Add loading overlay */}
                {isLocationLoading && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                        </View>
                    </View>
                )}
  
            </View>
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
        backgroundColor: COLORS.GRAY,
        marginTop: 0, // Ensure map starts below AppBar
    },
    // Add loading overlay styles
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: COLORS.TEXT_PRIMARY,
    },
    // Custom My Location button styles
    myLocationButtonContainer: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        zIndex: 999, // Ensure it's above the map
    },
    myLocationButton: {
        backgroundColor: COLORS.WHITE,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    statusIndicator: {
        position: 'absolute',
        right: 16,
        top: 24,
        zIndex: 999,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        color: COLORS.TEXT_PRIMARY,
    },
});
