import React, { useState } from 'react';
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db, appId } from "../../firebase";
import { Edit, MapPin, Users, AlertTriangle, X, Plus, Trash2, Save, CheckCircle } from 'lucide-react';

const safeArray = (v) => (Array.isArray(v) ? v : []);
const DEFAULT_CHECKLIST = [
  "Bettwäsche gewechselt",
  "Müll entsorgt & Neue Beutel",
  "Bad & Küche desinfiziert",
  "Böden gesaugt & gewischt",
  "Oberflächen abgestaubt",
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
        return <PropertyEditView 
                    property={editingProp} 
                    staff={staff} 
                    onClose={() => setEditingProp(null)}
                    onSave={handleSaveProperty}
                    isSaving={isSaving}
               />
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Objektverwaltung</h2>
                <p className="text-slate-500">Stamm-Personal und individuelle Checklisten konfigurieren.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="p-4">Objektname</th>
                            <th className="p-4">Team (Standard)</th>
                            <th className="p-4">Standort</th>
                            <th className="p-4 text-right">Aktion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-slate-400 italic">
                                    Keine Objekte gefunden. Führe einen Sync durch, um automatisch Objekte anzulegen.
                                </td>
                            </tr>
                        )}
                        {properties.map((prop) => {
                            const defaultStaffMembers = safeArray(prop.defaultStaff).map(sid => staff.find(s => s.id === sid)).filter(Boolean);

                            return (
                                <tr key={prop.id} className="hover:bg-slate-50 group">
                                    <td className="p-4 font-medium text-slate-800">{prop.name}</td>
                                    <td className="p-4">
                                        <div className="flex -space-x-2">
                                            {defaultStaffMembers.map((member) => (
                                                <div
                                                    key={member.id}
                                                    title={member.name}
                                                    className={`w-8 h-8 rounded-full border-2 border-white ${member.color || 'bg-slate-400'} flex items-center justify-center text-white text-xs font-bold`}
                                                >
                                                    {member.name?.charAt(0) || '?'}
                                                </div>
                                            ))}
                                            {defaultStaffMembers.length === 0 && <span className="text-slate-400 italic text-xs">Kein Team</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {prop.lat ? (
                                            <span className="text-emerald-600 flex items-center gap-1"><MapPin size={12} /> Gesetzt</span>
                                        ) : (
                                            <span className="text-orange-400 flex items-center gap-1"><AlertTriangle size={12} /> Fehlt</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => setEditingProp(prop)}
                                            className="bg-white border border-slate-200 text-slate-600 p-2 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                        >
                                            <Edit size={16} /> Bearbeiten
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Sub-Komponente für die Bearbeitungsansicht
const PropertyEditView = ({ property, staff, onClose, onSave, isSaving }) => {
    const [editedProp, setEditedProp] = useState(property);
    const [checklistInput, setChecklistInput] = useState("");

    const toggleStaffSelection = (staffId) => {
        const current = safeArray(editedProp.defaultStaff);
        const newStaff = current.includes(staffId) 
            ? current.filter(id => id !== staffId)
            : [...current, staffId];
        setEditedProp(prev => ({...prev, defaultStaff: newStaff}));
    };

    const addChecklistItem = () => {
        if (!checklistInput.trim()) return;
        const newChecklist = [...safeArray(editedProp.checklist), checklistInput.trim()];
        setEditedProp(prev => ({...prev, checklist: newChecklist}));
        setChecklistInput("");
    };


    const removeChecklistItem = (index) => {
        const newChecklist = [...safeArray(editedProp.checklist)];
        newChecklist.splice(index, 1);
        setEditedProp(prev => ({...prev, checklist: newChecklist}));
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold text-slate-800">{editedProp.name} bearbeiten</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users size={18} /> Stamm-Team zuweisen</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-100 rounded-lg p-2">
                         {staff.map((s) => (
                            <div key={s.id} onClick={() => toggleStaffSelection(s.id)} className={`flex items-center gap-3 p-2 rounded cursor-pointer border transition-colors ${safeArray(editedProp.defaultStaff).includes(s.id) ? "bg-blue-50 border-blue-200" : "bg-white border-transparent hover:bg-slate-50"}`}>
                                <div className={`w-8 h-8 rounded-full ${s.color || 'bg-gray-400'} flex items-center justify-center text-white font-bold text-xs`}>{safeArray(editedProp.defaultStaff).includes(s.id) && <CheckCircle size={14} />}</div>
                                <span className="text-sm font-medium text-slate-700">{s.name}</span>
                            </div>
                        ))}
                        {staff.length === 0 && <p className="text-sm text-slate-400 italic">Kein Personal vorhanden.</p>}
                    </div>
                </div>
                 <div>
                    <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users size={18} /> Checkliste</h4>
                    <div className="flex gap-2 mb-3">
                        <input type="text" value={checklistInput} onChange={e => setChecklistInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addChecklistItem()} placeholder="Neuer Punkt..." className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                        <button onClick={addChecklistItem} className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200"><Plus size={20} /></button>
                    </div>
                     <div className="space-y-1 max-h-60 overflow-y-auto">
                        {safeArray(editedProp.checklist).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded group">
                                <span className="text-sm text-slate-700">{item}</span>
                                <button onClick={() => removeChecklistItem(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                            </div>
                        ))}
                         {safeArray(editedProp.checklist).length === 0 && <p className="text-xs text-slate-400 italic">Standard-Liste wird verwendet.</p>}
                    </div>
                </div>
            </div>
             <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Abbrechen</button>
                <button onClick={() => onSave(editedProp)} disabled={isSaving} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
                    <Save size={18} /> {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
            </div>
        </div>
    );
};
