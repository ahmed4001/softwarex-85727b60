/**
 * Native (Capacitor) bootstrap — no-ops on the web.
 *
 * Responsibilities:
 *  1. Hide the splash screen once React has painted.
 *  2. Style the status bar.
 *  3. Keep auth working inside the Android WebView:
 *     - Supabase email confirm / password-reset / OAuth links open the site in
 *       the system browser and come back via a deep link. We catch that link
 *       with the App plugin, forward the tokens to supabase-js so the session
 *       is persisted in the WebView, and route to the intended path.
 *     - Android hardware back button maps to browser history.
 */
import { supabase } from "@/integrations/supabase/client";

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" && Boolean((window as any).Capacitor?.isNativePlatform?.());

/** Extract Supabase auth params from either the hash or the query string. */
function readAuthParams(url: string): URLSearchParams | null {
  try {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    if (hash.get("access_token") || hash.get("error_description")) return hash;
    const query = parsed.searchParams;
    if (query.get("access_token") || query.get("code")) return query;
    return null;
  } catch {
    return null;
  }
}

async function applyAuthFromUrl(url: string): Promise<boolean> {
  const params = readAuthParams(url);
  if (!params) return false;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const code = params.get("code");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) console.error("[native-auth] setSession failed", error.message);
    return !error;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[native-auth] code exchange failed", error.message);
    return !error;
  }

  return false;
}

/** Same-origin relative path from a deep link, e.g. reviewhunts.com/deals -> /deals */
function relativePath(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") return "/";
    return parsed.pathname + parsed.search;
  } catch {
    return "/";
  }
}

export async function initNativeApp(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
      import("@capacitor/splash-screen"),
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
    ]);

    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#4f46e5" });
    } catch {
      /* status bar is unavailable on some OEM builds — non-fatal */
    }

    // Cold start: the app may have been launched by a deep link.
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) {
      const handled = await applyAuthFromUrl(launchUrl.url);
      const path = relativePath(launchUrl.url);
      if (handled || path !== "/") window.history.replaceState({}, "", path);
    }

    // Warm start: returning from the system browser after sign-in / email link.
    App.addListener("appUrlOpen", async ({ url }) => {
      const handled = await applyAuthFromUrl(url);
      const path = relativePath(url);
      window.history.replaceState({}, "", handled ? path || "/" : path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Refresh the session whenever the app returns to the foreground so an
    // expired access token never leaves the user looking signed out.
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void supabase.auth.getSession();
    });

    // Hardware back button -> history back, exit at the root.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) window.history.back();
      else void App.exitApp();
    });

    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (err) {
    console.error("[native] bootstrap failed", err);
  }
}
