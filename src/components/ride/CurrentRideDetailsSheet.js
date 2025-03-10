import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Modal, Animated, PanResponder } from 'react-native';
import { COLORS } from '../../constants';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocationModel } from '../../models/LocationModel';
import { Button } from '../common';

// Import FARE_CONSTANTS
const FARE_CONSTANTS = {
  SYSTEM_FEE_PERCENTAGE: 0.12 // 12%
};

export const CurrentRideDetailsSheet = ({ 
  isVisible, 
  onClose, 
  activeTrip,
  currentLocation,
  onCallPassenger,
  onMessagePassenger
}) => {
  if (!activeTrip) return null;

  const driverToPickup = LocationModel.calculateDistanceAndTime(
    currentLocation,
    activeTrip.pickupLocation?.coordinates
  );

  const pickupToDropoff = LocationModel.calculateDistanceAndTime(
    activeTrip.pickupLocation?.coordinates,
    activeTrip.dropoffLocation?.coordinates
  );

  // Calculate driver's earning
  const fare = parseFloat(activeTrip.fare) || 0;
  // Use systemFee from activeTrip if available, otherwise calculate it
  const systemFee = activeTrip.systemFee !== undefined ? 
    parseFloat(activeTrip.systemFee) : 
    Math.round(fare * FARE_CONSTANTS.SYSTEM_FEE_PERCENTAGE);
  const driverEarning = fare - systemFee;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            
            <View style={styles.content}>
              {/* Passenger Name and Fare */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.passengerName}>{activeTrip.passengerName?.split(' ')[0]}</Text>
                  <Text style={styles.passengerCount}>
                    {activeTrip.passengerCount} {activeTrip.passengerCount > 1 ? 'passengers' : 'passenger'}
                  </Text>
                </View>
                <Text style={styles.farePrice}>₱{activeTrip.fare}</Text>
              </View>

              {/* Call and SMS buttons - only visible when trip is in progress */}
              {activeTrip.status === 'in_progress' && (
                <View style={styles.contactButtonsContainer}>
                  <TouchableOpacity 
                    onPress={onCallPassenger}
                    style={styles.contactButtonLarge}
                    disabled={!activeTrip.passengerPhone}
                  >
                    <Icon name="phone" size={20} color={COLORS.WHITE} />
                    <Text style={styles.contactButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={onMessagePassenger}
                    style={styles.contactButtonLarge}
                    disabled={!activeTrip.passengerPhone}
                  >
                    <Icon name="message" size={20} color={COLORS.WHITE} />
                    <Text style={styles.contactButtonText}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Locations */}
              <View style={styles.locationContainer}>
                <View style={styles.locationContent}>
                  {/* Left column with icons and line */}
                  <View style={styles.iconColumn}>
                    <Icon name="radio-button-off" size={20} color={COLORS.DARK_PRIMARY} />
                    <View style={styles.verticalLine} />
                    <Icon name="radio-button-on" size={20} color={COLORS.DARK_PRIMARY} />
                  </View>
                  
                  {/* Right column with location texts */}
                  <View style={styles.locationsTextColumn}>
                    {/* Pickup Location */}
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationText} numberOfLines={2}>
                        {activeTrip.pickupLocation?.address}
                      </Text>
                      <Text style={styles.distanceText}>
                        {LocationModel.formatDistance(driverToPickup.distance)} • {LocationModel.formatTime(driverToPickup.estimatedTime)} away
                      </Text>
                    </View>
                    
                    {/* Dropoff Location */}
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationText} numberOfLines={2}>
                        {activeTrip.dropoffLocation?.address}
                      </Text>
                      <Text style={styles.tripDetailsText}>
                        {LocationModel.formatDistance(pickupToDropoff.distance)} • {LocationModel.formatTime(pickupToDropoff.estimatedTime)} trip
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Additional Trip Details */}
              <View style={styles.additionalDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method:</Text>
                  <Text style={styles.detailValue}>{activeTrip.paymentMethod || 'Cash'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>System Fee:</Text>
                  <Text style={styles.detailValue}>₱{systemFee.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Your Earning:</Text>
                  <Text style={[styles.detailValue, styles.earningValue]}>₱{driverEarning.toFixed(2)}</Text>
                </View>
                {activeTrip.notes && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={styles.detailValue}>{activeTrip.notes}</Text>
                  </View>
                )}
              </View>

              <Button
                title="Close"
                onPress={onClose}
                style={styles.closeButton}
              />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  passengerName: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  passengerCount: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
  farePrice: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  locationContainer: {
    marginBottom: 20,
  },
  locationContent: {
    flexDirection: 'row',
  },
  iconColumn: {
    width: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 120, // Fixed height to ensure proper spacing
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginVertical: 8,
  },
  locationsTextColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationTextContainer: {
    marginBottom: 12,
  },
  locationText: {
    fontSize: 16,
    color: COLORS.TEXT,
    lineHeight: 22,
  },
  distanceText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  tripDetailsText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  contactButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  contactButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  contactButtonText: {
    color: COLORS.WHITE,
    fontWeight: '500',
    fontSize: 14,
  },
  additionalDetails: {
    backgroundColor: COLORS.BACKGROUND,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  earningValue: {
    color: COLORS.SUCCESS,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 'auto',
  },
}); 