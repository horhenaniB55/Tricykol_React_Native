import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { AppBar, Button } from '../../components/common';
import { COLORS, SCREENS } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import firestore from '@react-native-firebase/firestore';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

// Make sure to install if not already installed:
// yarn add @react-navigation/material-top-tabs react-native-tab-view react-native-pager-view

const Tab = createMaterialTopTabNavigator();

// Balance Screen Component
const BalanceScreen = ({ navigateToTopUp, navigation }) => {
  const { driver } = useAuthStore();
  const [walletData, setWalletData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTopUps, setPendingTopUps] = useState([]);
  const [isLoadingTopUps, setIsLoadingTopUps] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Use a ref to store listeners to prevent them from affecting dependency arrays
  const listenersRef = useRef([]);

  useEffect(() => {
    if (!driver?.id) return;

    console.log('[WalletScreen] Initializing wallet data listeners');
    
    // Clear previous listeners if any
    if (listenersRef.current.length > 0) {
      listenersRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      listenersRef.current = [];
    }

    // Only set loading state on initial mount
    if (isLoading) {
      setIsLoading(true);
    }
    if (isLoadingTopUps) {
      setIsLoadingTopUps(true);
    }

    // 1. Setup wallet data listener - real-time updates
    const walletUnsubscribe = firestore()
      .collection('wallets')
      .doc(driver.id)
      .onSnapshot(doc => {
        if (doc.exists) {
          const newWalletData = doc.data();
          // Only update if data actually changed to prevent unnecessary re-renders
          if (JSON.stringify(newWalletData) !== JSON.stringify(walletData)) {
            setWalletData(newWalletData);
          }
        } else {
          // Create a new wallet document if it doesn't exist
          // We don't need to update state here, the listener will catch the new document
          const newWallet = {
            driverId: driver.id,
            balance: 0,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp()
          };
          
          firestore()
            .collection('wallets')
            .doc(driver.id)
            .set(newWallet)
            .catch(error => {
              console.error('[WalletScreen] Error creating wallet:', error);
            });
        }
        setIsLoading(false);
      }, error => {
        console.error('[WalletScreen] Error fetching wallet:', error);
        setIsLoading(false);
      });

    listenersRef.current.push(walletUnsubscribe);

    // 2. Setup pending top-ups listener - simplified real-time approach
    try {
      console.log('[WalletScreen] Setting up real-time pending top-ups listener');
      
      // Try the optimal query first
      const topUpUnsubscribe = firestore()
        .collection('transactions')
        .where('driverId', '==', driver.id)
        .where('type', '==', 'top_up')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot({
          next: snapshot => {
            const newPendingTxns = !snapshot.empty 
              ? snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }))
              : [];
            
            // Only update if data actually changed
            if (JSON.stringify(newPendingTxns) !== JSON.stringify(pendingTopUps)) {
              setPendingTopUps(newPendingTxns);
              console.log('[WalletScreen] Real-time pending top-ups updated:', newPendingTxns.length);
            }
            setIsLoadingTopUps(false);
          },
          error: error => {
            console.error('[WalletScreen] Error in primary top-ups query:', error);
            
            // If error is due to missing index, set up a fallback listener
            if (error.code === 'firestore/failed-precondition' && 
                error.message.includes('index')) {
              console.log('[WalletScreen] Using fallback query for pending top-ups');
              
              // Fallback query - get recent transactions and filter client-side
              const fallbackUnsubscribe = firestore()
                .collection('transactions')
                .where('driverId', '==', driver.id)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .onSnapshot({
                  next: snapshot => {
                    if (!snapshot.empty) {
                      // Filter in memory
                      const newPendingTxns = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(txn => txn.type === 'top_up' && txn.status === 'pending');
                      
                      // Only update if data actually changed
                      if (JSON.stringify(newPendingTxns) !== JSON.stringify(pendingTopUps)) {
                        setPendingTopUps(newPendingTxns);
                        console.log('[WalletScreen] Fallback query pending top-ups:', newPendingTxns.length);
                      }
                    } else if (pendingTopUps.length > 0) {
                      // Only update if we have items but the result is empty
                      setPendingTopUps([]);
                    }
                    setIsLoadingTopUps(false);
                  },
                  error: fallbackError => {
                    console.error('[WalletScreen] Error with fallback query:', fallbackError);
                    setIsLoadingTopUps(false);
                  }
                });
              
              listenersRef.current.push(fallbackUnsubscribe);
            } else {
              setIsLoadingTopUps(false);
            }
          }
        });
      
      listenersRef.current.push(topUpUnsubscribe);
    } catch (error) {
      console.error('[WalletScreen] Error setting up pending top-ups listener:', error);
      setIsLoadingTopUps(false);
    }

    // Cleanup all listeners on unmount
    return () => {
      console.log('[WalletScreen] Cleaning up all Firestore listeners');
      listenersRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      listenersRef.current = [];
    };
  }, [driver?.id]); // Only re-run if driver ID changes

  const formatDate = (timestamp) => {
    return timestamp.toDate().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleTopUpCardPress = (transaction) => {
    navigation.navigate('TopUpTicket', { transaction });
  };

  const renderPendingTopUp = (transaction) => (
    <TouchableOpacity 
      key={transaction.id} 
      style={styles.pendingTopUpCard}
      onPress={() => handleTopUpCardPress(transaction)}
      activeOpacity={0.7}
    >
      <View style={styles.pendingHeader}>
        <MaterialIcons name="history" size={20} color={COLORS.WARNING} />
        <Text style={styles.pendingLabel}>Pending Top Up</Text>
      </View>
      
      <View style={styles.pendingDetails}>
        <Text style={styles.pendingAmount}>₱{transaction.amount.toFixed(2)}</Text>
        <Text style={styles.pendingReference}>Ref: {transaction.referenceNumber}</Text>
        <Text style={styles.pendingExpiry}>
          Expires: {formatDate(transaction.expiryDate)}
        </Text>
      </View>

      <Text style={styles.pendingInstructions}>
        Visit Tricykol Outlet Paniqui to complete this top up.
      </Text>
      
      <View style={styles.viewDetailsContainer}>
        <Text style={styles.viewDetails}>View Details</Text>
        <MaterialIcons name="chevron-right" size={16} color={COLORS.PRIMARY} />
      </View>
    </TouchableOpacity>
  );

  const onRefresh = async () => {
    if (!driver?.id) {
      console.log('[WalletScreen] No driver ID available for refresh');
      return;
    }

    setRefreshing(true);
    console.log('[WalletScreen] Pull to refresh triggered for Balance');

    try {
      // Fetch the latest wallet data
      const walletDoc = await firestore()
        .collection('wallets')
        .doc(driver.id)
        .get();

      if (walletDoc.exists) {
        const newWalletData = walletDoc.data();
        setWalletData(newWalletData);
      }

      // Fetch pending top-ups
      const topUpsSnapshot = await firestore()
        .collection('transactions')
        .where('driverId', '==', driver.id)
        .where('type', '==', 'top_up')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get()
        .catch(error => {
          console.log('[WalletScreen] Using fallback query for refresh');
          // Fallback if index doesn't exist
          return firestore()
            .collection('transactions')
            .where('driverId', '==', driver.id)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        });

      if (!topUpsSnapshot.empty) {
        let newPendingTxns = topUpsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // If using fallback, filter client-side
        if (newPendingTxns.some(txn => txn.type !== 'top_up' || txn.status !== 'pending')) {
          newPendingTxns = newPendingTxns.filter(
            txn => txn.type === 'top_up' && txn.status === 'pending'
          );
        }
        
        setPendingTopUps(newPendingTxns);
      } else {
        setPendingTopUps([]);
      }

      console.log('[WalletScreen] Balance refresh completed successfully');
    } catch (error) {
      console.error('[WalletScreen] Error refreshing balance data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.PRIMARY]}
          tintColor={COLORS.PRIMARY}
        />
      }
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
        ) : (
          <Text style={styles.balanceAmount}>
            ₱{walletData?.balance?.toFixed(2) || '0.00'}
          </Text>
        )}
      </View>

      {isLoadingTopUps ? (
        <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.topUpLoader} />
      ) : pendingTopUps.length > 0 ? (
        <View style={styles.pendingTopUpsContainer}>
          {pendingTopUps.map(renderPendingTopUp)}
          
          {/* <View style={styles.infoMessageContainer}>
            <MaterialIcons name="info-outline" size={16} color={COLORS.WARNING} />
            <Text style={styles.infoMessage}>
              Complete your pending top-up before requesting another one
            </Text>
          </View> */}
        </View>
      ) : null}

      <Button
        title={pendingTopUps.length > 0 ? "TOP UP UNAVAILABLE" : "TOP UP WALLET"}
        onPress={navigateToTopUp}
        style={[
          styles.topUpButton,
          pendingTopUps.length > 0 && styles.topUpButtonDisabled
        ]}
        disabled={pendingTopUps.length > 0}
      />
    </ScrollView>
  );
};

