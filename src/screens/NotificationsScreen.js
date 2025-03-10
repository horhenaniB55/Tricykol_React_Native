import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';
import { useAuthStore } from '../store/authStore';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatDistanceToNow } from 'date-fns';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const { driver } = useAuthStore();

  useEffect(() => {
    if (!driver?.id) return;

    // Set up real-time listeners for notifications with specific types
    const unsubscribeDriverId = firestore()
      .collection('notifications')
      .where('driverId', '==', driver.id)
      .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const driverIdNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setNotifications(prevNotifications => {
            const userIdNotifications = prevNotifications.filter(n => n.userId === driver.id);
            return [...driverIdNotifications, ...userIdNotifications].sort((a, b) => 
              b.createdAt.toDate() - a.createdAt.toDate()
            );
          });
        },
        (error) => {
          console.error('Error fetching driverId notifications:', error);
        }
      );

    const unsubscribeUserId = firestore()
      .collection('notifications')
      .where('userId', '==', driver.id)
      .where('type', 'in', ['passenger_response', 'transaction', 'cancellation', 'trip_completed', 'verification'])
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const userIdNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setNotifications(prevNotifications => {
            const driverIdNotifications = prevNotifications.filter(n => n.driverId === driver.id);
            return [...driverIdNotifications, ...userIdNotifications].sort((a, b) => 
              b.createdAt.toDate() - a.createdAt.toDate()
            );
          });
        },
        (error) => {
          console.error('Error fetching userId notifications:', error);
        }
      );

    return () => {
      unsubscribeDriverId();
      unsubscribeUserId();
    };
  }, [driver?.id]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'passenger_response':
        return 'person';
      case 'transaction':
        return 'account-balance-wallet';
      case 'cancellation':
        return 'cancel';
      case 'trip_completed':
        return 'check-circle';
      case 'verification':
        return 'verified-user';
      default:
        return 'notifications';
    }
  };

  const renderNotification = ({ item }) => {
    const timeAgo = item.createdAt ? formatDistanceToNow(new Date(item.createdAt.toDate()), { addSuffix: true }) : '';
    
    // Get notification title based on type and status
    const getTitle = () => {
      if (item.title) return item.title;
      
      switch (item.type) {
        case 'passenger_response':
          return item.status === 'accepted' ? 'Request Accepted' : 'Passenger Response';
        case 'transaction':
          return 'Transaction Update';
        case 'cancellation':
          return 'Booking Cancelled';
        case 'trip_completed':
          return 'Trip Completed';
        case 'verification':
          return 'Account Verified';
        default:
          return 'Notification';
      }
    };
    
    // Get notification message
    const getMessage = () => {
      if (item.message) return item.message;
      
      switch (item.type) {
        case 'verification':
          return 'Your account has been verified. You can now receive bookings.';
        default:
          return item.message || '';
      }
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem,
          !item.read && styles.unreadNotification
        ]}
      >
        <View style={styles.iconContainer}>
          <Icon 
            name={getNotificationIcon(item.type)} 
            size={24} 
            color={COLORS.PRIMARY}
          />
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.message}>{getMessage()}</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="notifications-none" size={64} color={COLORS.GRAY_MEDIUM} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  listContainer: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.GRAY_LIGHT,
    backgroundColor: COLORS.WHITE,
  },
  unreadNotification: {
    backgroundColor: COLORS.GRAY_LIGHTEST,
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.GRAY_MEDIUM,
  },
});

export default NotificationsScreen; 