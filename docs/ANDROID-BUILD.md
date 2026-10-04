# Android build record

The owner approved Google's Android SDK terms for this project. Build tools are portable under `D:\SafeLink-AI\work`; no Android Studio or emulator is required. The tools and caches are ignored by Git. They can be reused on this laptop; a different machine needs its own SDK installation and license acceptance.

The checked toolchain is Temurin JDK 17, Android platform/build tools 36, NDK 28.2.13676358, checksum-pinned Gradle 9.3.1 and the project's existing Flutter SDK. Plugins also installed platforms 34 and 35 under the same SDK root. The project limits Gradle to two workers and a 2 GB heap.

The 5 October local build reached Flutter compilation, then Windows Application Control blocked Flutter's official `impellerc.exe` shader compiler. That attempt produced no local APK and changed no security settings. The Linux GitHub Actions build later succeeded as recorded below. Installing the SDK alone cannot resolve the local OS policy.

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

A successful build writes the debug APK to `mobile/build/app/outputs/flutter-apk/app-debug.apk`; the Windows attempt above did not reach that step. It is a test build. Release signing requires the owner's private keystore and `mobile/android/key.properties`; do not commit either. A successful build and valid APK signature do not prove physical camera/gallery/share behavior. Install and rehearse on the intended phone.

The APK's default API URL points to the existing published service. Deploy the updated backend separately, then verify login, scan and history against that service. The app's Account page allows choosing another backend and clears the prior server's session.

`scripts/prepare-android-tools.mjs` downloads checksum-pinned official JDK, Android command-line and Gradle archives into `work/android-downloads`. It does not install SDK packages or accept licenses automatically. Use it only after agreeing to the relevant SDK terms. Official sources: [Android SDK and terms](https://developer.android.com/studio), [sdkmanager](https://developer.android.com/tools/sdkmanager), [Adoptium archive installation](https://adoptium.net/installation/archives/), [Gradle checksum](https://services.gradle.org/distributions/gradle-9.3.1-all.zip.sha256).

## Cloud APK build

On 5 October 2026, [run 37228833017](https://github.com/NoorAbdullah02/SafeLink-AI/actions/runs/37228833017) completed with **SUCCESS** for source `c9c2284` (`c9c22845b9dc0589a87657b10c9e4d176504ff84`). Both `web-api` and `flutter` jobs passed. The Linux Flutter job used Flutter 3.47.3 and Java 17, passed analysis/tests, built `app-debug.apk`, verified its signature with `apksigner` and generated the SHA-256 artifact.

The source was pushed to `codex/safelink-audit` and opened as [draft PR #1](https://github.com/NoorAbdullah02/SafeLink-AI/pull/1). `master` remains unchanged. The APK artifact is from the exact source revision above; later documentation-only commits do not change its provenance. Backend deployment and a signed public release remain separate pending steps.

1. Open the successful run above and download **SafeLink-AI-debug-apk** from Artifacts.
2. Unzip it to obtain `app-debug.apk` and its SHA-256 file. Verify the downloaded archive and APK checksums before installation; the 5 October local verification passed as recorded below.
3. Install and rehearse on the intended phone. ADB found zero authorized devices during the local audit, so physical-device acceptance remains unverified.

The downloaded artifact was verified locally on 5 October 2026. The ZIP digest matched GitHub's artifact digest, the extracted APK matched its included SHA-256 file, and local `apksigner verify` exited 0 with a valid v2 debug signature. The checked APK is at `work/releases/c9c2284/app-debug.apk`; no physical-device installation was performed.

| Verification                 | Recorded result                                                    |
| ---------------------------- | ------------------------------------------------------------------ |
| Archive SHA-256              | `dc8a7b4741b2498df7009129b087f8a14c81f24b354e71342d160d50703ad421` |
| APK SHA-256                  | `139a34a28da4359f4dc6ea094d310c2d04909b107f3f89cf80f7df558f70a333` |
| APK size                     | 177,186,343 bytes                                                  |
| Local signature check        | `apksigner verify`: exit 0, valid v2 debug signature               |
| Physical-device installation | Not performed                                                      |

The workflow publishes a test artifact, not a release, and uses no private service/signing keys. Keep `.env`, `work` and signing keys excluded from source publication. Once the workflow is on the default branch, **Run workflow** is also available.

The workflow defaults to `https://safelink-ai-8q6c.onrender.com`; the optional repository variable `SAFELINK_API_URL` can select another backend. Deploy the audited API separately and test the installed app on the intended phone. Follow [GitHub's manual workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

The current local build also warned that legacy Kotlin Gradle Plugin support will be removed in a future Flutter version. CI pins the checked Flutter version. A later upgrade should follow [Flutter's migration guide](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers) after all used plugins support it; changing app flags alone is insufficient.
