import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { containerId } = await params;
  const db = await getDb();
  const cId = new ObjectId(containerId);

  const url = new URL(req.url);
  const includeReserved = url.searchParams.get("includeReserved") === "1";

  const container = await db.collection("calendarContainers").findOne({ _id: cId });
  if (!container) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assignments = await db.collection("calendarAssignments").aggregate([
    { $match: { containerId: cId, status: "IN_CONTAINER" } },
    {
      $lookup: {
        from: "sittingCustomers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    { $sort: { createdAt: 1 } },
    {
      $project: {
        _id: 1,
        containerId: 1,
        customerId: 1,
        status: 1,
        note: 1,

        kind: 1,
        pairId: 1,
        roleInPair: 1,

        // meeting occupy fields
        occupiedMode: 1,
        occupiedDate: 1,
        occupiedContainerId: 1,
        meetingDecision: 1,

        addedByUserId: 1,
        createdAt: 1,
        updatedAt: 1,

        customer: 1,
      },
    },
  ]).toArray();

  let reserved = [];
  if (includeReserved && container.mode === "DIKSHA") {
    reserved = await db.collection("calendarAssignments").aggregate([
      {
        $match: {
          occupiedContainerId: cId,
          meetingDecision: "PENDING",
          status: "IN_CONTAINER",
        },
      },
      {
        $lookup: {
          from: "sittingCustomers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      { $sort: { createdAt: 1 } },
      {
        $project: {
          _id: 1,
          containerId: 1,
          customerId: 1,
          status: 1,
          note: 1,

          kind: 1,
          pairId: 1,
          roleInPair: 1,

          occupiedMode: 1,
          occupiedDate: 1,
          occupiedContainerId: 1,
          meetingDecision: 1,

          addedByUserId: 1,
          createdAt: 1,
          updatedAt: 1,

          customer: 1,
        },
      },
    ]).toArray();
  }

  return NextResponse.json({ container, assignments, reserved });
}
