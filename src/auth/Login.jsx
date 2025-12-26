import React, { useEffect, useState } from "react";
import { Brush, AlertTriangle } from "lucide-react";
import { signIn, signUpWithInvite } from "./authService";

const getFirebaseErrorMessage = (errorCode) => {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Ungueltiges E-Mail-Format.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Falsche E-Mail oder Passwort.";
    case "auth/weak-password":
      return "Das Passwort muss mindestens 6 Zeichen lang sein.";
    case "auth/email-already-in-use":
      return "Diese E-Mail-Adresse wird bereits verwendet.";
    default:
      return "Ein unbekannter Fehler ist aufgetreten.";
  }
};

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
      setIsLogin(false);
      setInviteCode(invite);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUpWithInvite(email, password, inviteCode);
      }
    } catch (err) {
      console.error(err);
      setError(getFirebaseErrorMessage(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-stone-200 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur shadow-xl rounded-3xl border border-stone-100">
        <div className="p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="p-3 bg-teal-600 text-white rounded-2xl mb-3">
              <Brush size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">CleanTeam</h1>
            <p className="text-slate-500 mt-1">
              {isLogin ? "Willkommen zurueck!" : "Account mit Einladung erstellen"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail Adresse"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
            {!isLogin && (
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Einladungscode"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                isLogin ? "Anmelden" : "Registrieren"
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-50/80 p-4 text-center rounded-b-3xl border-t border-slate-100">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-sm text-teal-700 hover:text-teal-800 font-medium"
          >
            {isLogin
              ? "Kein Account? Mit Einladungscode registrieren"
              : "Du hast bereits einen Account? Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}
