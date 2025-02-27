import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants';

/**
 * Toast component for displaying temporary messages
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Message to display
 * @param {boolean} props.visible - Whether the toast is visible
 * @param {number} [props.duration=3000] - How long to show the toast in ms
 * @param {string} [props.type='info'] - Toast type (info, error, success)
 * @param {Function} [props.onHide] - Callback when toast hides
 * @returns {React.ReactElement} Toast component
 */
export const Toast = ({ 
  message, 
  visible, 
  duration = 3000,
  type = 'info',
  onHide 
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Hide after duration
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (onHide) onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return COLORS.ERROR;
      case 'success':
        return COLORS.SUCCESS;
      default:
        return COLORS.PRIMARY;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateY }],
          opacity,
          backgroundColor: getBackgroundColor(),
        }
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
