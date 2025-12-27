/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDXjzLGXPS4fxMooU4MITdRSKZdoRnDU9U",
  authDomain: "cleanteam-96578.firebaseapp.com",
  projectId: "cleanteam-96578",
  storageBucket: "cleanteam-96578.firebasestorage.app",
  messagingSenderId: "1049033412494",
  appId: "1:1049033412494:web:f26ca5a7e433fe91711edf",
});

const messaging = firebase.messaging();
const iconBaseUrl = self.registration?.scope || "/";

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "CleanTeam";
  const options = {
    body: payload?.notification?.body || "",
    icon: new URL("cleanteam-icon-192.png", iconBaseUrl).toString(),
    badge: new URL("cleanteam-icon-192.png", iconBaseUrl).toString(),
    data: payload?.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
      return null;
    })
  );
});
