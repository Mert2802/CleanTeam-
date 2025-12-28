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
import { db, appId } from "../../firebase";

const formatTime = (timestamp) => {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DirectChat({
  teamId,
  threadId,
  authUser,
  title,
  subtitle,
  toUid,
  className = "",
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (!teamId || !threadId) return undefined;
    setLoading(true);
    setError("");
    const messagesRef = collection(
      db,
      `artifacts/${appId}/teams/${teamId}/directMessages/${threadId}/messages`
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setMessages(items);
        setLoading(false);
      },
      (err) => {
        console.error("Chat Fehler:", err);
        setError("Chat konnte nicht geladen werden.");
        setLoading(false);
      }
    );
  }, [teamId, threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !teamId || !threadId || !authUser) return;

    await addDoc(
      collection(db, `artifacts/${appId}/teams/${teamId}/directMessages/${threadId}/messages`),
      {
        text: trimmed,
        fromUid: authUser.uid,
        toUid: toUid || null,
        createdAt: serverTimestamp(),
      }
    );
    setText("");
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      <div className="p-5 border-b border-slate-100 bg-slate-50/70">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading && <div className="text-sm text-slate-500">Nachrichten werden geladen...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && messages.length === 0 && (
          <div className="text-sm text-slate-500">Noch keine Nachrichten. Starte die Unterhaltung.</div>
        )}
        {!loading && !error && messages.map((msg) => {
          const isMine = msg.fromUid === authUser.uid;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow ${
                isMine ? "bg-teal-600 text-white rounded-br-md" : "bg-slate-100 text-slate-700 rounded-bl-md"
              }`}>
                <p>{msg.text}</p>
                <p className={`text-[10px] mt-1 ${isMine ? "text-teal-100" : "text-slate-400"}`}>{formatTime(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4 flex gap-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nachricht schreiben..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
