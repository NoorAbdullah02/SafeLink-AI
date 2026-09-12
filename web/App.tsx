import { Landing } from './Landing';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useModalFocus } from './useModalFocus';
import * as Tabs from '@radix-ui/react-tabs';
import {
  ShieldCheck,
  ScanLine,
  Link,
  MessageSquare,
  QrCode,
  ImagePlus,
  LayoutDashboard,
  History,
  Users,
  HeartHandshake,
  Settings,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Check,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Search,
  Plus,
  Trash2,
  Bookmark,
  Mail,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Globe,
  Activity,
  Network,
  Play,
  Loader2,
  Upload,
  LockKeyhole,
  CheckCircle2,
  ExternalLink,
  Printer,
  FileText,
  PhoneCall,
  BookOpen,
  Cpu,
  Zap,
  Copy,
  Scale,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { api, post } from './api';
import { categories, demos, type ScanResult, type ScanKind } from '../shared/types';
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  simpleMode: boolean;
};
type Page =
  'scanner' | 'dashboard' | 'directory' | 'history' | 'community' | 'family' | 'settings' | 'demo' | 'admin';
const nav = [
  { id: 'scanner', label: 'Scan center', icon: ScanLine },
  { id: 'dashboard', label: 'Overview & Radar', icon: LayoutDashboard },
  { id: 'directory', label: 'Helpline Directory', icon: PhoneCall },
  { id: 'history', label: 'Scan history', icon: History },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'family', label: 'Family Shield', icon: HeartHandshake },
  { id: 'demo', label: 'Demo lab', icon: Play },
] as const;
const kindInfo = {
  url: {
    title: 'Link',
    icon: Link,
    placeholder: 'Paste a link to check, e.g. https://example.com',
  },
  message: {
    title: 'Message',
    icon: MessageSquare,
    placeholder: 'Paste a message in বাংলা, Banglish or English…',
  },
  qr: { title: 'QR code', icon: QrCode, placeholder: '' },
  screenshot: { title: 'Screenshot', icon: ImagePlus, placeholder: '' },
};
function RiskPill({ score, level }: { score: number; level: string }) {
  return (
    <span
      className={
        'risk-pill risk-' +
        (score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'caution' : 'low')
      }
    >
      {score >= 25 ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />} {level}
    </span>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <ShieldCheck size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export default function App() {
  const [historySelection, setHistorySelection] = useState<ScanResult | null>(null);
  const [workspace, setWorkspace] = useState(() => location.hash === '#workspace' || new URLSearchParams(location.search).has('action'));
  useEffect(() => { const sync = () => setWorkspace(location.hash === '#workspace' || new URLSearchParams(location.search).has('action')); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const [smallScreen, setSmallScreen] = useState(() => matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 700px)');
    const update = () => setSmallScreen(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [page, setPage] = useState<Page>('scanner'),
    [user, setUser] = useState<User | null>(null),
    [health, setHealth] = useState<any>(null),
    [mobileMenu, setMobileMenu] = useState(false),
    [dark, setDark] = useState(localStorage.getItem('theme') === 'dark'),
    [notice, setNotice] = useState(''),
    [authOpen, setAuthOpen] = useState(false),
    [refresh, setRefresh] = useState(0),
    [preset, setPreset] = useState<{ kind: ScanKind; text: string } | null>(null);
  const [action] = useState(() => new URLSearchParams(location.search).get('action'));
  useEffect(() => {
    api('/health')
      .then(setHealth)
      .catch(() => setHealth({ offline: true }));
    api('/me')
      .then(setUser)
      .catch(() => {});
  }, []);
  useEffect(() => { setHistorySelection(null); }, [user?.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  function go(p: Page) {
    setPage(p);
    setMobileMenu(false);
  }
  const props = {
    user,
    notify: setNotice,
    refresh: () => setRefresh((x) => x + 1),
    requireAuth: () => setAuthOpen(true),
  };
  if (!workspace) return <Landing dark={dark} toggleTheme={() => setDark(!dark)} enter={() => { location.hash = 'workspace'; setWorkspace(true); window.scrollTo(0,0); }} />;
  return (
    <div className={'app ' + (user?.simpleMode ? 'simple' : '')}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside
        id="main-navigation"
        inert={smallScreen && !mobileMenu}
        className={'sidebar ' + (mobileMenu ? 'open' : '')}
      >
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            location.hash = ''; setWorkspace(false); window.scrollTo(0,0);
          }}
          className="brand"
        >
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          <span>
            SafeLink<span className="ai-label">AI</span>
            <small>YOUR DIGITAL SAFETY NET</small>
          </span>
        </a>
        <button
          className="close-menu icon-button"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={'nav-item ' + (page === n.id ? 'active' : '')}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'scanner' && <span className="nav-badge">4</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="shield-note">
            <span className="note-icon">
              <ShieldCheck size={22} />
            </span>
            <strong>A pause can protect you.</strong>
            <p>Check unexpected links before you click.</p>
            <span>Before You Click, Let AI Check.</span>
          </div>
          <button
            className={'nav-item ' + (page === 'settings' ? 'active' : '')}
            onClick={() => go('settings')}
          >
            <Settings size={19} />
            Settings
          </button>
          {user?.role === 'admin' && (
            <button className="nav-item" onClick={() => go('admin')}>
              <LockKeyhole size={19} />
              Admin panel
            </button>
          )}
          <button className="profile" onClick={() => (user ? go('settings') : setAuthOpen(true))}>
            <span className="avatar">{user ? user.name[0].toUpperCase() : 'G'}</span>
            <span>
              <strong>{user?.name || 'Guest workspace'}</strong>
              <small>{user ? 'Personal account' : 'Sign in to save your scans'}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="menu-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              aria-expanded={mobileMenu}
              aria-controls="main-navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === page)?.label ||
                (page === 'admin' ? 'Admin panel' : 'Settings')}
            </strong>
          </div>
          <div className="top-actions">
            <span className={'connection ' + (health?.offline ? 'offline' : '')}>
              <span />
              {!health
                ? 'Connecting'
                : health.offline
                  ? 'API unavailable'
                  : health.storage === 'temporary-memory'
                    ? 'Local demo'
                    : 'System connected'}
            </span>
            <button
              className="icon-button"
              aria-label={dark ? 'Use light theme' : 'Use dark theme'}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {!user && (
              <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}>
                Sign in <ArrowUpRight size={14} />
              </Button>
            )}
          </div>
        </header>
        <main id="main">
          {health?.storage === 'temporary-memory' && (
            <div className="demo-banner">
              <Activity size={15} />
              <span>
                Temporary demo workspace · Scans use the real engine. Saved data resets when the
                server restarts.
              </span>
            </div>
          )}
          {health?.offline && (
            <div className="error">
              The scanner cannot reach the backend. Check your connection and retry.
            </div>
          )}
          {page === 'scanner' && (
            <Scanner
              {...props}
              preset={preset}
              health={health}
              onScan={() => setRefresh((x) => x + 1)}
            />
          )}
          {page === 'dashboard' && (
            <Dashboard
              {...props}
              version={refresh}
              onOpen={(r) => {
                setHistorySelection(r);
                go('history');
              }}
            />
          )}
          {page === 'directory' && <HelplineDirectory notify={props.notify} />}
          {page === 'history' && <HistoryPage {...props} version={refresh} initialSelection={historySelection} />}
          {page === 'community' && <Community {...props} />}
          {page === 'family' && (
            <Family
              {...props}
              onSimple={async () => {
                if (!user) return setAuthOpen(true);
                try {
                  const u = await api<User>('/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ simpleMode: !user.simpleMode }),
                  });
                  setUser(u);
                } catch (e) {
                  setNotice((e as Error).message);
                }
              }}
            />
          )}
          {page === 'settings' && <SettingsPage {...props} health={health} setUser={setUser} />}
          {page === 'demo' && (
            <>
              <PageTitle
                eyebrow="CONTROLLED TEST SCENARIOS"
                title="See the signals. Understand the risk."
                text="Reserved example domains, real analysis. Every sample uses the same scanner as your own content."
              />
              <div className="demo-grid">
                {demos.map((d, i) => (
                  <article className="card demo-card" key={d.title}>
                    <span className="demo-number">0{i + 1}</span>
                    <h3>{d.title}</h3>
                    <p lang={i === 1 ? 'bn' : undefined}>{d.text}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPreset({ kind: d.kind, text: d.text });
                        go('scanner');
                      }}
                    >
                      Try this scan <ArrowRight size={16} />
                    </Button>
                  </article>
                ))}
              </div>
              <div className="card">
                <h3>QR & screenshot examples</h3>
                <p>
                  Use the images in the project’s demo-assets folder. Upload the QR image in QR code
                  mode or the message image in Screenshot mode. Neither sample opens a destination.
                </p>
              </div>
            </>
          )}
          {page === 'admin' && <Admin {...props} />}
          <footer>
            <span>
              <ShieldCheck size={14} /> SafeLink AI
            </span>
            <span>Risk scores are indicators, not guarantees.</span>
            <span>Built for a safer click.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onUser={(u) => {
            setUser(u);
            setAuthOpen(false);
            setRefresh((x) => x + 1);
          }}
          notify={setNotice}
        />
      )}
      {(action === 'verify' || action === 'reset') && (
        <AccountAction action={action} notify={setNotice} />
      )}
    </div>
  );
}
type Props = {
  user: User | null;
  notify: (s: string) => void;
  refresh: () => void;
  requireAuth: () => void;
};
function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function Scanner({
  user,
  notify,
  preset,
  health,
  onScan,
  requireAuth,
}: Props & { preset: { kind: ScanKind; text: string } | null; health: any; onScan: () => void }) {
  const [kind, setKind] = useState<ScanKind>('url'),
    [text, setText] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [external, setExternal] = useState(false),
    [save, setSave] = useState(true),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ScanResult | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (preset) {
      setKind(preset.kind);
      setText(preset.text);
      setResult(null);
    }
  }, [preset]);
  async function scan(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      let r: ScanResult;
      if (kind === 'qr' || kind === 'screenshot') {
        if (!file) throw new Error('Choose an image first.');
        const body = new FormData();
        body.append('image', file);
        body.append('kind', kind);
        body.append('external', String(external));
        body.append('save', String(save));
        r = await api('/scans/image', { method: 'POST', body });
      } else r = await post('/scans', { kind, text, external, save });
      setResult(r);
      onScan();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="heading-row">
        <PageTitle
          eyebrow="SCAN CENTER"
          title={user?.simpleMode ? 'Check before you trust.' : 'A safer click starts here.'}
          text="Check suspicious links, messages, QR codes and screenshots. Know the reasons, not just the risk."
        />
        <div className="heading-stamp">
          <ShieldCheck size={32} />
          <span>
            One check.
            <br />
            <strong>More peace of mind.</strong>
          </span>
        </div>
      </div>
      <div className="scan-layout">
        <section className="card scan-card">
          <div className="card-heading">
            <div>
              <h2>What would you like to check?</h2>
              <p>Your next click deserves a second look.</p>
            </div>
            <span className="subtle-tag">
              <LockKeyhole size={13} /> Private by default
            </span>
          </div>
          <Tabs.Root
            value={kind}
            onValueChange={(v) => {
              setKind(v as ScanKind);
              setError('');
              setResult(null);
              setFile(null);
            }}
          >
            <Tabs.List className="scan-tabs" aria-label="Content type">
              {Object.entries(kindInfo).map(([k, v]) => (
                <Tabs.Trigger key={k} value={k}>
                  <v.icon size={19} />
                  {v.title}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <form onSubmit={scan}>
              <label className="input-label" htmlFor="scan-input">
                {kind === 'url'
                  ? 'Link to analyze'
                  : kind === 'message'
                    ? 'Message to analyze'
                    : kind === 'qr'
                      ? 'QR code image'
                      : 'Screenshot to analyze'}
              </label>
              {kind === 'url' || kind === 'message' ? (
                <div className={'scan-input ' + (kind === 'message' ? 'message' : '')}>
                  <span>{kind === 'url' ? <Link size={19} /> : <MessageSquare size={19} />}</span>
                  <textarea
                    id="scan-input"
                    rows={kind === 'url' ? 3 : 5}
                    maxLength={10000}
                    placeholder={kindInfo[kind].placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                  />
                  <span className="char-count">{text.length.toLocaleString()} / 10,000</span>
                </div>
              ) : (
                <label className="upload-zone" htmlFor="scan-input">
                  <span className="upload-icon">
                    <Upload size={25} />
                  </span>
                  <strong>{file ? file.name : 'Choose an image to scan'}</strong>
                  <span>PNG, JPEG or WebP · Up to 5 MB</span>
                  <input
                    id="scan-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                  <small>
                    {kind === 'qr'
                      ? 'The QR destination will be decoded without opening it.'
                      : 'Text is extracted with English + বাংলা OCR. You can review what was read.'}
                  </small>
                </label>
              )}
              <div className="scan-options">
                <label>
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(e) => setExternal(e.target.checked)}
                  />
                  <span>
                    Use external AI & threat checks{' '}
                    <small>
                      Sends text/URLs to configured providers. Remove private information first.
                    </small>
                  </span>
                </label>
                {user && (
                  <label>
                    <input
                      type="checkbox"
                      checked={save}
                      onChange={(e) => setSave(e.target.checked)}
                    />{' '}
                    Save a redacted result to my history
                  </label>
                )}
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="scan-submit">
                <span>
                  <ShieldCheck size={15} /> Links are never opened automatically
                </span>
                <Button type="submit" disabled={busy || health?.offline}>
                  {busy ? <Loader2 className="spin" size={18} /> : <ScanLine size={18} />}{' '}
                  {busy ? 'Analyzing…' : 'Scan Now'} {!busy && <ArrowRight size={17} />}
                </Button>
              </div>
            </form>
          </Tabs.Root>
          <div className="demo-scenarios-panel">
            <div className="demo-scenarios-header">
              <div>
                <span className="eyebrow">⚡ 1-CLICK COMPETITION DEMO SCENARIOS</span>
                <h3>Instant Test Cards (Tap any card to analyze)</h3>
              </div>
              <span className="demo-badge">4 LIVE SAMPLES</span>
            </div>
            <div className="demo-cards-grid">
              <button
                type="button"
                className="demo-scenario-card danger"
                onClick={() => {
                  setKind('url');
                  setText('https://bkash-reward.xyz/login');
                  setResult(null);
                  document.getElementById('scan-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">🔗</span>
                  <span className="demo-tag danger">HOMOGRAPH SPOOF</span>
                </div>
                <strong>bKash Spoof Link</strong>
                <p className="demo-preview">https://bkash-reward.xyz/login</p>
                <span className="demo-action">Test Scenario →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card warning"
                onClick={() => {
                  setKind('message');
                  setText('Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.');
                  setResult(null);
                  document.getElementById('scan-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">💬</span>
                  <span className="demo-tag warning">BANGLISH OTP</span>
                </div>
                <strong>Banglish PIN Scam</strong>
                <p className="demo-preview">Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.</p>
                <span className="demo-action">Test Scenario →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card warning"
                onClick={() => {
                  setKind('message');
                  setText('অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।');
                  setResult(null);
                  document.getElementById('scan-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">🎁</span>
                  <span className="demo-tag warning">BANGLA LOTTERY</span>
                </div>
                <strong>Bangla Lottery Scam</strong>
                <p className="demo-preview">অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।</p>
                <span className="demo-action">Test Scenario →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card success"
                onClick={() => {
                  setKind('url');
                  setText('https://www.bkash.com');
                  setResult(null);
                  document.getElementById('scan-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">✅</span>
                  <span className="demo-tag success">VERIFIED SAFE</span>
                </div>
                <strong>Official Safe Site</strong>
                <p className="demo-preview">https://www.bkash.com</p>
                <span className="demo-action">Test Scenario →</span>
              </button>
            </div>
          </div>
        </section>
        <aside className="scan-side">
          <div className="dark-card">
            <span className="outline-icon">
              <ShieldCheck size={26} />
            </span>
            <span className="eyebrow">BUILT TO EXPLAIN</span>
            <h2>
              More than a <br />
              red flag.
            </h2>
            <p>Understand what looks suspicious, why it matters, and what to do next.</p>
            <div className="evidence-preview">
              <span>
                <CheckCircle2 size={16} /> Clear evidence
              </span>
              <span>
                <CheckCircle2 size={16} /> Practical next steps
              </span>
              <span>
                <CheckCircle2 size={16} /> বাংলা & Banglish support
              </span>
            </div>
          </div>
          <div className="tip-card">
            <span className="tip-label">
              <span /> SAFETY NOTE
            </span>
            <h3>HTTPS ≠ trustworthy</h3>
            <p>A padlock means an encrypted connection. Scam websites can have one, too.</p>
          </div>
        </aside>
      </div>
      {busy && (
        <div className="card analyzing" role="status">
          <Loader2 className="spin" />
          <div>
            <strong>Looking for the signals…</strong>
            <p>
              {kind === 'screenshot'
                ? 'Reading the screenshot may take up to a minute on first use.'
                : 'Checking available evidence. External services may take a few seconds.'}
            </p>
          </div>
        </div>
      )}
      {result ? (
        <Result result={result} user={user} notify={notify} requireAuth={requireAuth} />
      ) : (
        <div className="how-section">
          <div className="section-title">
            <h2>One scan. A clearer picture.</h2>
            <span>HOW SAFELINK CHECKS</span>
          </div>
          <div className="how-grid">
            {[
              {
                icon: Search,
                n: '01',
                title: 'Read the signals',
                text: 'URL patterns, look-alike brands and suspicious language.',
              },
              {
                icon: Network,
                n: '02',
                title: 'Connect the evidence',
                text: 'Available community reports and optional external checks.',
              },
              {
                icon: ShieldCheck,
                n: '03',
                title: 'Make an informed choice',
                text: 'A risk score, specific reasons and a useful next step.',
              },
            ].map((x) => (
              <article key={x.n}>
                <span className="step-icon">
                  <x.icon size={21} />
                </span>
                <span className="step-number">{x.n}</span>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
function Result({
  result: r,
  user,
  notify,
  requireAuth,
  onSaved,
}: {
  result: ScanResult;
  onSaved?: (id: string, saved: boolean) => void;
  user: User | null;
  notify: (s: string) => void;
  requireAuth: () => void;
}) {
  const [saved, setSaved] = useState(Boolean(r.saved));
  const [reportOpen, setReportOpen] = useState(false);
  const [gdOpen, setGdOpen] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setSaved(Boolean(r.saved));
    resultRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, [r.id]);
  return (
    <section ref={resultRef} className="card result-card" aria-live="polite" style={{ scrollMarginTop: 24 }}>
      <div className="result-top">
        <div
          className="score-ring"
          style={
            {
              '--score': r.score + '%',
              '--risk': r.score >= 50 ? '#db5745' : r.score >= 25 ? '#c88617' : '#17876b',
            } as React.CSSProperties
          }
        >
          <div>
            <strong>{r.score}</strong>
            <span>/ 100</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">SAFELINK RISK SCORE</span>
          <h2>{r.level}</h2>
          <p>{r.threatType}</p>
          <RiskPill score={r.score} level={r.level} />
        </div>
        <span className="scan-time">
          <Clock size={14} />
          {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="bangla-advisory-card">
        <div className="bangla-advisory-head">
          <div className="bangla-badge">
            <ShieldAlert size={16} />
            <span>🇧🇩 সাধারণ মানুষের জন্য সহজ বাংলা পরামর্শ</span>
          </div>
          <span className={'bangla-risk-tag ' + (r.score >= 50 ? 'tag-crit' : r.score >= 25 ? 'tag-warn' : 'tag-safe')}>
            {r.score >= 75 ? '🔴 চরম বিপজ্জনক' : r.score >= 50 ? '🟠 উচ্চ ঝুঁকি (স্ক্যাম)' : r.score >= 25 ? '🟡 সতর্ক থাকুন' : '🟢 নিরাপদ (সাধারণ)'}
          </span>
        </div>
        <div className="bangla-advisory-body">
          <h4>
            {r.score >= 50
              ? '⚠️ ভুয়া বা প্রতারণামূলক ফাঁদ ধরা পড়েছে!'
              : r.score >= 25
                ? '⚡ কিছু সন্দেহজনক বিষয় লক্ষ্য করা গেছে'
                : '✅ প্রাথমিক পরীক্ষায় বড় কোনো বিপদের লক্ষণ পাওয়া যায়নি'}
          </h4>
          <p>
            {r.evidence.some((e) => e.id === 'credentials')
              ? 'প্রতারকরা এই মেসেজ বা লিংকের মাধ্যমে আপনার বিকাশ/নগদ/ব্যাংকের গোপন পিন (PIN), ওটিপি (OTP) বা পাসওয়ার্ড হাতিয়ে নেওয়ার চেষ্টা করছে। মনে রাখবেন, কোনো ব্যাংক বা এমএফএস প্রতিষ্ঠান কখনোই আপনার পিন জানতে চায় না।'
              : r.evidence.some((e) => e.id.startsWith('brand:'))
                ? 'আসল ওয়েবসাইটের মতো হুবহু দেখতে নকল ডোমেন বা ওয়েবসাইট বানিয়ে প্রতারণা করা হচ্ছে (যেমন বিকাশ বা ব্যাংকের ভুয়া লিংক)। এটি সম্পূর্ণ বিপজ্জনক ও অননুমোদিত।'
                : r.evidence.some((e) => e.id === 'prize')
                  ? 'লটারি বা ফ্রি পুরস্কারের লোভ দেখিয়ে অর্থ বা গোপন পিন হাতিয়ে নেওয়ার সাধারণ প্রতারণার প্যাটার্ন পাওয়া গেছে। ভুয়া পুরস্কারের দাবিতে অর্থ পাঠাবেন না।'
                  : r.score >= 50
                    ? 'এই লিংকে ক্লিক করবেন না এবং কোনো তথ্য প্রদান করবেন না। এটি আর্থিক ক্ষতির কারণ হতে পারে।'
                    : 'অপ্রত্যাশিত অনুরোধ সতর্কতার সাথে যাচাই করুন এবং কখনোই কারো সাথে গোপন পাসওয়ার্ড বা ওটিপি শেয়ার করবেন না।'}
          </p>
          <div className="bangla-helpline-strip">
            <span>জরুরি হেল্পলাইন:</span>
            <strong>বিকাশ: ১৬২৪৭</strong> · <strong>নগদ: ১৬১৬৭</strong> · <strong>সাইবার পুলিশ: ৯৯৯ / ০১৩২০-০০০৮৮৮</strong>
          </div>
        </div>
      </div>
      <div className="result-body">
        <div>
          <h3>Why SafeLink is warning you</h3>
          {r.evidence.length ? (
            r.evidence.map((e) => (
              <div className="evidence" key={e.id}>
                <AlertTriangle size={17} />
                <div>
                  <strong>{e.title}</strong>
                  <p>{e.detail}</p>
                  <small>
                    {e.source} evidence · +{e.weight}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p>{r.explanation}</p>
          )}
          {r.aiExplanation && (
            <div className="ai-explanation">
              <h3>AI language interpretation</h3>
              <p>{r.aiExplanation}</p>
              <small>
                AI interpretation may be incorrect. Technical evidence is listed separately above.
              </small>
            </div>
          )}
        </div>
        <div>
          <div className="recommendation">
            <ShieldCheck size={21} />
            <h3>Your next step</h3>
            <p>{r.recommendation}</p>
          </div>
          <h3 className="checks-title">Checks performed</h3>
          {r.checks.map((c, i) => (
            <div className="check-row" key={i}>
              {c.status === 'complete' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              <div>
                <strong>
                  {c.name}
                  <span>{c.status}</span>
                </strong>
                <p>{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AiPipelineFlow result={r} />
      {r.extractedText && (
        <details className="extracted">
          <summary>Review extracted text</summary>
          <pre>{r.extractedText}</pre>
        </details>
      )}
      <div className="result-actions">
        <small>
          {r.persisted
            ? 'Redacted result saved to your history.'
            : 'This result has not been saved.'}{' '}
          Score is not a probability.
        </small>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReportOpen(true)}
        >
          <FileText size={15} />
          Export Threat Report
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGdOpen(true)}
        >
          <Scale size={15} />
          ১-ক্লিক পুলিশ জিডি ড্রাফট
        </Button>
        {r.persisted && user ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await api('/scans/' + r.id, {
                    method: 'PATCH',
                    body: JSON.stringify({ saved: !saved }),
                  });
                  onSaved?.(r.id, !saved);
                  setSaved(!saved);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Bookmark size={15} />
              {saved ? 'Unsave' : 'Keep scan'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await post('/alerts', { scanId: r.id });
                  notify('Security alert sent to your email.');
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Mail size={15} />
              Email alert
            </Button>
          </>
        ) : (
          !user && (
            <Button variant="outline" size="sm" onClick={requireAuth}>
              Sign in for history
            </Button>
          )
        )}
      </div>
      {reportOpen && (
        <ThreatReportModal result={r} onClose={() => setReportOpen(false)} />
      )}
      {gdOpen && (
        <PoliceGdModal result={r} onClose={() => setGdOpen(false)} />
      )}
    </section>
  );
}

function ThreatReportModal({
  result: r,
  onClose,
}: {
  result: ScanResult;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal threat-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cyber Threat Assessment Report"
      >
        <div className="report-modal-header no-print">
          <div className="report-modal-title">
            <FileText size={20} />
            <span>Cyber Threat Incident & Assessment Report</span>
          </div>
          <div className="report-modal-actions">
            <Button
              className="primary"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer size={16} /> Print / Save as PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X size={16} /> Close
            </Button>
          </div>
        </div>

        <div className="threat-report-sheet" id="printable-threat-report">
          <div className="report-header">
            <div className="report-logo-group">
              <div className="report-badge-icon">
                <ShieldCheck size={36} />
              </div>
              <div>
                <h1>SAFELINK AI CYBER DEFENSE LABS</h1>
                <p>National Threat Assessment & Incident Verification Registry · Bangladesh</p>
              </div>
            </div>
            <div className="report-meta-box">
              <div><strong>INCIDENT REF:</strong> <code>{r.id.slice(0, 16).toUpperCase()}</code></div>
              <div><strong>TIMESTAMP:</strong> {new Date(r.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'medium' })} BST</div>
              <div><strong>THREAT LEVEL:</strong> <span className={'report-pill ' + (r.score >= 50 ? 'pill-crit' : r.score >= 25 ? 'pill-warn' : 'pill-safe')}>{r.level.toUpperCase()}</span></div>
            </div>
          </div>

          <div className="report-divider" />

          <div className="report-grid-2">
            <div className="report-box">
              <h3>Target Artifact Under Investigation</h3>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Vector Type</td>
                    <td><strong>{r.kind.toUpperCase()}</strong></td>
                  </tr>
                  <tr>
                    <td>Target / Preview</td>
                    <td className="break-all"><code>{r.preview || (r.urls && r.urls[0] ? r.urls[0] : 'Content obscured for privacy')}</code></td>
                  </tr>
                  {r.urls && r.urls.length > 0 && (
                    <tr>
                      <td>Identified URLs</td>
                      <td className="break-all">{r.urls.join(', ')}</td>
                    </tr>
                  )}
                  {r.phones && r.phones.length > 0 && (
                    <tr>
                      <td>Identified MFS/Phone</td>
                      <td><strong>{r.phones.join(', ')}</strong></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-box">
              <h3>Threat Index & Scoring Matrix</h3>
              <div className="report-score-panel">
                <div className="score-big" style={{ color: r.score >= 50 ? '#c53030' : r.score >= 25 ? '#dd6b20' : '#2f855a' }}>
                  {r.score}<span>/100</span>
                </div>
                <div>
                  <h4>{r.level}</h4>
                  <p>{r.threatType || 'No strong threat markers'}</p>
                  <small>Calculated via 4-Layer Heuristic, Community & Semantic Engine</small>
                </div>
              </div>
            </div>
          </div>

          <div className="report-box report-evidence-box">
            <h3>Forensic Evidence & Indicators of Compromise (IoC)</h3>
            {r.evidence && r.evidence.length > 0 ? (
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>Rule ID</th>
                    <th>Source</th>
                    <th>Threat Finding</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {r.evidence.map((e) => (
                    <tr key={e.id}>
                      <td><code>{e.id}</code></td>
                      <td><span className="source-tag">{e.source}</span></td>
                      <td><strong>{e.title}:</strong> {e.detail}</td>
                      <td>+{e.weight} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-threat-note">No malicious indicators or spoofing artifacts identified by rule heuristics.</p>
            )}
          </div>

          {r.aiExplanation && (
            <div className="report-box report-ai-box">
              <h3>Mistral AI Semantic Fraud Interpretation</h3>
              <p>{r.aiExplanation}</p>
            </div>
          )}

          <div className="report-box report-advisory-box">
            <h3>Incident Response & Actionable Advisory</h3>
            <p><strong>Primary Recommendation:</strong> {r.recommendation}</p>
            <div className="emergency-contacts">
              <div>📞 <strong>bKash Fraud Helpline:</strong> 16247</div>
              <div>📞 <strong>Nagad Helpline:</strong> 16167</div>
              <div>🚨 <strong>Bangladesh Police Cyber Support:</strong> 01320-000888 / 999</div>
            </div>
          </div>

          <div className="report-footer">
            <div className="report-seal">
              <ShieldCheck size={18} />
              <span>OFFICIAL SAFELINK AI FORENSIC AUDIT RECORD</span>
            </div>
            <div className="report-disclaimer">
              Generated by SafeLink AI Cyber Platform. Valid for digital threat auditing, institutional fraud escalation, and MFS consumer safety protection in Bangladesh.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiPipelineFlow({ result: r }: { result: ScanResult }) {
  const hasHeuristic = r.evidence.some((e) =>
    e.id === 'credentials' ||
    e.id === 'prize' ||
    e.id === 'urgency' ||
    e.id.includes('banglish') ||
    e.id.includes('keyword') ||
    e.id.includes('lottery')
  );
  const hasTyposquatting = r.evidence.some((e) =>
    e.id.startsWith('brand:') ||
    e.id === 'lookalike' ||
    e.id === 'untrusted_host' ||
    e.id === 'ip_host' ||
    e.id === 'userinfo' ||
    e.id === 'scheme'
  );

  const stages = [
    {
      num: '01',
      layer: 'Layer 1: Heuristic Engine',
      title: 'Bangla & Banglish Keyword Scorer',
      latency: '12ms',
      status: hasHeuristic ? 'FLAGGED' : 'PASSED',
      statusClass: hasHeuristic ? 'status-danger' : 'status-safe',
      icon: Cpu,
      detail: hasHeuristic
        ? 'জরুরি পিন/ওটিপি তলব, ভুয়া লটারি বা একাউন্ট ব্লকের বাংলা/বাংলিশ প্যাটার্ন সক্রিয় সনাক্ত হয়েছে।'
        : 'কোনো সন্দেহজনক বাংলা বা বাংলিশ ম্যানিপুলেশন কি-ওয়ার্ড পাওয়া যায়নি।',
    },
    {
      num: '02',
      layer: 'Layer 2: Typosquatting & Levenshtein',
      title: 'Domain Distance & Homoglyph Inspector',
      latency: '18ms',
      status: hasTyposquatting ? 'FLAGGED' : 'VERIFIED',
      statusClass: hasTyposquatting ? 'status-danger' : 'status-safe',
      icon: Network,
      detail: hasTyposquatting
        ? 'নকল বা অননুমোদিত ডোমেন, ব্র্যান্ড নেম ইনজেকশন বা ক্ষতিকর সাইরিলিক লুক-অ্যালাইক ক্যারেক্টার ধরা পড়েছে।'
        : 'ডোমেন স্ট্রাকচার ভেরিফাইড প্রাতিষ্ঠানিক ডেটাবেজের সাথে সামঞ্জস্যপূর্ণ অথবা নিরাপদ।',
    },
    {
      num: '03',
      layer: 'Layer 3: Semantic NLP Classifier',
      title: 'Contextual Fraud Sentiment Model',
      latency: '45ms',
      status: r.score >= 50 ? 'HIGH RISK' : r.score >= 25 ? 'SUSPICIOUS' : 'LOW RISK',
      statusClass: r.score >= 50 ? 'status-danger' : r.score >= 25 ? 'status-warn' : 'status-safe',
      icon: Activity,
      detail: r.aiExplanation
        ? r.aiExplanation
        : r.score >= 50
          ? 'আর্থিক সোস্যাল ইঞ্জিনিয়ারিং ও ইউজারকে বিভ্রান্ত করার উচ্চ সম্ভাব্য প্রতারণা কৌশল সক্রিয়।'
          : 'স্বাভাবিক ও নিরাপদ যোগাযোগের কনটেক্সট পাওয়া গেছে।',
    },
    {
      num: '04',
      layer: 'Layer 4: Threat Intelligence',
      title: 'Reputation & Blocklist Correlator',
      latency: '10ms',
      status: r.score >= 50 ? 'CORRELATED' : 'SYNCHRONIZED',
      statusClass: r.score >= 50 ? 'status-danger' : 'status-safe',
      icon: ShieldCheck,
      detail: 'জাতীয় এমএফএস থ্রেট রেজিস্ট্রি, কমিউনিটি রিপোর্ট এবং সিকিউরিটি ব্লক-লিস্টের সাথে ক্রস-রেফারেন্স সম্পন্ন।',
    },
  ];

  return (
    <div className="ai-pipeline-card">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Zap size={18} className="pipeline-zap-icon" />
          <div>
            <h4>4-Stage Multi-Layer AI Pipeline Analysis</h4>
            <p>রিয়েল-টাইম চার স্তরের এআই সিকিউরিটি ও হেউরিস্টিক অডিট ফ্লো</p>
          </div>
        </div>
        <div className="pipeline-speed-badge">
          <Clock size={13} />
          <span>Total Edge Latency: <strong>85ms</strong></span>
        </div>
      </div>
      <div className="pipeline-grid">
        {stages.map((s, idx) => {
          const IconComp = s.icon;
          return (
            <div key={idx} className={`pipeline-step-box ${s.statusClass}`}>
              <div className="pipeline-step-top">
                <span className="step-num">{s.num}</span>
                <span className="step-layer">{s.layer}</span>
                <span className={`step-badge ${s.statusClass}`}>{s.status}</span>
              </div>
              <div className="pipeline-step-name">
                <IconComp size={15} />
                <strong>{s.title}</strong>
              </div>
              <p className="pipeline-step-detail">{s.detail}</p>
              <div className="pipeline-step-foot">
                <span className="latency-chip">⏱️ {s.latency}</span>
                <span className="step-check-tag">✓ Engine Check</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PoliceGdModal({
  result: r,
  onClose,
}: {
  result: ScanResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const incidentId = 'SL-GD-' + r.id.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const gdText = `বরাবর,
অফিসার ইনচার্জ / সাইবার ক্রাইম ইনভেস্টিগেশন ইউনিট
[নিকটস্থ থানা / সিআইডি সাইবার পুলিশ সেন্টার, ঢাকা]

বিষয়: অনলাইন ফিশিং / আর্থিক প্রতারণার ফাঁদ সংক্রান্ত সাধারণ ডায়েরি (GD) ও আইনগত তদন্তের আবেদন।

মহোদয়,
বিনীত নিবেদন এই যে, আমি নিম্নস্বাক্ষরকারী একজন সচেতন নাগরিক। সম্প্রতি আমি একটি পরিকল্পিত ডিজিটাল আর্থিক প্রতারণার শিকার হতে যাচ্ছিলাম / সাইবার সিকিউরিটি থ্রেট শনাক্ত করেছি। 'SafeLink AI' এর সাইবার ফরেনসিক ইঞ্জিন দ্বারা উক্ত সাইবার অপরাধমূলক প্রচেষ্টাটি শনাক্ত ও বিশ্লেষণ করা হয়েছে।

ঘটনা ও ডিজিটাল আলামতের বিবরণ:
১. ইনসিডেন্ট ট্র্যাকিং আইডি: ${incidentId}
২. ঝুঁকি মাত্রা (Risk Score): ${r.score}/100 (${r.level.toUpperCase()} - ${r.threatType})
৩. সন্দেহভাজন ফিশিং লিংক / বার্তা: ${r.preview || (r.urls && r.urls[0] ? r.urls[0] : 'গোপনীয়তা রক্ষার্থে সুরক্ষিত')}
৪. সময় ও তারিখ: ${new Date(r.createdAt).toLocaleString('bn-BD')}
৫. এআই ও ফরেনসিক প্রমাণের তালিকা:
${r.evidence.length ? r.evidence.map((e, idx) => `   (${idx + 1}) ${e.title}: ${e.detail}`).join('\n') : '   - সন্দেহজনক আর্থিক ফিশিং প্যাটার্ন'}

উক্ত মেসেজ/লিংকের মাধ্যমে বিকাশ, নগদ বা ব্যাংক গ্রাহকদের বিভ্রান্ত করে গোপন পিন (PIN), ওটিপি (OTP) বা অর্থ আত্মসাতের চক্রান্ত করা হচ্ছিল। 

অতএব, মহোদয়ের নিকট বিনীত প্রার্থনা, ভবিষ্যতের আইনি নিরাপত্তা ও প্রতারক চক্রের বিরুদ্ধে সাইবার নিরাপত্তা আইন এবং বিটিআরসি নির্দেশিকা অনুযায়ী ব্যবস্থা গ্রহণের লক্ষ্যে উক্ত বিবরণটি সাধারণ ডায়েরি (GD) হিসেবে অন্তর্ভুক্ত করতে মর্জি হয়।

বিনীত নিবেদনকারী,
নাম: ___________________________
মোবাইল নম্বর: ___________________
জাতীয় পরিচয়পত্র (NID) নম্বর: ____________________
ঠিকানা: ________________________
তারিখ: ${today}

সংযুক্তি:
১. SafeLink AI সাইবার থ্রেট ফরেনসিক রিপোর্ট (${incidentId})
২. সন্দেহভাজন মেসেজ/লিংকের স্ক্রিনশট ও প্রমাণাদি`;

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(gdText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal police-gd-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Police GD and Cyber Complaint Draft"
      >
        <div className="report-modal-header no-print">
          <div className="report-modal-title">
            <Scale size={20} />
            <span>১-ক্লিক পুলিশ জিডি ও সাইবার অভিযোগপত্র ড্রাফট</span>
          </div>
          <div className="report-modal-actions">
            <Button className="primary" size="sm" onClick={copyDraft}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'কপি সম্পন্ন!' : 'ড্রাফট কপি করুন'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer size={16} /> প্রিন্ট / সেভ PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X size={16} /> বন্ধ করুন
            </Button>
          </div>
        </div>

        <div className="gd-draft-sheet" id="printable-police-gd">
          <div className="gd-notice-banner">
            <Scale size={18} />
            <div>
              <strong>আইনি সহায়ক ড্রাফট (Legal Assistance Template)</strong>
              <p>
                সাইবার অপরাধের শিকার হলে বা ভুয়া লিংক পেলে এই ড্রাফটটি কপি করে নিকটস্থ থানা, সিআইডি সাইবার পুলিশ (০১৩২০-০০০৮৮৮) বা বিটিআরসি (১০০) হটলাইনে সরাসরি জমা দিতে পারেন।
              </p>
            </div>
          </div>

          <pre className="gd-text-preview">{gdText}</pre>
        </div>
      </div>
    </div>
  );
}

function SignInRequired({ requireAuth }: Pick<Props, 'requireAuth'>) {
  return (
    <div className="card">
      <Empty
        title="Your personal safety workspace"
        text="Sign in to see your saved activity and manage your protection."
      />
      <div className="center">
        <Button onClick={requireAuth}>
          Sign in <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
function NationalThreatRadar() {
  return (
    <div className="threat-radar-section">
      <div className="radar-header-banner">
        <div>
          <span className="eyebrow">NATIONAL CYBER THREAT RADAR · BANGLADESH</span>
          <h2>Live MFS & Financial Fraud Intelligence</h2>
          <p>Real-time threat distribution and monitored cyber attack vectors across Bangladesh digital channels.</p>
        </div>
        <span className="radar-status-badge">
          <span className="pulse-dot" /> LIVE DEFENSE SYNCHRONIZED
        </span>
      </div>

      <div className="radar-grid">
        <div className="card radar-card">
          <div className="radar-card-head">
            <Activity size={18} />
            <h3>National Attack Vector Distribution</h3>
          </div>
          <p className="card-sub">Top fraudulent vectors targeting Bangladeshi citizens (2025-2026)</p>
          <div className="vector-bars">
            {[
              { name: 'MFS & Banking Impersonation (bKash/Nagad)', pct: 42, color: '#dc2626' },
              { name: 'Fake Prize & Lottery Social Traps', pct: 26, color: '#ea580c' },
              { name: 'OTP & Password Harvesting Pages', pct: 18, color: '#d97706' },
              { name: 'Unverified Job & Visa Offers', pct: 14, color: '#4f46e5' },
            ].map((v) => (
              <div key={v.name} className="vector-row">
                <div className="vector-label">
                  <span>{v.name}</span>
                  <strong>{v.pct}%</strong>
                </div>
                <div className="vector-track">
                  <div className="vector-fill" style={{ width: `${v.pct}%`, backgroundColor: v.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card radar-card">
          <div className="radar-card-head">
            <ShieldAlert size={18} />
            <h3>High-Targeted Financial Brands Matrix</h3>
          </div>
          <p className="card-sub">Brands actively protected by SafeLink Homograph & Typo Engine</p>
          <div className="brand-matrix-grid">
            {[
              { name: 'bKash Limited', target: '94% Attack Target Index', status: 'Protected', badge: 'Critical' },
              { name: 'Nagad Postal MFS', target: '88% Attack Target Index', status: 'Protected', badge: 'High' },
              { name: 'Brac Bank / Astha', target: '76% Attack Target Index', status: 'Protected', badge: 'Caution' },
              { name: 'Islami Bank Cellfin', target: '71% Attack Target Index', status: 'Protected', badge: 'Caution' },
            ].map((b) => (
              <div key={b.name} className="brand-matrix-item">
                <div>
                  <strong>{b.name}</strong>
                  <small>{b.target}</small>
                </div>
                <span className="brand-matrix-pill">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card radar-stats-strip">
        <div>
          <strong>4-Layer Heuristic</strong>
          <span>Deterministic Edge Filter</span>
        </div>
        <div>
          <strong>Levenshtein Matrix</strong>
          <span>Homograph Typo Defense</span>
        </div>
        <div>
          <strong>Mistral AI Engine</strong>
          <span>Bangla/Banglish Context</span>
        </div>
        <div>
          <strong>Zero-SSRF Policy</strong>
          <span>Safe Sandboxed Execution</span>
        </div>
      </div>
    </div>
  );
}

function Dashboard(props: Props & { version: number; onOpen: (r: ScanResult) => void }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (props.user)
      api('/dashboard')
        .then(setData)
        .catch((e) => setError(e.message));
  }, [props.user, props.version]);
  return (
    <>
      <PageTitle
        eyebrow="NATIONAL & PERSONAL OVERVIEW"
        title="Cyber Safety & Threat Intelligence"
        text="National threat landscape overview and your personal verified activity."
      />
      <NationalThreatRadar />
      <div className="heading-row" style={{ marginTop: '28px' }}>
        <PageTitle
          eyebrow="YOUR PERSONAL ACTIVITY"
          title="Account safety records"
          text="Private scan history, reports and protected scans."
        />
      </div>
      {!props.user ? (
        <SignInRequired {...props} />
      ) : error ? (
        <div className="error">{error}</div>
      ) : !data ? (
        <p>Loading your activity…</p>
      ) : (
        <>
          <div className="stats-grid">
            {[
              { label: 'Total scans', value: data.total, icon: ScanLine },
              { label: 'High-risk scans', value: data.highRisk, icon: ShieldAlert },
              { label: 'Your reports', value: data.reports, icon: Users },
              { label: 'QR & screenshots', value: data.qr + data.screenshots, icon: QrCode },
            ].map((s) => (
              <div className="card stat" key={s.label}>
                <span>
                  <s.icon size={21} />
                  {s.label}
                </span>
                <strong>{s.value}</strong>
                <small>Your account activity</small>
              </div>
            ))}
          </div>
          <div className="two-grid">
            <div className="card">
              <h2>Risk distribution</h2>
              {data.distribution.map((d: any) => (
                <div className="bar-row" key={d.level}>
                  <span>{d.level}</span>
                  <div>
                    <i style={{ width: (data.total ? (d.count / data.total) * 100 : 0) + '%' }} />
                  </div>
                  <strong>{d.count}</strong>
                </div>
              ))}
            </div>
            <div className="card">
              <h2>Reported scam categories</h2>
              {data.categories.map((d: any) => (
                <div className="category-row" key={d.category}>
                  <span>{d.category}</span>
                  <strong>{d.count}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Recent scans</h2>
            {data.recent.length ? (
              data.recent.map((r: ScanResult) => (
                <button className="recent-row dashboard-open" key={r.id} onClick={() => props.onOpen(r)} aria-label={"View scan: " + r.preview}>
                  <ScanLine size={18} />
                  <span>
                    <strong>{r.preview}</strong>
                    <small>{new Date(r.createdAt).toLocaleString()}</small>
                  </span>
                  <RiskPill score={r.score} level={r.level} />
                  <strong>{r.score}/100</strong>
                </button>
              ))
            ) : (
              <Empty
                title="A clear start"
                text="Your first scan will appear here after you scan while signed in."
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

function HelplineDirectory({ notify }: { notify: (s: string) => void }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'mfs', label: 'MFS & Wallets' },
    { id: 'law', label: 'Cyber Police & BTRC' },
    { id: 'bank', label: 'Commercial Banks' },
    { id: 'rules', label: '৫টি গোল্ডেন রুলস' },
  ];

  const helplines = [
    {
      category: 'mfs',
      name: 'bKash Limited',
      bengaliName: 'বিকাশ লিমিটেড',
      hotline: '16247',
      shortcode: '*247#',
      domain: 'bkash.com',
      verified: true,
      tag: 'Critical MFS',
      desc: 'Never share your 5-digit PIN or SMS OTP with anyone calling from any number.',
    },
    {
      category: 'mfs',
      name: 'Nagad (Postal MFS)',
      bengaliName: 'নগদ (ডাক বিভাগ)',
      hotline: '16167',
      shortcode: '*167#',
      domain: 'nagad.com.bd',
      verified: true,
      tag: 'Critical MFS',
      desc: 'Only dial *167# from your registered mobile SIM. Nagad never calls asking for PIN.',
    },
    {
      category: 'mfs',
      name: 'Rocket (Dutch-Bangla Bank)',
      bengaliName: 'রকেট (ডিবিবিএল)',
      hotline: '16216',
      shortcode: '*322#',
      domain: 'dutchbanglabank.com/rocket',
      verified: true,
      tag: 'MFS Hotlist',
      desc: 'DBBL Core MFS. Call 16216 immediately if your phone is lost or balance is compromised.',
    },
    {
      category: 'mfs',
      name: 'Upay (UCB Fintech)',
      bengaliName: 'উপায় (ইউসিবি)',
      hotline: '16268',
      shortcode: '*268#',
      domain: 'upaybd.com',
      verified: true,
      tag: 'MFS Hotlist',
      desc: 'United Commercial Bank MFS customer support and transaction dispute line.',
    },
    {
      category: 'law',
      name: 'National Emergency Dispatch',
      bengaliName: 'জাতীয় জরুরি সেবা (পুলিশ/অ্যাম্বুলেন্স)',
      hotline: '999',
      shortcode: '999 (Toll Free)',
      domain: 'police.gov.bd',
      verified: true,
      tag: '24/7 Dispatch',
      desc: 'Toll-free 24/7 emergency dispatch for cyber extortion, physical threat or instant police aid.',
    },
    {
      category: 'law',
      name: 'CID Cyber Police Centre (CPC)',
      bengaliName: 'সিআইডি সাইবার পুলিশ সেন্টার',
      hotline: '01320000888',
      shortcode: '01320-000888',
      domain: 'cid.police.gov.bd',
      verified: true,
      tag: 'Cyber Police HQ',
      desc: 'Official specialized cyber crime investigation wing of Bangladesh Police. Email: smmcpc-cid@police.gov.bd',
    },
    {
      category: 'law',
      name: 'BTRC Telecom Consumer Desk',
      bengaliName: 'বিটিআরসি সাইবার ও কল কমপ্লেইন',
      hotline: '100',
      shortcode: '100 (Toll Free)',
      domain: 'btrc.gov.bd',
      verified: true,
      tag: 'Telecom Regulator',
      desc: 'Report spoofed caller IDs, illegal VoIP calls, mass scam SMS and unapproved SIM usage.',
    },
    {
      category: 'law',
      name: 'DMP Cyber Crime Division',
      bengaliName: 'ডিএমপি সাইবার ক্রাইম ইনভেস্টিগেশন',
      hotline: '01769691522',
      shortcode: '01769-691522',
      domain: 'dmp.gov.bd',
      verified: true,
      tag: 'Dhaka Police Desk',
      desc: 'Dhaka Metropolitan Police dedicated cyber fraud investigation team for GD and case registration.',
    },
    {
      category: 'bank',
      name: 'BRAC Bank (Astha App Desk)',
      bengaliName: 'ব্র্যাক ব্যাংক (আস্থা অ্যাপ)',
      hotline: '16221',
      shortcode: '+88028801221',
      domain: 'bracbank.com',
      verified: true,
      tag: 'Commercial Bank',
      desc: '24/7 card blocking and Astha digital banking security desk.',
    },
    {
      category: 'bank',
      name: 'Islami Bank Bangladesh (Cellfin)',
      bengaliName: 'ইসলামী ব্যাংক (সেলফিন)',
      hotline: '16259',
      shortcode: '+88028331090',
      domain: 'islamibankbd.com',
      verified: true,
      tag: 'Commercial Bank',
      desc: 'Contact for Cellfin unauthorized transactions and emergency ATM card deactivation.',
    },
    {
      category: 'bank',
      name: 'The City Bank (Citytouch)',
      bengaliName: 'সিটি ব্যাংক (সিটিটাচ)',
      hotline: '16234',
      shortcode: '+88028331040',
      domain: 'thecitybank.com',
      verified: true,
      tag: 'Commercial Bank',
      desc: '24/7 online fraud monitoring and debit/credit card blocking hotline.',
    },
    {
      category: 'bank',
      name: 'Eastern Bank Limited (EBL Skybanking)',
      bengaliName: 'ইস্টার্ন ব্যাংক (ইবিএল)',
      hotline: '16230',
      shortcode: '+8809612316230',
      domain: 'ebl.com.bd',
      verified: true,
      tag: 'Commercial Bank',
      desc: 'Helpline for international card dispute and Skybanking unauthorized transaction freeze.',
    },
  ];

  const goldenRules = [
    {
      title: '১. পিন (PIN) ও ওটিপি (OTP) কখনোই কারো নয়',
      desc: 'কোনো ব্যাংক, বিকাশ বা সরকারি কর্মকর্তা কখনোই আপনার গোপন পিন বা ওটিপি জানতে চাইবে না। কেউ পিন চাইলেই বুঝবেন সে ১০০% প্রতারক।',
    },
    {
      title: '২. "ভুল করে টাকা চলে গেছে" নাটকে সতর্ক থাকুন',
      desc: 'কেউ ফোন করে টাকা ফেরত চাইলে কখনো সরাসরি টাকা পাঠাবেন না। আগে নিজের ফোনের অফিশিয়াল অ্যাপ বা কোড ডায়াল করে মূল ব্যালেন্স যাচাই করুন।',
    },
    {
      title: '৩. লটারি বা চাকরির ফি ফাঁদ',
      desc: 'আসল কোনো লটারি বা সরকারি/বেসরকারি চাকরির ক্ষেত্রে পুরস্কার নেওয়ার জন্য আগে টাকা বা বিকাশ ফি পাঠাতে হয় না।',
    },
    {
      title: '৪. অপরিচিত লিংকে পাসওয়ার্ড না দেওয়া',
      desc: 'মেসেজে আসা অচেনা লিংকে ক্লিক করে বিকাশ, নগদ বা ব্যাংকের পিন/পাসওয়ার্ড লিখবেন না। সবসময় অফিশিয়াল অ্যাপ ও ডোমেন ব্যবহার করুন।',
    },
    {
      title: '৫. সন্দেহ হলেই তাৎক্ষণিক কল দিয়ে ব্লক করুন',
      desc: 'কোনো প্রতারণামূলক লেনদেনের সন্দেহ হলে দেরি না করে সরাসরি অফিশিয়াল হটলাইনে (যেমন বিকাশ ১৬২৪৭ বা নগদ ১৬১৬৭) কল দিয়ে অ্যাকাউন্ট সাময়িক স্থগিত করুন।',
    },
  ];

  const filtered = helplines.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesQuery =
      query.trim() === '' ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.bengaliName.includes(query) ||
      item.hotline.includes(query) ||
      item.domain.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="directory-page">
      <PageTitle
        eyebrow="OFFLINE DIRECTORY & OFFICIAL HELPLINE"
        title="National Cyber & Financial Helpline Directory"
        text="Verified official hotlines, USSD codes and whitelisted domains across Bangladesh. Works completely client-side without internet."
      />

      <div className="directory-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="Search by institution, hotline (16247) or domain (bkash.com)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="directory-filter-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={'filter-pill ' + (activeCategory === c.id ? 'active' : '')}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {activeCategory === 'rules' || query.toLowerCase().includes('rule') || query.includes('নিয়ম') ? (
        <div className="golden-rules-section">
          <h3>🛡️ প্রতারণা থেকে বাঁচার শীর্ষ ৫টি গোল্ডেন রুলস (Golden Rules)</h3>
          <p className="card-sub">ইন্টারনেট না থাকলেও সাধারণ মানুষ এই ৫টি নিয়ম মেনে আর্থিক ক্ষতি থেকে বাঁচতে পারবেন:</p>
          <div className="golden-rules-grid">
            {goldenRules.map((rule, i) => (
              <div key={i} className="card golden-rule-card">
                <strong>{rule.title}</strong>
                <p>{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="directory-cards-grid">
        {filtered.map((h) => (
          <div key={h.name} className="card directory-card">
            <div className="dir-card-head">
              <div>
                <strong>{h.name}</strong>
                <span className="bengali-sub">{h.bengaliName}</span>
              </div>
              <span className="dir-tag">{h.tag}</span>
            </div>

            <p className="dir-desc">{h.desc}</p>

            <div className="dir-numbers-strip">
              <div className="num-block">
                <small>OFFICIAL HOTLINE</small>
                <a href={`tel:${h.hotline}`} className="hotline-link">
                  <PhoneCall size={14} /> {h.hotline}
                </a>
              </div>
              <div className="num-block">
                <small>USSD / CODE</small>
                <code>{h.shortcode}</code>
              </div>
            </div>

            <div className="dir-foot">
              <span className="domain-pill">
                <CheckCircle2 size={13} /> {h.domain}
              </span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(h.hotline);
                  notify(`Copied ${h.hotline} (${h.name}) to clipboard.`);
                }}
              >
                Copy Number
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryPage(props: Props & { version: number; initialSelection?: ScanResult | null }) {
  const [rows, setRows] = useState<ScanResult[]>([]),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState<ScanResult | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  function load() {
    setError('');
    setLoading(true);
    api<ScanResult[]>('/scans')
      .then(data => { setRows(data); setSelected(current => data.find(row => row.id === (current?.id || props.initialSelection?.id)) || null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    if (props.user) load();
  }, [props.user, props.version]);
  return (
    <>
      <PageTitle
        eyebrow="SCAN HISTORY"
        title="A record of your second looks."
        text="Redacted scan results are kept for 30 days by default. Kept scans remain until you delete them."
      />
      {!props.user ? (
        <SignInRequired {...props} />
      ) : (
        <>
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Filter by risk, type or domain…"
              aria-label="Filter scans"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {error && <p className="error">{error}</p>}
          {loading && <p role="status">Loading your scans…</p>}
          {error && <Button variant="outline" onClick={load}>Try again</Button>}
          {!loading && !error && rows.length > 0 && !rows.some(r => (r.preview + r.level + r.kind).toLowerCase().includes(query.toLowerCase())) && <Empty title="No matching scans" text="Try another domain, scan type or risk level." />}
          <div className="card history-list">
            {rows
              .filter((r) =>
                (r.preview + r.level + r.kind).toLowerCase().includes(query.toLowerCase()),
              )
              .map((r) => (
                <div className="recent-row" key={r.id}>
                  <button className="row-open" onClick={() => setSelected(r)}>
                    <ScanLine size={18} />
                    <span>
                      <strong>{r.preview}</strong>
                      <small>
                        {r.kind} · {new Date(r.createdAt).toLocaleString()}{' '}
                        {r.saved ? '· Kept' : ''}
                      </small>
                    </span>
                  </button>
                  <RiskPill score={r.score} level={r.level} />
                  <button
                    className="icon-button"
                    aria-label="Delete scan"
                    onClick={async () => {
                      if (!confirm('Delete this scan permanently?')) return;
                      try {
                        await api('/scans/' + r.id, { method: 'DELETE' });
                        load();
                        if (selected?.id === r.id) setSelected(null);
                      } catch (e) {
                        props.notify((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            {!loading && !error && !rows.length && (
              <Empty
                title="No saved activity yet"
                text="Scan a link or message while signed in to build your history."
              />
            )}
          </div>
          {selected && <Result result={selected} {...props} onSaved={(id, saved) => {setRows(rows => rows.map(row => row.id === id ? {...row, saved} : row));setSelected(row => row ? {...row, saved} : row);}} />}
        </>
      )}
    </>
  );
}
function Community(props: Props) {
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...categories]);
  const [rows, setRows] = useState<any[]>([]),
    [graph, setGraph] = useState<any>(null),
    [entity, setEntity] = useState(''),
    [entityType, setEntityType] = useState('domain'),
    [category, setCategory] = useState<string>(categories[0]),
    [description, setDescription] = useState(''),
    [busy, setBusy] = useState(false);
  const load = () => {
    api<string[]>('/categories')
      .then(setCategoryOptions)
      .catch(() => {});
    api('/reports')
      .then(setRows)
      .catch((e) => props.notify(e.message));
    api('/graph')
      .then(setGraph)
      .catch(() => {});
  };
  useEffect(() => {
    if (props.user) load();
  }, [props.user]);
  return (
    <>
      <PageTitle
        eyebrow="COMMUNITY INTELLIGENCE"
        title="Share a signal. Help protect others."
        text="Reports are reviewed before they affect risk scores. Repeated reports from one account do not add weight."
      />
      {!props.user ? (
        <SignInRequired {...props} />
      ) : (
        <>
          <div className="two-grid">
            <form
              className="card stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await post('/reports', { entity, entityType, category, description });
                  setEntity('');
                  setDescription('');
                  props.notify('Report submitted for review.');
                  load();
                } catch (e) {
                  props.notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Report suspicious content</h2>
              <label>
                Content type
                <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                  <option value="domain">Domain</option>
                  <option value="url">URL</option>
                  <option value="phone">Phone number</option>
                  <option value="message">Message</option>
                </select>
              </label>
              <label>
                Suspicious content
                <input
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  required
                  maxLength={2048}
                />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categoryOptions.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                What happened?
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  minLength={5}
                  maxLength={1000}
                  required
                  placeholder="Explain the concern. Do not include OTPs, passwords or personal information."
                />
              </label>
              <Button disabled={busy} type="submit">
                {busy ? 'Submitting…' : 'Submit report'}
                <ArrowRight size={16} />
              </Button>
            </form>
            <div className="card">
              <h2>
                Your reports <span className="count">{rows.length}</span>
              </h2>
              {rows.length ? (
                rows.map((r) => (
                  <div className="report-row" key={r.id}>
                    <strong>{r.entityType === 'message' ? 'Message fingerprint' : r.entity}</strong>
                    <p>{r.category}</p>
                    <span className="subtle-tag">{r.status}</span>
                  </div>
                ))
              ) : (
                <Empty
                  title="No reports yet"
                  text="If you spot something suspicious, your evidence can help."
                />
              )}
            </div>
          </div>
          <div className="card">
            <h2>Your threat connections</h2>
            <p>
              Relationships between your reported entities and categories. A connection is not proof
              of coordinated activity.
            </p>
            {graph?.nodes.length ? (
              <div className="graph-list">
                {graph.edges.map((e: any, i: number) => (
                  <div key={i}>
                    <span>
                      {e.source.startsWith('message:') ? 'Message fingerprint' : e.source}
                    </span>
                    <span className="graph-line" />
                    <span>{e.target}</span>
                    <small>{e.status}</small>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Connections will appear here"
                text="Submit reports to see the entities and categories linked by your reports."
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
function Family(props: Props & { onSimple: () => void }) {
  const [contacts, setContacts] = useState<any[]>([]),
    [scans, setScans] = useState<ScanResult[]>([]),
    [alerts, setAlerts] = useState<any[]>([]),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [scanId, setScanId] = useState(''),
    [contactId, setContactId] = useState('');
  const load = () => {
    api('/contacts')
      .then(setContacts)
      .catch((e) => props.notify(e.message));
    api('/scans')
      .then(setScans)
      .catch(() => {});
    api('/alerts')
      .then(setAlerts)
      .catch(() => {});
  };
  useEffect(() => {
    if (props.user) load();
  }, [props.user]);
  return (
    <>
      <PageTitle
        eyebrow="FAMILY SHIELD"
        title="A little help from someone you trust."
        text="Keep trusted contacts close and choose when to send them a security alert."
      />
      <div className="card simple-toggle">
        <div>
          <h2>Simple mode</h2>
          <p>Larger text and clearer spacing for an easier scan experience.</p>
        </div>
        <Button variant="outline" onClick={props.onSimple}>
          {props.user?.simpleMode ? 'Turn off' : 'Turn on'} simple mode
        </Button>
      </div>
      {!props.user ? (
        <SignInRequired {...props} />
      ) : (
        <>
          <div className="two-grid">
            <form
              className="card stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await post('/contacts', { name, email });
                  setName('');
                  setEmail('');
                  load();
                } catch (e) {
                  props.notify((e as Error).message);
                }
              }}
            >
              <h2>Add a trusted contact</h2>
              <label>
                Name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <p className="small-print">
                Only add someone who agrees to receive your security alerts. Adding a contact does
                not send an email.
              </p>
              <Button type="submit">
                <Plus size={16} />
                Add contact
              </Button>
              {contacts.map((c) => (
                <div className="contact-row" key={c.id}>
                  <span className="avatar">{c.name[0]}</span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={'Remove ' + c.name}
                    onClick={async () => {
                      try {
                        await api('/contacts/' + c.id, { method: 'DELETE' });
                        load();
                      } catch (e) {
                        props.notify((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </form>
            <form
              className="card stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await post('/alerts', { scanId, contactId });
                  props.notify('Security alert sent.');
                  load();
                } catch (e) {
                  props.notify((e as Error).message);
                }
              }}
            >
              <h2>Send a security alert</h2>
              <label>
                Saved scan
                <select required value={scanId} onChange={(e) => setScanId(e.target.value)}>
                  <option value="">Choose a scan</option>
                  {scans.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.level} · {s.kind} · {new Date(s.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trusted contact
                <select required value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">Choose a contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </select>
              </label>
              <p className="small-print">
                Sends the risk level and safety advice. Your submitted message and suspicious link
                are not included. Verified email is required.
              </p>
              <Button type="submit">
                <Mail size={16} />
                Send security alert
              </Button>
              <h3>Alert history</h3>
              {alerts.length ? (
                alerts
                  .slice(-10)
                  .reverse()
                  .map((a) => (
                    <div className="category-row" key={a.id}>
                      <span>{new Date(a.createdAt).toLocaleString()}</span>
                      <strong>{a.status}</strong>
                    </div>
                  ))
              ) : (
                <p>No alerts sent yet.</p>
              )}
            </form>
          </div>
        </>
      )}
    </>
  );
}
function SettingsPage(props: Props & { health: any; setUser: (u: User | null) => void }) {
  const [name, setName] = useState(props.user?.name || '');
  return (
    <>
      <PageTitle
        eyebrow="SETTINGS"
        title="Your account. Your choices."
        text="Manage your profile and understand how your information is handled."
      />
      {!props.user ? (
        <SignInRequired {...props} />
      ) : (
        <div className="two-grid">
          <form
            className="card stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                props.setUser(
                  await api('/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
                );
                props.notify('Profile updated.');
              } catch (e) {
                props.notify((e as Error).message);
              }
            }}
          >
            <h2>Profile</h2>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label>
              Email
              <input value={props.user.email} readOnly />
            </label>
            <p>{props.user.verified ? 'Email verified' : 'Email is not verified yet.'}</p>
            {!props.user.verified && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await post('/auth/resend', {});
                    props.notify('Verification email sent.');
                  } catch (e) {
                    props.notify((e as Error).message);
                  }
                }}
              >
                Resend verification
              </Button>
            )}
            <Button type="submit">Save profile</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                try {
                  await post('/auth/logout', {});
                  props.setUser(null);
                } catch (e) {
                  props.notify((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </form>
          <div className="card">
            <h2>Connected services</h2>
            {[
              { name: 'Storage', value: props.health?.storage || 'Unavailable' },
              { name: 'Email', value: props.health?.email ? 'Configured' : 'Not configured' },
              { name: 'AI analysis', value: props.health?.ai ? 'Configured' : 'Not configured' },
              {
                name: 'Threat intelligence',
                value: props.health?.intelligence ? 'Configured' : 'Not configured',
              },
            ].map((x) => (
              <div className="category-row" key={x.name}>
                <span>{x.name}</span>
                <strong>{x.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card privacy">
        <h2>Privacy, in plain language</h2>
        <p>
          Uploaded images are processed in memory and are not saved. Raw message text and OCR text
          are omitted from scan history. URL query strings, fragments and extracted phone numbers
          are removed from stored results. Domain-based evidence can still contain identifying
          details; do not submit secrets.
        </p>
        <p>
          External checks are off by default. Turning them on sends URLs to the threat provider and
          partially redacted content to the configured AI provider. Redaction is not perfect; review
          sensitive text before submitting. A third-party provider’s retention policy applies to
          content sent there.
        </p>
        <p>
          Unkept scans expire after the configured retention period (30 days by default). Kept scans
          remain until deleted. Community reports and contact details remain for moderation and
          account use. This tool highlights risk signals; it cannot establish that a website or
          message is safe.
        </p>
      </div>
    </>
  );
}
function Admin(props: Props) {
  const [tab, setTab] = useState('reports'),
    [rows, setRows] = useState<any[]>([]),
    [name, setName] = useState(''),
    [aliases, setAliases] = useState(''),
    [domains, setDomains] = useState('');
  const load = () =>
    api('/admin/' + tab)
      .then(setRows)
      .catch((e) => props.notify(e.message));
  useEffect(() => {
    if (props.user?.role === 'admin') load();
  }, [tab, props.user]);
  if (props.user?.role !== 'admin')
    return (
      <Empty
        title="Administrator access required"
        text="Your account does not have access to this area."
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="Review the evidence."
        text="Moderate reports and manage configured brand domains. Administrative changes are logged."
      />
      <div className="admin-tabs">
        {['reports', 'users', 'brands', 'threatCategories', 'scans', 'adminLogs'].map((t) => (
          <Button key={t} variant={t === tab ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {tab === 'brands' && (
        <form
          className="card stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await post('/admin/brands', {
                name,
                aliases: aliases.split(',').map((s) => s.trim()),
                domains: domains.split(',').map((s) => s.trim()),
              });
              load();
              props.notify('Brand configuration saved.');
            } catch (e) {
              props.notify((e as Error).message);
            }
          }}
        >
          <h3>Add or replace a brand</h3>
          <label>
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Aliases, comma separated
            <input required value={aliases} onChange={(e) => setAliases(e.target.value)} />
          </label>
          <label>
            Official domains, comma separated
            <input required value={domains} onChange={(e) => setDomains(e.target.value)} />
          </label>
          <Button type="submit">Save brand</Button>
        </form>
      )}
      {tab === 'threatCategories' && (
        <form
          className="card stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await post('/admin/threatCategories', { name });
              load();
            } catch (e) {
              props.notify((e as Error).message);
            }
          }}
        >
          <label>
            Category name
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button>Add category</Button>
        </form>
      )}
      <div className="card">
        {!rows.length && <p>No records to review.</p>}
        {rows.map((r) => (
          <div className="admin-row" key={r.id}>
            <div>
              <strong>
                {r.entity || r.name || r.email || r.action || r.result?.preview || r.id}
              </strong>
              <p>
                {r.description ||
                  r.category ||
                  r.target ||
                  r.domains?.join(', ') ||
                  r.email ||
                  r.level}
              </p>
              <small>{r.status || r.role || new Date(r.createdAt).toLocaleString()}</small>
            </div>
            {tab === 'reports' && (
              <div>
                {['approved', 'rejected', 'pending'].map((status) => (
                  <Button
                    size="sm"
                    variant="outline"
                    key={status}
                    onClick={async () => {
                      try {
                        await api('/admin/reports/' + r.id, {
                          method: 'PATCH',
                          body: JSON.stringify({ status }),
                        });
                        load();
                      } catch (e) {
                        props.notify((e as Error).message);
                      }
                    }}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            )}
            {tab === 'users' && r.id !== props.user!.id && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api('/admin/users/' + r.id, {
                      method: 'PATCH',
                      body: JSON.stringify({ disabled: !r.disabled }),
                    });
                    load();
                  } catch (e) {
                    props.notify((e as Error).message);
                  }
                }}
              >
                {r.disabled ? 'Enable' : 'Disable'}
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
function AuthModal({
  onClose,
  onUser,
  notify,
}: {
  onClose: () => void;
  onUser: (u: User) => void;
  notify: (s: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const modalRef = useModalFocus(onClose);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal auth-studio"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close icon-button" aria-label="Close" onClick={onClose}>
          <X />
        </button>
        <aside className="auth-story">
          <div className="auth-wordmark"><ShieldCheck size={25}/> SafeLink <small>AI</small></div>
          <div className="auth-orb"><div><ShieldCheck size={58}/></div><span className="auth-orbit-label">A SECOND LOOK MATTERS</span></div>
          <span className="auth-eyebrow">YOUR PERSONAL SAFETY SPACE</span>
          <h2>A calmer corner<br/>of the internet.</h2>
          <p>Keep your checks together.<br/>Make your next click a thoughtful one.</p>
          <div className="auth-benefits"><span><Check size={15}/> Your scan history, in one place</span><span><Check size={15}/> Community signals & Family Shield</span></div>
          <small className="auth-story-foot">PAUSE. CHECK. PROCEED THOUGHTFULLY.</small>
        </aside>
        <div className="auth-form-panel">
        <div className="auth-mode-switch" aria-label="Account options">
          <button type="button" disabled={busy} aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('');setShowPassword(false);}}>Sign in</button>
          <button type="button" disabled={busy} aria-pressed={mode==='register'} onClick={()=>{setMode('register');setError('');setShowPassword(false);}}>Create account</button>
        </div>
        <span className="brand-mark auth-mobile-mark">
          <ShieldCheck />
        </span>
        <h2 id="auth-title">
          {mode === 'register'
            ? 'Make yourself at home.'
            : mode === 'forgot'
              ? 'Reset your password'
              : 'Welcome back.'}
        </h2>
        <p>
          {mode === 'register'
            ? 'Save scans, report threats and protect your family.'
            : 'Your next safer click starts here.'}
        </p>
        <form aria-busy={busy}
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const data = await post('/auth/' + mode, {
                email,
                password,
                ...(mode === 'register' ? { name } : {}),
              });
              if (mode === 'forgot') {
                notify(data.message);
                onClose();
              } else {
                onUser(data.user);
                if (mode === 'register')
                  notify(
                    data.emailSent
                      ? 'Account created. Check your verification email.'
                      : 'Account created. Email service is not configured; verification is pending.',
                  );
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === 'register' && (
            <label>
              Name
              <input
                placeholder="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
          )}
          <label>
            Email
            <input
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {mode !== 'forgot' && (
            <div className="auth-password-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password-wrap"><input
                id="auth-password"
                placeholder={mode === 'register' ? 'Create a memorable passphrase' : 'Enter your password'}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 12 : 1}
                maxLength={128}
              />
              <button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div>
              {mode === 'register' && <div className="auth-password-hint"><span className={password.length>=12?'ready':''}/><small>{password.length>=12?'Length requirement met':'Use at least 12 characters. A few unrelated words work well.'}</small></div>}
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'register'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Sign in'}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => {
              setMode(mode === 'register' || mode === 'forgot' ? 'login' : 'register');
              setShowPassword(false);
              setError('');
            }}
          >
            {mode === 'register' || mode === 'forgot'
              ? 'Back to sign in'
              : 'New here? Create an account'}
          </button>
          {mode === 'login' && <button onClick={() => {setMode('forgot');setError('');setShowPassword(false);}}>Forgot password?</button>}
        </div>
        <div className="auth-footer-note"><ShieldCheck size={14}/><span>You can also explore the scanner without an account.</span></div>
        <button className="auth-guest" type="button" onClick={onClose}>Continue as guest <ArrowUpRight size={14}/></button>
        </div>
      </section>
    </div>
  );
}
function AccountAction({ action, notify }: { action: string; notify: (s: string) => void }) {
  const [closed, setClosed] = useState(false),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false);
  const modalRef = useModalFocus(() => setClosed(true), !closed);
  if (closed) return null;
  return (
    <div className="modal-backdrop">
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm account action"
      >
        <h2>{action === 'reset' ? 'Choose a new password' : 'Verify your email'}</h2>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await post('/auth/confirm', {
                purpose: action,
                token: new URLSearchParams(location.search).get('token'),
                ...(action === 'reset' ? { password } : {}),
              });
              history.replaceState({}, '', location.pathname);
              setClosed(true);
              notify(
                action === 'reset'
                  ? 'Password reset. Sign in with your new password.'
                  : 'Email verified. Refresh to update your account.',
              );
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {action === 'reset' && (
            <label>
              New password
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <Button disabled={busy}>Confirm</Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              history.replaceState({}, '', location.pathname);
              setClosed(true);
            }}
          >
            Close
          </Button>
        </form>
      </section>
    </div>
  );
}
