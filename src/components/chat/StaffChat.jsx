import React from "react";
import DirectChat from "./DirectChat";

const safeArray = (v) => (Array.isArray(v) ? v : []);

export default function StaffChat({ teamId, authUser, staff, fullscreen = false, className = "" }) {
  const owner = safeArray(staff).find((member) => member.role === "owner");

  if (!owner) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-6 text-sm text-slate-500">
        Kein Administrator gefunden. Chat ist nicht verfuegbar.
      </div>
    );
  }

  return (
    <DirectChat
      teamId={teamId}
      threadId={authUser.uid}
      authUser={authUser}
      title={owner.name || "Admin"}
      subtitle="Direkter Chat"
      toUid={owner.id}
      className={`${fullscreen ? "h-full min-h-0" : "h-[420px] md:h-[520px] max-h-[70vh]"} ${className}`}
    />
  );
}
