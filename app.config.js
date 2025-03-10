import 'dotenv/config';

export default {
  expo: {
    name: "Tricykol Driver",
    slug: "Tricykol Driver",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/tricykol_driver.png",
      resizeMode: "contain",
      backgroundColor: "#263E61"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tricykol.driver",
      googleServicesFile: "./GoogleService-Info.plist",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs access to location when open to show your position on the map.",
        NSLocationAlwaysUsageDescription: "This app needs access to location when in the background for navigation.",
        UIBackgroundModes: ["location"]
      }
    },
    android: {
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        },
        locationServices: {
          promptOnLowAccuracy: false
        }
      },
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ],
      package: "com.tricykol.driver",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#263E61"
      }
    },
    plugins: [
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ],
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#263E61",
          "image": "./assets/tricykol_driver.png",
          "imageWidth": 200
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Tricykol Driver needs your location to show your position on the map and process bookings even when the app is in background.",
          locationWhenInUsePermission: "Tricykol Driver needs your location to show your position on the map and process bookings.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          enableBackgroundLocationUpdates: true,
          android: {
            backgroundPermissionRationale: "Tricykol Driver needs 'Allow all the time' permission to track your location for bookings even when the app is closed."
          }
        }
      ]
    ],
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    }
  }
};
