# SafeLink AI mobile

Flutter Android/iOS client for the shared SafeLink Express API. Includes text and URL scans, QR camera, screenshot upload, secure sessions, private history, simple mode, contacts and explicit email alerts. Android accepts shared text through `safelink/share`.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run --dart-define=API_URL=http://10.0.2.2:3001` for an Android emulator. A physical phone needs the host computer's LAN address or deployed HTTPS endpoint.

Debug Android builds permit local HTTP. Release builds require HTTPS and `android/key.properties` with your private signing key; see `android/key.properties.example`. iOS requires macOS/Xcode and your signing team. Camera and photo permission descriptions are included. iOS Share Extension is not implemented; paste and gallery upload remain available.

The website provides community moderation and the full dashboard. No detection rules run in this client: all scan results come from the backend.

See the parent README and docs/VALIDATION.md for setup, tests and deployment limitations.
