const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');

// Try to load service account from file first, then fall back to env var
let serviceAccount;
const keyPath = path.join(__dirname, '..', 'firebase-key.json');

if (fs.existsSync(keyPath)) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log('Firebase Admin: Found firebase-key.json');
  } catch (e) {
    console.error('Firebase Admin: Error parsing firebase-key.json:', e.message);
  }
}

if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').trim();
    }
    console.log('Firebase Admin: Found FIREBASE_SERVICE_ACCOUNT env var');
  } catch (e) {
    console.error('Firebase Admin: Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e.message);
  }
}

if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin: Initialized successfully');
  } catch (e) {
    console.error('Firebase Admin: Initialization failed:', e.message);
    console.warn('Firebase Push Notifications will be disabled.');
  }
} else {
  console.warn('Firebase Admin: No service account provided. Push Notifications will be disabled.');
}

const sendPushNotification = async (token, title, body) => {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized. Skipping push.');
    return { success: false, error: 'Firebase not initialized' };
  }

  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: token
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, data: response };
  } catch (error) {
    console.error('Push Notification Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPushNotification };
