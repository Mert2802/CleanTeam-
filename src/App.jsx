import { useAuth } from "./hooks/useAuth";
import Login from "./auth/Login";
import CleanTeamApp from "./CleanTeamApp"; // Diese wird später refaktorieriert

const App = () => {
  const { authUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        Authentifizierung wird geprüft...
      </div>
    );
  }

  return authUser ? <CleanTeamApp authUser={authUser} /> : <Login />;
};

export default App;
