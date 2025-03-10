import { auth, createDocument, getDocument, updateDocument, OTP_SERVICE_URL } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

export const AuthService = {
  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - Phone number with country code
   * @returns {Promise<Object>} Result object
   */
  sendOtp: async (phoneNumber) => {
    try {
      console.log('Sending OTP to:', phoneNumber);
      
      // Use the external OTP service instead of Firebase
      const response = await fetch(`${OTP_SERVICE_URL}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }
      
      // Store the phone number for verification later
      await AsyncStorage.setItem('verifyingPhone', phoneNumber);
      
      return { success: true, data };
    } catch (error) {
      console.error('Send OTP error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send verification code' 
      };
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
      console.log('Verifying OTP:', otp);
      
      // Get the phone number we're verifying
      const phoneNumber = await AsyncStorage.getItem('verifyingPhone');
      
      if (!phoneNumber) {
        throw new Error('No phone number found. Please request a new code.');
      }
      
      // Use the external OTP service for verification
      const response = await fetch(`${OTP_SERVICE_URL}/verify-otp`, {
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
          isNewUser: data.isNewUser 
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
   * Register a new passenger
   * @param {Object} passengerData - Passenger data
   * @returns {Promise<Object>} Result object
   */
  registerPassenger: async (passengerData) => {
    try {
      console.log('Registering passenger:', passengerData);
      
      const user = auth().currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create passenger document with proper schema
      const passengerWithTimestamp = {
        // Basic information
        fullName: passengerData.fullName,
        email: passengerData.email || null,
        phoneNumber: user.phoneNumber, // From Firebase Auth
        sex: passengerData.sex || null,
        dateOfBirth: passengerData.dateOfBirth || null,
        
        // Guardian information (optional)
        guardian: passengerData.guardian ? {
          name: passengerData.guardian.name,
          relationship: passengerData.guardian.relationship,
          phoneNumber: passengerData.guardian.phoneNumber
        } : null,
        
        // Metadata
        userId: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        
        // Account status
        isActive: true,
        isVerified: true,
      };
      
      await createDocument('passengers', passengerWithTimestamp, user.uid);
      
      return { success: true, passenger: passengerWithTimestamp };
    } catch (error) {
      console.error('Register passenger error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to register passenger' 
      };
    }
  },
  
  /**
   * Get current passenger data
   * @returns {Promise<Object|null>} Passenger data or null
   */
  getCurrentPassenger: async () => {
    try {
      const user = auth().currentUser;
      
      if (!user) {
        return null;
      }
      
      const passengerData = await getDocument('passengers', user.uid);
      return passengerData;
    } catch (error) {
      console.error('Get current passenger error:', error);
      throw error;
    }
  },
  
  /**
   * Update passenger data
   * @param {Object} passengerData - Passenger data to update
   * @returns {Promise<Object>} Result object
   */
  updatePassenger: async (passengerData) => {
    try {
      const user = auth().currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const dataWithTimestamp = {
        ...passengerData,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      
      await updateDocument('passengers', user.uid, dataWithTimestamp);
      
      return { success: true };
    } catch (error) {
      console.error('Update passenger error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update passenger data' 
      };
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
}; 