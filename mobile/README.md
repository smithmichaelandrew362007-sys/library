# LibraVault Mobile App (Flutter)

Mobile application for **LibraVault**, built with Flutter and equipped with an in-app automatic OTA updater targeting GitHub Releases.

---

## 🚀 How to Build & Release New Versions

You don't need Android emulators or local Android build chains. The application builds automatically via **GitHub Actions**.

### 1. Push a Release Tag to GitHub
Whenever you want to release a new version to your phone:

```bash
# 1. Update version in mobile/pubspec.yaml if needed (e.g. version: 1.0.1+2)
git add .
git commit -m "Release v1.0.1"

# 2. Tag the release
git tag v1.0.1

# 3. Push to GitHub
git push origin main --tags
```

### 2. GitHub Actions Automated Pipeline
- The GitHub Actions workflow (`.github/workflows/build_apk.yml`) triggers automatically.
- It builds `app-release.apk` using Java 17 and Flutter SDK.
- It automatically creates a new GitHub Release under `smithmichaelandrew362007-sys/library/releases` with the APK attached.

---

## 📱 Testing & In-App Updating on Mobile

1. **Initial Install**:
   - Download `app-release.apk` from the latest GitHub Release on your phone and install it.

2. **Subsequent In-App Updates**:
   - Open the app -> Go to **Settings**.
   - Tap **Check for Updates**.
   - The app fetches release metadata from GitHub, alerts you of new versions with changelog notes, downloads the new APK, and opens the native Android package installer.
