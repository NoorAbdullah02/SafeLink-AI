// Test imports run before dotenv/config. Empty values prevent .env from supplying
// production credentials and keep automated checks away from live services.
process.env.NODE_ENV = 'test';
process.env.DEMO_MEMORY = 'true';
process.env.APP_URL = 'http://localhost:5173';
for (const name of [
  'DATABASE_URL', 'RENDER_EXTERNAL_URL', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL',
  'LLM_API_KEY', 'LLM_MODEL', 'LLM_BASE_URL', 'MISTRAL_KEY', 'MISTRIAL_KEY',
  'SAFE_BROWSING_API_KEY',
]) process.env[name] = '';
