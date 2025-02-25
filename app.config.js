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
      googleServicesFile: "./GoogleService-Info.plist"
    },
    android: {
      googleServicesFile: "./google-services.json",
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
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
      ["@rnmapbox/maps", {
        RNMapboxMapsImpl: "mapbox",
        RNMapboxMapsDownloadToken: process.env.MAPBOX_ACCESS_TOKEN,
        RNMapboxMapsVersion: "10.16.2"
      }],
    ],
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN
    }
  }
};
