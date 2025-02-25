import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen, OtpVerificationScreen } from '../screens/auth';
import { SCREENS, COLORS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { Loading } from '../components/common';
import { MainTabNavigator } from './MainTabNavigator';

// Create stack navigators
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();
const RootStack = createStackNavigator();

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
      }}
    >
      <AuthStack.Screen name={SCREENS.LOGIN} component={LoginScreen} />
      <AuthStack.Screen name={SCREENS.OTP_VERIFICATION} component={OtpVerificationScreen} />
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
    </MainStack.Navigator>
  );
};

/**
 * Root navigator that handles authentication state
 * @returns {React.ReactElement} Root navigator
 */
export const RootNavigator = () => {
  const { isAuthenticated, loading } = useAuthStore();

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
        <RootStack.Screen name="MainApp" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};
