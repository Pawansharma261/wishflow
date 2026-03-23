const axios = require('axios');

/**
 * CallMeBot WhatsApp API
 * IMPORTANT: CallMeBot sends messages TO the owner of the API key (i.e., you).
 * It is designed to notify yourself. To notify contacts, you need a paid WhatsApp Business API.
 * 
 * For this app, the "phone" param must be the phone number tied to the API key.
 * We will use the contact's phone number plus the user's whatsapp_api_key (or contact's own key).
 */
const sendWhatsApp = async (phone, message, apiKey) => {
  try {
    const encodedMessage = encodeURIComponent(message);
    const encodedPhone = encodeURIComponent(phone);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodedPhone}&text=${encodedMessage}&apikey=${apiKey}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    // CallMeBot returns HTML — check for success keyword
    const isSuccess = response.data && !response.data.includes('APIKey is invalid') && !response.data.includes('error');
    return { success: isSuccess, data: response.data };
  } catch (error) {
    console.error('WhatsApp Service Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWhatsApp };
