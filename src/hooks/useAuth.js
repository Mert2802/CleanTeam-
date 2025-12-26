import { useState, useEffect } from "react";
import { onAuthUserChanged } from "../auth/authService";

/**
 * Ein Hook zur Verwaltung des Authentifizierungsstatus des Benutzers.
 * Stellt das `authUser`-Objekt (mit Team- und Rollen-Informationen)
 * und einen Ladezustand bereit.
 *
 * @returns {{
 *   authUser: Object | null,
 *   isLoading: boolean,
 *   isOwner: boolean,
 *   isStaff: boolean,
 *   teamId: string | null
 * }}
 */
export const useAuth = () => {
  const [authUser, setAuthUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // onAuthUserChanged liefert den angereicherten Benutzer
    // (inkl. Team-ID und Rolle) oder null.
    const unsubscribe = onAuthUserChanged((user) => {
      setAuthUser(user);
      setIsLoading(false);
    });

    // Beim Unmount des Hooks die Subscription beenden
    return () => unsubscribe();
  }, []);

  return {
    authUser,
    isLoading,
    isOwner: authUser?.role === "owner",
    isStaff: authUser?.role === "staff",
    teamId: authUser?.teamId || null,
  };
};
