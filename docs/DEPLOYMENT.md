# Deployment and GitHub handoff

The source is ready to place at the root of `NoorAbdullah02/SafeLink-AI`. No push or public deployment is performed as part of this local handoff.

## GitHub

From the project folder, review `.gitignore`, ensure `.env` and signing keys are excluded, then:

```sh
git init -b master
git add .
git commit -m "Build SafeLink AI web, API and Flutter platform"
git remote add origin https://github.com/NoorAbdullah02/SafeLink-AI.git
git push -u origin master
```

If origin is already configured, inspect it with `git remote -v` instead of adding a duplicate. Do not force-push over existing work. The CI workflow checks web/API tests and builds, then analyzes/tests the Flutter app and builds a debug APK. Use pull requests for subsequent features.

## Recommended initial topology

One Node container serves the React build and Express API over HTTPS. Neon hosts PostgreSQL separately. This avoids cross-domain cookie configuration and keeps web and mobile on one API. `Dockerfile` and `render.yaml` are included; equivalent container hosts can use the same image.

1. Create Neon database; set `DATABASE_URL` locally and run `pnpm db:migrate`.
2. Connect the GitHub repository to the chosen container host and select the Dockerfile.
3. Set `NODE_ENV=production`, `DEMO_MEMORY=false`, `APP_URL=https://your-host` and `DATABASE_URL` in the host’s secret settings.
4. Add optional Brevo, AI and threat intelligence keys. Verify your Brevo sender.
5. Deploy one instance. Confirm `/api/health` reports PostgreSQL.
6. Register and verify an account, run a scan and reload history to confirm persistence.
7. Set your exact production origin, enable HTTPS and verify the secure session cookie in the browser.
8. Build the mobile app with that origin in `--dart-define=API_URL=...`.

Do not upload `.env` to GitHub. Configure branch protection so changes merge after CI succeeds. Configure the deployment provider to deploy after successful CI rather than blindly publishing a failing branch. Provider accounts, domain registration and service charges are owned by the user.

### Optional providers

The core scanner does not need Brevo/LLM/threat keys. Without them, the UI explicitly reports unavailable checks. Real transactional email, provider response quality and provider quotas must be tested with your credentials. No email is sent automatically to a trusted contact after a scan; the user must choose Send Security Alert.

### Mobile release

Android debug APKs are for testing only. For Play Store release, configure a private keystore, release signing and your production API endpoint. Never commit the keystore or passwords. iOS needs a Mac, Xcode, signing/team configuration and App Store/TestFlight setup. Physical-device camera and gallery permissions must be tested on target OS versions.

### Before the Tech Fair

- Run the controlled demos using both the website and the phone.
- Preload OCR languages or test first-use downloads on the fair connection.
- Confirm database persistence survives an API restart.
- Verify an alert to an agreed test recipient and inspect the failure state with Brevo unavailable.
- Keep a local laptop demo ready for internet failure; label its temporary storage clearly.

This implementation targets a single-instance educational pilot. A public service serving many users requires a further operational/security review, shared throttling, background image jobs, query pagination and abuse monitoring.
