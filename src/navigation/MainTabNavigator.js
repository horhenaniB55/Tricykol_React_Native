import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import {
  CurrentRideScreen,
  MapScreen,
  RidesScreen,
  WalletScreen,
  MenuScreen,
} from '../screens/main';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.PRIMARY,
        },
        headerTitleStyle: {
          color: COLORS.WHITE,
        },
        tabBarStyle: {
          backgroundColor: COLORS.BACKGROUND,
          borderTopWidth: 1,
          borderTopColor: COLORS.BORDER,
          height: 60,
          paddingBottom: 8,
          // Add padding to bottom on Android to avoid system navigation overlap
          ...(Platform.OS === 'android' && {
            height: 65,
            paddingBottom: 12,
          }),
        },
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: COLORS.TEXT,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'CurrentRide':
              iconName = 'local-taxi';
              break;
            case 'Map':
              iconName = 'map';
              break;
            case 'Rides':
              iconName = 'history';
              break;
            case 'Wallet':
              iconName = 'account-balance-wallet';
              break;
            case 'Menu':
              iconName = 'menu';
              break;
            default:
              iconName = 'error';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="CurrentRide"
        component={CurrentRideScreen}
        options={{
          title: 'Current Ride',
          headerTitle: 'Current Ride',
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Map',
          headerTitle: 'Map',
        }}
      />
      <Tab.Screen
        name="Rides"
        component={RidesScreen}
        options={{
          title: 'Rides',
          headerTitle: 'Rides History',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: 'Wallet',
          headerTitle: 'My Wallet',
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          title: 'Menu',
          headerTitle: 'Menu',
        }}
      />
      </Tab.Navigator>
    </SafeAreaView>
  );
};
