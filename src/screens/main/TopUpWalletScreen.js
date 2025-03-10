import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar, Button } from '../../components/common';
import { COLORS, SCREENS } from '../../constants';
import Modal from 'react-native-modal';
import { useAuthStore } from '../../store/authStore';
import firestore from '@react-native-firebase/firestore';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const MINIMUM_AMOUNT = 300;
const PRESET_AMOUNTS = [300, 500, 1000, 2000, 3000, 5000];

export const TopUpWalletScreen = ({ navigation }) => {
  const { driver } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleAmountChange = (text) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
  };

  const handlePresetAmount = (value) => {
    setAmount(value.toString());
  };

  const renderPresetAmounts = () => {
    return (
      <View style={styles.presetContainer}>
        {PRESET_AMOUNTS.map((value) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.presetBox,
              amount === value.toString() && styles.presetBoxSelected
            ]}
            onPress={() => handlePresetAmount(value)}
          >
            <Text style={[
              styles.presetAmount,
              amount === value.toString() && styles.presetAmountSelected
            ]}>
              ₱{value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      const numericAmount = parseInt(amount, 10);

      // Create transaction document
      const transactionRef = firestore().collection('transactions').doc();
      const timestamp = firestore.Timestamp.now();
      const expiryTime = new Date(timestamp.toDate());
      expiryTime.setHours(expiryTime.getHours() + 12); // 12 hours expiry

      const transactionData = {
        id: transactionRef.id,
        type: 'top_up',
        amount: numericAmount,
        status: 'pending',
        driverId: driver.id,
        driverName: driver.fullName,
        paymentMethod: 'Tricykol Outlet Paniqui',
        referenceNumber: `TOP${Date.now().toString(36).toUpperCase()}`,
        createdAt: timestamp,
        expiryDate: firestore.Timestamp.fromDate(expiryTime),
        updatedAt: timestamp
      };

      await transactionRef.set(transactionData);

      // Use exact navigation name
      navigation.replace('TopUpTicket', { transaction: transactionData });

    } catch (error) {
      console.error('Error creating top-up transaction:', error);
      Alert.alert('Error', 'Failed to create top-up request. Please try again.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  const handleTopUp = () => {
    const numericAmount = parseInt(amount, 10);
    if (numericAmount < MINIMUM_AMOUNT) {
      Alert.alert('Invalid Amount', `Minimum top-up amount is ₱${MINIMUM_AMOUNT}`);
      return;
    }
    setShowConfirmModal(true);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <AppBar title="Top Up Wallet" showBack />
      <ScrollView style={styles.container}>
        <Text style={styles.label}>Select Amount</Text>
        
        {renderPresetAmounts()}

        <Text style={styles.label}>Or Enter Custom Amount</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>₱</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor={COLORS.TEXT_SECONDARY}
          />
        </View>

        <Text style={styles.minAmountNote}>
          Minimum amount: ₱{MINIMUM_AMOUNT}
        </Text>

        <Button
          title="CONTINUE"
          onPress={handleTopUp}
          style={styles.continueButton}
          disabled={!amount || parseInt(amount, 10) < MINIMUM_AMOUNT}
        />
      </ScrollView>

      <Modal
        isVisible={showConfirmModal}
        onBackdropPress={() => setShowConfirmModal(false)}
        onBackButtonPress={() => setShowConfirmModal(false)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Top Up</Text>
          <View style={styles.modalDetails}>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Amount</Text>
              <Text style={styles.modalValue}>₱{parseInt(amount, 10).toFixed(2)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Payment Method</Text>
              <Text style={styles.modalValue}>Tricykol Outlet Paniqui</Text>
            </View>
          </View>
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => setShowConfirmModal(false)}
              type="outline"
              style={styles.modalButton}
            />
            <Button
              title="Confirm"
              onPress={handleConfirm}
              loading={isLoading}
              style={[styles.modalButton, styles.confirmButton]}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY,
    paddingBottom: 8,
  },
  pesoSign: {
    fontSize: 32,
    color: COLORS.TEXT,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    color: COLORS.TEXT,
    padding: 0,
  },
  minAmountText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
  continueButton: {
    marginTop: 'auto',
    marginBottom: 16,
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.WHITE,
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 16,
  },
  modalDetails: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  modalValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  confirmButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  presetBox: {
    width: '31%', // Slightly less than a third to account for gaps
    aspectRatio: 2,
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
  },
  presetBoxSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  presetAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  presetAmountSelected: {
    color: COLORS.WHITE,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 24,
    color: COLORS.TEXT,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    color: COLORS.TEXT,
    paddingVertical: 12,
  },
  minAmountNote: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  continueButton: {
    marginHorizontal: 16,
  },
}); 