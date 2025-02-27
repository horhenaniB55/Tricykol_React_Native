import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { MainStack } from './src/navigation/MainStack';
import { useAuthStore } from './src/store/authStore';
import useLocationStore from './src/store/locationStore';
import { AuthService } from './src/services/auth';
import { getAuth, getFirebaseApp } from './src/services/firebase';
import { COLORS } from './src/constants';
import { Loading, LocationErrorModal } from './src/components/common';

/**
 * Main application component
 * @returns {React.ReactElement} The App component
 */
export default function App() {
  const { setDriver, setError, setLoading } = useAuthStore();
  const {
    checkLocationStatus,
    showLocationErrorModal,
    locationErrorType,
    clearLocationError,
    setLocationError, // Add this
    startWatchingLocationAvailability,
    stopWatchingLocationAvailability,
  } = useLocationStore();
  const [appInitialized, setAppInitialized] = useState(false);
  const [initError, setInitError] = useState(null);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app...');
        // Get Firebase app to ensure it's initialized
        const app = getFirebaseApp();
        console.log('Firebase app initialized:', app.name);

        // Check location permissions and services *before* watching
        const initialStatus = await checkLocationStatus();

        // If location is not enabled on startup, show the modal
        if (initialStatus && (initialStatus.foreground !== 'granted' || initialStatus.services !== 'enabled')) {
          // Use the existing actions to set the error state and show the modal
          const errorType = initialStatus.foreground !== 'granted' ? 'permission' : 'services';
          setLocationError(errorType); // This will set showLocationErrorModal to true
        }

      // Start watching location availability for real-time updates
      startWatchingLocationAvailability();

      // Removed the conditional call to startLocationTracking here.
      // The startLocationTracking function in locationStore already
      // handles getting the initial location.

      setAppInitialized(true);
    } catch (error) {
        console.error('Error initializing app:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize app');
      }
    };
  
      initializeApp();

      // Cleanup function
      return () => {
        stopWatchingLocationAvailability();
      }
    }, []);

      // Subscribe to auth state changes
    useEffect(() => {
      if (!appInitialized) return;
  
      console.log('Setting up auth state listener');
      setLoading(true);
      const unsubscribe = getAuth().onAuthStateChanged(async (user) => {
        try {
          if (user) {
            console.log('Auth state changed - User signed in:', user.uid);
            const driverProfile = await AuthService.getDriverProfile(user.uid);
            if (!driverProfile) {
              console.log('No driver profile found for:', user.uid);
              setError('Phone number not yet registered');
              await getAuth().signOut();
            } else {
              console.log('Driver profile loaded:', driverProfile.name);
              setDriver(driverProfile);
            }
          } else {
            console.log('Auth state changed - User signed out');
            setDriver(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          setError(error instanceof Error ? error.message : 'Unknown error occurred');
          if (user) {
            try {
              await getAuth().signOut();
            } catch (signOutError) {
              console.error('Error signing out after auth error:', signOutError);
            }
          }
        } finally {
          setLoading(false);
        }
      });
  
      return () => {
        console.log('Cleaning up auth state listener');
        unsubscribe();
        setLoading(false);
      };
    }, [appInitialized]);

  // Make sure there's no automatic clearing of the modal
  useEffect(() => {
    if (showLocationErrorModal) {
      console.log('Modal is visible in App.js');
    }
  }, [showLocationErrorModal]);

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
      </View>
    );
  }

  // Show loading screen while initializing
  if (!appInitialized) {
    return <Loading message="Initializing app..." />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainStack />
        <LocationErrorModal 
          isVisible={showLocationErrorModal}
          type={locationErrorType}
          onClose={clearLocationError}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.BACKGROUND,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.ERROR,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.TEXT,
    textAlign: 'center',
  },
});
