import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./auth/Login";
import CleanTeamApp from "./CleanTeamApp";

const PERMISSION_DEFAULT = "default";

const PermissionsGate = ({ children }) => {
  const [locationStatus, setLocationStatus] = useState(PERMISSION_DEFAULT);
  const [notificationStatus, setNotificationStatus] = useState(PERMISSION_DEFAULT);

  useEffect(() => {
    let mounted = true;

    const syncStatuses = async () => {
      if (typeof Notification !== "undefined") {
        setNotificationStatus(Notification.permission);
      } else {
        setNotificationStatus("unsupported");
      }

      if (!("geolocation" in navigator)) {
        setLocationStatus("unsupported");
        return;
      }

      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: "geolocation" });
          if (mounted) setLocationStatus(status.state);
          status.onchange = () => {
            if (mounted) setLocationStatus(status.state);
          };
          return;
        } catch (err) {
          console.warn("Geolocation permission check failed:", err);
        }
      }

      setLocationStatus(PERMISSION_DEFAULT);
    };

    syncStatuses();
    return () => {
      mounted = false;
    };
  }, []);

  const requestLocation = () =>
    new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        setLocationStatus("unsupported");
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationStatus("granted");
          resolve(true);
        },
        () => {
          setLocationStatus("denied");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      setNotificationStatus("unsupported");
      return false;
    }
    const result = await Notification.requestPermission();
    setNotificationStatus(result);
    return result === "granted";
  };

  const hasAccess = locationStatus === "granted" && notificationStatus === "granted";

  if (hasAccess) return children;

  return (
    <div className="h-screen bg-[var(--ct-bg)] text-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white shadow-xl rounded-3xl border border-slate-100 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Zugriff erforderlich</h1>
          <p className="text-slate-500 text-sm mt-1">
            Um die App zu nutzen, muessen Standort und Mitteilungen erlaubt sein.
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <span>Standort</span>
            <span className={locationStatus === "granted" ? "text-emerald-600" : "text-slate-500"}>
              {locationStatus}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <span>Mitteilungen</span>
            <span className={notificationStatus === "granted" ? "text-emerald-600" : "text-slate-500"}>
              {notificationStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={requestLocation}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            Standort erlauben
          </button>
          <button
            onClick={requestNotifications}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
          >
            Mitteilungen erlauben
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Falls du abgelehnt hast, aendere die Berechtigungen in den Browser- bzw. iOS-Einstellungen
          und lade die App neu.
        </p>
      </div>
    </div>
  );
};

const App = () => {
  const { authUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        Authentifizierung wird geprueft...
      </div>
    );
  }

  return authUser ? (
    <PermissionsGate>
      <CleanTeamApp authUser={authUser} />
    </PermissionsGate>
  ) : (
    <Login />
  );
};

export default App;
