import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import puppeteer from "puppeteer";

export const runtime = "nodejs";

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { html, filename } = body || {};

  if (!html) return NextResponse.json({ error: "Missing html" }, { status: 400 });

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(String(html), { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    await browser.close();
    browser = null;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // inline => open in browser tab
        "Content-Disposition": `inline; filename="${(filename || "customer").replace(/[^a-z0-9_\-\.]/gi, "_")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    try { if (browser) await browser.close(); } catch {}
    return NextResponse.json(
      { error: "PDF_GENERATION_FAILED", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
