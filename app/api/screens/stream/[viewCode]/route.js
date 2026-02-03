import { subscribeScreen } from "@/lib/screenBus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidCode(code) {
  const c = String(code || "").trim();
  return c.length === 5;
}

export async function GET(req, { params }) {
  const { viewCode } = await params;
  const codeLower = String(viewCode || "").trim().toLowerCase();

  if (!isValidCode(codeLower)) {
    return Response.json({ error: "Invalid viewCode" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  let closed = false;
  let pingTimer = null;
  let unsub = null;

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;

        try {
          if (pingTimer) clearInterval(pingTimer);
        } catch {}
        pingTimer = null;

        try {
          unsub?.();
        } catch {}
        unsub = null;

        try {
          controller.close();
        } catch {}
      };

      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`
            )
          );
        } catch {
          cleanup();
        }
      };

      // client disconnect
      try {
        req.signal?.addEventListener("abort", cleanup);
      } catch {}

      send("hello", { ok: true, ts: Date.now() });

      unsub = subscribeScreen(codeLower, (msg) => {
        send(msg?.event || "update", msg || { type: "updated", ts: Date.now() });
      });

      pingTimer = setInterval(() => {
        send("ping", { ts: Date.now() });
      }, 15000);
    },

    cancel() {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      try {
        unsub?.();
      } catch {}
      unsub = null;
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      // helpful for nginx later:
      "X-Accel-Buffering": "no",
    },
  });
}
