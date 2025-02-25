import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SCREENS } from '../../constants';
import { Button, Input, Loading } from '../../components/common';
import { AuthService } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';

/**
 * Login screen component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.navigation - Navigation object
 * @returns {React.ReactElement} LoginScreen component
 */
export const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { loading: authLoading, error: authError } = useAuthStore();

  // Format phone number as user types
  const handlePhoneChange = (text) => {
    // Remove non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    setPhoneNumber(cleaned);
    setError('');
  };

  // Handle login button press
  const handleLogin = async () => {
    try {
      // Validate phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }

      setIsLoading(true);
      
      // Format phone number with country code if not already present
      const formattedNumber = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+63${phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber}`;
      
      // Send OTP
      await AuthService.sendOtp(formattedNumber);
      
      // Navigate to OTP verification screen
      navigation.navigate(SCREENS.OTP_VERIFICATION, { phoneNumber: formattedNumber });
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle register button press
  const handleRegister = () => {
    // For now, just show an alert that registration is on the website
    alert('Please register on the Tricykol website');
    // In a real app, you might open the website in a browser
    // Linking.openURL('https://tricykol.com/register');
  };

  // Display error from auth store if present
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>TRICYKOL</Text>
            <Text style={styles.logoSubtext}>driver</Text>
          </View>

          <View style={styles.formContainer}>
            <Input
              label="Mobile Number"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="0967 057 5500"
              keyboardType="phone-pad"
              error={error}
            />

            <Button
              title="LOG IN"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!phoneNumber || phoneNumber.length < 10}
              style={styles.loginButton}
            />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
            >
              <Text style={styles.registerText}>REGISTER</Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By tapping "Log in", I accept the Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {authLoading && <Loading message="Please wait..." />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.BLACK,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  logoSubtext: {
    fontSize: 24,
    color: COLORS.WHITE,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: COLORS.PRIMARY,
  },
  registerButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  registerText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    marginTop: 20,
    color: COLORS.WHITE,
    textAlign: 'center',
    fontSize: 12,
  },
});
