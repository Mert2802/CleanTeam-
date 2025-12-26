import React, { useEffect, useState } from "react";
import { Save, RefreshCw, Server, Clock, AlertTriangle, HardDriveUpload } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, appId } from "../../firebase";
import { syncWithSmoobu } from "../../lib/smoobu";
import { migrateData } from "../../lib/migration";
import { repairTeamLinks } from "../../lib/repair";

export default function SettingsView({ authUser, teamId, settings: initialSettings, existingTasks, existingProperties }) {
  const [settings, setSettings] = useState(initialSettings || {});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", error: false });

  useEffect(() => {
    setSettings(initialSettings || {});
  }, [initialSettings]);

  const handleSave = async () => {
    if (!teamId) return;
    setIsSaving(true);
    setFeedback({ message: "", error: false });
    try {
      const settingsRef = doc(db, `artifacts/${appId}/teams/${teamId}/config`, "main");
      await setDoc(settingsRef, settings, { merge: true });
      setFeedback({ message: "Einstellungen gespeichert.", error: false });
    } catch (err) {
      console.error(err);
      setFeedback({ message: "Fehler beim Speichern.", error: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback({ message: "Synchronisierung wird gestartet...", error: false });
    const result = await syncWithSmoobu({ 
        teamId, 
        settings,
        existingTasks,
        existingProperties
    });
    setFeedback({ message: result.message, error: !result.success });
    setIsSyncing(false);
  };
  
  const handleMigration = async () => {
    if (!window.confirm("Bist du sicher, dass du die Daten aus deinem alten anonymen Account migrieren möchtest? Dieser Vorgang kann nicht rückgängig gemacht werden.")) {
      return;
    }
    setIsMigrating(true);
    setFeedback({ message: "Migration wird gestartet...", error: false });
    const result = await migrateData(authUser.uid, teamId, { dryRun: false });
    setFeedback({ message: result.message, error: !result.success });
    setIsMigrating(false);
  };


  const handleRepair = async () => {
    setIsRepairing(true);
    setFeedback({ message: "Repair running...", error: false });
    const result = await repairTeamLinks({ teamId });
    setFeedback({ message: result.message, error: !result.success });
    setIsRepairing(false);
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
        ...prev,
        [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Einstellungen & Sync</h2>
        <p className="text-slate-500">Verbindung zu Smoobu & Systemkonfiguration.</p>
      </div>
      
      {feedback.message && (
        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${
            feedback.error
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          <AlertTriangle size={16} /> {feedback.message}
        </div>
      )}

      <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4 transition-opacity ${!teamId ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <h3 className="font-semibold text-lg text-slate-800">Smoobu API</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
          <input
            type="password"
            name="apiKey"
            value={settings?.apiKey || ""}
            onChange={handleChange}
            placeholder="Dein API Key von Smoobu..."
            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={!teamId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">CORS Proxy URL (Optional)</label>
          <div className="flex items-center gap-2">
            <Server size={18} className="text-slate-400" />
            <input
              type="text"
              name="corsProxy"
              value={settings?.corsProxy || ""}
              onChange={handleChange}
              placeholder="z.B. https://proxy.cors.sh/"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={!teamId}
            />
          </div>
          <p className="text-xs text-orange-600 mt-1 p-2 bg-orange-50 rounded border border-orange-200">
            <strong>Wichtig:</strong> Öffentliche Proxys sind unzuverlässig und unsicher. Für den produktiven Einsatz wird dringend empfohlen, einen eigenen CORS-Proxy (z.B. mit Cloudflare Workers oder CORS Anywhere) zu betreiben.
          </p>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !teamId}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? "Speichern..." : "Einstellungen speichern"}
          </button>
        </div>
      </div>
      
      <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4 transition-opacity ${!teamId ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <h3 className="font-semibold text-lg text-slate-800">Synchronisierung</h3>
         <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Automatischer Sync (Minuten)
          </label>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-slate-400" />
            <input
              type="number"
              name="autoSyncInterval"
              min="0"
              value={settings?.autoSyncInterval || ""}
              onChange={handleChange}
              placeholder="0 = Deaktiviert"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={!teamId}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Stelle 0 ein, um den Auto-Sync zu deaktivieren.</p>
        </div>
         <div className="pt-4 flex justify-end">
           <button
            onClick={handleManualSync}
            disabled={isSyncing || !teamId}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Lade Daten..." : "Manueller Sync"}
          </button>
        </div>
      </div>

      <div className={`bg-white p-6 rounded-xl shadow-sm border border-orange-200/80 space-y-4 transition-opacity ${!teamId ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <h3 className="font-semibold text-lg text-orange-800 flex items-center gap-2"><HardDriveUpload size={20}/> Datenmigration</h3>
        <p className="text-sm text-slate-600">
            Wenn du diese App bereits vor der Einführung von Benutzer-Accounts genutzt hast,
            kannst du hier deine alten Daten (Personal, Objekte, Aufgaben) in dein neues Team-Konto importieren.
        </p>
         <div className="pt-4 flex justify-end">
           <button
            onClick={handleMigration}
            disabled={isMigrating || !teamId}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 disabled:opacity-50"
          >
            <HardDriveUpload size={18} className={isMigrating ? "animate-spin" : ""} />
            {isMigrating ? "Migriere Daten..." : "Alte Daten jetzt migrieren"}
          </button>
        </div>
      </div>

      <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 transition-opacity ${!teamId ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <h3 className="font-semibold text-lg text-slate-800">Repair Team Links</h3>
        <p className="text-sm text-slate-600">
          Rebuilds users/{'{uid}'} and teams/{'{teamId}'}/members linkage from existing member docs.
        </p>
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleRepair}
            disabled={isRepairing || !teamId}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
          >
            <HardDriveUpload size={18} className={isRepairing ? "animate-spin" : ""} />
            {isRepairing ? "Repairing..." : "Run Repair"}
          </button>
        </div>
      </div>

    </div>
  );
}
