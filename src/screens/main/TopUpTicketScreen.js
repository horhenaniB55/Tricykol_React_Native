import React from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar, Button } from '../../components/common';
import { COLORS, SCREENS } from '../../constants';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CommonActions } from '@react-navigation/native';

export const TopUpTicketScreen = ({ route, navigation }) => {
  // Add error handling for missing transaction
  if (!route.params || !route.params.transaction) {
    // Handle missing transaction data
    setTimeout(() => {
      navigation.goBack();
    }, 100);
    
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <AppBar title="Error" showBack />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: 16, color: COLORS.TEXT }}>
            Transaction details not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { transaction } = route.params;

  const handleShare = async () => {
    try {
      const message = `Tricykol Top Up Details\n\n` +
        `Amount: ₱${transaction.amount.toFixed(2)}\n` +
        `Reference: ${transaction.referenceNumber}\n` +
        `Payment Method: ${transaction.paymentMethod}\n` +
        `Expiry: ${transaction.expiryDate.toDate().toLocaleString('en-PH', { 
          timeZone: 'Asia/Manila' 
        })}\n\n` +
        `Please visit Tricykol Outlet Paniqui to complete your top up.`;

      await Share.share({
        message,
        title: 'Top Up Details',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (timestamp) => {
    return timestamp.toDate().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDone = () => {
    try {
      // Simply go back instead of navigating to a new screen
      // This prevents screen reloads and behaves like the back button
      navigation.goBack();
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback navigation
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <AppBar 
        title="Transaction Details" 
        showBack 
        rightComponent={
          <MaterialIcons 
            name="share" 
            size={24} 
            color={COLORS.TEXT}
            onPress={handleShare}
            style={styles.shareIcon}
          />
        }
      />
      <ScrollView style={styles.container}>
        <View style={styles.card}>
          <View style={styles.header}>
            <MaterialIcons name="account-balance-wallet" size={32} color={COLORS.PRIMARY} />
            <Text style={styles.headerTitle}>Top Up Request</Text>
            <Text style={styles.amount}>₱{transaction.amount.toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue}>{transaction.id}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference Number</Text>
              <Text style={styles.detailValue}>{transaction.referenceNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{transaction.paymentMethod}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created At</Text>
              <Text style={styles.detailValue}>
                {formatDate(transaction.createdAt)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires At</Text>
              <Text style={styles.detailValue}>
                {formatDate(transaction.expiryDate)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, styles.statusPending]}>
                PENDING
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionText}>
            1. Visit Tricykol Outlet Paniqui within the expiry time
          </Text>
          <Text style={styles.instructionText}>
            2. Show this ticket to the cashier
          </Text>
          <Text style={styles.instructionText}>
            3. Pay the amount in cash
          </Text>
          <Text style={styles.instructionText}>
            4. Wait for your wallet balance to be updated
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomButtons}>
        <Button
          title="Share Details"
          onPress={handleShare}
          type="outline"
          style={styles.shareButton}
        />
        <Button
          title="Done"
          onPress={handleDone}
          style={styles.doneButton}
        />
      </View>
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
  shareIcon: {
    padding: 8,
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    color: COLORS.TEXT,
    fontWeight: '600',
    marginVertical: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.GRAY_LIGHT,
    marginVertical: 16,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  statusPending: {
    color: COLORS.WARNING,
    fontWeight: 'bold',
  },
  instructionsCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginBottom: 8,
    lineHeight: 20,
  },
  bottomButtons: {
    padding: 16,
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
  },
  doneButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
  },
}); 