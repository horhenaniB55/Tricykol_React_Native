import React, { useEffect, useState, Suspense } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, TouchableOpacity, Image, View, ActivityIndicator, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import useLocationStore from '../store/locationStore';
import { COLORS, SCREENS } from '../constants';
import { useAuthStore } from '../store/authStore';
import firestore from '@react-native-firebase/firestore';

const Tab = createBottomTabNavigator();

// Loading component for lazy loaded screens
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BACKGROUND }}>
    <ActivityIndicator size="large" color={COLORS.PRIMARY} />
  </View>
);

// Lazy load screen components
const CurrentRideScreenLazy = React.lazy(() => 
  import('../screens/main/CurrentRideScreen').then(module => ({ default: module.CurrentRideScreen }))
);
const MapScreenLazy = React.lazy(() => 
  import('../screens/main/MapScreen').then(module => ({ default: module.MapScreen }))
);
const RidesScreenLazy = React.lazy(() => 
  import('../screens/main/RidesScreen').then(module => ({ default: module.RidesScreen }))
);
const WalletScreenLazy = React.lazy(() => 
  import('../screens/main/WalletScreen').then(module => ({ default: module.WalletScreen }))
);
const MenuScreenLazy = React.lazy(() => 
  import('../screens/main/MenuScreen').then(module => ({ default: module.MenuScreen }))
);

// Create wrapper components for each screen
const CurrentRideScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <CurrentRideScreenLazy {...props} />
  </Suspense>
);

const MapScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <MapScreenLazy {...props} />
  </Suspense>
);

const RidesScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <RidesScreenLazy {...props} />
  </Suspense>
);

const WalletScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <WalletScreenLazy {...props} />
  </Suspense>
);

const MenuScreen = (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <MenuScreenLazy {...props} />
  </Suspense>
);

export const MainTabNavigator = () => {
  const { driver } = useAuthStore();
  const [hasActiveTrip, setHasActiveTrip] = useState(false);
  const [activeTripStatus, setActiveTripStatus] = useState(null);
  const [nearbyBookingsCount, setNearbyBookingsCount] = useState(0);

  // Listen for active trips
  useEffect(() => {
    if (!driver?.id) return;

    const unsubscribe = firestore()
      .collection('bookings')
      .where('driverId', '==', driver.id)
      .where('status', 'in', ['accepted', 'on_the_way', 'arrived', 'in_progress'])
      .onSnapshot(snapshot => {
        const trips = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setHasActiveTrip(trips.length > 0);
        if (trips.length > 0) {
          setActiveTripStatus(trips[0].status);
        } else {
          setActiveTripStatus(null);
        }
      });

    return () => unsubscribe();
  }, [driver?.id]);

  // Listen for changes in nearby bookings
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('bookings')
      .onSnapshot(snapshot => {
        const nearbyBookings = snapshot.docs.filter(doc => {
          // Add your logic to determine if a booking is nearby
          return true; // Placeholder logic
        });
        setNearbyBookingsCount(nearbyBookings.length);
      });

    return () => unsubscribe();
  }, []);

  // Get badge text based on trip status
  const getBadgeText = (status) => {
    switch (status) {
      case 'accepted':
        return 'New';
      case 'on_the_way':
        return 'OTW';
      case 'arrived':
        return 'Here';
      case 'in_progress':
        return 'Active';
      default:
        return '';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      <Tab.Navigator
        initialRouteName={SCREENS.BOOKINGS}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.BACKGROUND,
            borderTopWidth: 1,
            borderTopColor: COLORS.BORDER,
            height: 72,
            paddingBottom: 8,
            paddingTop: 8,
            ...(Platform.OS === 'android' && {
              height: 72,
              paddingBottom: 12
            })
          },
          tabBarActiveTintColor: COLORS.PRIMARY,
          tabBarInactiveTintColor: COLORS.TEXT,
          lazy: true,
          lazyPlaceholder: LoadingScreen,
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === SCREENS.BOOKINGS) {
              return (
                <Image 
                  source={require('../../assets/tricykol_icon.png')} 
                  style={{ 
                    width: 22, 
                    height: 22, 
                    tintColor: color,
                  }} 
                  resizeMode="contain"
                />
              );
            }
            
            if (route.name === 'CurrentRide') {
              return <MaterialCommunityIcons name="road-variant" size={size} color={color} />;
            }
            
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
            tabBarBadge: hasActiveTrip ? '1' : null,
            tabBarBadgeStyle: {
              backgroundColor: COLORS.DANGER,
              color: COLORS.WHITE,
              minWidth: 16,
              height: 16,
              fontSize: 10,
              lineHeight: 16,
              textAlign: 'center',
              borderRadius: 8,
              ...(Platform.OS === 'android' && {
                minHeight: 16,
              }),
            },
            lazy: true,
            tabBarIcon: ({ focused, color, size }) => (
              <View style={{ width: 24, alignItems: 'center' }}>
                <MaterialCommunityIcons 
                  name="road-variant" 
                  size={size} 
                  color={color} 
                />
              </View>
            ),
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                onPress={() => {
                  if (!hasActiveTrip) {
                    Toast.show({
                      type: 'info',
                      text1: 'No Active Trip',
                      text2: 'You don\'t have any ongoing trips'
                    });
                    return;
                  }
                  props.onPress();
                }}
                style={[
                  props.style,
                  { opacity: hasActiveTrip ? 1 : 0.5 }
                ]}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Map',
            headerTitle: 'Map',
            lazy: true,
          }}
        />
        <Tab.Screen
          name={SCREENS.BOOKINGS}
          component={RidesScreen}
          options={{
            title: 'Rides',
            headerTitle: 'Available Rides',
            lazy: true,
            tabBarBadge: nearbyBookingsCount > 0 ? nearbyBookingsCount.toString() : null,
            tabBarBadgeStyle: {
              backgroundColor: COLORS.DANGER,
              color: COLORS.WHITE,
              minWidth: 16,
              height: 16,
              fontSize: 10,
              lineHeight: 16,
              textAlign: 'center',
              borderRadius: 8,
              ...(Platform.OS === 'android' && {
                minHeight: 16,
              }),
            },
          }}
        />
        <Tab.Screen
          name="Wallet"
          component={WalletScreen}
          options={{
            title: 'Wallet',
            headerTitle: 'My Wallet',
            lazy: true,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="account-balance-wallet" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Menu"
          component={MenuScreen}
          options={{
            title: 'Menu',
            headerTitle: 'Menu',
            lazy: true,
          }}
        />
      </Tab.Navigator>

      <Toast 
        config={{
          info: (props) => (
            <View style={{
              height: 65,
              width: '90%',
              backgroundColor: COLORS.GRAY,
              padding: 20,
              borderRadius: 8,
              justifyContent: 'center',
              marginBottom: 65,
            }}>
              <Text style={{ color: COLORS.WHITE, fontSize: 14, fontWeight: '500' }}>
                {props.text1}
              </Text>
              {props.text2 && (
                <Text style={{ color: COLORS.WHITE, fontSize: 12 }}>
                  {props.text2}
                </Text>
              )}
            </View>
          )
        }}
        position="bottom"
        visibilityTime={2000}
      />
    </SafeAreaView>
  );
};
