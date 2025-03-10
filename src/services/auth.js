import { 
  auth, 
  createDocument, 
  getDocument, 
  updateDocument, 
  OTP_SERVICE_URL,
  FieldValue
} from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { COLLECTIONS } from '../constants';

/**
 * Authentication Service
 */
export const AuthService = {
  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - Phone number with country code
   * @returns {Promise<Object>} Result object
   */
  sendOtp: async (phoneNumber) => {
    try {
      console.log('Sending OTP to:', phoneNumber);
      
      // Store the phone number for verification later
      await AsyncStorage.setItem('verifyingPhone', phoneNumber);
      
      const response = await fetch('https://otp-service-666017533126.asia-southeast1.run.app/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }
      
      console.log('OTP sent successfully, storing phone number for verification');
      return { success: true };
    } catch (error) {
      console.error('Send OTP error:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Verify OTP
   * @param {string} otp - OTP code
   * @param {boolean} isRegistration - Whether this is for registration
   * @returns {Promise<Object>} Result object
   */
  verifyOtp: async (otp, isRegistration = false) => {
    try {
      // Get the phone number we're verifying
      const phoneNumber = await AsyncStorage.getItem('verifyingPhone');
      
      if (!phoneNumber) {
        throw new Error('No phone number found. Please request a new code.');
      }
      
      const response = await fetch('https://otp-service-666017533126.asia-southeast1.run.app/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          otp,
          isRegistration,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }
      
      // If verification is successful, sign in with custom token
      if (data.token) {
        const userCredential = await auth().signInWithCustomToken(data.token);
        return { 
          success: true, 
          user: userCredential.user,
          uid: data.uid,
          isNewUser: data.isNewUser,
          driverId: data.driverId,
          needsProfile: data.needsProfile
        };
      } else {
        throw new Error('Authentication failed: No token received from server');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      return { 
        success: false, 
        error: error.message || 'Invalid verification code' 
      };
    }
  },
  
  /**
   * Get the current driver's profile
   * @returns {Promise<Object|null>} Driver data or null if not found
   */
  getCurrentDriver: async () => {
    try {
      const user = auth().currentUser;
      if (!user) {
        console.log('No authenticated user found');
        return null;
      }

      console.log('Getting driver profile for user:', user.uid);
      
      // Get driver document from Firestore
      const driverDoc = await firestore()
        .collection(COLLECTIONS.DRIVERS)
        .doc(user.uid)
        .get();

      if (!driverDoc.exists) {
        console.log('No driver profile found for user:', user.uid);
        return null;
      }

      const driverData = {
        id: driverDoc.id,
        ...driverDoc.data(),
      };

      // Check if wallet exists, if not create one
      const walletDoc = await firestore()
        .collection(COLLECTIONS.WALLETS)
        .doc(user.uid)
        .get();

      if (!walletDoc.exists) {
        console.log('Creating new wallet for driver');
        
        // Create wallet with initial balance
        await firestore()
          .collection(COLLECTIONS.WALLETS)
          .doc(user.uid)
          .set({
            balance: 300, // Initial balance of 300 pesos
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
          
        driverData.walletBalance = 300;
      } else {
        driverData.walletBalance = walletDoc.data().balance || 0;
      }

      // Always ensure driver is online
      driverData.status = 'online';

      console.log('Driver profile retrieved successfully:', driverData);
      return driverData;
    } catch (error) {
      console.error('Error getting driver profile:', error);
      throw error;
    }
  },
  
  /**
   * Update driver profile
   * @param {Object} driverData - Driver data to update
   * @returns {Promise<Object>} Result object
   */
  updateDriver: async (driverData) => {
    try {
      // Always ensure driver is online
      driverData.status = 'online';
      
      await firestore()
        .collection(COLLECTIONS.DRIVERS)
        .doc(driverData.id)
        .update({
          ...driverData,
          lastUpdate: firestore.FieldValue.serverTimestamp()
        });

      return { success: true };
    } catch (error) {
      console.error('Error updating driver:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Sign out
   * @returns {Promise<void>}
   */
  signOut: async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },
  
  /**
   * Check authentication state
   * @returns {Promise<Object|null>} Current user or null
   */
  checkAuthState: async () => {
    const user = auth().currentUser;
    return user;
  },
};
