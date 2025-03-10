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
  const [formattedPhoneNumber, setFormattedPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { error: authError } = useAuthStore();

  // Format phone number as user types
  const handlePhoneChange = (text) => {
    // Remove non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 11 digits
    const limited = cleaned.slice(0, 11);
    
    // Store the raw value
    setPhoneNumber(limited);
    
    // Format for display (09XX XXX XXXX)
    let formatted = '';
    if (limited.length > 0) {
      // First part (09XX)
      formatted = limited.slice(0, 4);
      
      // Add space and second part (XXX) if available
      if (limited.length > 4) {
        formatted += ' ' + limited.slice(4, 7);
        
        // Add space and third part (XXXX) if available
        if (limited.length > 7) {
          formatted += ' ' + limited.slice(7, 11);
        }
      }
    }
    
    setFormattedPhoneNumber(formatted);
    setError('');
  };

  // Validate phone number
  const validatePhoneNumber = (number) => {
    if (!number) {
      return 'Please enter your mobile number';
    }
    
    if (number.length !== 11) {
      return 'Mobile number must be 11 digits';
    }
    
    if (!number.startsWith('09')) {
      return 'Mobile number must start with 09';
    }
    
    return null;
  };

  // Handle login button press
  const handleLogin = async () => {
    try {
      // Validate phone number
      const validationError = validatePhoneNumber(phoneNumber);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsLoading(true);
      
      // Format phone number with country code
      // Convert 09XXXXXXXXX to +639XXXXXXXXX
      const formattedNumber = `+63${phoneNumber.substring(1)}`;
      
      console.log('Sending OTP to:', formattedNumber);
      
      // Use the store's sendOtp method
      const result = await useAuthStore.getState().sendOtp(formattedNumber);
      
      if (result.success) {
        console.log('OTP sent successfully, navigating to verification screen');
        
        // Make sure we're using the exact screen name from constants
        console.log('Navigating to screen:', SCREENS.OTP_VERIFICATION);
        
        // Navigate immediately without setTimeout
        navigation.navigate(SCREENS.OTP_VERIFICATION, { 
          phoneNumber: formattedNumber 
        });
      } else {
        console.error('Failed to send OTP:', result.error);
        setError(result.error || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle register button press
  const handleRegister = () => {
    // Open the Tricykol registration website in the default browser
    const registrationUrl = 'https://tricykol-driver-register-666017533126.asia-southeast1.run.app/register';
    
    Linking.openURL(registrationUrl)
      .catch(err => {
        console.error('Error opening registration website:', err);
        alert(`Could not open the registration website. Please visit ${registrationUrl} manually.`);
      });
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
            <Image 
              source={require('../../../assets/tricykol_driver.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.formContainer}>
            <Input
              label="Mobile Number"
              value={formattedPhoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="09XX XXX XXXX"
              keyboardType="phone-pad"
              error={error}
              maxLength={13} // 11 digits + 2 spaces
            />
            
            <Text style={styles.helperText}>
              Enter your 11-digit mobile number starting with 09
            </Text>

            <Button
              title="LOG IN"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!phoneNumber || phoneNumber.length !== 11 || isLoading}
              style={styles.loginButton}
            />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.registerText}>REGISTER</Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By tapping "Log in", I accept the Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#263E61",
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
  logoImage: {
    width: 300,
    height: 150,
  },
  formContainer: {
    width: '100%',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: -12,
    marginBottom: 16,
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
