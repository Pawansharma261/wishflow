const axios = require('axios');

const sendInstagramDM = async (recipientUsername, message, accessToken) => {
  try {
    // Note: To send a DM via Graph API, you usually need the recipient's PSID or IGSID.
    // Instagram Messaging API typically works by responding to users who message you first or via specific IDs.
    // For a simple bot approach, if the user has connected their account:
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    const response = await axios.post(url, {
      recipient: { name: recipientUsername }, // Ideally this should be a numeric ID
      message: { text: message }
    }, {
      params: { access_token: accessToken }
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Instagram Service Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

module.exports = { sendInstagramDM };
