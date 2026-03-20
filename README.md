# 🌟 WishFlow: Smart Festival & Occasion Wish Scheduler

WishFlow is a full-stack automated celebration assistant that ensures you never miss a chance to wish your loved ones. Scheduled wishes are sent automatically via **WhatsApp**, **Instagram DM**, and **Push Notifications**.

## 🚀 Tech Stack
-   **Frontend:** React (Vite) + Tailwind CSS + Framer Motion
-   **Backend:** Node.js + Express + node-cron
-   **Database:** PostgreSQL (Supabase)
-   **Auth:** Supabase Auth
-   **Messaging:** CallMeBot (WhatsApp), Meta Graph API (Instagram), Firebase FCM (Push)

---

## 🛠️ Step-by-Step Setup

### 1. Database (Supabase) ✅ DONE
1.  **Project Created:** [WishFlow](https://supabase.com/dashboard/project/llqmetaphnxyjtxzdegd)
2.  **Schema Applied:** `backend/db/schema.sql` has been executed.
3.  **Credentials:** `.env` files in `backend/` and `frontend/` have been updated with the Project URL and API Keys.

### 2. WhatsApp (CallMeBot) — FREE
1.  Add `+34 644 20 47 56` to your contacts.
2.  Send a message: `I allow callmebot to send me messages` via WhatsApp.
3.  The bot will reply with your **API Key**.
4.  Enter this key in the **Settings** page of WishFlow.

### 3. Instagram (Meta Graph API)
1.  Create a developer account at [Meta for Developers](https://developers.facebook.com/).
2.  Create an app with **Instagram Basic Display API** and **Instagram Messaging**.
3.  Generate an **Access Token** using the User Token Generator.
4.  Enter the token in the **Settings** page.

### 4. Push Notifications (Firebase)
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Add a Web project.
3.  Go to **Project Settings > Service accounts** and generate a new private key.
4.  Either set the JSON as `FIREBASE_SERVICE_ACCOUNT` or use the file directly in `backend/services/pushService.js`.
5.  Update `frontend/src/lib/firebaseConfig.js` (placeholder created) with your web config.

---

## 💻 Local Development

### Backend
```bash
cd backend
# Create .env with details from .env.example
npm install
npm run dev
```

### Frontend
```bash
cd frontend
# Create .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

---

## 🌍 Deployment
-   **Backend:** Deploy to Render.com or Railway.app (ensure the cron job is active).
-   **Frontend:** Deploy to Vercel (connect repo).

---

## 🎨 UI Preview
-   **Warm Gradients:** `#FF6B8A` to `#7B5EA7`
-   **Glassmorphism:** Premium frosted glass cards.
-   **Micro-animations:** Smooth transitions using Framer Motion.

Developed with ❤️ by Antigravity.
