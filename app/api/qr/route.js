export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = crypto.randomUUID();
  const db = await getDb();
  await db.collection("qrTokens").insertOne({
    token,
    createdByUserId: session.userId,
    used: false,
    expiresAt: new Date(Date.now() + 24*60*60*1000), // 24h
    createdAt: new Date()
  });

  const url = `${process.env.NEXT_PUBLIC_URL || "https://yourapp.vercel.app"}/qr/${token}`;
  return NextResponse.json({ url });
}
