import React, { useState } from "react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db, appId } from "../../firebase";
import { Edit, MapPin, Users, AlertTriangle, X, Plus, Trash2, Save, CheckCircle } from "lucide-react";

const safeArray = (v) => (Array.isArray(v) ? v : []);
const DEFAULT_CHECKLIST = [
  "Bettwaesche gewechselt",
  "Muell entsorgt und neue Beutel",
  "Bad und Kueche desinfiziert",
  "Boeden gesaugt und gewischt",
  "Oberflaechen abgestaubt",
];

export default function PropertiesView({ properties, staff, teamId, tasks }) {
  const [editingProp, setEditingProp] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProperty = async (prop) => {
    if (!teamId || !prop) return;
    setIsSaving(true);
    try {
      const propRef = doc(db, `artifacts/${appId}/teams/${teamId}/properties`, prop.id);
      await updateDoc(propRef, {
        defaultStaff: safeArray(prop.defaultStaff),
        checklist: safeArray(prop.checklist).length ? safeArray(prop.checklist) : DEFAULT_CHECKLIST,
      });

      const isUnassigned = (assignedTo) => {
        if (Array.isArray(assignedTo)) return assignedTo.length === 0;
        return !assignedTo;
      };
      const matchesProperty = (task) => {
        if (prop.apartmentId != null && task.apartmentId != null) {
          return String(task.apartmentId) === String(prop.apartmentId);
        }
        return prop.name && task.apartment === prop.name;
      };

      const pendingTasks = safeArray(tasks).filter(
        (task) =>
          task?.status === "pending" &&
          matchesProperty(task) &&
          isUnassigned(task.assignedTo)
      );

      if (pendingTasks.length > 0) {
        const batch = writeBatch(db);
        pendingTasks.forEach((task) => {
          const taskRef = doc(db, `artifacts/${appId}/teams/${teamId}/tasks`, task.id);
          batch.update(taskRef, {
            assignedTo: safeArray(prop.defaultStaff),
          });
        });
        await batch.commit();
      }

      setEditingProp(null);
    } catch (error) {
      console.error("Fehler beim Speichern des Objekts:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (editingProp) {
    return (
      <PropertyEditView
        property={editingProp}
        staff={staff}
        onClose={() => setEditingProp(null)}
        onSave={handleSaveProperty}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Objekte</h2>
        <p className="text-slate-500">Stamm-Team und Checklisten konfigurieren.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {properties.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400 italic">
            Keine Objekte gefunden. Fuehre einen Sync durch, um Objekte anzulegen.
          </div>
        )}
        {properties.map((prop) => {
          const defaultStaffMembers = safeArray(prop.defaultStaff)
            .map((sid) => staff.find((s) => s.id === sid))
            .filter(Boolean);

          return (
            <div key={prop.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{prop.name}</h3>
                  <p className="text-xs text-slate-400">{prop.apartmentId ? `ID: ${prop.apartmentId}` : "Keine ID"}</p>
                </div>
                <button
                  onClick={() => setEditingProp(prop)}
                  className="bg-slate-100 text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-200"
                >
                  <Edit size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  {prop.lat ? (
                    <span className="text-emerald-600 flex items-center gap-1"><MapPin size={12} /> Standort gesetzt</span>
                  ) : (
                    <span className="text-orange-500 flex items-center gap-1"><AlertTriangle size={12} /> Standort fehlt</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Standard-Team</p>
                <div className="mt-2 flex -space-x-2">
                  {defaultStaffMembers.map((member) => (
                    <div
                      key={member.id}
                      title={member.name}
                      className={`w-9 h-9 rounded-full border-2 border-white ${member.color || "bg-slate-400"} flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {member.name?.charAt(0) || "?"}
                    </div>
                  ))}
                  {defaultStaffMembers.length === 0 && <span className="text-slate-400 italic text-xs">Kein Team</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PropertyEditView = ({ property, staff, onClose, onSave, isSaving }) => {
  const [editedProp, setEditedProp] = useState(property);
  const [checklistInput, setChecklistInput] = useState("");

  const toggleStaffSelection = (staffId) => {
    const current = safeArray(editedProp.defaultStaff);
    const newStaff = current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId];
    setEditedProp((prev) => ({ ...prev, defaultStaff: newStaff }));
  };

  const addChecklistItem = () => {
    if (!checklistInput.trim()) return;
    const newChecklist = [...safeArray(editedProp.checklist), checklistInput.trim()];
    setEditedProp((prev) => ({ ...prev, checklist: newChecklist }));
    setChecklistInput("");
  };

  const removeChecklistItem = (index) => {
    const newChecklist = [...safeArray(editedProp.checklist)];
    newChecklist.splice(index, 1);
    setEditedProp((prev) => ({ ...prev, checklist: newChecklist }));
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <h3 className="text-xl font-bold text-slate-800">{editedProp.name} bearbeiten</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users size={18} /> Stamm-Team</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-100 rounded-2xl p-3">
            {staff.map((s) => (
              <div
                key={s.id}
                onClick={() => toggleStaffSelection(s.id)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${safeArray(editedProp.defaultStaff).includes(s.id) ? "bg-teal-50 border-teal-200" : "bg-white border-transparent hover:bg-slate-50"}`}
              >
                <div className={`w-9 h-9 rounded-full ${s.color || "bg-gray-400"} flex items-center justify-center text-white font-bold text-xs`}>
                  {safeArray(editedProp.defaultStaff).includes(s.id) && <CheckCircle size={14} />}
                </div>
                <span className="text-sm font-medium text-slate-700">{s.name}</span>
              </div>
            ))}
            {staff.length === 0 && <p className="text-sm text-slate-400 italic">Kein Personal vorhanden.</p>}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users size={18} /> Checkliste</h4>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={checklistInput}
              onChange={(e) => setChecklistInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
              placeholder="Neuer Punkt..."
              className="flex-1 px-3 py-2 border rounded-xl text-sm"
            />
            <button onClick={addChecklistItem} className="bg-slate-100 text-slate-600 p-2 rounded-xl hover:bg-slate-200"><Plus size={20} /></button>
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {safeArray(editedProp.checklist).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl group">
                <span className="text-sm text-slate-700">{item}</span>
                <button onClick={() => removeChecklistItem(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
              </div>
            ))}
            {safeArray(editedProp.checklist).length === 0 && <p className="text-xs text-slate-400 italic">Standard-Liste wird verwendet.</p>}
          </div>
        </div>
      </div>
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">Abbrechen</button>
        <button onClick={() => onSave(editedProp)} disabled={isSaving} className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
          <Save size={18} /> {isSaving ? "Speichern..." : "Speichern"}
        </button>
      </div>
    </div>
  );
};
