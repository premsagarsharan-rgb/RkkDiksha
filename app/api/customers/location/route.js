import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();

  // 1) SITTING customers -> find latest IN_CONTAINER assignment -> find container (MEETING/DIKSHA)
  const sittingItems = await db.collection("sittingCustomers").aggregate([
    {
      $lookup: {
        from: "calendarAssignments",
        let: { cid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$customerId", "$$cid"] },
                  { $eq: ["$status", "IN_CONTAINER"] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              containerId: 1,
              kind: 1,
              pairId: 1,
              roleInPair: 1,
              occupiedDate: 1,
              occupiedContainerId: 1,
              meetingDecision: 1,
            },
          },
        ],
        as: "asg",
      },
    },
    { $unwind: { path: "$asg", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "calendarContainers",
        localField: "asg.containerId",
        foreignField: "_id",
        as: "ctn",
      },
    },
    { $unwind: { path: "$ctn", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        rollNo: 1,
        gender: 1,
        sittingStatus: "$status",

        containerId: "$ctn._id",
        mode: "$ctn.mode",
        date: "$ctn.date",

        occupiedDate: "$asg.occupiedDate",
        meetingDecision: "$asg.meetingDecision",
      },
    },
  ]).toArray();

  const sittingNormalized = sittingItems.map((x) => {
    const hasContainer = Boolean(x.containerId && x.mode && x.date);
    const locationType = hasContainer ? x.mode : "SITTING";

    return {
      _id: String(x._id),
      sourceDb: "SITTING",

      name: x.name || "",
      rollNo: x.rollNo || "",
      gender: x.gender || "",
      sittingStatus: x.sittingStatus || "",

      locationType,
      locationLabel: locationType,

      containerId: x.containerId ? String(x.containerId) : null,
      mode: hasContainer ? x.mode : null,
      date: hasContainer ? x.date : null,

      pausedAt: null,
      occupiedDate: x.occupiedDate || null,
      meetingDecision: x.meetingDecision || null,
    };
  });

  // 2) PENDING customers (these are not in container; show last known container if available)
  const pendingItems = await db.collection("pendingCustomers").aggregate([
    {
      $lookup: {
        from: "calendarContainers",
        localField: "pausedFromContainerId",
        foreignField: "_id",
        as: "ctn",
      },
    },
    { $unwind: { path: "$ctn", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        rollNo: 1,
        gender: 1,
        status: 1,
        pausedAt: 1,
        pausedFromContainerId: 1,

        lastContainerId: "$ctn._id",
        lastMode: "$ctn.mode",
        lastDate: "$ctn.date",
      },
    },
    { $sort: { pausedAt: -1 } },
  ]).toArray();

  const pendingNormalized = pendingItems.map((x) => {
    return {
      _id: String(x._id),
      sourceDb: "PENDING",

      name: x.name || "",
      rollNo: x.rollNo || "",
      gender: x.gender || "",
      sittingStatus: "",

      locationType: "PENDING",
      locationLabel: "PENDING",

      // last known container (optional)
      containerId: x.lastContainerId ? String(x.lastContainerId) : (x.pausedFromContainerId ? String(x.pausedFromContainerId) : null),
      mode: x.lastMode || null,
      date: x.lastDate || null,

      pausedAt: x.pausedAt || null,
      occupiedDate: null,
      meetingDecision: null,
    };
  });

  // merge (pending + sitting)
  const items = [...pendingNormalized, ...sittingNormalized];

  return NextResponse.json({ items });
}
