import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

/**
 * Custom input component
 * 
 * @param {Object} props - Component props
 * @param {string} props.label - Input label
 * @param {string} props.value - Input value
 * @param {Function} props.onChangeText - Text change handler
 * @param {string} [props.placeholder] - Input placeholder
 * @param {boolean} [props.secureTextEntry=false] - Hide text for password inputs
 * @param {string} [props.error] - Error message
 * @param {Object} [props.style] - Additional container style
 * @param {Object} [props.inputStyle] - Additional input style
 * @param {string} [props.keyboardType='default'] - Keyboard type
 * @param {boolean} [props.autoCapitalize='none'] - Auto capitalize
 * @param {boolean} [props.editable=true] - Whether the input is editable
 * @returns {React.ReactElement} Input component
 */
export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  style,
  inputStyle,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          !editable && styles.disabledInput,
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.GRAY}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: COLORS.WHITE,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.TEXT,
    backgroundColor: COLORS.GRAY_LIGHT,
  },
  inputError: {
    borderColor: COLORS.ERROR,
  },
  disabledInput: {
    backgroundColor: COLORS.GRAY_LIGHT,
    color: COLORS.GRAY,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 12,
    marginTop: 4,
  },
});
