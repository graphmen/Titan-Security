# Mobile APK hosting

APK files in this folder are served at:

- `/downloads/titan-monitor-latest.apk`
- `/downloads/titan-supervisor-latest.apk`

## Publish after building

From repo root, after building an APK:

```powershell
.\scripts\publish-mobile-apks.ps1
```

Or build + publish in one step:

```powershell
cd mobile
.\build-apk.ps1

cd ..\mobile-supervisor
.\build-apk.ps1
```

Then commit the APK files + `versions.json` and push to `main` so Vercel hosts them.

## In-app updates

Mobile apps check `/api/mobile/version?app=monitor|supervisor` on the sign-in screen.
When `versionCode` on the server is higher than the installed app, an **Update app** button appears.
