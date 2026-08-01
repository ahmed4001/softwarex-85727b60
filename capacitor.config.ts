import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Release builds (what you upload to the Play Store) must ship the bundled
 * web assets from `dist/` — NOT a remote URL. Live-reload against the Lovable
 * sandbox is opt-in via `CAP_LIVE_RELOAD=1 npx cap sync`.
 *
 * `androidScheme: 'https'` + `hostname: 'reviewhunts.com'` makes the WebView
 * origin `https://reviewhunts.com`. That matters for auth: localStorage (where
 * the Supabase session lives) is origin-scoped, cookies are treated as secure,
 * and any `window.location.origin` redirect target already matches the URL
 * allow-list used on the web. Assets are still served locally from the APK.
 */
const liveReload = process.env.CAP_LIVE_RELOAD === '1';

const config: CapacitorConfig = {
  appId: 'app.lovable.8f8ab8bf14f540859849266b90f727c8',
  appName: 'ReviewHunts',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
  server: liveReload
    ? {
        url: 'https://8f8ab8bf-14f5-4085-9849-266b90f727c8.lovableproject.com?forceHideBadge=true',
        cleartext: true,
      }
    : {
        androidScheme: 'https',
        hostname: 'reviewhunts.com',
      },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#4f46e5',
    },
  },
};

export default config;
