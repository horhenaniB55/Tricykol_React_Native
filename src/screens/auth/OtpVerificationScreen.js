import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SCREENS } from '../../constants';
import { Button, Loading } from '../../components/common';
import { AuthService } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';

/**
 * OTP Verification screen component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.navigation - Navigation object
 * @param {Object} props.route - Route object with params
 * @returns {React.ReactElement} OtpVerificationScreen component
 */
export const OtpVerificationScreen = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const { loading: authLoading, error: authError } = useAuthStore();
  
  // References for OTP input fields
  const inputRefs = useRef([]);

  // Start countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle OTP input change
  const handleOtpChange = (text, index) => {
    if (text.length > 1) {
      // If pasting multiple digits, distribute them
      const digits = text.split('').slice(0, 6);
      const newOtp = [...otp];
      
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      
      setOtp(newOtp);
      
      // Focus on the next empty input or the last one
      const nextIndex = Math.min(index + digits.length, 5);
      if (nextIndex < 6) {
        inputRefs.current[nextIndex].focus();
      }
    } else {
      // Handle single digit input
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      
      // Auto-focus next input if current one is filled
      if (text !== '' && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    }
    
    setError('');
  };

  // Handle key press for backspace
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1].focus();
    }
  };

  // Handle verify button press
  const handleVerify = async () => {
    try {
      const otpCode = otp.join('');
      
      // Validate OTP
      if (otpCode.length !== 6) {
        setError('Please enter a valid 6-digit OTP');
        return;
      }

      setIsLoading(true);
      
      // Verify OTP
      const result = await AuthService.verifyOtp(phoneNumber, otpCode);
      
      if (result.success) {
        // Authentication will be handled by the auth state listener in App.js
        console.log('OTP verified successfully');
      } else {
        setError('Failed to verify OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError(error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (timer > 0) return;
    
    try {
      setIsLoading(true);
      await AuthService.sendOtp(phoneNumber);
      setTimer(60);
      setError('');
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Verification Code</Text>
            <Text style={styles.subHeaderText}>
              Enter the 6-digit code sent to {phoneNumber}
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6} // Allow pasting full OTP
                selectTextOnFocus
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            title="VERIFY"
            onPress={handleVerify}
            loading={isLoading}
            disabled={otp.join('').length !== 6}
            style={styles.verifyButton}
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={timer > 0}
            >
              <Text style={[
                styles.resendActionText,
                timer > 0 && styles.resendDisabled
              ]}>
                {timer > 0 ? `Resend in ${timer}s` : 'Resend'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {authLoading && <Loading message="Verifying..." />}
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
    padding: 20,
  },
  headerContainer: {
    marginTop: 40,
    marginBottom: 30,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    textAlign: 'center',
    marginBottom: 10,
  },
  subHeaderText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
  },
  errorText: {
    color: COLORS.ERROR,
    textAlign: 'center',
    marginBottom: 20,
  },
  verifyButton: {
    marginBottom: 20,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: COLORS.GRAY,
  },
  resendActionText: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  resendDisabled: {
    color: COLORS.GRAY,
  },
});
