const axios = require('axios');

const sendWhatsApp = async (phone, message, apiKey) => {
  try {
    // CallMeBot API: https://api.callmebot.com/whatsapp.php?phone={phone}&text={message}&apikey={key}
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    const response = await axios.get(url);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('WhatsApp Service Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWhatsApp };
