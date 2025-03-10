require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

// Initialize Firebase Admin with service account
let db;
let isFirebaseInitialized = false;

async function initializeFirebase() {
  try {
    if (!isFirebaseInitialized) {
      // For Cloud Run, use default credentials
      if (process.env.K_SERVICE) {
        if (!admin.apps.length) {
          admin.initializeApp();
        }
      } else {
        // For local development, use service account file
        const serviceAccount = require('./service-account.json');
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        }
      }
      
      db = admin.firestore();
      isFirebaseInitialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    }
    return true;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message, error.stack);
    return false;
  }
}

// OTP expiration time in milliseconds (5 minutes)
const OTP_EXPIRY = 5 * 60 * 1000;

// Get Semaphore API key from environment
const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY;
if (!SEMAPHORE_API_KEY) {
  console.error('WARNING: SEMAPHORE_API_KEY is not configured');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebaseInitialized: isFirebaseInitialized,
    semaphoreConfigured: !!SEMAPHORE_API_KEY
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'OTP Service is running',
    version: '1.0.0'
  });
});

// Ensure OTP collection exists
async function ensureOtpCollection() {
  if (!isFirebaseInitialized) {
    await initializeFirebase();
  }
  
  try {
    const collectionRef = db.collection('otps');
    // Try to get the collection
    await collectionRef.limit(1).get();
    return collectionRef;
  } catch (error) {
    console.log('Creating otps collection');
    // Collection doesn't exist, create it
    await db.collection('otps').doc('_config').set({
      created: Date.now(),
      description: 'Collection for storing temporary OTPs'
    });
    return db.collection('otps');
  }
}

// Helper function to check if driver exists
async function checkDriverExists(phoneNumber) {
  if (!isFirebaseInitialized) {
    await initializeFirebase();
  }
  
  try {
    // Check in drivers collection
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Try different phone formats to find the driver
    const phoneFormats = [
      normalizedPhone.original,
      normalizedPhone.local,
      normalizedPhone.international,
      normalizedPhone.withoutPlus
    ];
    
    for (const phone of phoneFormats) {
      const snapshot = await db.collection('drivers')
        .where('phoneNumber', '==', phone)
        .limit(1)
        .get();
        
      if (!snapshot.empty) {
        const driverDoc = snapshot.docs[0];
        return {
          exists: true,
          driverId: driverDoc.id, // Document ID in drivers collection (should match Firebase Auth UID)
          data: driverDoc.data()
        };
      }
    }
    
    // No driver found with any phone format
    return { exists: false };
  } catch (error) {
    console.error('Error checking driver:', error);
    return { exists: false, error };
  }
}

