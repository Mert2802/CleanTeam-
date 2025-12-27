const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const APP_ID = "cleanteam-test";
const TEAM_BASE = `artifacts/${APP_ID}/teams`;

const INVALID_TOKEN_ERRORS = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

async function getTeamMembers(teamId) {
  const membersSnap = await admin.firestore().collection(`${TEAM_BASE}/${teamId}/members`).get();
  let members = membersSnap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));

  if (members.length === 0) {
    const teamDoc = await admin.firestore().doc(`${TEAM_BASE}/${teamId}`).get();
    const membersMap = teamDoc.get("members") || {};
    members = Object.entries(membersMap).map(([uid, data]) => ({
      uid,
      ...data,
    }));
  }

  return members;
}

async function getTokensByUid(uids) {
  const uniqueUids = [...new Set(uids.filter(Boolean))];
  if (uniqueUids.length === 0) return { tokens: [], tokenToUid: new Map() };

  const refs = uniqueUids.map((uid) => admin.firestore().doc(`users/${uid}`));
  const snaps = await admin.firestore().getAll(...refs);

  const tokens = [];
  const tokenToUid = new Map();
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const uid = snap.id;
    const userTokens = snap.get("pushTokens") || [];
    userTokens.forEach((token) => {
      tokens.push(token);
      tokenToUid.set(token, uid);
    });
  });

  return { tokens, tokenToUid };
}

async function cleanupInvalidTokens(responses, tokenToUid, tokens) {
  const invalid = [];
  responses.forEach((resp, idx) => {
    if (!resp.error) return;
    const code = resp.error.code || "";
    if (!INVALID_TOKEN_ERRORS.has(code)) return;
    const token = tokens[idx];
    const uid = tokenToUid.get(token);
    if (uid) invalid.push({ uid, token });
  });

  if (invalid.length === 0) return;

  const batch = admin.firestore().batch();
  invalid.forEach(({ uid, token }) => {
    const ref = admin.firestore().doc(`users/${uid}`);
    batch.update(ref, {
      pushTokens: admin.firestore.FieldValue.arrayRemove(token),
    });
  });
  await batch.commit();
}

async function sendToUids({ uids, title, body, data }) {
  const { tokens, tokenToUid } = await getTokensByUid(uids);
  if (tokens.length === 0) return null;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data || {},
  });

  await cleanupInvalidTokens(response.responses, tokenToUid, tokens);
  return response;
}

exports.sendTestPush = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const title = "CleanTeam Test";
  const body = "Push-Benachrichtigung funktioniert.";

  await sendToUids({
    uids: [uid],
    title,
    body,
    data: { type: "test" },
  });

  return { ok: true };
});

exports.onTaskCreated = functions.firestore
  .document(`artifacts/${APP_ID}/teams/{teamId}/tasks/{taskId}`)
  .onCreate(async (snap, context) => {
    const task = snap.data() || {};
    const { teamId, taskId } = context.params;

    const assigned = Array.isArray(task.assignedTo)
      ? task.assignedTo
      : task.assignedTo
        ? [task.assignedTo]
        : [];

    const members = await getTeamMembers(teamId);
    const recipients = assigned.length > 0
      ? assigned
      : members.map((member) => member.uid);

    if (recipients.length === 0) return null;

    const title = "Neue Aufgabe";
    const parts = [];
    if (task.apartment) parts.push(`Objekt: ${task.apartment}`);
    if (task.date) parts.push(`Datum: ${task.date}`);
    const body = parts.length > 0 ? parts.join(" · ") : "Eine neue Aufgabe wurde erstellt.";

    return sendToUids({
      uids: recipients,
      title,
      body,
      data: {
        type: "task",
        teamId,
        taskId,
      },
    });
  });

exports.onDirectMessageCreated = functions.firestore
  .document(`artifacts/${APP_ID}/teams/{teamId}/directMessages/{staffId}/messages/{messageId}`)
  .onCreate(async (snap, context) => {
    const message = snap.data() || {};
    const { teamId, staffId, messageId } = context.params;
    const sender = message.fromUid;

    if (!sender) return null;

    const members = await getTeamMembers(teamId);
    const admins = members
      .filter((member) => member.role === "owner" || member.role === "admin")
      .map((member) => member.uid);

    let recipients = [];
    let title = "Neue Nachricht";

    if (sender === staffId) {
      recipients = admins.filter((uid) => uid !== sender);
      const staffMember = members.find((member) => member.uid === staffId);
      const staffName = staffMember?.name || "Mitarbeiter";
      title = `Neue Nachricht von ${staffName}`;
    } else {
      recipients = [staffId];
      title = "Neue Nachricht vom Admin";
    }

    if (recipients.length === 0) return null;

    const body = message.text || "Neue Nachricht";

    return sendToUids({
      uids: recipients,
      title,
      body,
      data: {
        type: "chat",
        teamId,
        staffId,
        messageId,
      },
    });
  });
