import React from 'react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <div className="container mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-2xl">✨</div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">WishFlow Privacy Policy</h1>
            <p className="text-slate-500 text-sm">Last updated: March 23, 2026</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-8 text-slate-700 leading-relaxed">
          
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introduction</h2>
            <p>WishFlow is a product of <strong>KP Technologies</strong> ("we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our WishFlow application and related services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Account Information:</strong> Email address and authentication credentials when you register</li>
              <li><strong>Contact Data:</strong> Names, phone numbers, Camera usernames, and special dates of your contacts that you voluntarily add</li>
              <li><strong>Wish Content:</strong> Messages you draft and schedule to be sent</li>
              <li><strong>API Keys:</strong> Third-party API keys (CallMeBot, Camera) you provide to enable messaging features</li>
              <li><strong>Usage Data:</strong> App usage patterns, features used, and interaction logs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To deliver automated birthday and celebration wishes on your behalf</li>
              <li>To schedule and manage your wish calendar</li>
              <li>To send notifications via WhatsApp and Camera at your chosen times</li>
              <li>To improve and personalize the app experience</li>
              <li>To maintain security and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Camera & Facebook Data</h2>
            <p>WishFlow uses the Meta (Facebook/Camera) Graph API to send messages on Camera. We only request the minimum permissions required (<code>instagram_manage_messages</code>, <code>instagram_basic</code>). We do not:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Store your Facebook or Camera password</li>
              <li>Access your private messages beyond what is required to send your scheduled wishes</li>
              <li>Share Camera data with third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Storage & Security</h2>
            <p>Your data is stored securely using Supabase (PostgreSQL) with row-level security policies ensuring you can only access your own data. All API communications use HTTPS encryption.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Data Sharing</h2>
            <p>We do not sell, trade, or share your personal data with third parties except for the service providers required to operate WishFlow:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong>Supabase</strong> — Database hosting</li>
              <li><strong>Render</strong> — Backend server hosting</li>
              <li><strong>Vercel</strong> — Frontend hosting</li>
              <li><strong>Meta (Facebook/Camera)</strong> — Message delivery via Camera</li>
              <li><strong>CallMeBot</strong> — WhatsApp message delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Data Deletion</h2>
            <p>You can delete your account and all associated data at any time by contacting us at <a href="mailto:pawansharmavats61@gmail.com" className="text-purple-600 underline">pawansharmavats61@gmail.com</a>. We will process deletion requests within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at:</p>
            <p className="mt-2"><strong>Email:</strong> <a href="mailto:pawansharmavats61@gmail.com" className="text-purple-600 underline">pawansharmavats61@gmail.com</a></p>
          </section>
        </div>

        <div className="text-center mt-10">
          <Link to="/auth" className="text-purple-600 font-bold hover:underline">← Back to WishFlow</Link>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