// History Screen Component
const HistoryScreen = () => {
  const { driver } = useAuthStore();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Use a ref for the listener to prevent re-renders
  const transactionListenerRef = useRef(null);

  useEffect(() => {
    if (!driver?.id) return;

    console.log('[WalletScreen] Setting up real-time transactions history listener');
    
    // Clean up previous listener if exists
    if (transactionListenerRef.current) {
      transactionListenerRef.current();
      transactionListenerRef.current = null;
    }
    
    // Only set loading on initial mount
    if (isLoading) {
      setIsLoading(true);
    }

    // Single real-time listener for transaction history
    transactionListenerRef.current = firestore()
      .collection('transactions')
      .where('driverId', '==', driver.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot({
        next: snapshot => {
          const newTxns = !snapshot.empty 
            ? snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            : [];
          
          // Only update if data actually changed
          if (JSON.stringify(newTxns) !== JSON.stringify(transactions)) {
            setTransactions(newTxns);
            console.log('[WalletScreen] Real-time transactions updated:', newTxns.length);
          }
          setIsLoading(false);
        },
        error: error => {
          console.error('[WalletScreen] Error fetching transactions history:', error);
          setIsLoading(false);
        }
      });

    // Clean up listener on unmount
    return () => {
      console.log('[WalletScreen] Cleaning up transactions history listener');
      if (transactionListenerRef.current) {
        transactionListenerRef.current();
        transactionListenerRef.current = null;
      }
    };
  }, [driver?.id]); // Only re-run if driver ID changes

  const renderTransaction = (transaction) => (
    <View key={transaction.id} style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <MaterialIcons 
          name={transaction.type === 'top_up' ? 'add-circle' : 'remove-circle'} 
          size={24} 
          color={transaction.type === 'top_up' ? COLORS.SUCCESS : COLORS.PRIMARY}
        />
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionType}>
            {transaction.type === 'top_up' ? 'Top Up' : 'Trip Payment'}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(transaction.createdAt.toDate()).toLocaleDateString('en-PH')}
          </Text>
        </View>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: transaction.type === 'top_up' ? COLORS.SUCCESS : COLORS.PRIMARY }
      ]}>
        {transaction.type === 'top_up' ? '+' : '-'}₱{transaction.amount.toFixed(2)}
      </Text>
    </View>
  );

  const onRefresh = async () => {
    if (!driver?.id) {
      console.log('[WalletScreen] No driver ID available for history refresh');
      return;
    }

    setRefreshing(true);
    console.log('[WalletScreen] Pull to refresh triggered for History');

    try {
      // Fetch the latest transactions
      const txnSnapshot = await firestore()
        .collection('transactions')
        .where('driverId', '==', driver.id)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      if (!txnSnapshot.empty) {
        const newTxns = txnSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTransactions(newTxns);
      } else {
        setTransactions([]);
      }

      console.log('[WalletScreen] History refresh completed successfully');
    } catch (error) {
      console.error('[WalletScreen] Error refreshing transaction history:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.PRIMARY]}
          tintColor={COLORS.PRIMARY}
        />
      }
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.PRIMARY} style={styles.loader} />
      ) : transactions.length > 0 ? (
        transactions.map(renderTransaction)
      ) : (
        <Text style={styles.emptyText}>No transactions yet</Text>
      )}
    </ScrollView>
  );
};

