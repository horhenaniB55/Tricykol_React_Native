# Tricykol Driver App

Mobile application for Tricykol drivers built with React Native and Expo.

## Project Structure

```
src/
├── assets/            # Static assets like images, fonts, etc.
├── components/        # Reusable UI components
│   ├── common/        # Common UI components used across the app
│   └── map/           # Map-related components
├── constants/         # App-wide constants and configuration
├── hooks/             # Custom React hooks
├── navigation/        # Navigation configuration
├── screens/           # App screens
│   ├── auth/          # Authentication screens (login, OTP verification)
│   └── main/          # Main app screens (home, profile, etc.)
├── services/          # API and service integrations
├── store/             # State management (Zustand)
└── utils/             # Utility functions
```

## Features

- **Authentication**
  - SMS OTP verification
  - Passwordless login
  - Firebase authentication

- **Driver Profile**
  - View and manage driver profile
  - Online/offline status toggle

- **Map Integration**
  - Real-time location tracking
  - Nearby booking discovery
  - Trip navigation

- **Booking Management**
  - View and accept nearby bookings
  - Trip status updates
  - Fare calculation

- **Wallet**
  - View wallet balance
  - Transaction history
  - Top-up requests

## Technologies

- React Native
- Expo
- Firebase (Authentication, Firestore, Storage)
- Mapbox for maps
- Zustand for state management
- React Navigation for routing

## Getting Started

### Prerequisites

- Node.js
- npm or yarn
- Expo CLI
- Firebase account
- Mapbox API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your API keys:
   ```
   MAPBOX_ACCESS_TOKEN=your_mapbox_token
   ```
4. Start the development server:
   ```
   npm start
   ```

## OTP Service

The app uses a custom OTP service for SMS verification. The service is built with Node.js and Firebase, and it's deployed on Google Cloud Run.

### OTP Flow

1. User enters phone number
2. App sends request to OTP service
3. Service generates OTP and sends via SMS
4. User enters OTP
5. App verifies OTP with service
6. Service returns Firebase custom token
7. App uses token to authenticate with Firebase
