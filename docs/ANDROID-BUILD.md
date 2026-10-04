# Android build on this laptop

The owner approved Google's Android SDK terms for this project. Build tools are portable under `D:\SafeLink-AI\work`; no Android Studio or emulator is required. The tools and caches are ignored by Git. They can be reused on this laptop; a different machine needs its own SDK installation and license acceptance.

The checked toolchain is Temurin JDK 17, Android platform/build tools 36, NDK 28.2.13676358, checksum-pinned Gradle 9.3.1 and the project's existing Flutter SDK. Plugins also installed platforms 34 and 35 under the same SDK root. The project limits Gradle to two workers and a 2 GB heap.

The 5 October local build reached Flutter compilation, then Windows Application Control blocked Flutter's official `impellerc.exe` shader compiler. No fresh APK was produced. Security settings were not changed. Use a permitted build machine or the prepared Linux GitHub Actions workflow below; installing the SDK alone cannot resolve this OS policy.

From `D:\SafeLink-AI\mobile` in PowerShell:

```powershell
$env:JAVA_HOME = 'D:\SafeLink-AI\work\java\jdk-17.0.20.1+1'
$env:ANDROID_HOME = 'D:\SafeLink-AI\work\android-sdk'
$env:ANDROID_USER_HOME = 'D:\SafeLink-AI\work\android-user'
$env:GRADLE_USER_HOME = 'D:\SafeLink-AI\work\gradle'
$flutterSdkPath = 'D:\path\to\your\flutter-sdk'
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'safe.directory'
$env:GIT_CONFIG_VALUE_0 = $flutterSdkPath.Replace('\', '/')
$flutterPath = Join-Path $flutterSdkPath 'bin\flutter.bat'
& $flutterPath analyze --no-pub
& $flutterPath test --no-pub
& $flutterPath build apk --debug --no-pub --dart-define=API_URL=https://safelink-ai-8q6c.onrender.com
```

Replace `$flutterSdkPath` with your installed Flutter SDK directory. These environment variables affect this PowerShell process only. If dependencies changed, run `flutter pub get` before the checks. Git's scoped exception applies only to that installed SDK checkout.

The debug APK is produced at `mobile/build/app/outputs/flutter-apk/app-debug.apk`. It is a test build. Release signing requires the owner's private keystore and `mobile/android/key.properties`; do not commit either. A successful build and valid APK signature do not prove physical camera/gallery/share behavior. Install and rehearse on the intended phone.

The APK's default API URL points to the existing published service. Deploy the updated backend separately, then verify login, scan and history against that service. The app's Account page allows choosing another backend and clears the prior server's session.

`scripts/prepare-android-tools.mjs` downloads checksum-pinned official JDK, Android command-line and Gradle archives into `work/android-downloads`. It does not install SDK packages or accept licenses automatically. Use it only after agreeing to the relevant SDK terms. Official sources: [Android SDK and terms](https://developer.android.com/studio), [sdkmanager](https://developer.android.com/tools/sdkmanager), [Adoptium archive installation](https://adoptium.net/installation/archives/), [Gradle checksum](https://services.gradle.org/distributions/gradle-9.3.1-all.zip.sha256).

## Cloud APK build

The prepared `.github/workflows/ci.yml` uses Linux, Flutter 3.47.3 and Java 17. It analyzes/tests the mobile source, builds a debug APK, verifies the APK signature and uploads the APK with its SHA-256 file. It does not publish a release or use private service/signing keys. This workflow has not yet been run for these local changes.

1. Review and push the updated source using the parent deployment guide. Keep `.env`, `work` and signing keys excluded.
2. Open the repository's Actions page and select **SafeLink checks**. A master or `codex/` branch push starts it automatically; after the workflow is on the default branch, **Run workflow** is also available.
3. Open a successful run and download **SafeLink-AI-debug-apk** from Artifacts. Unzip it to obtain `app-debug.apk` and its checksum file. If a job fails, keep its exact error log for diagnosis.

The workflow defaults to `https://safelink-ai-8q6c.onrender.com`; the optional repository variable `SAFELINK_API_URL` can select another backend. Deploy the audited API separately and test the installed app on the intended phone. Follow [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The current local build also warned that legacy Kotlin Gradle Plugin support will be removed in a future Flutter version. CI pins the checked Flutter version. A later upgrade should follow [Flutter's migration guide](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers) after all used plugins support it; changing app flags alone is insufficient.