export const WalletScreen = ({ navigation }) => {
  const navigateToTopUp = () => {
    navigation.navigate(SCREENS.TOP_UP_WALLET);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <AppBar title="My Wallet" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: COLORS.PRIMARY,
          tabBarInactiveTintColor: COLORS.TEXT_SECONDARY,
          tabBarIndicatorStyle: { backgroundColor: COLORS.PRIMARY },
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
        }}
      >
        <Tab.Screen 
          name="Balance" 
        >
          {(props) => <BalanceScreen {...props} navigateToTopUp={navigateToTopUp} navigation={navigation} />}
        </Tab.Screen>
        <Tab.Screen name="History" component={HistoryScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  tabBar: {
    backgroundColor: COLORS.WHITE,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
  },
  tabLabel: {
    textTransform: 'none',
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: COLORS.WHITE,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  topUpButton: {
    marginTop: 'auto',
  },
  topUpButtonDisabled: {
    opacity: 0.7,
    backgroundColor: COLORS.GRAY,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    marginBottom: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionDetails: {
    marginLeft: 12,
  },
  transactionType: {
    fontSize: 16,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.TEXT_SECONDARY,
    marginTop: 20,
  },
  loader: {
    marginTop: 20,
  },
  topUpLoader: {
    marginVertical: 10,
  },
  pendingTopUpsContainer: {
    marginBottom: 20,
  },
  pendingTopUpCard: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.WARNING,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pendingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WARNING,
    marginLeft: 8,
  },
  pendingDetails: {
    marginBottom: 12,
  },
  pendingAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  pendingReference: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  pendingExpiry: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  pendingInstructions: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
  },
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.GRAY_LIGHT,
  },
  viewDetails: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: '500',
    marginRight: 4,
  },
  infoMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.WARNING + '15', // 15% opacity
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  infoMessage: {
    color: COLORS.TEXT,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});
