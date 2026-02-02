import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { addCommit } from "@/lib/commits";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { containerId, assignmentId } = await params;
  const body = await req.json().catch(() => ({}));
  const { commitMessage } = body || {};
  if (!commitMessage) return NextResponse.json({ error: "Commit required" }, { status: 400 });

  const db = await getDb();
  const ctnId = new ObjectId(containerId);
  const asgId = new ObjectId(assignmentId);
  const now = new Date();
  const actorLabel = `${session.role}:${session.username}`;

  const container = await db.collection("calendarContainers").findOne({ _id: ctnId });
  if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });
  if (container.mode !== "MEETING") return NextResponse.json({ error: "Confirm only valid for MEETING" }, { status: 400 });

  const base = await db.collection("calendarAssignments").findOne({ _id: asgId, containerId: ctnId, status: "IN_CONTAINER" });
  if (!base) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  if (!base.occupiedContainerId || !base.occupiedDate || base.meetingDecision !== "PENDING") {
    return NextResponse.json({ error: "This card is not occupied / not pending" }, { status: 409 });
  }

  // group handling
  const isGroup = (base.kind === "COUPLE" || base.kind === "FAMILY") && base.pairId;
  const group = isGroup
    ? await db.collection("calendarAssignments").find({
        containerId: ctnId,
        status: "IN_CONTAINER",
        pairId: base.pairId,
      }).toArray()
    : [base];

  const targetId = new ObjectId(base.occupiedContainerId);

  // move assignments to DIKSHA container (same assignment docs)
  const ids = group.map((x) => x._id);
  const custIds = group.map((x) => x.customerId);

  await db.collection("calendarAssignments").updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        containerId: targetId,
        updatedAt: now,
        meetingDecision: "CONFIRMED",
        confirmedAt: now,
        confirmedByUserId: session.userId,
      },
    }
  );

  // update customer active container
  await db.collection("sittingCustomers").updateMany(
    { _id: { $in: custIds } },
    { $set: { activeContainerId: targetId, status: "IN_EVENT" } }
  );

  // commits
  for (const cid of custIds) {
    await addCommit({
      customerId: cid,
      userId: session.userId,
      actorLabel,
      message: commitMessage,
      action: "MEETING_CONFIRM_TO_DIKSHA",
      meta: {
        fromMeetingContainerId: String(ctnId),
        toDikshaContainerId: String(targetId),
        occupiedDate: base.occupiedDate,
        kind: base.kind,
        pairId: base.pairId ? String(base.pairId) : null,
      },
    });
  }

  return NextResponse.json({ ok: true, moved: custIds.length });
}
