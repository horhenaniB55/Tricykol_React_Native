import axios from 'axios';
import { getAuth, getFirestore, getDoc, getCollection, FieldValue } from './firebase';

// OTP service URL
const OTP_SERVICE_URL = 'https://otp-service-666017533126.asia-southeast1.run.app';

/**
 * Authentication Service
 */
export const AuthService = {
  /**
   * Send OTP to the provided phone number
   * @param {string} phoneNumber - Phone number with country code (e.g., +639670575500)
   * @returns {Promise<Object>} Response from OTP service
   */
  async sendOtp(phoneNumber) {
    console.log(`Sending OTP to phone number: ${phoneNumber}`);
    try {
      console.log(`Making POST request to: ${OTP_SERVICE_URL}/send-otp`);
      const response = await axios.post(`${OTP_SERVICE_URL}/send-otp`, {
        phone: phoneNumber
      });
      console.log('OTP sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending OTP:', error);
      console.error('Error details:', error.response?.data);
      throw new Error(error.response?.data?.error || 'Failed to send OTP');
    }
  },

  /**
   * Verify OTP and sign in the user
   * @param {string} phoneNumber - Phone number with country code
   * @param {string} otp - OTP code received by the user
   * @returns {Promise<Object>} User data and authentication token
   */
  async verifyOtp(phoneNumber, otp) {
    console.log(`Verifying OTP for phone number: ${phoneNumber}`);
    try {
      console.log(`Making POST request to: ${OTP_SERVICE_URL}/verify-otp`);
      const response = await axios.post(`${OTP_SERVICE_URL}/verify-otp`, {
        phone: phoneNumber,
        otp: otp
      });

      console.log('OTP verification response:', response.data);

      if (response.data.success && response.data.token) {
        console.log('OTP verified successfully, signing in with custom token');
        // Sign in with custom token
        await getAuth().signInWithCustomToken(response.data.token);
        console.log('User signed in successfully with UID:', response.data.uid);
        return {
          success: true,
          uid: response.data.uid,
          isNewUser: response.data.isNewUser
        };
      } else {
        console.error('Invalid response from OTP service:', response.data);
        throw new Error('Invalid response from OTP service');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      console.error('Error details:', error.response?.data);
      throw new Error(error.response?.data?.error || 'Failed to verify OTP');
    }
  },

  /**
   * Get driver profile from Firestore
   * @param {string} uid - User ID
   * @returns {Promise<Object|null>} Driver profile or null if not found
   */
  async getDriverProfile(uid) {
    console.log(`Getting driver profile for UID: ${uid}`);
    try {
      // Log authentication state before Firestore access
      const user = getAuth().currentUser;
      console.log('Auth state before Firestore access:', user ? `Authenticated as ${user.uid}` : 'Not authenticated');
      
      // Get driver document and wallet document
      const [driverDoc, walletDoc] = await Promise.all([
        getDoc('drivers', uid).get(),
        getDoc('wallets', uid).get()
      ]);
      
      if (driverDoc.exists) {
        const driverData = driverDoc.data();
        let walletBalance = 0;

        if (walletDoc.exists) {
          walletBalance = walletDoc.data().balance || 0;
          console.log('Wallet found with balance:', walletBalance);
        } else {
          // Create wallet if it doesn't exist
          await getCollection('wallets').doc(uid).set({
            balance: 300, // Free 300 pesos for verified driver
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          walletBalance = 300;
          console.log('Created new wallet with initial balance:', walletBalance);
        }

        console.log('Driver profile found:', { ...driverData, walletBalance });
        return {
          id: driverDoc.id,
          ...driverData,
          walletBalance
        };
      }
      
      console.log('No driver profile found for UID:', uid);
      
      // For testing purposes, create a temporary driver profile
      // In a real app, you would redirect to a registration flow
      console.log('Creating temporary driver profile for testing');
      const tempDriverData = {
        name: 'Test Driver',
        phoneNumber: 'Unknown',
        email: '',
        sex: 'Unknown',
        dateOfBirth: new Date().toISOString(),
        plateNumber: 'TEST-123',
        licenseNumber: 'TEST-456',
        isVerified: false,
        permitVerified: false,
        status: 'offline',
        // Use Firestore server timestamps for createdAt and updatedAt
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      console.log('Using Firestore server timestamps for createdAt and updatedAt');
      
      // Create the driver document
      await getCollection('drivers').doc(uid).set(tempDriverData);
      
      console.log('Temporary driver profile created');
      
      // For the return value, we need to convert the server timestamp to a regular date
      // since server timestamps are not serializable in the client
      return {
        id: uid,
        ...tempDriverData,
        // Replace server timestamps with current date for client-side use
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting driver profile:', error);
      // Log detailed error information
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.message) {
        console.error('Error message:', error.message);
      }
      return null;
    }
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    console.log('Signing out user');
    try {
      await getAuth().signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  /**
   * Check authentication state
   * @returns {Promise<Object|null>} Current user or null
   */
  async checkAuthState() {
    const auth = getAuth();
    const user = auth.currentUser;
    
    console.log('Current auth state:', user ? {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      isAnonymous: user.isAnonymous,
      providerId: user.providerId
    } : 'Not authenticated');
    
    return user;
  },

  /**
   * Update driver status in Firestore
   * @param {string} driverId - Driver's ID
   * @param {string} status - New status ('online' or 'offline')
   * @returns {Promise<void>}
   */
  async updateDriverStatus(driverId, status) {
    console.log(`Updating driver status for ${driverId} to ${status}`);
    try {
      await getFirestore().collection('drivers').doc(driverId).update({
        status: status,
        updatedAt: FieldValue.serverTimestamp(), // Update the timestamp
      });
      console.log('Driver status updated successfully');
    } catch (error) {
      console.error('Error updating driver status:', error);
      throw new Error('Failed to update driver status');
    }
  },
};
