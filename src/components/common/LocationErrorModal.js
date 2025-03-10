import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Linking, Platform, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import * as Location from 'expo-location';
import { COLORS } from '../../constants';
import { Button } from './Button';
import { useAuthStore } from '../../store/authStore';
import useLocationStore from '../../store/locationStore';

const LocationErrorModal = () => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, needsWebRegistration } = useAuthStore();
  const { 
    locationError,
    locationPermission,
    locationServicesEnabled,
    locationErrorType,
    isAttemptingRecovery,
    recoverLocationServices,
    clearLocationError,
    dismissedErrorTypes
  } = useLocationStore();

  // Check if we should actually show the modal
  const shouldShowModal = isAuthenticated && 
    !needsWebRegistration && 
    !!locationError && 
    locationErrorType !== 'timeout' && // Don't show modal for timeout errors
    !dismissedErrorTypes.has(locationErrorType); // Don't show if error type was dismissed

  useEffect(() => {
    if (shouldShowModal) {
      console.log('LocationErrorModal shown with error type:', locationErrorType);
    }
  }, [shouldShowModal, locationErrorType]);

  const handleClose = () => {
    console.log('Modal close requested by user');
    clearLocationError();
  };

  const handleOpenSettings = async () => {
    if (locationErrorType === 'permission') {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } else if (locationErrorType === 'play_services') {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.error('Error opening settings:', error);
      }
    } else {
      // For location services, try to enable directly first
      try {
        await Location.enableLocationAsync();
      } catch (error) {
        // If direct enable fails, open settings
        if (Platform.OS === 'ios') {
          await Linking.openURL('App-Prefs:Privacy&path=LOCATION');
        } else {
          await Linking.openSettings();
        }
      }
    }
  };

  const handleRetry = () => {
    handleOpenSettings()
  };

  const getContent = () => {
    if (locationErrorType === 'permission') {
      return {
        title: 'Location Permission Required',
        message: 'Tricykol Driver needs location access to show you nearby bookings and provide accurate navigation. Please enable location permissions in your device settings.',
        primaryButton: 'Open Settings',
        primaryAction: handleOpenSettings,
      };
    } else if (locationErrorType === 'services') {
      return {
        title: 'Location Services Disabled',
        message: 'Please enable location services on your device to use Tricykol Driver.',
        primaryButton: 'Open Settings',
        primaryAction: handleOpenSettings,
      };
    } else if (locationErrorType === 'play_services') {
      return {
        title: 'Google Play Services Issue',
        message: 'There was a problem connecting to Google Play Services, which is required for location features. This might be due to a temporary disconnection or Google Play Services needs to be updated.',
        primaryButton: isAttemptingRecovery ? 'Trying to Reconnect...' : 'Retry Connection',
        primaryAction: handleRetry,
        secondaryButton: 'Open Settings',
        secondaryAction: handleOpenSettings,
      };
    } else {
      return {
        title: 'Location Error',
        message: `We encountered an issue with your location. Please check your device settings and try again.`,
        primaryButton: 'Open Settings',
        primaryAction: handleRetry,
      };
    }
  };

  const content = getContent();

  if (!shouldShowModal || !content) {
    return null;
  }

  return (
    <Modal
      isVisible={shouldShowModal}
      onBackButtonPress={handleClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={null}
      useNativeDriver={true}
      statusBarTranslucent
      backdropOpacity={0.5}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>

      <Text style={styles.title}>{content.title}</Text>
        <Pressable 
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed
          ]} 
          onPress={handleClose}
        >
          <Icon name="close" size={24} color={COLORS.TEXT} />
        </Pressable>
        </View>
        
       
        <Text style={styles.message}>{content.message}</Text>
        
        {content.note && (
          <Text style={styles.note}>{content.note}</Text>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title={content.primaryButton}
            onPress={content.primaryAction}
            style={styles.button}
            disabled={isAttemptingRecovery}
          />
          
          {content.secondaryButton && (
            <Button
              title={content.secondaryButton}
              onPress={content.secondaryAction}
              style={styles.button}
              type="secondary"
            />
          )}
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
    lineHeight: 22,
  },
  note: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    marginBottom: 24,
    opacity: 0.8,
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
