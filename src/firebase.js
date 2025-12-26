import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Deine Firebase-Konfiguration.
// Diese Werte findest du in deiner Firebase-Projektübersicht.
const firebaseConfig = {
  apiKey: "AIzaSyDXjzLGXPS4fxMooU4MITdRSKZdoRnDU9U",
  authDomain: "cleanteam-96578.firebaseapp.com",
  projectId: "cleanteam-96578",
  storageBucket: "cleanteam-96578.firebasestorage.app",
  messagingSenderId: "1049033412494",
  appId: "1:1049033412494:web:f26ca5a7e433fe91711edf",
};

// Firebase-App initialisieren
const app = initializeApp(firebaseConfig);

// Firebase-Dienste exportieren
export const auth = getAuth(app);
export const db = getFirestore(app);

// Globale App-ID für die Firestore-Pfade
export const appId = "cleanteam-test";
