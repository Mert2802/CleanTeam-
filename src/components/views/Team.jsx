import React, { useState } from "react";
import { Plus, Users, X, Clipboard, Check, Mail } from "lucide-react";
import { createInvite } from "../../lib/team";

const StaffCard = ({ member }) => (
  <div className="group p-4 border border-slate-200 rounded-2xl flex items-center justify-between gap-4 hover:border-teal-200 transition-colors">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${member.color || "bg-slate-200"} flex items-center justify-center text-white font-bold`}>
        {(member.name || "?").charAt(0)}
      </div>
      <div>
        <p className="font-medium text-slate-900">{member.name || "Unbenannt"}</p>
        <p className="text-xs text-slate-400 flex items-center gap-1"><Mail size={12} /> {member.email || "-"}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-slate-400">{member.role || "staff"}</span>
      <button className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={18} />
      </button>
    </div>
  </div>
);

const InviteModal = ({ code, onClose }) => {
  const [copied, setCopied] = useState(false);
  const registrationUrl = new URL(
    `${import.meta.env.BASE_URL}?invite=${code}`,
    window.location.origin
  ).toString();

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={24} />
        </button>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Einladung erstellt!</h3>
        <p className="text-slate-600 mb-6">
          Sende den Code oder Link an dein neues Teammitglied. Der Code ist 7 Tage gueltig.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Einladungscode</label>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={code} className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono" />
              <button onClick={() => handleCopy(code)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl">
                {copied ? <Check size={20} className="text-green-500" /> : <Clipboard size={20} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Registrierungslink</label>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={registrationUrl} className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
              <button onClick={() => handleCopy(registrationUrl)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl">
                {copied ? <Check size={20} className="text-green-500" /> : <Clipboard size={20} />}
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold mt-6">
          Fertig
        </button>
      </div>
    </div>
  );
};

export default function TeamView({ staff = [], teamId }) {
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState(null);

  const handleInvite = async () => {
    if (!newName || !teamId) return;
    setLoading(true);
    setError("");
    try {
      const code = await createInvite(teamId, newName);
      setInviteCode(code);
      setNewName("");
    } catch (err) {
      setError("Fehler beim Erstellen der Einladung.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <InviteModal code={inviteCode} onClose={() => setInviteCode(null)} />

      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Team</h2>
          <p className="text-slate-500">Mitarbeiter einladen und verwalten.</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-800 mb-3 text-lg">Neues Mitglied einladen</h3>
            <div className={`transition-opacity ${!teamId ? "opacity-50" : ""}`}>
              <div className="flex flex-col md:flex-row gap-4 items-end mb-2">
                <div className="flex-1">
                  <label htmlFor="staffName" className="block text-sm font-medium text-slate-700 mb-1">
                    Name des Mitarbeiters
                  </label>
                  <input
                    id="staffName"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="z.B. Maria Muster"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    disabled={!teamId || loading}
                  />
                </div>
                <button
                  onClick={handleInvite}
                  disabled={!newName || loading || !teamId}
                  className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Plus size={20} />
                  )}
                  Einladung erstellen
                </button>
              </div>
              {!teamId && <p className="text-xs text-orange-500">Team wird initialisiert, bitte einen Moment warten...</p>}
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-4 text-lg flex items-center gap-2">
              <Users size={20} /> Aktuelles Team
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.length > 0 ? (
                staff.map((member) => <StaffCard key={member.id} member={member} />)
              ) : (
                <p className="text-slate-500 italic md:col-span-2">Noch keine Mitarbeiter im Team.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
