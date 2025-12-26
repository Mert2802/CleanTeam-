import { useAuth } from "./hooks/useAuth";
import Login from "./auth/Login";
import CleanTeamApp from "./CleanTeamApp";

const App = () => {
  const { authUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400">
        Authentifizierung wird geprueft...
      </div>
    );
  }

  return authUser ? <CleanTeamApp authUser={authUser} /> : <Login />;
};

export default App;
