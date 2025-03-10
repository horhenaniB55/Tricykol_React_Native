import React, { useEffect, useRef, useState } from 'react';
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

    // Optimize location tracking
    useEffect(() => {
        let locationUnsubscribe = null;
        let isMounted = true;
        
        const setupLocationTracking = async () => {
            if (!driver?.id) {
                console.log('[MapScreen] No driver ID available');
                if (isMounted) setIsLocationLoading(false);
                return;
            }
            
            // Don't set loading to true if we already have a location
            if (!currentLocation && isMounted) {
                setIsLocationLoading(true);
            }
            
            try {
                // First try to get location from AsyncStorage
                const storedLocationString = await AsyncStorage.getItem('last_known_location');
                if (storedLocationString && isMounted) {
                    try {
                        const storedLocation = JSON.parse(storedLocationString);
                        if (storedLocation && storedLocation.latitude && storedLocation.longitude) {
                            console.log('[MapScreen] Using location from AsyncStorage');
                            // Update the location store
                            useLocationStore.setState({ currentLocation: storedLocation });
                            // Update the map region
                            setRegion({
                                ...storedLocation,
                                latitudeDelta: 0.02,
                                longitudeDelta: 0.02,
                            });
                            setIsLocationLoading(false);
                        }
                    } catch (error) {
                        console.error('[MapScreen] Error parsing stored location:', error);
                    }
                }

                // Set up Firestore listener for location updates (with performance optimizations)
                locationUnsubscribe = firestore()
                    .collection('drivers')
                    .doc(driver.id)
                    .onSnapshot(
                        async (docSnapshot) => {
                            if (!isMounted) return;
                            
                            if (docSnapshot.exists) {
                                const driverData = docSnapshot.data();
                                if (driverData.currentLocation && 
                                    driverData.currentLocation.latitude && 
                                    driverData.currentLocation.longitude) {
                                    
                                    const firestoreLocation = {
                                        latitude: driverData.currentLocation.latitude,
                                        longitude: driverData.currentLocation.longitude,
                                        timestamp: driverData.currentLocation.updatedAt?.toDate()?.getTime() || Date.now()
                                    };

                                    // Only update if we don't have a more recent location in AsyncStorage
                                    const storedLocationString = await AsyncStorage.getItem('last_known_location');
                                    if (storedLocationString) {
                                        const storedLocation = JSON.parse(storedLocationString);
                                        if (storedLocation && storedLocation.timestamp && 
                                            storedLocation.timestamp > firestoreLocation.timestamp) {
                                            console.log('[MapScreen] AsyncStorage location is more recent');
                                            return;
                                        }
                                    }
                                    
                                    console.log('[MapScreen] Using location from Firestore');
                                    // Update AsyncStorage with Firestore location
                                    await AsyncStorage.setItem('last_known_location', JSON.stringify(firestoreLocation));
                                    // Update the location store
                                    useLocationStore.setState({ currentLocation: firestoreLocation });
                                    // Update the map region - moved to separate useEffect for better performance
                                }
                            }
                            if (isMounted) setIsLocationLoading(false);
                        },
                        (error) => {
                            console.error('[MapScreen] Error in Firestore location listener:', error);
                            if (isMounted) setIsLocationLoading(false);
                        }
                    );
            } catch (error) {
                console.error('[MapScreen] Error setting up location tracking:', error);
                if (isMounted) setIsLocationLoading(false);
            }
        };
        
        setupLocationTracking();
        
        // Clean up listener and mounted flag when component unmounts
        return () => {
            isMounted = false;
            if (locationUnsubscribe) {
                console.log('[MapScreen] Cleaning up Firestore location listener');
                locationUnsubscribe();
            }
        };
    }, [driver?.id]); // Only re-run if driver ID changes

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

    // Memoize center location handler
    const handleCenterLocation = useRef(() => {
        if (mapRef.current && currentLocation) {
            mapRef.current.animateToRegion({
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            });
        }
    }).current;
    
    // Cleanup all listeners and timers on component unmount
    useEffect(() => {
        return () => {
            cleanupMapStore();
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
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
                    >
                        <MaterialIcons name="my-location" size={24} color={COLORS.PRIMARY} />
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
