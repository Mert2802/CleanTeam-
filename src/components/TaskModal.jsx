import React, { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, appId } from "../firebase";
import { CheckCircle, X } from "lucide-react";

const safeArray = (v) => (Array.isArray(v) ? v : []);

const statusOptions = [
  { value: "pending", label: "Offen" },
  { value: "in-progress", label: "In Arbeit" },
  { value: "completed", label: "Erledigt" },
];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCoord = (loc) => {
  if (!loc) return "-";
  const lat = typeof loc.lat === "number" ? loc.lat.toFixed(5) : "-";
  const lng = typeof loc.lng === "number" ? loc.lng.toFixed(5) : "-";
  const acc = typeof loc.accuracy === "number" ? ` (±${Math.round(loc.accuracy)}m)` : "";
  return `${lat}, ${lng}${acc}`;
};

export default function TaskModal({
  task,
  staff,
  teamId,
  onClose,
  onSave,
  isSaving,
}) {
  const [assignedTo, setAssignedTo] = useState(safeArray(task?.assignedTo));
  const [status, setStatus] = useState(task?.status || "pending");
  const [notes, setNotes] = useState(task?.notes || "");
  const [guestName, setGuestName] = useState(task?.guestName || "");
  const [workLogs, setWorkLogs] = useState({});

  useEffect(() => {
    setAssignedTo(safeArray(task?.assignedTo));
    setStatus(task?.status || "pending");
    setNotes(task?.notes || "");
    setGuestName(task?.guestName || "");
  }, [task]);

  useEffect(() => {
    const loadLogs = async () => {
      if (!teamId || !task?.id) return;
      const ids = safeArray(task.assignedTo);
      const entries = await Promise.all(
        ids.map(async (uid) => {
          const logRef = doc(
            db,
            `artifacts/${appId}/teams/${teamId}/tasks/${task.id}/workLogs`,
            uid
          );
          const snap = await getDoc(logRef);
          return [uid, snap.exists() ? snap.data() : null];
        })
      );
      const next = {};
      entries.forEach(([uid, data]) => {
        if (data) next[uid] = data;
      });
      setWorkLogs(next);
    };
    loadLogs();
  }, [teamId, task?.id, task?.assignedTo]);

  const staffById = useMemo(
    () => new Map(safeArray(staff).map((s) => [s.id, s])),
    [staff]
  );

  if (!task) return null;

  const toggleStaff = (staffId) => {
    setAssignedTo((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleSave = () => {
    onSave?.(task.id, {
      assignedTo,
      status,
      notes,
      guestName,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Aufgabe</p>
            <h3 className="text-2xl font-bold text-slate-900">{task.apartment || "Ohne Titel"}</h3>
            <p className="text-sm text-slate-500">{task.date || "Kein Datum"}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <div className="mt-2 flex gap-2">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                      status === opt.value
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Gastname</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Optional"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Notiz</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Zusatzinfos fuer das Team"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {task.issueReport && (
              <div className="bg-amber-50 text-amber-900 rounded-2xl p-4 text-sm border border-amber-200">
                <p className="font-semibold mb-1">Gemeldetes Problem</p>
                <p>{task.issueReport}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-sm">
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Zeiterfassung</p>
              <div className="space-y-2">
                {Object.keys(workLogs).length === 0 && (
                  <p className="text-slate-500">Noch keine Zeiterfassung vorhanden.</p>
                )}
                {Object.entries(workLogs).map(([uid, log]) => {
                  const name = staffById.get(uid)?.name || uid;
                  return (
                    <div key={uid} className="rounded-xl bg-white border border-slate-100 p-3">
                      <p className="font-semibold text-slate-800">{name}</p>
                      <p className="text-xs text-slate-500">Start: {formatDateTime(log?.startedAt)}</p>
                      <p className="text-xs text-slate-500">Stop: {formatDateTime(log?.completedAt)}</p>
                      {log?.startLocation && (
                        <p className="text-xs text-slate-400">
                          GPS Start: {formatCoord(log.startLocation)}
                        </p>
                      )}
                      {log?.endLocation && (
                        <p className="text-xs text-slate-400">
                          GPS Ende: {formatCoord(log.endLocation)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Zustaendiges Team</label>
              <div className="mt-3 flex flex-wrap gap-2">
                {safeArray(staff).map((member) => {
                  const isAssigned = assignedTo.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleStaff(member.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
                        isAssigned
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-teal-200"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${member.color || "bg-slate-400"}`} />
                      {member.name || "Unbenannt"}
                      {isAssigned && <CheckCircle size={14} />}
                    </button>
                  );
                })}
                {safeArray(staff).length === 0 && (
                  <p className="text-xs text-slate-400">Kein Personal angelegt.</p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs uppercase tracking-widest text-slate-400">Zuweisung</p>
              <div className="mt-3 space-y-2">
                {safeArray(assignedTo).length === 0 && (
                  <p className="text-sm text-slate-500">Noch niemand zugewiesen.</p>
                )}
                {safeArray(assignedTo).map((id) => (
                  <div key={id} className="text-sm text-slate-700">
                    {staffById.get(id)?.name || id}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60"
          >
            {isSaving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
