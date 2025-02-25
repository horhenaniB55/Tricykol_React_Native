/**
 * Formatting and validation utility functions
 */

/**
 * Format phone number for display
 * 
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('63')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  
  // Return as is if it doesn't match expected formats
  return phoneNumber;
};

/**
 * Format currency (PHP)
 * 
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
export const formatCurrency = (amount) => {
  return `₱${amount.toFixed(2)}`;
};

/**
 * Format date and time
 * 
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
};

/**
 * Format date only
 * 
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

/**
 * Format time only
 * 
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted time
 */
export const formatTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
};

/**
 * Validate phone number
 * 
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} Whether the phone number is valid
 */
export const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // Remove non-numeric characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check if it's a valid PH number
  if (cleaned.startsWith('+63') && cleaned.length === 13) {
    return true;
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    return true;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    return true;
  } else if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    // Assuming this is a PH number without the leading 0
    return true;
  }
  
  return false;
};

/**
 * Format a phone number with country code
 * 
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number with country code
 */
export const formatWithCountryCode = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove non-numeric characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Already has +63 prefix
  if (cleaned.startsWith('+63')) {
    return cleaned;
  }
  
  // Has 63 prefix without +
  if (cleaned.startsWith('63')) {
    return `+${cleaned}`;
  }
  
  // Has 0 prefix (PH format)
  if (cleaned.startsWith('0')) {
    return `+63${cleaned.substring(1)}`;
  }
  
  // No prefix, assume it's a PH number
  return `+63${cleaned}`;
};
