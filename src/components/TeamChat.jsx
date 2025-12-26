import React, { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, appId } from "../firebase";

const formatTime = (timestamp) => {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveName = (authUser, staff) => {
  if (!authUser) return "User";
  const match = staff?.find((member) => member.id === authUser.uid);
  return match?.name || authUser.email || "User";
};

export default function TeamChat({ teamId, authUser, staff }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!teamId) return undefined;
    const messagesRef = collection(db, `artifacts/${appId}/teams/${teamId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(items);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    });
  }, [teamId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !teamId || !authUser) return;

    const senderName = resolveName(authUser, staff);

    await addDoc(collection(db, `artifacts/${appId}/teams/${teamId}/messages`), {
      text: trimmed,
      senderId: authUser.uid,
      senderName,
      senderRole: authUser.role || "member",
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="font-semibold text-slate-800">Team Chat</h3>
        <p className="text-xs text-slate-500">Messages are visible to team members.</p>
      </div>
      <div className="max-h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-500">No messages yet.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold">
                {(msg.senderName || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{msg.senderName || "User"}</p>
                  <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700">{msg.text}</p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}
