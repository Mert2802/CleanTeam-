import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, appId } from "../firebase";
import { createTeamForOwner } from "../lib/team";

const getPendingInvite = () => {
  try {
    return window?.sessionStorage?.getItem("pendingInvite") || "";
  } catch {
    return "";
  }
};

const clearPendingInvite = () => {
  try {
    window?.sessionStorage?.removeItem("pendingInvite");
  } catch {
    // ignore
  }
};

export const signIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

const waitForAuthUser = (uid, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.uid === uid) {
        unsubscribe();
        resolve();
      }
    });

    setTimeout(() => {
      unsubscribe();
      resolve();
    }, timeoutMs);
  });

/**
 * Meldet den aktuellen Benutzer ab.
 * @returns {Promise<void>}
 */
export const signOut = () => {
  return firebaseSignOut(auth);
};

/**
 * Registriert einen neuen Mitarbeiter mit einem Einladungscode.
 * Erstellt den Firebase-Benutzer und fuegt ihn zum richtigen Team hinzu.
 * @param {string} email - Die E-Mail des neuen Mitarbeiters.
 * @param {string} password - Das Passwort des neuen Mitarbeiters.
 * @param {string} inviteCode - Der Einladungscode.
 * @returns {Promise<void>}
 */
export const signUpWithInvite = async (email, password, inviteCode) => {
  if (!inviteCode) throw new Error("Einladungscode ist erforderlich.");

  // 1. Einladungscode validieren
  const inviteRef = doc(db, `artifacts/${appId}/invites`, inviteCode);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists() || inviteSnap.data().expiresAt.toDate() < new Date()) {
    throw new Error("Ungueltiger oder abgelaufener Einladungscode.");
  }

  const { teamId, staffName } = inviteSnap.data();

  // 2. Firebase-Benutzer erstellen
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = userCredential;
  await waitForAuthUser(user.uid);
  await user.getIdToken(true);

  // 3. Benutzer zum Team hinzufuegen und Einladung loeschen (atomarer Batch-Write)
  const batch = writeBatch(db);

  // a) Teammitglied anlegen
  const memberRef = doc(db, `artifacts/${appId}/teams/${teamId}/members`, user.uid);
  batch.set(memberRef, {
    uid: user.uid, // Hinzufuegen fuer collectionGroup-Abfragen
    role: "staff",
    name: staffName,
    email: user.email,
    createdAt: Timestamp.now(),
  });

  // b) Update des `members` Map-Feldes im Team-Dokument fuer Security Rules
  const teamRef = doc(db, `artifacts/${appId}/teams`, teamId);
  batch.update(teamRef, {
    [`members.${user.uid}`]: {
      role: "staff",
    }
  });

  // c) Einladung loeschen
  batch.delete(inviteRef);

  // d) User-Profil in der Top-Level-Collection fuer den schnellen Lookup anlegen
  const userProfileRef = doc(db, "users", user.uid);
  batch.set(userProfileRef, {
    teamId: teamId,
  });

  await batch.commit();
  clearPendingInvite();
};

const applyInviteToExistingUser = async (user, inviteCode) => {
  if (!inviteCode) return null;
  const inviteRef = doc(db, `artifacts/${appId}/invites`, inviteCode);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists() || inviteSnap.data().expiresAt.toDate() < new Date()) {
    throw new Error("Ungueltiger oder abgelaufener Einladungscode.");
  }

  const { teamId, staffName } = inviteSnap.data();
  const batch = writeBatch(db);

  const memberRef = doc(db, `artifacts/${appId}/teams/${teamId}/members`, user.uid);
  batch.set(memberRef, {
    uid: user.uid,
    role: "staff",
    name: staffName || user.email?.split("@")[0] || "Staff",
    email: user.email || "",
    createdAt: Timestamp.now(),
  });

  const teamRef = doc(db, `artifacts/${appId}/teams`, teamId);
  batch.update(teamRef, {
    [`members.${user.uid}`]: { role: "staff" },
  });

  const userProfileRef = doc(db, "users", user.uid);
  batch.set(userProfileRef, { teamId }, { merge: true });

  batch.delete(inviteRef);

  await batch.commit();
  clearPendingInvite();
  return { teamId, role: "staff" };
};

const resolveTeamInfo = async (user) => {
  const userProfileRef = doc(db, "users", user.uid);
  const userProfileSnap = await getDoc(userProfileRef);

  if (userProfileSnap.exists()) {
    const { teamId } = userProfileSnap.data();
    if (!teamId) throw new Error(`User-Profil ${user.uid} hat keine teamId.`);

    const memberRef = doc(db, `artifacts/${appId}/teams/${teamId}/members`, user.uid);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      const fallbackName = user.email ? user.email.split("@")[0] : "Staff";
      await setDoc(memberRef, {
        uid: user.uid,
        role: "staff",
        name: fallbackName,
        email: user.email || "",
        createdAt: Timestamp.now(),
      }, { merge: true });
      return { teamId, role: "staff" };
    }

    return { teamId, role: memberSnap.data().role };
  }

  const memberQuery = query(
    collectionGroup(db, "members"),
    where("uid", "==", user.uid)
  );
  const memberSnapshot = await getDocs(memberQuery);
  if (memberSnapshot.empty) return null;

  const memberDoc = memberSnapshot.docs[0];
  const teamId = memberDoc.ref.parent.parent?.id;
  if (!teamId) return null;

  await setDoc(userProfileRef, { teamId }, { merge: true });
  return { teamId, role: memberDoc.data().role };
};

/**
 * Ueberwacht den Authentifizierungsstatus und reichert die Benutzerdaten
 * mit Team- und Rolleninformationen an. Erstellt ein Team, falls noetig.
 * @param {function} callback - Die Funktion, die mit dem `authUser` (oder null) aufgerufen wird.
 * @returns {Unsubscribe} - Die Abmeldefunktion.
 */
export const onAuthUserChanged = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        let resolved = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          resolved = await resolveTeamInfo(user);
          if (resolved) break;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        if (!resolved) {
          const pendingInvite = getPendingInvite();
          if (pendingInvite) {
            try {
              resolved = await applyInviteToExistingUser(user, pendingInvite);
            } catch (inviteError) {
              console.error("Einladung konnte nicht angewendet werden:", inviteError);
            }
          }
        }

        if (!resolved) {
          console.log(`Benutzer ${user.uid} hat kein Profil, erstelle jetzt Team...`);
          const newTeamId = await createTeamForOwner(user.uid, user.email);
          console.log(`Team ${newTeamId} für ${user.uid} erstellt.`);
          resolved = { teamId: newTeamId, role: "owner" };
        }

        callback({
          uid: user.uid,
          email: user.email,
          teamId: resolved.teamId,
          role: resolved.role,
        });
      } catch (error) {
        console.error("Fataler Fehler bei der Auth-Verarbeitung:", error);
        callback(null); // Bei gravierenden Fehlern ausloggen
      }
    } else {
      // Benutzer ist abgemeldet
      callback(null);
    }
  });
};
