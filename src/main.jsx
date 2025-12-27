import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.DEV ? "/" : import.meta.env.BASE_URL;
    const swUrl = `${baseUrl}firebase-messaging-sw.js`;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
