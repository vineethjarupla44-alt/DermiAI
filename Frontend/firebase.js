import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyClMzMfGyQuqsMQ7lIUHr0M2nZS5025Klg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dermiai-fe0bb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dermiai-fe0bb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dermiai-fe0bb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "15952648049",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:15952648049:web:b3da45997cbf89910a88d0",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VLKVDP19BL",
};

// Initialize Firebase safely without duplicate app initialization on Vite HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export default app;
