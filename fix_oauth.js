const fs = require('fs');
const path = require('path');

const baseDir = 'wishflow-mobile/src/pages';
const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.jsx'));

// Replace Camera with Instagram in all pages
for (const file of files) {
  const fullPath = path.join(baseDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  let altered = false;
  if (content.includes('Camera')) {
    content = content.replace(/Camera/g, 'Instagram');
    altered = true;
  }
  if (altered) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Reverted Instagram in ${file}`);
  }
}

// Ensure Auth.jsx REDIRECT_URL handles deeper linking correctly
let authContent = fs.readFileSync('wishflow-mobile/src/pages/Auth.jsx', 'utf8');
if (!authContent.includes('Capacitor.isNativePlatform()')) {
  authContent = authContent.replace(
    "const REDIRECT_URL = window.location.origin;",
    "import { Capacitor } from '@capacitor/core';\nconst REDIRECT_URL = Capacitor.isNativePlatform() ? 'com.kptech.wishflow://auth-callback' : window.location.origin;"
  );
  fs.writeFileSync('wishflow-mobile/src/pages/Auth.jsx', authContent, 'utf8');
}

// Inject URL listener in App.jsx
let appContent = fs.readFileSync('wishflow-mobile/src/App.jsx', 'utf8');
if (!appContent.includes('appUrlOpen')) {
  appContent = appContent.replace(
    "import React, { useEffect, useState } from 'react';",
    "import React, { useEffect, useState } from 'react';\nimport { App as CapacitorApp } from '@capacitor/app';"
  );
  
  const listenerLogic = `
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    CapacitorApp.addListener('appUrlOpen', event => {
      const hashData = event.url.split('#')[1];
      if (hashData) {
        const params = new URLSearchParams(hashData.replace(/\\?/g, '&'));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    });
`;
  appContent = appContent.replace(
    "    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {\n      setSession(session);\n    });",
    listenerLogic
  );
  fs.writeFileSync('wishflow-mobile/src/App.jsx', appContent, 'utf8');
}
