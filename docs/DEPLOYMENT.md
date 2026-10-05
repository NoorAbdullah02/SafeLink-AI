# Deployment and GitHub handoff

The source belongs at the root of `NoorAbdullah02/SafeLink-AI`. The 2026-10-04 audit updates local files. It does not push, redeploy the published website or replace the published Android APK.

## GitHub

From the project folder, review `.gitignore`, ensure `.env` and signing keys are excluded, then:

```sh
git status
git remote -v
git add .
git commit -m "Fix SafeLink web, API and mobile audit findings"
git push -u origin master
```

This checkout already has Git history and an origin; do not initialize it again. Inspect `git status` and `git remote -v`, review changes, commit and push only when ready. Do not force-push over existing work. CI checks tests, builds, production dependency advisories and migration consistency, then analyzes/tests Flutter and uploads a debug APK artifact. It no longer publishes every master push under a fixed release tag. Use pull requests for subsequent features.

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

The portable toolchain installed for this laptop and repeatable debug-build command are documented in [the Android build guide](ANDROID-BUILD.md).

### Read-only service diagnostics

Run `pnpm services:check` to check the configured database connection and required table columns without reading personal rows or changing schema/data. Add `--email-config` to check whether Brevo lists the configured sender as active; it sends no email. Add `--providers` only when ready to send the script's synthetic reserved-domain example and generic safety question to the configured providers. Reports are written separately under `work/verification` so one check does not overwrite another.

These checks do not measure model quality, email inbox delivery, persistence across restarts, or whether the latest source has been deployed. `/api/health` reports configuration rather than proving those outcomes.

### Before the Tech Fair

- Run the controlled demos using both the website and the phone.
- Preload OCR languages or test first-use downloads on the fair connection.
- Container builds now preload English/Bengali OCR files into `/app/ocr-data`; the runtime uses `OCR_LANG_PATH` for these read-only assets. A successful local OCR check does not verify a hosted container build.
- Confirm database persistence survives an API restart.
- Verify an alert to an agreed test recipient and inspect the failure state with Brevo unavailable.
- Keep a local laptop demo ready for internet failure; label its temporary storage clearly.

This implementation targets a single-instance educational pilot. A public service serving many users requires a further operational/security review, shared throttling, background image jobs, query pagination and abuse monitoring.

Never describe the product as blocking payment accounts or automatically filing police reports. The app supplies guidance and editable drafts. External assistant analysis requires consent independently of scan-provider consent. Keep verified helpline sources available and refresh contact details before a presentation.
