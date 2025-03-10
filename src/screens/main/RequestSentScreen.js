import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { COLORS, SCREENS } from '../../constants';

export const RequestSentScreen = ({ navigation }) => {
  const scaleValue = new Animated.Value(0);
  const opacityValue = new Animated.Value(0);

  useEffect(() => {
    // Animate check mark
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Wait for 1.5 seconds then navigate back
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate back to the main screen
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainApp',
            state: {
              routes: [
                {
                  name: SCREENS.HOME,
                  state: {
                    routes: [
                      {
                        name: SCREENS.BOOKINGS
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      });
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Icon name="check-circle" size={80} color={COLORS.PRIMARY} />
        </View>
        <Text style={styles.title}>Request Sent!</Text>
        <Text style={styles.message}>
          Your request has been sent successfully.{'\n'}
          Waiting for passenger confirmation.
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 