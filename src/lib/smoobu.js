import { doc, writeBatch, collection, getDocs, Timestamp } from "firebase/firestore";
import { db, appId } from "../firebase";

const DEFAULT_CHECKLIST = [
  "Bettwäsche gewechselt",
  "Müll entsorgt & Neue Beutel",
  "Bad & Küche desinfiziert",
  "Böden gesaugt & gewischt",
  "Oberflächen abgestaubt",
];

const safeArray = (v) => (Array.isArray(v) ? v : []);

// Erstellt eine stabile Dokument-ID für ein Property
const makePropertyDocId = (apartmentId, apartmentName) => {
    if (apartmentId) return `apt_${String(apartmentId)}`;
    const cleaned = String(apartmentName || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
    return `name_${cleaned || "unknown"}`;
};

// Hilfsfunktion für Batch-Writes, um das 500-Operationen-Limit zu umgehen
const BatchWriter = (firestore) => {
    let batch = writeBatch(firestore);
    let ops = 0;
    const MAX_OPS = 450;
  
    const commitIfNeeded = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = writeBatch(firestore);
      ops = 0;
    };
  
    const ensureRoom = async (needed = 1) => {
      if (ops + needed >= MAX_OPS) await commitIfNeeded();
    };
  
    const set = async (ref, data, options) => {
      await ensureRoom(1);
      batch.set(ref, data, options);
      ops += 1;
    };
  
    const update = async (ref, data) => {
      await ensureRoom(1);
      batch.update(ref, data);
      ops += 1;
    };
  
    return { set, update, commitIfNeeded };
};


/**
 * Synchronisiert Buchungen von der Smoobu API und schreibt sie als Aufgaben in Firestore.
 * @param {object} params - Die Parameter für den Sync.
 * @param {string} params.teamId - Die ID des Teams.
 * @param {object} params.settings - Die App-Einstellungen mit API-Key und Proxy.
 * @param {Array} params.existingTasks - Bereits im State vorhandene Aufgaben zur Deduplizierung.
 * @param {Array} params.existingProperties - Bereits im State vorhandene Objekte.
 * @returns {Promise<{
 *   success: boolean,
 *   message: string,
 *   stats: { createdTasks: number, updatedTasks: number, createdProps: number }
 * }>} - Ein Objekt mit dem Ergebnis des Syncs.
 */
export const syncWithSmoobu = async ({ teamId, settings, existingTasks = [], existingProperties = [] }) => {
  if (!teamId) return { success: false, message: "Team-ID fehlt.", stats: {} };
  if (!settings?.apiKey) return { success: false, message: "Smoobu API Key ist nicht gesetzt.", stats: {} };

  try {
    const from = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]; // 2 Tage zurück
    const to = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0]; // 60 Tage voraus

    // HIER ist der Punkt für eine zukünftige Serverless-Architektur.
    // Aktuell wird die Anfrage client-seitig über einen Proxy gesendet.
    // Zukünftig könnte hier ein Aufruf an eine Firebase Function oder einen Cloudflare Worker stehen,
    // der die `teamId` und die Daten (`from`, `to`) erhält und die Anfrage serverseitig macht.
    // z.B.: const response = await callServerlessSmoobuProxy({ teamId, from, to });
    const endpoint = `https://login.smoobu.com/api/reservations?from=${from}&to=${to}&excludeBlocked=true`;
    const proxy = settings.corsProxy || "";
    const url = `${proxy}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Api-Key": settings.apiKey,
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`API Fehler: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Defensive Prüfung: API kann 'bookings' oder 'reservations' zurückgeben
    const reservations = data.bookings || data.reservations || [];

    if (reservations.length === 0) {
      return { success: true, message: "Sync erfolgreich, keine anstehenden Buchungen gefunden.", stats: { createdTasks: 0, updatedTasks: 0, createdProps: 0 } };
    }

    const existingTasksById = new Map(existingTasks.map((t) => [t.id, t]));
    const propsByAptId = new Map(
        existingProperties.filter(p => p.apartmentId != null).map(p => [String(p.apartmentId), p])
    );

    const bw = BatchWriter(db);
    const baseRef = `artifacts/${appId}/teams/${teamId}`;
    
    let createdTasks = 0;
    let updatedTasks = 0;
    let createdProps = 0;

    for (const res of reservations) {
        // Defensive Daten-Extraktion
        const departureDate = res?.departure;
        if (!departureDate) continue;

        const apartmentName = res?.apartment?.name || `Wohnung ID ${res?.apartmentId ?? "unbekannt"}`;
        const apartmentId = res?.apartmentId != null ? String(res.apartmentId) : null;

        let propConfig = apartmentId ? propsByAptId.get(apartmentId) : null;
        
        // Property anlegen, falls nicht über ID gefunden
        if (!propConfig) {
            const propDocId = makePropertyDocId(apartmentId, apartmentName);
            const propRef = doc(db, baseRef, "properties", propDocId);
            
            await bw.set(propRef, {
                name: apartmentName,
                apartmentId: apartmentId,
                createdAt: Timestamp.now(),
                defaultStaff: [],
                checklist: DEFAULT_CHECKLIST
            }, { merge: true });

            createdProps++;
            propConfig = { defaultStaff: [], checklist: DEFAULT_CHECKLIST }; // Pseudo-Config für den Rest der Schleife
        }
        
        const taskId = `smoobu-${res.id}`;
        const taskRef = doc(db, baseRef, "tasks", taskId);
        const existingTask = existingTasksById.get(taskId);

        if (!existingTask) {
            const newTask = {
                apartment: apartmentName,
                apartmentId: apartmentId,
                date: departureDate,
                status: "pending",
                guestName: res.guestName || "Unbekannter Gast",
                notes: res.notice || "",
                assignedTo: safeArray(propConfig.defaultStaff),
                checklist: safeArray(propConfig.checklist).length > 0 ? safeArray(propConfig.checklist) : DEFAULT_CHECKLIST,
                source: "smoobu",
                createdAt: Timestamp.now(),
                originalData: res,
            };
            await bw.set(taskRef, newTask);
            createdTasks++;
        } else {
            // Nur aktualisieren, wenn sich wesentliche Daten geändert haben UND der Task noch offen ist
            if (existingTask.status === 'pending' && (existingTask.date !== departureDate || existingTask.apartment !== apartmentName)) {
                await bw.update(taskRef, {
                    date: departureDate,
                    apartment: apartmentName,
                    guestName: res.guestName || existingTask.guestName,
                    notes: res.notice || existingTask.notes,
                    updatedAt: Timestamp.now(),
                });
                updatedTasks++;
            }
        }
    }

    await bw.commitIfNeeded();
    
    const stats = { createdTasks, updatedTasks, createdProps };
    let message = `Sync erfolgreich. Neu: ${createdTasks}, Aktualisiert: ${updatedTasks}, Neue Objekte: ${createdProps}.`;
    if (createdTasks === 0 && updatedTasks === 0 && createdProps === 0) {
        message = "Sync erfolgreich. Alle Daten sind bereits auf dem neuesten Stand."
    }

    return { success: true, message, stats };

  } catch (e) {
    console.error("Smoobu Sync Fehler:", e);
    return { success: false, message: `Fehler beim Sync: ${e.message}`, stats: {} };
  }
};
