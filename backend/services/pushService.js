// Push notifications are disabled — firebase-admin removed to fix Render build times.
// This is a stub that safely no-ops all push calls.

const sendPushNotification = async (token, title, body) => {
  console.log(`[Push] DISABLED — would have sent: "${title}" to token ${token?.slice(0,8)}...`);
  return { success: false, error: 'Push notifications disabled' };
};

module.exports = { sendPushNotification };
