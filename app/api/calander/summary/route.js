import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const mode = searchParams.get("mode");

  if (!from || !to || !mode) return NextResponse.json({ error: "Missing from/to/mode" }, { status: 400 });

  const db = await getDb();

  const rows = await db.collection("calendarContainers").aggregate([
    { $match: { date: { $gte: from, $lte: to }, mode } },
    {
      $lookup: {
        from: "calendarAssignments",
        let: { cid: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$containerId", "$$cid"] }, { $eq: ["$status", "IN_CONTAINER"] }] } } },
          {
            $lookup: {
              from: "sittingCustomers",
              localField: "customerId",
              foreignField: "_id",
              as: "cust",
            }
          },
          { $unwind: "$cust" },
          {
            $project: {
              gender: "$cust.gender",
            }
          }
        ],
        as: "genders"
      }
    },
    {
      $project: {
        date: 1,
        genders: 1,
      }
    }
  ]).toArray();

  const map = {};
  for (const r of rows) {
    const male = r.genders.filter(x => x.gender === "MALE").length;
    const female = r.genders.filter(x => x.gender === "FEMALE").length;
    const other = r.genders.filter(x => x.gender === "OTHER").length;
    const total = male + female + other;
    map[r.date] = { total, male, female, other };
  }

  return NextResponse.json({ map });
}
