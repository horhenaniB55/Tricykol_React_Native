import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Firebase configuration
const firebaseConfig = {
  apiKey: Constants.expoConfig.extra.firebaseApiKey,
  authDomain: Constants.expoConfig.extra.firebaseAuthDomain,
  projectId: Constants.expoConfig.extra.firebaseProjectId,
  storageBucket: Constants.expoConfig.extra.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig.extra.firebaseMessagingSenderId,
  appId: Constants.expoConfig.extra.firebaseAppId,
  measurementId: Constants.expoConfig.extra.firebaseMeasurementId,
};

// OTP service URL
const OTP_SERVICE_URL = 'https://otp-service-passenger-666017533126.asia-southeast1.run.app';

// OTP verification function
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

// Export auth instance
export { auth };

/**
 * Restore auth session from AsyncStorage
 * @returns {Promise<Object|null>} The authenticated user or null
 */
export const restoreAuthSession = async () => {
  try {
    // With React Native Firebase, the auth state is automatically persisted
    // This function is kept for compatibility with the existing code
    const currentUser = auth().currentUser;
    return currentUser;
  } catch (error) {
    console.error('Error restoring auth session:', error);
    return null;
  }
};

/**
 * Get Firestore reference
 * @returns {Object} Firestore instance
 */
export const getFirestore = () => {
  return firestore();
};

/**
 * Get a document reference
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Object} Document reference
 */
export const getDocRef = (collection, docId) => {
  return firestore().collection(collection).doc(docId);
};

/**
 * Get a collection reference
 * @param {string} collection - Collection name
 * @returns {Object} Collection reference
 */
export const getCollectionRef = (collection) => {
  return firestore().collection(collection);
};

/**
 * Create a document in Firestore
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID (optional)
 * @param {Object} data - Document data
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

export { OTP_SERVICE_URL }; 