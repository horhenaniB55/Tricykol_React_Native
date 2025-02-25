require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

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
      // Log environment info
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

// Verify OTP Endpoint
app.post('/verify-otp', async (req, res) => {
  try {
    if (!isFirebaseInitialized) {
      const success = await initializeFirebase();
      if (!success) {
        throw new Error('Firebase initialization failed');
      }
    }

    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    // Get or create OTP collection
    const otpCollection = await ensureOtpCollection();

    // Get stored OTP from Firestore
    const otpDoc = await otpCollection.doc(phone).get();
    
    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'OTP not found' });
    }

    const otpData = otpDoc.data();
    
    if (Date.now() > otpData.expiresAt) {
      // Delete expired OTP
      await otpCollection.doc(phone).delete();
      return res.status(400).json({ error: 'OTP expired' });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Delete used OTP
    await otpCollection.doc(phone).delete();

    // Create or get Firebase user
    const user = await admin.auth().getUserByPhoneNumber(phone)
      .catch(() => admin.auth().createUser({ phoneNumber: phone }));

    // Generate custom token
    const token = await admin.auth().createCustomToken(user.uid);

    res.json({ 
      success: true, 
      token,
      uid: user.uid,
      isNewUser: user.metadata.creationTime === user.metadata.lastSignInTime
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize Firebase and start server
(async () => {
  try {
    await initializeFirebase();
    const port = process.env.PORT || 8080;
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
