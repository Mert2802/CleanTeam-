import { doc, writeBatch, collection, getDocs, Timestamp } from "firebase/firestore";
import { db, appId } from "../firebase";

const DEFAULT_CHECKLIST = [
  "Bettwaesche gewechselt",
  "Muell entsorgt und neue Beutel",
  "Bad und Kueche desinfiziert",
  "Boeden gesaugt und gewischt",
  "Oberflaechen abgestaubt",
];

const safeArray = (v) => (Array.isArray(v) ? v : []);

const makePropertyDocId = (apartmentId, apartmentName) => {
  if (apartmentId) return `apt_${String(apartmentId)}`;
  const cleaned = String(apartmentName || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `name_${cleaned || "unknown"}`;
};

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

export const syncWithSmoobu = async ({ teamId, settings, existingTasks = [], existingProperties = [] }) => {
  if (!teamId) return { success: false, message: "Team-ID fehlt.", stats: {} };
  if (!settings?.apiKey) return { success: false, message: "Smoobu API Key ist nicht gesetzt.", stats: {} };

  try {
    const from = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
    const to = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0];

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
    const reservations = data.bookings || data.reservations || [];

    if (reservations.length === 0) {
      return { success: true, message: "Sync erfolgreich, keine anstehenden Buchungen gefunden.", stats: { createdTasks: 0, updatedTasks: 0, createdProps: 0 } };
    }

    const existingTasksById = new Map(existingTasks.map((t) => [t.id, t]));
    const propsByAptId = new Map(
      existingProperties.filter((p) => p.apartmentId != null).map((p) => [String(p.apartmentId), p])
    );

    const bw = BatchWriter(db);
    const baseRef = `artifacts/${appId}/teams/${teamId}`;

    let createdTasks = 0;
    let updatedTasks = 0;
    let createdProps = 0;

    for (const res of reservations) {
      const departureDate = res?.departure;
      if (!departureDate) continue;

      const apartmentName = res?.apartment?.name || `Wohnung ID ${res?.apartmentId ?? "unbekannt"}`;
      const apartmentId = res?.apartmentId != null ? String(res.apartmentId) : null;

      let propConfig = apartmentId ? propsByAptId.get(apartmentId) : null;

      if (!propConfig) {
        const propDocId = makePropertyDocId(apartmentId, apartmentName);
        const propRef = doc(db, baseRef, "properties", propDocId);

        await bw.set(propRef, {
          name: apartmentName,
          apartmentId: apartmentId,
          createdAt: Timestamp.now(),
          defaultStaff: [],
          checklist: DEFAULT_CHECKLIST,
        }, { merge: true });

        createdProps++;
        propConfig = { defaultStaff: [], checklist: DEFAULT_CHECKLIST };
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
        if (existingTask.status === "pending" && (existingTask.date !== departureDate || existingTask.apartment !== apartmentName)) {
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
      message = "Sync erfolgreich. Alle Daten sind bereits auf dem neuesten Stand.";
    }

    return { success: true, message, stats };
  } catch (e) {
    console.error("Smoobu Sync Fehler:", e);
    return { success: false, message: `Fehler beim Sync: ${e.message}`, stats: {} };
  }
};
