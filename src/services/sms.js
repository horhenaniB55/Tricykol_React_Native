export const SmsService = {
  sendPriorityMessage: async (phoneNumber, message) => {
    try {
      const formData = new URLSearchParams();
      formData.append('apikey', process.env.SEMAPHORE_API_KEY);
      formData.append('number', phoneNumber.replace('+', '')); // Remove + from phone number
      formData.append('message', message);

      const response = await fetch('https://semaphore.co/api/v4/priority', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();
      console.log('SMS API Response:', data); // Add logging for debugging
      return data;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  },

  sendGuardianAlert: async (guardianContact, tripDetails) => {
    const { 
      passengerName,
      driverName, 
      driverPhone, 
      plateNumber, 
      pickupLocation, 
      dropoffLocation,
      timestamp 
    } = tripDetails;

    // Format message with more readable structure
    const message = 
      `TRICYKOL ALERT:\n` +
      `Passenger: ${passengerName}\n` +
      `Has been picked up by:\n` +
      `Driver: ${driverName}\n` +
      `Contact: ${driverPhone}\n` +
      `Plate #: ${plateNumber}\n` +
      `From: ${pickupLocation}\n` +
      `To: ${dropoffLocation}\n` +
      `Time: ${new Date(timestamp).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`;

    // Use the existing sendPriorityMessage method
    return SmsService.sendPriorityMessage(guardianContact, message);
  }
}; 