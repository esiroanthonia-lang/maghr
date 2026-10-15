import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ACTIVE_COOKIE, STARTED_COOKIE, sessionExpired, shouldTouch } from "../session-timeout";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/invite", "/careers"];

/** Refreshes the Supabase session cookie and sends signed-out visitors to /login. */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run other code between createServerClient and getUser(): it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (user) {
    const now = Date.now();
    const last = request.cookies.get(ACTIVE_COOKIE)?.value;
    const started = request.cookies.get(STARTED_COOKIE)?.value;
    if (sessionExpired(last, started, now)) {
      // Away too long (or signed in too long ago): end the session on the server, then ask to sign in again.
      await supabase.auth.signOut({ scope: "local" });
      response.cookies.delete(ACTIVE_COOKIE);
      response.cookies.delete(STARTED_COOKIE);
      if (isPublic) return response;
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?expired=1";
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.cookies.delete(ACTIVE_COOKIE);
      redirect.cookies.delete(STARTED_COOKIE);
      return redirect;
    }
    const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 };
    if (shouldTouch(last, now)) response.cookies.set(ACTIVE_COOKIE, String(now), opts);
    if (!started) response.cookies.set(STARTED_COOKIE, String(now), opts);
  } else if (request.cookies.get(ACTIVE_COOKIE) || request.cookies.get(STARTED_COOKIE)) {
    response.cookies.delete(ACTIVE_COOKIE);
    response.cookies.delete(STARTED_COOKIE);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
