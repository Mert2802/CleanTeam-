import React, { useMemo, useState } from "react";
import { Search, User } from "lucide-react";
import DirectChat from "./DirectChat";

const safeArray = (v) => (Array.isArray(v) ? v : []);

export default function AdminChat({ teamId, authUser, staff }) {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  const staffList = useMemo(() => {
    return safeArray(staff).filter((member) => member.id !== authUser.uid);
  }, [staff, authUser.uid]);

  const filtered = staffList.filter((member) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${member.name || ""} ${member.email || ""}`.toLowerCase().includes(term);
  });

  const activeMember = staffList.find((m) => m.id === selectedId) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[70vh]">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Chats</h3>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mitarbeiter suchen"
              className="w-full text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-slate-500">Kein Mitarbeiter gefunden.</div>
          )}
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedId(member.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 hover:bg-slate-50 ${
                selectedId === member.id ? "bg-teal-50" : "bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-full ${member.color || "bg-slate-200"} flex items-center justify-center text-white font-bold`}>
                {(member.name || "?").charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{member.name || "Unbenannt"}</p>
                <p className="text-xs text-slate-500">{member.role || "staff"}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="h-full">
        {activeMember ? (
          <DirectChat
            teamId={teamId}
            threadId={activeMember.id}
            authUser={authUser}
            title={activeMember.name || "Mitarbeiter"}
            subtitle="Direkter Chat"
            toUid={activeMember.id}
          />
        ) : (
          <div className="h-full bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-slate-500">
            <User size={28} className="text-slate-300" />
            <p className="mt-2">Waehle einen Mitarbeiter aus, um zu chatten.</p>
          </div>
        )}
      </div>
    </div>
  );
}
