import { NextResponse } from "next/server";
import net from "net";

export async function POST(request: Request) {
  let body: { host?: string; port?: number; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const host = body.host?.trim();
  const port = typeof body.port === "number" ? body.port : 9100;
  const text = body.text ?? "";

  if (!host) {
    return NextResponse.json({ error: "host is required." }, { status: 400 });
  }

  const payload = Buffer.from(`\x1b\x40${text}\n\n\x1d\x56\x00`, "utf8");

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.write(payload, (err) => {
          socket.end();
          if (err) reject(err);
          else resolve();
        });
      });
      socket.setTimeout(8000);
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Printer connection timed out."));
      });
      socket.on("error", reject);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reach the network printer.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
