import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function addCommit({
  customerId,
  userId,
  message,
  action,
  meta = {},
  actorLabel, // "ADMIN:boss" / "USER:ali"
}) {
  if (!message || !String(message).trim()) throw new Error("COMMIT_REQUIRED");

  const db = await getDb();
  await db.collection("customerCommits").insertOne({
    customerId: new ObjectId(customerId),
    userId: String(userId),
    actorLabel: actorLabel || String(userId),
    message: String(message).trim(),
    action: action || "UNKNOWN",
    meta,
    createdAt: new Date(),
  });
}
