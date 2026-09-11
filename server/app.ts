import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { resolve } from 'node:path';
import type { Store, Row } from './store.js';
import { config, allowedOrigins } from './config.js';
import { publicUser, token, hash, passwordHash, verifyPassword } from './security.js';
import { localScan, finish, normalizeUrl, normalizePhone } from './engine.js';
import { enrich } from './providers.js';
import { defaultBrands } from './brands.js';
import { mailReady, sendMail, accountLink } from './mail.js';
import { readImage } from './media.js';
import { categories, type ScanResult, type ScanKind, type Brand } from '../shared/types.js';
type Authed = Request & { user?: Row; sessionId?: string; accountUnavailable?: boolean };
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const scanInput = z.object({
  kind: z.enum(['url', 'message', 'qr', 'screenshot']),
  text: z.string().trim().min(1).max(10000),
  external: z.boolean().default(false),
  save: z.boolean().default(true),
});
const sessionCookie = 'safelink_session';
export function createApp(store: Store) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  const origins = allowedOrigins();
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || origins.has(origin)), credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const origin = req.headers.origin;
      const host = req.get('host');
      const isSameHost = Boolean(host && (origin === `https://${host}` || origin === `http://${host}`));
      const isMobile = req.headers['x-safelink-client'] === 'mobile';
      if (!origins.has(origin) && !isSameHost && !isMobile) {
        return next(fail(403, 'Request origin is not allowed.'));
      }
    }
    next();
  });
  app.use('/api', async (req: Authed, _res, next) => {
    try {
      const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined;
      const value = bearer || req.cookies[sessionCookie];
      if (value) {
        const s = (await store.list('sessions', { tokenHash: hash(value) }))[0];
        if (s && new Date(s.expiresAt) > new Date()) {
          const u = (await store.list('users', { id: s.userId }))[0];
          if (u && !u.disabled) {
            req.user = u;
            req.sessionId = s.id;
          }
        }
      }
      next();
    } catch {
      if (req.method === 'POST' && ['/scans', '/scans/image'].includes(req.path)) {
        req.accountUnavailable = true;
        next();
      } else next(fail(503, 'Account service is temporarily unavailable.'));
    }
  });
  const auth = (req: Authed, _res: Response, next: NextFunction) =>
    req.user ? next() : next(fail(401, 'Sign in to continue.'));
  const admin = (req: Authed, _res: Response, next: NextFunction) =>
    req.user?.role === 'admin' ? next() : next(fail(403, 'Administrator access required.'));
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const scanLimit = rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const mailLimit = rateLimit({
    windowMs: 3600000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const issueSession = async (req: Request, res: Response, u: Row) => {
    const value = token();
    await store.insert('sessions', {
      userId: u.id,
      tokenHash: hash(value),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    res.cookie(sessionCookie, value, {
      httpOnly: true,
      secure: config.production,
      sameSite: 'lax',
      maxAge: 7 * 86400000,
      path: '/',
    });
    return {
      user: publicUser(u),
      ...(req.headers['x-safelink-client'] === 'mobile' ? { token: value } : {}),
    };
  };
  const issueToken = async (u: Row, purpose: string) => {
    const value = token();
    await store.insert('authTokens', {
      userId: u.id,
      tokenHash: hash(value),
      purpose,
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    return value;
  };
  const categoryNames = async () => [
    ...new Set([
      ...categories,
      ...(await store.list('threatCategories')).map((c) => String(c.name)),
    ]),
  ];
  app.get('/api/categories', async (_req, res) => res.json(await categoryNames()));
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      storage: store.memory ? 'temporary-memory' : 'postgresql',
      email: mailReady(),
      ai: Boolean(
        (process.env.LLM_API_KEY && process.env.LLM_MODEL) ||
          process.env.MISTRAL_KEY ||
          process.env.MISTRIAL_KEY,
      ),
      intelligence: Boolean(process.env.SAFE_BROWSING_API_KEY),
    }),
  );
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const data = z
      .object({ name: z.string().trim().min(2).max(80), email, password })
      .parse(req.body);
    const u = await store.insert('users', {
      ...data,
      password: undefined,
      passwordHash: await passwordHash(data.password),
      role: 'user',
      verified: false,
      disabled: false,
      simpleMode: false,
    });
    const value = await issueToken(u, 'verify');
    const sent = await sendMail(
      u.email,
      'Verify your email',
      'Confirm this email for your SafeLink account. This link expires in 30 minutes.',
      accountLink('verify', value),
    );
    res.status(201).json({ ...(await issueSession(req, res, u)), emailSent: sent });
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const data = z.object({ email, password: z.string().max(128) }).parse(req.body);
    const u = (await store.list('users', { email: data.email }))[0];
    const valid = await verifyPassword(
      data.password,
      u?.passwordHash || '00000000000000000000000000000000:' + '0'.repeat(128),
    );
    if (!u || !valid || u.disabled) throw fail(401, 'Email or password is incorrect.');
    res.json(await issueSession(req, res, u));
  });
  app.post('/api/auth/logout', auth, async (req: Authed, res) => {
    if (req.sessionId) await store.remove('sessions', req.sessionId);
    res.clearCookie(sessionCookie, { path: '/' }).json({ ok: true });
  });
  app.get('/api/me', auth, (req: Authed, res) => res.json(publicUser(req.user!)));
  app.patch('/api/me', auth, async (req: Authed, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        simpleMode: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(publicUser((await store.update('users', req.user!.id, data))!));
  });
  app.post('/api/auth/forgot', authLimit, async (req, res) => {
    const data = z.object({ email }).parse(req.body);
    if (!mailReady()) throw fail(503, 'Email service is not configured.');
    const u = (await store.list('users', { email: data.email }))[0];
    if (u) {
      const value = await issueToken(u, 'reset');
      await sendMail(
        u.email,
        'Reset your password',
        'A password reset was requested. Ignore this email if it was not you. The link expires in 30 minutes.',
        accountLink('reset', value),
      );
    }
    res.json({ message: 'If an account exists, a reset email has been requested.' });
  });
  app.post('/api/auth/resend', auth, mailLimit, async (req: Authed, res) => {
    if (!mailReady()) throw fail(503, 'Email service is not configured.');
    const value = await issueToken(req.user!, 'verify');
    const sent = await sendMail(
      req.user!.email,
      'Verify your email',
      'Confirm this email for your SafeLink account.',
      accountLink('verify', value),
    );
    if (!sent) throw fail(503, 'Email could not be sent.');
    res.json({ ok: true });
  });
  // Single-use tokens are consumed before mutation; concurrent requests cannot both consume a token.
  const consuming = new Set<string>();
  app.post('/api/auth/confirm', authLimit, async (req, res) => {
    const data = z
      .object({
        token: z.string().length(64),
        purpose: z.enum(['verify', 'reset']),
        password: password.optional(),
      })
      .parse(req.body);
    if (data.purpose === 'reset' && !data.password) throw fail(400, 'A new password is required.');
    const digest = hash(data.token);
    if (consuming.has(digest)) throw fail(400, 'This link is already being used.');
    consuming.add(digest);
    try {
      const t = await store.consumeToken(digest, data.purpose);
      if (!t || new Date(t.expiresAt) < new Date())
        throw fail(400, 'This link is invalid or expired.');
    await store.update(
        'users',
        t.userId,
        data.purpose === 'verify'
          ? { verified: true }
          : { passwordHash: await passwordHash(data.password!) },
      );
      if (data.purpose === 'reset') {
        for (const s of await store.list('sessions', { userId: t.userId }))
          await store.remove('sessions', s.id);
        for (const token of await store.list('authTokens', { userId: t.userId, purpose: 'reset' })) await store.remove('authTokens',token.id);
      }
      res.json({ ok: true });
    } finally {
      consuming.delete(digest);
    }
  });
  const runScan = async (req: Authed, data: z.infer<typeof scanInput>) => {
    let brands = defaultBrands;
    let dbAvailable = true;
    try {
      const custom = await store.list('brands');
      brands = [
        ...defaultBrands.filter((b) => !custom.some((c) => c.name === b.name)),
        ...(custom as Brand[]),
      ];
    } catch {
      dbAvailable = false;
    }
    const r = localScan(data.text, data.kind, brands);
    if (dbAvailable)
      try {
        const entities = [
          ...r.urls,
          ...r.urls.map((u) => new URL(u).hostname),
          ...r.phones,
          'message:' + hash(data.text.normalize('NFKC').toLowerCase()),
        ];
        const credible = new Set<string>();
        for (const entity of entities) {
          const rows = await store.list('reports', { entity, status: 'approved' });
          rows.forEach((x) => credible.add(x.userId));
        }
        if (credible.size >= 2) {
          const weight = Math.min(25, credible.size * 5);
          r.score += weight;
          r.evidence.push({
            id: 'community',
            source: 'community',
            title: 'Multiple reviewed community reports',
            detail: `${credible.size} distinct reporters have approved reports for matching entities.`,
            weight,
          });
        }
        r.checks.push({
          name: 'Community reports',
          status: 'complete',
          detail: store.memory
            ? 'Temporary demo reports only.'
            : 'Only moderator-approved reports from distinct accounts influence risk.',
        });
      } catch {
        dbAvailable = false;
      }
    if (!dbAvailable)
      r.checks.push({
        name: 'Community reports',
        status: 'unavailable',
        detail: 'Database check unavailable.',
      });
    await enrich(finish(r), data.text, data.external);
    r.persisted = false;
    if (req.accountUnavailable)
      r.checks.push({
        name: 'Account and history',
        status: 'unavailable',
        detail: 'Your session could not be checked. Analysis ran without saving a history record.',
      });
    if (req.user && data.save) {
      try {
        const stored = {
          ...r,
          extractedText: undefined,
          urls: r.urls.map((u) => new URL(u).origin),
          phones: [],
          evidence: r.evidence.map((e) => ({
            ...e,
            detail: e.detail.replace(/\+?\d{8,}/g, '[number removed]'),
          })),
        };
        await store.insert('scans', {
          id: r.id,
          userId: req.user.id,
          kind: r.kind,
          score: r.score,
          level: r.level,
          saved: false,
          result: stored,
        });
        r.persisted = true;
      } catch {
        r.checks.push({
          name: 'History storage',
          status: 'unavailable',
          detail: 'Scan completed but could not be saved.',
        });
      }
    }
    return r;
  };
  app.post('/api/scans', scanLimit, async (req: Authed, res) =>
    res.json(await runScan(req, scanInput.parse(req.body))),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4 },
  });
  app.post('/api/scans/image', scanLimit, upload.single('image'), async (req: Authed, res) => {
    const kind = z.enum(['qr', 'screenshot']).parse(req.body.kind);
    if (!req.file) throw fail(400, 'Choose an image.');
    let text: string;
    try {
      text = await readImage(req.file.buffer, kind);
    } catch (e) {
      throw fail((e as any).status || 422, (e as Error).message);
    }
    const r = await runScan(req, {
      kind,
      text,
      external: req.body.external === 'true',
      save: req.body.save !== 'false',
    });
    res.json({ ...r, extractedText: text });
  });
  app.get('/api/scans', auth, async (req: Authed, res) =>
    res.json(
      (await store.list('scans', { userId: req.user!.id }))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 200)
        .map((r) => ({ ...r.result, saved: r.saved, persisted: true })),
    ),
  );
  const own = async (t: 'scans' | 'contacts', id: string, userId: string) => {
    const row = (await store.list(t, { id: z.uuid().parse(id), userId }))[0];
    if (!row) throw fail(404, 'Item not found.');
    return row;
  };
  app.patch('/api/scans/:id', auth, async (req: Authed, res) => {
    const row = await own('scans', String(req.params.id), req.user!.id);
    await store.update('scans', row.id, z.object({ saved: z.boolean() }).parse(req.body));
    res.json({ ok: true });
  });
  app.delete('/api/scans/:id', auth, async (req: Authed, res) => {
    const row = await own('scans', String(req.params.id), req.user!.id);
    await store.remove('scans', row.id);
    res.json({ ok: true });
  });
  app.get('/api/reports', auth, async (req: Authed, res) =>
    res.json(await store.list('reports', { userId: req.user!.id })),
  );
  app.post('/api/reports', auth, mailLimit, async (req: Authed, res) => {
    if (!req.user!.verified && !store.memory)
      throw fail(403, 'Verify your email before submitting community reports.');
    const data = z
      .object({
        entity: z.string().trim().min(3).max(2048),
        entityType: z.enum(['url', 'domain', 'phone', 'message']),
        category: z.string().min(2).max(80),
        description: z.string().trim().min(5).max(1000),
      })
      .parse(req.body);
    if (!(await categoryNames()).includes(data.category))
      throw fail(400, 'Choose an available threat category.');
    let entity = data.entity;
    if (data.entityType === 'url') entity = normalizeUrl(entity).href;
    if (data.entityType === 'domain') entity = normalizeUrl(entity).hostname;
    if (data.entityType === 'phone') {
      entity = normalizePhone(entity);
      if (!/^\+\d{8,15}$/.test(entity)) throw fail(400, 'Use an international phone number.');
    }
    if (data.entityType === 'message')
      entity = 'message:' + hash(entity.normalize('NFKC').toLowerCase());
    const report = await store.insert('reports', {
      ...data,
      entity,
      userId: req.user!.id,
      status: 'pending',
    });
    if (req.user!.verified)
      await sendMail(
        req.user!.email,
        'Report received',
        'Your community report is pending review. It does not affect risk scores until approved.',
      );
    res.status(201).json(report);
  });
  app.get('/api/contacts', auth, async (req: Authed, res) =>
    res.json(await store.list('contacts', { userId: req.user!.id })),
  );
  app.post('/api/contacts', auth, async (req: Authed, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80), email }).parse(req.body);
    if ((await store.list('contacts', { userId: req.user!.id })).length >= 10)
      throw fail(400, 'You can add up to 10 trusted contacts.');
    res.status(201).json(await store.insert('contacts', { ...data, userId: req.user!.id }));
  });
  app.delete('/api/contacts/:id', auth, async (req: Authed, res) => {
    const row = await own('contacts', String(req.params.id), req.user!.id);
    await store.remove('contacts', row.id);
    res.json({ ok: true });
  });
  app.get('/api/alerts', auth, async (req: Authed, res) =>
    res.json(await store.list('alerts', { userId: req.user!.id })),
  );
  app.post('/api/alerts', auth, mailLimit, async (req: Authed, res) => {
    if (!req.user!.verified) throw fail(403, 'Verify your email before sending alerts.');
    if (!mailReady()) throw fail(503, 'Email service is not configured.');
    const data = z.object({ scanId: z.uuid(), contactId: z.uuid().optional() }).parse(req.body);
    const scan = await own('scans', data.scanId, req.user!.id);
    const contact = data.contactId
      ? await own('contacts', data.contactId, req.user!.id)
      : undefined;
    const sent = await sendMail(
      contact?.email || req.user!.email,
      contact ? 'Trusted-contact security alert' : 'Security alert',
      `${req.user!.name} requested this alert. SafeLink found ${scan.level} (${scan.score}/100 Risk Score). ${scan.result.recommendation} No submitted message or suspicious link is included.`,
    );
    await store.insert('alerts', {
      userId: req.user!.id,
      scanId: scan.id,
      contactId: contact?.id || null,
      status: sent ? 'sent' : 'failed',
    });
    if (!sent) throw fail(503, 'The email provider could not send this alert.');
    res.json({ ok: true });
  });
  app.get('/api/dashboard', auth, async (req: Authed, res) => {
    const rows = await store.list('scans', { userId: req.user!.id });
    const reports = await store.list('reports', { userId: req.user!.id });
    res.json({
      total: rows.length,
      highRisk: rows.filter((r) => r.score >= 50).length,
      reports: reports.length,
      qr: rows.filter((r) => r.kind === 'qr').length,
      screenshots: rows.filter((r) => r.kind === 'screenshot').length,
      distribution: ['Low Risk', 'Caution', 'High Risk', 'Critical Risk'].map((level) => ({
        level,
        count: rows.filter((r) => r.level === level).length,
      })),
      categories: (await categoryNames()).map((category) => ({
        category,
        count: reports.filter((r) => r.category === category).length,
      })),
      recent: rows
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 6)
        .map((r) => r.result),
    });
  });
  app.get('/api/graph', auth, async (req: Authed, res) => {
    const reports = await store.list('reports', { userId: req.user!.id });
    const nodes = new Map<string, Row>();
    const edges: Row[] = [];
    for (const r of reports.slice(0, 50)) {
      nodes.set(r.entity, { id: r.entity, label: r.entity, type: r.entityType });
      nodes.set(r.category, { id: r.category, label: r.category, type: 'category' });
      edges.push({ source: r.entity, target: r.category, status: r.status });
    }
    res.json({ nodes: [...nodes.values()], edges });
  });
  app.use('/api/admin', auth, admin);
  app.get('/api/admin/:table', async (req, res) => {
    const t = z
      .enum(['users', 'reports', 'brands', 'threatCategories', 'adminLogs', 'scans'])
      .parse(req.params.table);
    const rows = await store.list(t);
    res.json(
      rows.slice(-500).map((r) => (t === 'users' ? { ...publicUser(r), disabled: r.disabled } : r)),
    );
  });
  app.patch('/api/admin/reports/:id', async (req: Authed, res) => {
    const id = z.uuid().parse(req.params.id);
    const data = z.object({ status: z.enum(['approved', 'rejected', 'pending']) }).parse(req.body);
    if(!await store.update('reports', id, data)) throw fail(404,'Report not found.');
    await store.insert('adminLogs', {
      userId: req.user!.id,
      action: 'report:' + data.status,
      target: id,
    });
    res.json({ ok: true });
  });
  app.patch('/api/admin/users/:id', async (req: Authed, res) => {
    const id = z.uuid().parse(req.params.id);
    if (id === req.user!.id) throw fail(400, 'You cannot change your own administrative access.');
    const data = z.object({ disabled: z.boolean() }).parse(req.body);
    if(!await store.update('users', id, data)) throw fail(404,'User not found.');
    if(data.disabled) for(const session of await store.list('sessions',{userId:id})) await store.remove('sessions',session.id);
    await store.insert('adminLogs', {
      userId: req.user!.id,
      action: 'user:' + String(data.disabled),
      target: id,
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/brands', async (req: Authed, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(80),
        aliases: z.array(z.string().trim().min(2).max(60).transform(s=>s.toLowerCase())).min(1).max(20),
        domains: z.array(z.string().min(3).max(253)).min(1).max(20),
      })
      .parse(req.body);
    data.domains = data.domains.map((d) => normalizeUrl(d).hostname);
    const existing = (await store.list('brands', { name: data.name }))[0];
    const row = existing
      ? await store.update('brands', existing.id, data)
      : await store.insert('brands', data);
    await store.insert('adminLogs', {
      userId: req.user!.id,
      action: 'brand:upsert',
      target: row!.id,
    });
    res.json(row);
  });
  app.post('/api/admin/threatCategories', async (req: Authed, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    const row = await store.insert('threatCategories', data);
    await store.insert('adminLogs', {
      userId: req.user!.id,
      action: 'category:create',
      target: row.id,
    });
    res.json(row);
  });
  app.use('/api', (_req, _res, next) => next(fail(404, 'API route not found.')));
  if (config.production) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof z.ZodError
        ? 400
        : (err.code === '23505' || err.cause?.code === '23505')
          ? 409
          : err instanceof multer.MulterError
            ? 400
            : err.status || 500;
    res.status(status).json({
      error:
        err instanceof z.ZodError
          ? err.issues.map((i) => i.message).join(' ')
          : status === 409
            ? 'This entry already exists.'
            : status >= 500
              ? (status===503 && err.status===503 ? err.message : 'Service temporarily unavailable. Please try again.')
              : err.message || 'Request failed.',
    });
  });
  return app;
}
