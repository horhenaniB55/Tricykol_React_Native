import { initializeApp, getApp, getApps } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';

// Export Firestore FieldValue for timestamps
export const { FieldValue } = firestore;

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

// Add this to log the project ID
export const logFirebaseProjectInfo = () => {
  console.log('Firebase app name:', app.name);
  console.log('Firebase options:', app.options);
};
