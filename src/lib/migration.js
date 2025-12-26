import { collection, doc, getDocs, getDoc, writeBatch } from "firebase/firestore";
import { db, appId } from "../firebase";

const BATCH_SIZE = 450; // Firestore batch limit is 500

/**
 * Migriert Daten von der alten `users/{uid}`-Struktur zur neuen `teams/{teamId}`-Struktur.
 * @param {string} uid - Die UID des Owners, von dem migriert wird.
 * @param {string} teamId - Die ID des Ziel-Teams.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const migrateData = async (uid, teamId, { dryRun = false } = {}) => {
  if (!uid || !teamId) {
    return { success: false, message: "Benutzer-ID und Team-ID sind erforderlich." };
  }

  console.log(`Migration gestartet für uid: ${uid} -> teamId: ${teamId}. Dry Run: ${dryRun}`);

  try {
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalOperations = 0;

    const oldBasePath = `artifacts/${appId}/users/${uid}`;
    const newBasePath = `artifacts/${appId}/teams/${teamId}`;

    const collectionsToMigrate = ["staff", "properties", "tasks"];

    for (const coll of collectionsToMigrate) {
      const oldCollRef = collection(db, oldBasePath, coll);
      const snapshot = await getDocs(oldCollRef);

      if (snapshot.empty) {
        console.log(`-> Sammlung '${coll}' ist leer, wird übersprungen.`);
        continue;
      }
      
      console.log(`-> Migriere ${snapshot.size} Dokumente aus der Sammlung '${coll}'...`);

      for (const oldDoc of snapshot.docs) {
        if (operationCount >= BATCH_SIZE) {
            if (!dryRun) await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
        }
        const newDocRef = doc(db, newBasePath, coll, oldDoc.id);
        
        console.log(`  - Plane Set: ${newDocRef.path}`);
        if (!dryRun) batch.set(newDocRef, oldDoc.data());
        
        operationCount++;
        totalOperations++;
      }
    }
    
    // Migriere die Konfiguration
    const oldConfigRef = doc(db, oldBasePath, "config", "main");
    const oldConfigSnap = await getDoc(oldConfigRef);
    if(oldConfigSnap.exists()) {
        console.log("-> Migriere Konfigurationsdokument...");
        if (operationCount >= BATCH_SIZE) {
            if (!dryRun) await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
        }
        const newConfigRef = doc(db, newBasePath, "config", "main");
        
        console.log(`  - Plane Set (merge): ${newConfigRef.path}`);
        if (!dryRun) batch.set(newConfigRef, oldConfigSnap.data(), { merge: true });
        
        operationCount++;
        totalOperations++;
    } else {
        console.log("-> Keine alte Konfiguration gefunden, wird übersprungen.");
    }


    if (operationCount > 0 && !dryRun) {
      await batch.commit();
    }
    
    const message = dryRun 
        ? `Dry Run abgeschlossen. ${totalOperations} Operationen würden ausgeführt.`
        : `Daten erfolgreich migriert! ${totalOperations} Operationen ausgeführt.`;
    
    console.log(message);
    return { success: true, message };

  } catch (error) {
    console.error("Fehler bei der Datenmigration:", error);
    return { success: false, message: `Ein Fehler ist aufgetreten: ${error.message}` };
  }
};
