import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SCREENS } from "../../constants";
import { AppBar } from "../../components/common";
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from "../../store/authStore";
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MenuScreen = () => {
  const navigation = useNavigation();
  const { signOut, driver } = useAuthStore();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBookingsVisible, setIsBookingsVisible] = useState(true);
  
  // Local state to prevent global store updates from causing re-renders
  const [localProfileData, setLocalProfileData] = useState(null);
  // Use ref to store the firestore listener
  const listenerRef = useRef(null);
  // Use ref to track mount state
  const isMountedRef = useRef(true);

  // Initialize local state once on mount
  useEffect(() => {
    // Set initial data from driver prop
    if (driver && !localProfileData) {
      setLocalProfileData(driver);
      setIsLoading(false); // Initial driver data is available
    } else {
      setIsLoading(true); // Need to load data
    }
    
    // Mark component as mounted
    isMountedRef.current = true;
    
    // Clean up on unmount
    return () => {
      isMountedRef.current = false;
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, []);

  // Setup Firestore listener separate from state initialization
  useEffect(() => {
    // Only proceed if we have a driver ID
    if (!driver?.id) {
      console.log('[MenuScreen] No driver ID available');
      return;
    }
    
    // Clean up previous listener if exists
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }
    
    console.log('[MenuScreen] Setting up driver profile listener');
    setIsLoading(true); // Start loading
    
    // Setup new listener with error handling and retry logic
    const setupListener = () => {
      try {
        listenerRef.current = firestore()
          .collection('drivers')
          .doc(driver.id)
          .onSnapshot(
            (doc) => {
              // Only update if the component is still mounted
              if (!isMountedRef.current) {
                console.log('[MenuScreen] Skipping update - component unmounted');
                return;
              }
              
              if (doc.exists) {
                const updatedData = doc.data();
                console.log('[MenuScreen] Received profile update:', {
                  status: updatedData.status,
                  fullName: updatedData.fullName
                });
                
                // Always update local state for status changes
                setLocalProfileData((prev) => {
                  if (!prev || prev.status !== updatedData.status) {
                    console.log('[MenuScreen] Status changed, updating state');
                    return {
                      ...prev,
                      ...updatedData,
                      id: driver.id
                    };
                  }
                  
                  // For other changes, do deep comparison
                  const hasOtherChanges = 
                    prev.fullName !== updatedData.fullName ||
                    prev.phoneNumber !== updatedData.phoneNumber ||
                    prev.profilePicture?.url !== updatedData.profilePicture?.url;
                  
                  if (hasOtherChanges) {
                    console.log('[MenuScreen] Profile data changed, updating state');
                    return {
                      ...updatedData,
                      id: driver.id
                    };
                  }
                  
                  return prev;
                });
              } else {
                console.log('[MenuScreen] Driver document does not exist');
              }
              
              setIsLoading(false);
            },
            (error) => {
              console.error('[MenuScreen] Error in profile listener:', error);
              setIsLoading(false);
              
              // Cleanup and retry once after error
              if (listenerRef.current) {
                listenerRef.current();
                listenerRef.current = null;
                // Retry setup once after a short delay
                setTimeout(setupListener, 1000);
              }
            }
          );
      } catch (error) {
        console.error('[MenuScreen] Error setting up profile listener:', error);
        setIsLoading(false);
      }
    };
    
    // Initial setup
    setupListener();
    
    // Cleanup on effect cleanup
    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [driver?.id]); // Only re-run if driver ID changes

  // Load initial visibility state from AsyncStorage
  useEffect(() => {
    const loadVisibilityState = async () => {
      try {
        const storedVisibility = await AsyncStorage.getItem('bookings_visible');
        if (storedVisibility !== null) {
          setIsBookingsVisible(JSON.parse(storedVisibility));
        }
      } catch (error) {
        console.error('[MenuScreen] Error loading visibility state:', error);
      }
    };
    loadVisibilityState();

    // Listen for visibility changes
    const visibilityListener = async () => {
      try {
        const storedVisibility = await AsyncStorage.getItem('bookings_visible');
        if (storedVisibility !== null) {
          setIsBookingsVisible(JSON.parse(storedVisibility));
        }
      } catch (error) {
        console.error('[MenuScreen] Error in visibility listener:', error);
      }
    };

    // Set up interval to check visibility
    const intervalId = setInterval(visibilityListener, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Remove the auth store sync effect since we're only managing visibility
  useEffect(() => {
    if (driver?.status !== localProfileData?.status && localProfileData?.status) {
      console.log('[MenuScreen] Profile data updated:', localProfileData.status);
      setLocalProfileData(prev => ({
        ...prev,
        status: localProfileData.status
      }));
    }
  }, [localProfileData?.status, driver?.status]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (!driver?.id) {
      console.log('[MenuScreen] No driver ID available for refresh');
      return;
    }

    setRefreshing(true);
    console.log('[MenuScreen] Pull to refresh triggered');

    try {
      // Fetch the latest driver data
      const driverDoc = await firestore()
        .collection('drivers')
        .doc(driver.id)
        .get();

      if (driverDoc.exists && isMountedRef.current) {
        const updatedData = driverDoc.data();
        console.log('[MenuScreen] Refresh received updated profile data');
        
        setLocalProfileData({
          ...updatedData,
          id: driver.id
        });
      } else {
        console.log('[MenuScreen] Driver document not found during refresh');
      }
    } catch (error) {
      console.error('[MenuScreen] Error refreshing profile data:', error);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [driver?.id]);

  // Handler functions remain unchanged
  const handleViewProfile = () => {
    alert('Profile view functionality will be implemented soon');
  };

  const handleAbout = () => {
    alert('About page will be implemented soon');
  };

  const handleTripHistory = () => {
    navigation.navigate('TripHistory');
  };

  const handleSignOut = async () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    try {
      setShowSignOutModal(false); // Close modal first
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Use local state for rendering, falling back to props
  const displayData = {
    ...driver,
    isBookingsVisible
  };
  
  // Profile Image component - moved state out
  const ProfileImage = useCallback(() => {
    if (!displayData?.profilePicture?.url || imageError) {
      return (
        <Text style={styles.profileInitials}>
          {displayData?.firstName?.charAt(0) || ''}
          {displayData?.lastName?.charAt(0) || ''}
        </Text>
      );
    }

    return (
      <>
        <Image 
          source={{ uri: displayData.profilePicture.url }} 
          style={styles.profileImage}
          onLoadStart={() => setImageLoading(true)}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
        {imageLoading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={COLORS.PRIMARY} />
          </View>
        )}
      </>
    );
  }, [displayData, imageError, imageLoading]);

  // MenuItem component definition unchanged
  const MenuItem = ({ icon, title, onPress, isLast = false, color = COLORS.PRIMARY }) => (
    <TouchableOpacity 
      style={[styles.menuItem, isLast && styles.lastMenuItem]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.menuText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.GRAY} style={styles.chevron} />
    </TouchableOpacity>
  );

  // SignOut Modal unchanged
  const SignOutModal = () => (
    <Modal
      visible={showSignOutModal}
      transparent={true}
      animationType="none"
      onRequestClose={() => setShowSignOutModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="log-out-outline" size={26} color={COLORS.ERROR} />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
          </View>
          
          <Text style={styles.modalMessage}>
            Are you sure you want to sign out from your account?
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setShowSignOutModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]} 
              onPress={confirmSignOut}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView edges={['top','left', 'right']} style={styles.safeArea}>
      <AppBar title="Menu" />
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.PRIMARY]}
            tintColor={COLORS.PRIMARY}
          />
        }
      >
        <View style={styles.profileSection}>
          <View style={styles.profilePicContainer}>
            <ProfileImage />
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{displayData?.fullName || 'Driver'}</Text>
            <Text style={styles.profilePhone}>{displayData?.phoneNumber || ''}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, {backgroundColor: displayData?.isBookingsVisible ? COLORS.SUCCESS : COLORS.ERROR}]} />
              <Text style={styles.statusText}>{displayData?.isBookingsVisible ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuSection}>
          <MenuItem 
            icon="person-outline" 
            title="View Profile" 
            onPress={handleViewProfile} 
          />
          <MenuItem 
            icon="information-circle-outline" 
            title="About Tricykol" 
            onPress={handleAbout} 
            color={COLORS.SECONDARY}
          />
           <MenuItem 
            icon="time-outline" 
            title="Trip History" 
            onPress={handleTripHistory} 
            color={COLORS.SECONDARY}
          />
        </View>
        
        <Text style={styles.sectionTitle}>Other</Text>
        <View style={styles.menuSection}>
          <MenuItem 
            icon="log-out-outline" 
            title="Sign Out" 
            onPress={handleSignOut}
            isLast={true}
            color={COLORS.ERROR}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
      
      {/* Add the loading overlay with transparent background */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          </View>
        </View>
      )}
      
      {/* Render the sign out confirmation modal */}
      <SignOutModal />
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
  profileSection: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    marginBottom: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePicContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: `${COLORS.PRIMARY}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  profileDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginHorizontal: 20,
    marginBottom: 8,
    marginTop: 8,
  },
  menuSection: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BACKGROUND,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  modalIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${COLORS.ERROR}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  modalMessage: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BACKGROUND,
  },
  confirmButton: {
    backgroundColor: COLORS.ERROR,
  },
  cancelButtonText: {
    color: COLORS.TEXT,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: COLORS.WHITE,
    fontWeight: '600',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    resizeMode: 'cover',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'transparent',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
