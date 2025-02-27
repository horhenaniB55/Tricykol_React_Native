import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Linking, Platform, TouchableOpacity, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import { COLORS } from '../../constants';
import { Button } from './index';

const LocationErrorModal = ({ 
  isVisible, 
  type, // 'permission' or 'services'
  onClose
}) => {
  const insets = useSafeAreaInsets();

  console.log('LocationErrorModal rendered with:', { isVisible, type });

  // Force re-render when visibility changes
  useEffect(() => {
    console.log('LocationErrorModal visibility changed to:', isVisible);
  }, [isVisible]);

  // Only allow closing with the close button, not backdrop press
  const handleClose = () => {
    console.log('Modal close requested by user');
    onClose();
  };

  const handleOpenSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  }, []);

  const getContent = () => {
    if (type === 'permission') {
      return {
        title: 'Location Permission Required',
        message: 'Tricykol Driver needs location access to show you nearby bookings and provide accurate navigation. Please enable location permissions in your device settings.',
        primaryButton: 'Open Settings',
        primaryAction: handleOpenSettings,
      };
    } else {
      return {
        title: 'Location Services Disabled',
        message: 'Please enable location services on your device to use Tricykol Driver.',
        primaryButton: 'Open Settings',
        primaryAction: handleOpenSettings,
      };
    }
  };

  const content = getContent();

  return (
    <Modal
      isVisible={isVisible}
      // Remove onBackdropPress to prevent accidental closing
      onBackButtonPress={handleClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={null} // Disable swipe to close
      useNativeDriver={true}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable 
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed
          ]} 
          onPress={handleClose}
        >
          <Icon name="close" size={24} color={COLORS.TEXT} />
        </Pressable>
        
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.message}>{content.message}</Text>

        <View style={styles.buttonContainer}>
          <Button
            title={content.primaryButton}
            onPress={content.primaryAction}
            style={styles.button}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.WHITE,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    minHeight: 48,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
    borderRadius: 20,
  },
  closeButtonPressed: {
    opacity: 0.7,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
});

export default LocationErrorModal;
