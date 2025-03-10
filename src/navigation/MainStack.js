import React, { Suspense } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainTabNavigator } from './MainTabNavigator';
import { SCREENS } from '../constants';
import { COLORS } from '../constants';
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();

// Loading component for lazy loaded screens
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND }}>
    <ActivityIndicator size="large" color={COLORS.PRIMARY} />
  </View>
);

// Lazy load screen components
const BookingDetailsScreenLazy = React.lazy(() => 
  import('../screens/main/BookingDetailsScreen').then(module => ({ default: module.BookingDetailsScreen }))
);
const BookingGroupDetailsScreenLazy = React.lazy(() => 
  import('../screens/main/BookingGroupDetailsScreen').then(module => ({ default: module.BookingGroupDetailsScreen }))
);
const RequestSentScreenLazy = React.lazy(() => 
  import('../screens/main/RequestSentScreen').then(module => ({ default: module.RequestSentScreen }))
);
const TopUpWalletScreenLazy = React.lazy(() => 
  import('../screens/main/TopUpWalletScreen').then(module => ({ default: module.TopUpWalletScreen }))
);
const TopUpTicketScreenLazy = React.lazy(() => 
  import('../screens/main/TopUpTicketScreen').then(module => ({ default: module.TopUpTicketScreen }))
);
const NotificationsScreenLazy = React.lazy(() => 
  import('../screens').then(module => ({ default: module.NotificationsScreen }))
);
const TripHistoryScreenLazy = React.lazy(() => 
  import('../screens/main').then(module => ({ default: module.TripHistoryScreen }))
);

// Create wrapper components for each screen
const BookingDetailsScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <BookingDetailsScreenLazy {...props} />
  </Suspense>
);

const BookingGroupDetailsScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <BookingGroupDetailsScreenLazy {...props} />
  </Suspense>
);

const RequestSentScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <RequestSentScreenLazy {...props} />
  </Suspense>
);

const TopUpWalletScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <TopUpWalletScreenLazy {...props} />
  </Suspense>
);

const TopUpTicketScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <TopUpTicketScreenLazy {...props} />
  </Suspense>
);

const NotificationsScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <NotificationsScreenLazy {...props} />
  </Suspense>
);

const TripHistoryScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <TripHistoryScreenLazy {...props} />
  </Suspense>
);

export const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.WHITE },
        lazy: true
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Notifications"
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
      <Stack.Screen 
        name="TopUpWallet"
        component={TopUpWalletScreen}
        key="topUpWallet"
      />
      <Stack.Screen 
        name="TopUpTicket"
        component={TopUpTicketScreen}
      />
      <Stack.Screen 
        name={SCREENS.BOOKING_GROUP_DETAILS} 
        component={BookingGroupDetailsScreen}
      />
      <Stack.Screen 
        name={SCREENS.BOOKING_DETAILS} 
        component={BookingDetailsScreen}
      />
      <Stack.Screen
        name={SCREENS.REQUEST_SENT}
        component={RequestSentScreen}
      />
      <Stack.Screen
        name={SCREENS.TRIP_HISTORY}
        component={TripHistoryScreen}
        options={{
          headerShown: false
        }}
      />
    </Stack.Navigator>
  );
}; 