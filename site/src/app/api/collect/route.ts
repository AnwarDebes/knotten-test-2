import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";
import { BOT, recordEvent, recordPageview } from "@/lib/server/stats";

/** Events the browser may report. Everything else is counted on the server where it happens. */
const CLIENT_EVENTS = new Set(["form_start"]);
/** The public pages only: the portal and the login screens are not part of the website's statistics. */
const PAGE = /^\/[\p{L}0-9\-_/.]*$/u;
const SKIP = /^\/(api|_next|portal|logg-inn|(no|en)\/(portal|login))(\/|$)/;

const done = () => new Response(null, { status: 204 });

/** The page-view beacon from components/Track.tsx. See lib/server/stats.ts for what is kept. */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua) || req.headers.get("sec-gpc") === "1" || req.headers.get("dnt") === "1") return done();
  // the team's own visits while logged in would only blur the numbers
  if ((await cookies()).get(AUTH_COOKIE)) return done();
  let body: { p?: unknown; r?: unknown; w?: unknown; d?: unknown; e?: unknown };
  try {
    body = JSON.parse((await req.text()).slice(0, 2000));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof body.e === "string") {
    if (CLIENT_EVENTS.has(body.e)) await recordEvent(body.e);
    return done();
  }
  const path = typeof body.p === "string" ? body.p.toLowerCase().slice(0, 100) : "";
  if (!PAGE.test(path) || SKIP.test(path)) return done();
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
  await recordPageview(
    { path, ref: typeof body.r === "string" ? body.r.slice(0, 300) : "", width: Number(body.w) || 0, design: body.d === "moderne" ? "moderne" : "klassisk" },
    ip,
    ua,
    req.headers.get("host") ?? "",
  ).catch(() => undefined);
  return done();
}
