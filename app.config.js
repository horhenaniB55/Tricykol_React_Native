import 'dotenv/config';

export default {
  expo: {
    name: "Tricykol_Driver",
    slug: "Tricykol_Driver",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
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
        backgroundColor: "#ffffff"
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
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Tricykol Driver to use your location.",
          locationWhenInUsePermission: "Allow Tricykol Driver to use your location.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          enableBackgroundLocationUpdates: false
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
