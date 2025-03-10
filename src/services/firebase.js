import { initializeApp, getApp, getApps } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Export Firestore FieldValue for timestamps
export const { FieldValue } = firestore;

// OTP service URL for driver authentication
export const OTP_SERVICE_URL = 'https://otp-service-666017533126.asia-southeast1.run.app';

// Initialize Firebase if it hasn't been initialized yet
if (getApps().length === 0) {
  console.log('Initializing Firebase app...');
  initializeApp();
  console.log('Firebase app initialized successfully!');
} else {
  console.log('Firebase app already initialized');
}

/**
 * Get Firebase app instance
 * @returns {Object} Firebase app instance
 */
export const getFirebaseApp = () => {
  console.log('Getting Firebase app instance');
  return getApp();
};

/**
 * Get Firebase Auth instance
 * @returns {Object} Firebase Auth instance
 */
export const getAuth = () => {
  console.log('Getting Firebase Auth instance');
  return auth();
};

/**
 * Get Firestore instance
 * @returns {Object} Firestore instance
 */
export const getFirestore = () => {
  console.log('Getting Firestore instance');
  return firestore();
};

/**
 * Get Firebase Storage instance
 * @returns {Object} Firebase Storage instance
 */
export const getStorage = () => {
  console.log('Getting Firebase Storage instance');
  return storage();
};

/**
 * Get Firebase Functions instance
 * @returns {Object} Firebase Functions instance
 */
export const getFunctions = () => {
  console.log('Getting Firebase Functions instance');
  return functions();
};

/**
 * Get a Firestore collection reference
 * @param {string} collectionPath - Path to the collection
 * @returns {Object} Firestore collection reference
 */
export const getCollection = (collectionPath) => {
  console.log(`Getting collection reference: ${collectionPath}`);
  return firestore().collection(collectionPath);
};

/**
 * Get a Firestore document reference
 * @param {string} collectionPath - Path to the collection
 * @param {string} docId - Document ID
 * @returns {Object} Firestore document reference
 */
export const getDoc = (collectionPath, docId) => {
  console.log(`Getting document reference: ${collectionPath}/${docId}`);
  return firestore().collection(collectionPath).doc(docId);
};

/**
 * OTP verification function
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} otp - OTP code
 * @param {boolean} isRegistration - Whether this is for registration
 * @returns {Promise<Object>} Result object
 */
export const verifyOtp = async (phoneNumber, otp, isRegistration = false) => {
  try {
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
      throw new Error(data.error || 'Failed to verify OTP');
    }
    
    return data;
  } catch (error) {
    console.error('OTP verification error:', error);
    throw error;
  }
};

/**
 * Restore auth session from AsyncStorage
 * @returns {Promise<Object|null>} The authenticated user or null
 */
export const restoreAuthSession = async () => {
  try {
    // With React Native Firebase, the auth state is automatically persisted
    const currentUser = auth().currentUser;
    return currentUser;
  } catch (error) {
    console.error('Error restoring auth session:', error);
    return null;
  }
};

/**
 * Create a document in Firestore
 * @param {string} collection - Collection name
 * @param {Object} data - Document data
 * @param {string} docId - Document ID (optional)
 * @returns {Promise<Object>} Document reference
 */
export const createDocument = async (collection, data, docId = null) => {
  try {
    const collectionRef = firestore().collection(collection);
    
    if (docId) {
      await collectionRef.doc(docId).set(data);
      return collectionRef.doc(docId);
    } else {
      const docRef = await collectionRef.add(data);
      return docRef;
    }
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

/**
 * Update a document in Firestore
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Document data to update
 * @returns {Promise<void>}
 */
export const updateDocument = async (collection, docId, data) => {
  try {
    await firestore().collection(collection).doc(docId).update(data);
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

/**
 * Get a document from Firestore
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null
 */
export const getDocument = async (collection, docId) => {
  try {
    const docSnap = await firestore().collection(collection).doc(docId).get();
    
    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

// Export auth for direct access
export { auth };
