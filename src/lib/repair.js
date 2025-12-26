import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db, appId } from "../firebase";

const commitInBatches = async (ops) => {
  const MAX_OPS = 450;
  let batch = writeBatch(db);
  let count = 0;
  const commits = [];

  for (const op of ops) {
    if (count >= MAX_OPS) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      count = 0;
    }
    op(batch);
    count += 1;
  }

  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
};

export const repairTeamLinks = async ({ teamId }) => {
  if (!teamId) {
    return { success: false, message: "Missing teamId." };
  }

  const teamRef = doc(db, `artifacts/${appId}/teams`, teamId);
  const teamSnap = await getDoc(teamRef);
  if (!teamSnap.exists()) {
    return { success: false, message: "Team doc not found." };
  }

  const membersRef = collection(db, `artifacts/${appId}/teams/${teamId}/members`);
  const membersSnap = await getDocs(membersRef);

  const ops = [];
  let fixedUsers = 0;
  let fixedMembers = 0;

  membersSnap.docs.forEach((memberDoc) => {
    const data = memberDoc.data();
    const uid = memberDoc.id;
    const role = data.role || "staff";

    ops.push((batch) =>
      batch.set(
        teamRef,
        {
          members: {
            [uid]: { role },
          },
        },
        { merge: true }
      )
    );
    fixedMembers += 1;

    const userRef = doc(db, "users", uid);
    ops.push((batch) => batch.set(userRef, { teamId }, { merge: true }));
    fixedUsers += 1;
  });

  await commitInBatches(ops);

  return {
    success: true,
    message: `Repair complete. members: ${fixedMembers}, users: ${fixedUsers}.`,
  };
};
