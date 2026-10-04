# SafeLink AI mobile

Flutter Android/iOS client for the shared SafeLink Express API. Includes text and URL scans, QR camera, screenshot upload, secure sessions, private history, simple mode, contacts and explicit email alerts. Android accepts shared text through `safelink/share`.

The safety assistant defaults to local guidance. Its separate external AI switch explicitly shares the question and recent conversation with the configured provider; each reply identifies local guidance, external AI, or a provider attempt followed by local guidance. The awareness page contains educational patterns, not national statistics. Scan checks and email delivery records come from API responses. There is no background push notification service or automatic account freeze.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run --dart-define=API_URL=http://10.0.2.2:3001` for an Android emulator. A physical phone needs the host computer's LAN address or deployed HTTPS endpoint.

Debug Android builds permit local HTTP. Release builds require HTTPS and `android/key.properties` with your private signing key; see `android/key.properties.example`. iOS requires macOS/Xcode and your signing team. Camera and photo permission descriptions are included. iOS Share Extension is not implemented; paste and gallery upload remain available.

Changing the server clears the current session so bearer credentials cannot be sent to another endpoint. Sessions created before endpoint binding was added require a fresh sign-in. Local sign-out still clears stored credentials if the server is unavailable. Android hotline actions open the dialer; platforms without that integration copy the number. The saved support directory can be read offline; scans require the server. Clipboard suggestions are off by default and can be enabled under Account.

The mobile UI currently uses its light theme even when the device uses dark mode. System text scaling remains enabled. Automated tests cover core pages and Message demo cards at 320 logical pixels with 180% text scaling; assistive technology and physical-device font behaviour still need QA.

Local verification completed on 5 October 2026: Flutter 3.47.3/Dart 3.13.3; analysis passed with no issues and all 26 tests passed (14 API, 12 widget). Tests include stale-session/server binding, interrupted-gallery recovery, pending input locks, scanner widths of 320, 768 and 1440 logical pixels, simulated system dark mode and the large-text layout cases above. These use isolated fixtures and do not establish real-device behaviour or detection accuracy.

Approved portable JDK/Android SDK/Gradle were installed under `work`. The debug build reached Flutter compilation, then Windows Application Control blocked the official `impellerc.exe` compiler. No fresh APK was produced and no security settings were changed. The prepared Linux CI workflow pins Flutter/Java, verifies the debug APK signature and uploads the APK with its checksum when successful; it has not yet run for these changes. See [the Android build record](../docs/ANDROID-BUILD.md).

ADB found zero authorized devices. Installation, camera/gallery permissions, interrupted-gallery behaviour on a phone, share sheets, native dialer behaviour, keyboard, secure storage, release signing and physical-device checks remain unverified. iOS builds require macOS/Xcode and signing.

The website provides community moderation and the full dashboard. No detection rules run in this client: all scan results come from the backend.

See the [parent README](../README.md) and [validation record](../docs/VALIDATION.md) for setup, tests and deployment limitations.
