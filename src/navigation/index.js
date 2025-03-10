import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen, OtpVerificationScreen } from '../screens/auth';
import { SCREENS, COLORS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { Loading } from '../components/common';
import { MainTabNavigator } from './MainTabNavigator';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { BookingGroupDetailsScreen } from '../screens/main/BookingGroupDetailsScreen';
import { BookingDetailsScreen } from '../screens/main/BookingDetailsScreen';
import { RequestSentScreen } from '../screens/main/RequestSentScreen';
import { TopUpWalletScreen, TopUpTicketScreen, TripHistoryScreen } from '../screens/main';
import { NotificationsScreen } from '../screens';
import { createNavigationContainerRef } from '@react-navigation/native';
import { CurrentRideScreen } from '../screens/main/CurrentRideScreen';

// Create stack navigators
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();
const RootStack = createStackNavigator();

export const navigationRef = createNavigationContainerRef();

/**
 * Authentication stack navigator
 * @returns {React.ReactElement} Auth stack navigator
 */
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.BLACK },
        presentation: 'card',
        animationEnabled: true,
      }}
    >
      <AuthStack.Screen name={SCREENS.LOGIN} component={LoginScreen} />
      <AuthStack.Screen 
        name={SCREENS.OTP_VERIFICATION} 
        component={OtpVerificationScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </AuthStack.Navigator>
  );
};

/**
 * Main app stack navigator (after authentication)
 * @returns {React.ReactElement} Main stack navigator
 */
const MainNavigator = () => {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.BACKGROUND },
      }}
    >
      <MainStack.Screen name={SCREENS.HOME} component={MainTabNavigator} />
      <MainStack.Screen 
        name={SCREENS.NOTIFICATIONS}
        component={NotificationsScreen}
        options={{
          headerShown: true,
          title: 'Notifications',
          headerStyle: {
            backgroundColor: COLORS.WHITE,
          },
          headerTintColor: COLORS.TEXT,
        }}
      />
      <MainStack.Screen 
        name={SCREENS.TOP_UP_WALLET}
        component={TopUpWalletScreen}
      />
      <MainStack.Screen 
        name={SCREENS.TOP_UP_TICKET}
        component={TopUpTicketScreen}
      />
      <MainStack.Screen 
        name={SCREENS.BOOKING_GROUP_DETAILS} 
        component={BookingGroupDetailsScreen}
      />
      <MainStack.Screen 
        name={SCREENS.BOOKING_DETAILS} 
        component={BookingDetailsScreen}
      />
      <MainStack.Screen
        name={SCREENS.REQUEST_SENT}
        component={RequestSentScreen}
      />
      <MainStack.Screen
        name={SCREENS.TRIP_HISTORY}
        component={TripHistoryScreen}
      />
      <MainStack.Screen
        name={SCREENS.CURRENT_RIDE}
        component={CurrentRideScreen}
        options={{
          gestureEnabled: false
        }}
      />
    </MainStack.Navigator>
  );
};

/**
 * Screen shown when user is authenticated but not registered on the web
 * @param {Object} props - Component props
 * @returns {React.ReactElement} WebRegistrationScreen component
 */
const WebRegistrationScreen = ({ navigation }) => {
  const { signOut, user } = useAuthStore();
  
  const handleOpenWebsite = () => {
    // Open the Tricykol registration website in the default browser
    // If we have the user's phone number, we can pass it as a query parameter
    const registrationUrl = 'https://tricykol-driver-register-h47mupgaza-as.a.run.app/register';
    const phoneNumber = user?.phoneNumber || '';
    const urlWithParams = phoneNumber ? 
      `${registrationUrl}?phone=${encodeURIComponent(phoneNumber)}` : 
      registrationUrl;
    
    Linking.openURL(urlWithParams)
      .catch(err => {
        console.error('Error opening registration website:', err);
        alert(`Could not open the registration website. Please visit ${registrationUrl} manually.`);
      });
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registration Required</Text>
      <Text style={styles.message}>
        You need to complete your driver registration on the Tricykol website before using this app.
      </Text>
      
      {user?.phoneNumber && (
        <View style={styles.phoneContainer}>
          <Text style={styles.phoneLabel}>Your phone number:</Text>
          <Text style={styles.phoneNumber}>{user.phoneNumber}</Text>
          <Text style={styles.phoneHint}>
            Use this number when registering on the website
          </Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.button} onPress={handleOpenWebsite}>
        <Text style={styles.buttonText}>REGISTER NOW</Text>
      </TouchableOpacity>
      
      <Text style={styles.infoText}>
        After completing registration on the website, sign out and sign in again to access the driver app.
      </Text>
      
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Root navigator that handles authentication state
 * @returns {React.ReactElement} Root navigator
 */
export const RootNavigator = () => {
  const { isAuthenticated, loading, needsWebRegistration } = useAuthStore();

  // Show loading screen while checking authentication
  if (loading) {
    return <Loading message="Loading..." />;
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
      }}
    >
      {isAuthenticated ? (
        needsWebRegistration ? (
          // User is authenticated but needs to register on the web
          <RootStack.Screen name={SCREENS.WEB_REGISTRATION} component={WebRegistrationScreen} />
        ) : (
          // User is authenticated and registered
          <RootStack.Screen name="MainApp" component={MainNavigator} />
        )
      ) : (
        // User is not authenticated
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
      <RootStack.Screen 
        name={SCREENS.BOOKING_GROUP_DETAILS}
        component={BookingGroupDetailsScreen}
        options={{
          presentation: 'card',
          cardStyle: { backgroundColor: 'white' },
        }}
      />
      <RootStack.Screen 
        name={SCREENS.BOOKING_DETAILS}
        component={BookingDetailsScreen}
        options={{
          presentation: 'modal',
          cardStyle: { backgroundColor: 'white' },
        }}
      />
      <RootStack.Screen 
        name={SCREENS.REQUEST_SENT}
        component={RequestSentScreen}
        options={{
          presentation: 'modal',
          cardStyle: { backgroundColor: 'white' },
          animationEnabled: true,
        }}
      />
    </RootStack.Navigator>
  );
};

// Styles for WebRegistrationScreen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BLACK,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.GRAY,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneContainer: {
    width: '100%',
    backgroundColor: COLORS.GRAY_DARK,
    borderRadius: 8,
    padding: 15,
    marginBottom: 30,
    alignItems: 'center',
  },
  phoneLabel: {
    fontSize: 14,
    color: COLORS.GRAY_LIGHT,
    marginBottom: 5,
  },
  phoneNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    marginBottom: 5,
  },
  phoneHint: {
    fontSize: 12,
    color: COLORS.GRAY_LIGHT,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  signOutButton: {
    marginTop: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.GRAY_DARK,
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  signOutText: {
    color: COLORS.GRAY,
    fontSize: 16,
  },
});
