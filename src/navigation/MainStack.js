import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainTabNavigator } from './MainTabNavigator';
import { BookingGroupDetailsScreen } from '../screens/main/BookingGroupDetailsScreen';
import { COLORS } from '../constants';

const Stack = createStackNavigator();

export const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.WHITE }
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabNavigator} 
      />
      <Stack.Screen 
        name="BookingGroupDetails" 
        component={BookingGroupDetailsScreen}
        options={{
          headerShown: false,
          presentation: 'card',
          cardStyle: { backgroundColor: COLORS.WHITE },
          animationEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}; 