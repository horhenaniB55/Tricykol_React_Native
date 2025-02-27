/**
 * Truncates a string to a specified length, adding ellipsis if needed.
 *
 * @param {string} str The string to truncate.
 * @param {number} maxLength The maximum length of the truncated string.
 * @returns {string} The truncated string.
 */
export const truncateString = (str, maxLength) => {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
};
