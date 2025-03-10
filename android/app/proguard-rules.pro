# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:
# Default ProGuard rules for React Native / Expo applications

# Keep your application's entry points
-keep class com.tricykol.driver.MainApplication { *; }
-keep class com.tricykol.driver.MainActivity { *; }

# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}

-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  void set*(***);
  *** get*();
}

# React Native navigation libraries
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# React Native Maps
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.google.maps.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Expo
-keep class expo.modules.** { *; }
-keep class expo.interfaces.** { *; }
-keep class expo.core.** { *; }

# Expo Location
-keep class expo.modules.location.** { *; }

# Geolocation
-keep class com.reactnativecommunity.geolocation.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Hermes Engine
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Geolib, ngeohash
-keep class geolib.** { *; }
-keep class ngeohash.** { *; }

# SVG
-keep public class com.horcrux.svg.** { *; }

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# Axios
-keep class com.github.axioscode.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JavaScript interface methods
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.bridge.ReactMethod *;
}

# Keep setters in Views so that animations can still work
-keepclassmembers public class * extends android.view.View {
   void set*(***);
   *** get*();
}

# Zustand (state management)
-keep class zustand.** { *; }

# Prevent stripping of React Native classes
-keep class com.facebook.react.devsupport.** { *; }
-dontwarn com.facebook.react.devsupport.**

# Warn about duplicate class definitions
-dontnote **

# Prevent removal of generic signatures (e.g., for Retrofit)
-keepattributes Signature

# Prevent obfuscation of classes/methods with native methods
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes JavascriptInterface
-keepattributes Exceptions

# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
