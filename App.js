import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import useLocationStore from './src/store/locationStore';
import { AuthService } from './src/services/auth';
import { getAuth, getFirebaseApp } from './src/services/firebase';
import { COLORS } from './src/constants';
import { Loading, LocationErrorModal } from './src/components/common';
import { serviceManager } from './src/services/serviceManager';

// Silence Firebase deprecation warnings
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

/**
 * Main application component
 * @returns {React.ReactElement} The App component
 */
export default function App() {
  const { initialize, isAuthenticated, needsWebRegistration, initialized, driver } = useAuthStore();
  const { 
    locationError,
    clearLocationError,
    cleanup: cleanupLocation
  } = useLocationStore();
  const [appInitialized, setAppInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const appState = useRef(AppState.currentState);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize auth first
        await initialize();
        
        // Initialize service manager with a small delay to ensure store is ready
        setTimeout(async () => {
          try {
            await serviceManager.initialize();
            console.log('Service manager initialized successfully');
          } catch (error) {
            console.error('Error initializing service manager:', error);
          }
        }, 500);
        
        setAppInitialized(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setInitError(error.message);
      }
    };

    initApp();

    // Cleanup on unmount
    return () => {
      cleanupLocation();
      serviceManager.cleanup();
    };
  }, []);

  // Initialize bookings service when driver is authenticated
  useEffect(() => {
    if (isAuthenticated && driver && driver.id && initialized && appInitialized) {
      console.log('Initializing bookings service for driver:', driver.id);
      try {
        // Initialize bookings service and handle the promise
        serviceManager.initializeBookingsService(driver.id)
          .catch(error => {
            console.error('Error initializing bookings service:', error);
          });
      } catch (error) {
        console.error('Error initializing bookings service:', error);
      }
    }
  }, [isAuthenticated, driver, initialized, appInitialized]);

  // Add AppState listener to detect when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Check if app has come to the foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground');
        // Check location status when app is brought to foreground
        if (isAuthenticated && !needsWebRegistration) {
          console.log('Checking location status after app foregrounded');
          setTimeout(() => {
            serviceManager.checkLocationStatus()
              .catch(err => console.error('Error checking location status:', err));
          }, 500);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, needsWebRegistration]);

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Initialization Error</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
      </View>
    );
  }

  // Show loading screen while initializing
  if (!appInitialized || !initialized) {
    return <Loading message="" />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
        <LocationErrorModal />
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
