# Android release build — ReviewHunts

Everything in the repo is ready; these steps run on your machine (they need
JDK 17 + Android Studio, which the Lovable sandbox doesn't have).

## 1. One-time setup

```bash
git pull                       # after Export to GitHub
npm install
npx cap add android
```

## 2. Generate adaptive icons + splash screens

Source art lives in `resources/` (`icon.png`, `icon-foreground.png`,
`icon-background.png`, `splash.png`, `splash-dark.png`).

```bash
npm run cap:assets
```

This writes Android adaptive icons (`mipmap-anydpi-v26`, all densities) and
light/dark splash drawables into `android/app/src/main/res/`.

## 3. Build the web bundle and sync

```bash
npm run build          # outputs dist/
npx cap sync android
```

Do **not** set `CAP_LIVE_RELOAD=1` for a release build — that points the app at
the Lovable sandbox URL instead of the bundled assets.

## 4. Create a signing keystore (once — back it up!)

```bash
keytool -genkey -v -keystore ~/keystores/reviewhunts-upload.jks \
  -alias reviewhunts -keyalg RSA -keysize 2048 -validity 10000
```

Losing this file means you can never update the app on Play. Store it and the
passwords in a password manager.

## 5. Wire signing into Gradle

Create `android/keystore.properties` (already git-ignored):

```properties
storeFile=/absolute/path/to/reviewhunts-upload.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=reviewhunts
keyPassword=YOUR_KEY_PASSWORD
```

Then in `android/app/build.gradle`, above `android { ... }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

and inside `android { ... }`:

```gradle
signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

## 6. Produce the upload artifact

```bash
npm run android:bundle     # AAB — this is what Play Console wants
# or
npm run android:apk        # signed APK for direct install / sideload testing
```

Outputs:

- AAB → `android/app/build/outputs/bundle/release/app-release.aab`
- APK → `android/app/build/outputs/apk/release/app-release.apk`

Bump `versionCode` (integer, must increase every upload) and `versionName` in
`android/app/build.gradle` before each release.

## 7. Auth inside the WebView

`capacitor.config.ts` sets the WebView origin to `https://reviewhunts.com`
(`androidScheme: 'https'` + `hostname`). That means:

- the Supabase session in `localStorage` is scoped to the same origin as the
  web app, so it survives app restarts;
- `window.location.origin` used in `emailRedirectTo` / OAuth `redirect_uri`
  matches the URL already on your Supabase redirect allow-list;
- `src/lib/native-app.ts` catches the return trip (`appUrlOpen`), calls
  `setSession` / `exchangeCodeForSession`, and routes to the original path;
- the session is re-checked whenever the app is foregrounded.

For email confirmation / password reset links to reopen the **app** instead of
Chrome, add App Links: host `https://reviewhunts.com/.well-known/assetlinks.json`
with your app's SHA-256 signing fingerprint (Play Console → Setup → App
integrity gives you the fingerprint after your first upload), then add an
`intent-filter` with `android:autoVerify="true"` for `reviewhunts.com` in
`android/app/src/main/AndroidManifest.xml`. Until then, links open in the
browser and sign-in still completes there.
