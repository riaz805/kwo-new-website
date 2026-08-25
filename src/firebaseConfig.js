/**
 * Firebase configuration & initialization — kept in its own file
 * (imported by App.jsx / HomePage.jsx) so the rest of the app never
 * touches Firebase config values directly.
 *
 * IMPORTANT: No API key or secret is hard-coded here. Every value
 * is read from environment variables. You must create a `.env` file
 * in your project root (and make sure `.env` is in `.gitignore` —
 * never commit it) with the following keys:
 *
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=...
 *   VITE_FIREBASE_PROJECT_ID=...
 *   VITE_FIREBASE_STORAGE_BUCKET=...
 *   VITE_FIREBASE_MESSAGING_SENDER_ID=...
 *   VITE_FIREBASE_APP_ID=...
 *
 * Where to get these values:
 *   Firebase Console → (your project) → Project settings (gear icon)
 *   → General tab → "Your apps" → Web app → SDK setup and configuration
 *
 * NOTE ON BUILD TOOLS:
 * The `import.meta.env.VITE_...` syntax below is for a Vite-based
 * React project (the most common setup for a plain React app deployed
 * on Vercel). If this project actually uses Next.js instead:
 *   1. Rename each env var's prefix from VITE_ to NEXT_PUBLIC_
 *   2. Replace every `import.meta.env.VITE_...` below with
 *      `process.env.NEXT_PUBLIC_...`
 * If you're not sure which one applies, check whether your project
 * has a `vite.config.js` (→ Vite) or a `next.config.js` (→ Next.js).
 *
 * In Vercel's dashboard, add the same keys under:
 *   Project → Settings → Environment Variables
 * so the deployed site has them too (a local `.env` file only works
 * on your own machine).
 */
 
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
 
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
 
// Guard against re-initializing (React StrictMode / hot reload can
// otherwise call this file's module body twice).
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
 
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export default firebaseApp;