// Generate numeric OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP Endpoint
app.post('/send-otp', async (req, res) => {
  try {
    if (!isFirebaseInitialized) {
      const success = await initializeFirebase();
      if (!success) {
        throw new Error('Firebase initialization failed');
      }
    }

    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Get or create OTP collection
    const otpCollection = await ensureOtpCollection();
    const expiresAt = Date.now() + OTP_EXPIRY;

    // Send OTP via Semaphore
    try {
      console.log('Sending OTP via Semaphore:', { phone });
      
      // Prepare form data for Semaphore OTP API
      const formData = new URLSearchParams();
      formData.append('apikey', SEMAPHORE_API_KEY);
      formData.append('number', phone.replace('+', '')); // Remove + but keep 63 prefix
      formData.append('message', 'Your Tricykol OTP Code is {otp}. Valid for 5 minutes.');

      console.log('Sending request to Semaphore:', {
        number: phone.replace('+', ''),
        apiKeyPresent: !!SEMAPHORE_API_KEY,
        message: formData.get('message')
      });

      // Send OTP request to Semaphore
      console.log('Environment:', {
        isCloudRun: !!process.env.K_SERVICE,
        semaphoreKeyLength: SEMAPHORE_API_KEY?.length,
        formData: Object.fromEntries(formData)
      });

      // Add more robust error handling for API call
      const response = await axios.post(
        'https://api.semaphore.co/api/v4/otp',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000, // 10 second timeout
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 500; // Accept any status code less than 500
          }
        }
      ).catch(error => {
        if (error.response) {
          console.error('Semaphore API Error Response:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          });
        } else if (error.request) {
          console.error('No response received:', error.request);
        }
        throw error;
      });

      // Log full response for debugging
      console.log('Full Semaphore Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });

      // Parse and validate response data
      if (!response.data) {
        throw new Error('Empty response from Semaphore API');
      }

      const apiResponse = Array.isArray(response.data) 
        ? response.data[0] 
        : typeof response.data === 'object'
          ? response.data
          : null;

      if (!apiResponse) {
        throw new Error('Invalid response format from Semaphore API');
      }

      if (!apiResponse.code || !apiResponse.message_id) {
        throw new Error('Missing required fields in response: ' + JSON.stringify(apiResponse));
      }

      // Store OTP data in Firestore
      const otpData = {
        otp: apiResponse.code.toString(),
        expiresAt,
        createdAt: Date.now(),
        messageId: apiResponse.message_id,
        status: apiResponse.status,
        recipient: apiResponse.recipient,
        network: apiResponse.network
      };
      
      await otpCollection.doc(phone).set(otpData);

      console.log('OTP stored successfully:', {
        messageId: apiResponse.message_id,
        status: apiResponse.status,
        recipient: apiResponse.recipient,
        network: apiResponse.network
      });
    } catch (error) {
      console.error('Semaphore API Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      // Delete any stored OTP if it exists
      try {
        await otpCollection.doc(phone).delete();
      } catch (deleteError) {
        console.error('Failed to delete OTP after SMS error:', deleteError);
      }
      
      if (error.response?.data?.message) {
        throw new Error(`SMS Gateway Error: ${error.response.data.message}`);
      } else if (error.response?.status) {
        throw new Error(`SMS Gateway Error: ${error.response.status} - ${error.response.statusText}`);
      } else {
        throw new Error(`SMS Gateway Error: ${error.message}`);
      }
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber) {
  let local = phoneNumber;
  let international = phoneNumber;
  let withoutPlus = phoneNumber;
  
  // Convert to local format (09XXXXXXXXX)
  if (phoneNumber.startsWith('+63')) {
    local = '0' + phoneNumber.substring(3);
  } else if (phoneNumber.startsWith('63') && !phoneNumber.startsWith('0')) {
    local = '0' + phoneNumber.substring(2);
  }
  
  // Convert to international format (+639XXXXXXXX)
  if (phoneNumber.startsWith('0')) {
    international = '+63' + phoneNumber.substring(1);
  } else if (!phoneNumber.startsWith('+') && phoneNumber.startsWith('63')) {
    international = '+' + phoneNumber;
  } else if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('63') && !phoneNumber.startsWith('0')) {
    international = '+63' + phoneNumber;
  }
  
  // Format without plus sign (639XXXXXXXX)
  if (phoneNumber.startsWith('+')) {
    withoutPlus = phoneNumber.substring(1);
  } else if (phoneNumber.startsWith('0')) {
    withoutPlus = '63' + phoneNumber.substring(1);
  }
  
  return {
    original: phoneNumber,
    local,
    international,
    withoutPlus
  };
}

// Verify OTP Endpoint
app.post('/verify-otp', async (req, res) => {
  try {
    // Ensure Firebase is initialized
    const initialized = await initializeFirebase();
    if (!initialized) {
      console.error('Firebase initialization failed during OTP verification');
      return res.status(500).json({
        success: false,
        error: 'Firebase initialization failed'
      });
    }
    
    const { phone, otp, isRegistration = false } = req.body;
    console.log(`Verifying OTP for ${phone}, isRegistration: ${isRegistration}`);
    
    if (!phone || !otp) {
      console.log('Missing required fields: phone or OTP');
      return res.status(400).json({
        success: false,
        error: 'Phone number and OTP are required'
      });
    }
    
    // Verify OTP in Firestore
    console.log(`Checking OTP for phone: ${phone}`);
    const otpRef = db.collection('otps').doc(phone);
    const otpDoc = await otpRef.get();
    
    if (!otpDoc.exists) {
      console.log(`No OTP found for phone: ${phone}`);
      return res.status(400).json({
        success: false,
        error: 'No OTP found for this phone number'
      });
    }

    const otpData = otpDoc.data();
    const now = Date.now();
    
    // Check if OTP is expired
    if (now > otpData.expiresAt) {
      console.log(`OTP expired for phone: ${phone}`);
      await otpRef.delete();
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Check if OTP matches
    if (otpData.otp !== otp) {
      console.log(`Invalid OTP for phone: ${phone}, expected: ${otpData.otp}, received: ${otp}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.'
      });
    }
    
    console.log(`OTP verified successfully for phone: ${phone}`);
    
    // OTP is valid, delete it
    await otpRef.delete();
    console.log(`Deleted OTP record for phone: ${phone}`);
    
    // Check if driver exists in the drivers collection
    const driverCheck = await checkDriverExists(phone);
    console.log(`Driver check result:`, driverCheck);
    
    let authUid = null; // Firebase Auth UID
    let isNewUser = true;
    let token = null;
    let existingAuthAccount = false;
    
    // First, check if the user exists in Firebase Auth regardless of collection status
    try {
      const userRecord = await admin.auth().getUserByPhoneNumber(phone);
      authUid = userRecord.uid;
      existingAuthAccount = true;
      console.log(`Found existing Firebase Auth account with UID: ${authUid}`);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        console.error(`Error checking Firebase Auth: ${error.code} - ${error.message}`);
        return res.status(500).json({
          success: false,
          error: `Error checking authentication: ${error.message}`
        });
      }
      console.log(`No existing Firebase Auth account found for ${phone}`);
    }
    
    if (driverCheck.exists) {
      // Driver exists in the drivers collection
      isNewUser = false;
      
      if (existingAuthAccount) {
        // Auth user exists, verify the IDs match
        if (authUid !== driverCheck.driverId) {
          console.warn(`Warning: Firebase Auth UID (${authUid}) doesn't match driver document ID (${driverCheck.driverId})`);
        }
      } else {
        // Driver exists in collection but not in Auth, create Auth user
        console.log(`Driver exists in collection but not in Auth. Creating new Auth user.`);
        try {
          const newUser = await admin.auth().createUser({
            phoneNumber: phone,
            uid: driverCheck.driverId // Use the same document ID as the driver document
          });
          authUid = newUser.uid;
          console.log(`New auth user created with UID: ${authUid}`);
        } catch (createError) {
          console.error(`Error creating user: ${createError.code} - ${createError.message}`);
          return res.status(500).json({
            success: false,
            error: `Failed to create user account: ${createError.message}`
          });
        }
      }
    } else {
      // Driver doesn't exist in the drivers collection
      if (existingAuthAccount) {
        // User exists in Auth but not in drivers collection
        if (isRegistration) {
          // This is a registration with an existing Auth account
          // Return success with a message indicating registration can proceed with Firebase app
          console.log(`Phone number exists in Auth but not in drivers collection during registration`);
          isNewUser = true;
        } else {
          // Login attempt with no driver record
          return res.status(400).json({
            success: false,
            error: 'No driver account found with this phone number. Please register first.'
          });
        }
      } else if (isRegistration) {
        // No Auth account, no driver record, and registration mode - create new Auth user
        try {
          const newUser = await admin.auth().createUser({
            phoneNumber: phone
          });
          authUid = newUser.uid;
          console.log(`New user created with UID: ${authUid} for registration`);
        } catch (createError) {
          console.error(`Error creating user: ${createError.code} - ${createError.message}`);
          return res.status(500).json({
            success: false,
            error: `Failed to create user account: ${createError.message}`
          });
        }
      } else {
        // No Auth account, no driver record, and login mode
        return res.status(400).json({
          success: false,
          error: 'No driver account found with this phone number. Please register first.'
        });
      }
    }
    
    // Generate custom token if we have a UID
    if (authUid) {
      console.log(`Generating custom token for UID: ${authUid}`);
      try {
        token = await admin.auth().createCustomToken(authUid);
        console.log(`Custom token generated successfully for UID: ${authUid}`);
      } catch (tokenError) {
        console.error(`Error creating custom token: ${tokenError.code} - ${tokenError.message}`);
        return res.status(500).json({
          success: false,
          error: `Failed to generate authentication token: ${tokenError.message}`
        });
      }
    } else {
      console.error('No UID available to generate token');
      return res.status(500).json({
        success: false,
        error: 'Authentication failed: No user ID available'
      });
    }
    
    console.log(`Returning successful response with token for UID: ${authUid}, isNewUser: ${isNewUser}`);
    res.json({ 
      success: true, 
      token,
      uid: authUid,
      isNewUser,
      driverId: driverCheck.exists ? driverCheck.driverId : authUid,
      // Add a flag to indicate if this is an auth-only account that needs to create a driver profile
      needsProfile: existingAuthAccount && !driverCheck.exists
    });
  } catch (error) {
    console.error(`Unhandled error in verify-otp: ${error.message}`);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      error: `Server error while verifying OTP: ${error.message}`
    });
  }
});

// Initialize Firebase and start server
(async () => {
  try {
    await initializeFirebase();
    const port = process.env.PORT || 8082;
    const server = app.listen(port, () => {
      console.log(`OTP service running on port ${port}`);
    });

    // Add proper shutdown handling
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
