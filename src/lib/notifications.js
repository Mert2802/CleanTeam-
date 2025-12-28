import { getMessaging, getToken, deleteToken, onMessage, isSupported } from "firebase/messaging";
import { arrayRemove, arrayUnion, deleteField, doc, setDoc } from "firebase/firestore";
import { app, db } from "../firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const BASE_URL = import.meta.env.DEV ? "/" : import.meta.env.BASE_URL || "/";
const SW_URL = `${BASE_URL}firebase-messaging-sw.js`;

let cachedMessaging = null;

async function getMessagingInstance() {
  if (cachedMessaging) return cachedMessaging;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  cachedMessaging = getMessaging(app);
  return cachedMessaging;
}

export async function isPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const supported = await isSupported().catch(() => false);
  return supported;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "service-worker-unsupported" };
  }

  let registration = await navigator.serviceWorker.getRegistration(SW_URL).catch(() => null);
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register(SW_URL);
    } catch (err) {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
      return { ok: false, reason: "service-worker-register-failed" };
    }
  }

  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("sw-timeout")), 8000)),
    ]);
    return { ok: true, registration: ready };
  } catch (err) {
    console.warn("Service Worker nicht ready, nutze Registrierung:", err);
    return { ok: true, registration };
  }
}

export async function enablePushNotifications({ uid }) {
  if (!VAPID_KEY) {
    return { ok: false, reason: "missing-vapid-key" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return { ok: false, reason: "unsupported" };
  }

  const swResult = await ensureServiceWorker();
  if (!swResult.ok) {
    return { ok: false, reason: swResult.reason };
  }

  const registration = swResult.registration;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return { ok: false, reason: "no-token" };
  }

  await setDoc(
    doc(db, "users", uid),
    {
      pushToken: token,
      pushTokens: arrayUnion(token),
      pushEnabled: true,
      pushUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { ok: true, token };
}

export async function disablePushNotifications({ uid }) {
  if (!VAPID_KEY) {
    return { ok: false, reason: "missing-vapid-key" };
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return { ok: false, reason: "unsupported" };
  }

  const swResult = await ensureServiceWorker();
  if (!swResult.ok) {
    return { ok: false, reason: swResult.reason };
  }

  const registration = swResult.registration;
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    await deleteToken(messaging);
    await setDoc(
      doc(db, "users", uid),
      {
        pushToken: deleteField(),
        pushTokens: arrayRemove(token),
        pushEnabled: false,
        pushUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  return { ok: true };
}

export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
