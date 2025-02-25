import React, { useEffect, useState } from 'react';
import Mapbox from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from '@env';

// Initialize Mapbox
Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/index';
import { useAuthStore } from './src/store/authStore';
import { AuthService } from './src/services/auth';
import { getAuth, getFirebaseApp } from './src/services/firebase';
import { COLORS } from './src/constants';
import { Loading } from './src/components/common';

/**
 * Main application component
 * @returns {React.ReactElement} The App component
 */
export default function App() {
  const { setDriver, setError, setLoading, loading, error } = useAuthStore();
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
        setAppInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize app');
      }
    };

    initializeApp();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    if (!appInitialized) return;

    console.log('Setting up auth state listener');
    setLoading(true);
    
    // Subscribe to auth state changes
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

    // Cleanup subscription
    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
      setLoading(false);
    };
  }, [appInitialized]);

  // Show initialization error if any
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
        <RootNavigator />
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
