const axios = require('axios');

/**
 * Instagram Messaging via Meta Graph API
 * 
 * To send an Instagram DM, you need:
 * 1. The recipient's Instagram Scoped ID (IGSID) - NOT their username
 * 2. Your Page-connected Access Token with instagram_manage_messages permission
 * 3. The conversation must already exist (user must have messaged your page first)
 * 
 * For now, we simulate a professional approach:
 * - If we have the IGSID, we use the real API
 * - Otherwise we log a "pending" status that requires manual setup
 */
const sendInstagramDM = async (recipientUsername, message, accessToken) => {
  try {
    if (!accessToken) {
      return { success: false, error: 'No Instagram access token configured. Please add it in Settings.' };
    }

    // Step 1: Get the Instagram Business Account ID
    const meResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: { fields: 'id,name,instagram_business_account', access_token: accessToken },
      timeout: 10000
    });

    const igAccountId = meResponse.data?.instagram_business_account?.id;
    if (!igAccountId) {
      return { 
        success: false, 
        error: 'No Instagram Business Account linked to this Facebook Page token. Please connect your Instagram account in Meta Business Suite.'
      };
    }

    // Step 2: Try to find the user by username in existing conversations
    // (Real API requires the user to have messaged you first to get their IGSID)
    const convoResponse = await axios.get(`https://graph.facebook.com/v18.0/${igAccountId}/conversations`, {
      params: { 
        fields: 'participants,messages{message}',
        access_token: accessToken,
        platform: 'instagram'
      },
      timeout: 10000
    });

    // Find participant matching the username
    let recipientId = null;
    for (const convo of (convoResponse.data?.data || [])) {
      const participant = convo.participants?.data?.find(p => 
        p.username?.toLowerCase() === recipientUsername.toLowerCase()
      );
      if (participant) {
        recipientId = participant.id;
        break;
      }
    }

    if (!recipientId) {
      return { 
        success: false, 
        error: `Could not find existing conversation with @${recipientUsername}. The recipient must message your Instagram business account first.`
      };
    }

    // Step 3: Send the message
    const sendResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${igAccountId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message }
      },
      { params: { access_token: accessToken }, timeout: 10000 }
    );

    return { success: true, data: sendResponse.data };
  } catch (error) {
    const errData = error.response?.data?.error || error.message;
    console.error('Instagram Service Error:', errData);
    return { success: false, error: errData };
  }
};

module.exports = { sendInstagramDM };
