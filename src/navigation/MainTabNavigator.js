import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, TouchableOpacity, Image } from 'react-native';
import Toast from 'react-native-toast-message';
import useLocationStore from '../store/locationStore';
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
  const { activeTrip } = useLocationStore();
  
  // Custom tab press handler for CurrentRide tab
  const handleCurrentRidePress = () => {
    if (!activeTrip) {
      // Show toast message when trying to access CurrentRide without an active ride
      Toast.show({
        type: 'info',
        position: 'bottom',
        text1: 'No Active Ride',
        text2: 'You don\'t have any ongoing trips at the moment',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 30,
        bottomOffset: 70,
      });
      return true; // Prevent navigation
    }
    return false; // Allow navigation
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      <Tab.Navigator
        initialRouteName="Rides"
        screenOptions={({ route }) => ({
          headerShown: false, // Use custom AppBar
          tabBarStyle: {
            backgroundColor: COLORS.BACKGROUND,
            borderTopWidth: 1,
            borderTopColor: COLORS.BORDER,
            height: 60,
            paddingBottom: 8,
            ...(Platform.OS === 'android' && {
              height: 65,
              paddingBottom: 12
            })
          },
          tabBarActiveTintColor: COLORS.PRIMARY,
          tabBarInactiveTintColor: COLORS.TEXT,
          tabBarIcon: ({ focused, color, size }) => {
            // Special case for Rides tab - use custom tricycle icon
            if (route.name === 'Rides') {
              return (
                <Image 
                  source={require('../../assets/tricycle.png')} 
                  style={{ 
                    width: size, 
                    height: size, 
                    tintColor: color 
                  }} 
                  resizeMode="contain"
                />
              );
            }
            
            // Special case for CurrentRide - use MaterialCommunityIcons
            if (route.name === 'CurrentRide') {
              return <MaterialCommunityIcons name="road-variant" size={size} color={color} />;
            }
            
            // For other tabs, use Material Icons
            let iconName;

            switch (route.name) {
              case 'Map':
                iconName = 'map';
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
            tabBarButton: (props) => {
              return (
                <TouchableOpacity
                  {...props}
                  onPress={() => {
                    if (handleCurrentRidePress()) {
                      return; // Prevent navigation if handleCurrentRidePress returns true
                    }
                    props.onPress(); // Otherwise, proceed with normal navigation
                  }}
                  style={[
                    props.style,
                    { opacity: activeTrip ? 1 : 0.5 } // Visual indication that tab is disabled
                  ]}
                />
              );
            },
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
      
      {/* Toast component for showing messages */}
      <Toast />
    </SafeAreaView>
  );
};
