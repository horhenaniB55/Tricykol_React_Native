import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { COLORS } from '../../constants';

/**
 * Loading indicator component
 * 
 * @param {Object} props - Component props
 * @param {string} [props.message] - Optional message to display
 * @param {boolean} [props.fullScreen=true] - Whether to display full screen
 * @param {Object} [props.style] - Additional container style
 * @returns {React.ReactElement} Loading component
 */
export const Loading = ({
  message,
  fullScreen = true,
  style,
}) => {
  return (
    <View style={[
      styles.container,
      fullScreen ? styles.fullScreen : null,
      style,
    ]}>
      <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
  },
  message: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
});
