import {
  doc,
  addDoc,
  collection,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db, appId } from "../firebase";

/**
 * Erstellt ein neues Team für einen Owner nach der Registrierung.
 * @param {string} ownerUid - Die UID des neuen Owners.
 * @param {string} ownerEmail - Die E-Mail des Owners.
 * @returns {Promise<string>} - Die ID des neu erstellten Teams.
 */
export const createTeamForOwner = async (ownerUid, ownerEmail) => {
  if (!ownerUid) throw new Error("Owner UID ist erforderlich.");

  const batch = writeBatch(db);

  // 1. Neues Team-Dokument erstellen, um eine ID zu erhalten
  const teamRef = doc(collection(db, `artifacts/${appId}/teams`));
  const teamId = teamRef.id;

  batch.set(teamRef, {
    ownerId: ownerUid,
    createdAt: Timestamp.now(),
    name: "Mein Team", // Standardname
    // Wichtig für Security Rules: Map mit Member-Rollen
    members: {
      [ownerUid]: { role: "owner" },
    },
  });

  // 2. Owner als Mitglied in der Subcollection anlegen
  const memberRef = doc(db, `artifacts/${appId}/teams/${teamId}/members`, ownerUid);
  batch.set(memberRef, {
    uid: ownerUid, // Hinzufügen für collectionGroup-Abfragen
    role: "owner",
    email: ownerEmail,
    name: "Admin", // Owner kann seinen Namen später ändern
    createdAt: Timestamp.now(),
  });

  // 3. Standard-Konfiguration für das Team erstellen
  const configRef = doc(db, `artifacts/${appId}/teams/${teamId}/config`, "main");
  batch.set(configRef, {
    apiKey: "",
    corsProxy: "https://proxy.cors.sh/",
    autoSyncInterval: 15, // Standard: alle 15 Minuten
  });

  // 4. User-Profil in der Top-Level-Collection für den schnellen Lookup anlegen
  const userProfileRef = doc(db, "users", ownerUid);
  batch.set(userProfileRef, {
    teamId: teamId,
  });

  await batch.commit();
  return teamId;
};

/**
 * Erstellt einen Einladungscode für einen neuen Mitarbeiter.
 * @param {string} teamId - Die ID des Teams, zu dem eingeladen wird.
 * @param {string} staffName - Der Name des neuen Mitarbeiters.
 * @returns {Promise<string>} - Der generierte Einladungscode.
 */
export const createInvite = async (teamId, staffName) => {
  if (!teamId || !staffName) {
    throw new Error("Team-ID und Name des Mitarbeiters sind erforderlich.");
  }

  // Gültigkeit des Codes: 7 Tage
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const inviteRef = await addDoc(collection(db, `artifacts/${appId}/invites`), {
    teamId,
    staffName,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  return inviteRef.id;
};
