import { Landing } from './Landing';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { setBaseInert, useModalFocus } from './useModalFocus';
import { useApiResource } from './useApiResource';
import { readTheme, applyTheme } from './theme';
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
  Bot,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { advanceSessionVersion, api, ApiError, post } from './api';
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
  | 'scanner'
  | 'dashboard'
  | 'directory'
  | 'history'
  | 'community'
  | 'family'
  | 'settings'
  | 'demo'
  | 'admin';
const nav = [
  { id: 'scanner', label: 'Scan center', icon: ScanLine },
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
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
function scrollToElement(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
}
function detectScanKind(value: string): ScanKind {
  return /^(?:https?:\/\/|www\.)/i.test(value) || (!/\s/.test(value) && value.includes('.'))
    ? 'url'
    : 'message';
}
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
  const [workspace, setWorkspace] = useState(
    () => location.hash === '#workspace' || new URLSearchParams(location.search).has('action'),
  );
  useEffect(() => {
    const sync = () =>
      setWorkspace(
        location.hash === '#workspace' || new URLSearchParams(location.search).has('action'),
      );
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [smallScreen, setSmallScreen] = useState(() => matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 700px)');
    const update = () => {
      setSmallScreen(media.matches);
      if (!media.matches) setMobileMenu(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [page, setPage] = useState<Page>('scanner'),
    [user, setUser] = useState<User | null>(null),
    [health, setHealth] = useState<any>(null),
    [mobileMenu, setMobileMenu] = useState(false),
    [dark, setDark] = useState(readTheme),
    [notice, setNotice] = useState(''),
    [authOpen, setAuthOpen] = useState(false),
    [refresh, setRefresh] = useState(0),
    [preset, setPreset] = useState<{ kind: ScanKind; text: string } | null>(null),
    [globalPanicOpen, setGlobalPanicOpen] = useState(false),
    [assistantOpen, setAssistantOpen] = useState(false),
    [simpleBusy, setSimpleBusy] = useState(false);
  const sessionRevision = useRef(0);
  const sessionUser = useRef<User | null>(null);
  const simpleRequest = useRef(false);
  const profileRequest = useRef(0);
  const healthRequest = useRef<AbortController | null>(null);
  function replaceSession(next: User | null) {
    sessionRevision.current += 1;
    advanceSessionVersion();
    sessionUser.current = next;
    setUser(next);
  }
  const renderedSession = sessionRevision.current;
  function updateAccount(next: User | null, field?: 'name' | 'simpleMode') {
    if (sessionRevision.current !== renderedSession || !sessionUser.current) return false;
    if (next && next.id !== sessionUser.current.id) return false;
    if (!next) replaceSession(null);
    else {
      const updated = field ? { ...sessionUser.current, [field]: next[field] } : next;
      sessionUser.current = updated;
      setUser(updated);
    }
    return true;
  }
  async function updateProfile(name: string) {
    const expectedSession = sessionRevision.current;
    const request = ++profileRequest.current;
    try {
      const next = await api<User>('/me', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      if (expectedSession !== sessionRevision.current || request !== profileRequest.current)
        return false;
      return updateAccount(next, 'name');
    } catch (error) {
      if (expectedSession !== sessionRevision.current || request !== profileRequest.current)
        return false;
      throw error;
    }
  }
  const [action] = useState(() => new URLSearchParams(location.search).get('action'));
  const menuRef = useModalFocus(() => setMobileMenu(false), smallScreen && mobileMenu && workspace);
  useEffect(() => {
    if (menuRef.current) setBaseInert(menuRef.current, smallScreen && !mobileMenu);
  }, [smallScreen, mobileMenu, workspace]);
  function restoreSession(signal?: AbortSignal, clearExpired = false) {
    const expectedSession = sessionRevision.current;
    return api<User>('/me', { signal })
      .then((next) => {
        if (!signal?.aborted && sessionRevision.current === expectedSession) replaceSession(next);
      })
      .catch((error: Error) => {
        if (signal?.aborted || sessionRevision.current !== expectedSession) return;
        if (error instanceof ApiError && error.status === 401) {
          if (clearExpired && sessionUser.current) replaceSession(null);
        } else {
          setNotice('Your account could not be loaded. Retry the connection or reload.');
        }
      });
  }
  function loadHealth() {
    healthRequest.current?.abort();
    const controller = new AbortController();
    healthRequest.current = controller;
    void api('/health', { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) setHealth(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ offline: true });
      });
  }
  const checkHealth = () => {
    loadHealth();
    if (!sessionUser.current) void restoreSession();
  };
  useEffect(() => {
    const controller = new AbortController();
    loadHealth();
    void restoreSession(controller.signal);
    window.addEventListener('online', checkHealth);
    const sessionExpired = () => {
      replaceSession(null);
      setNotice('Your session ended. Sign in again to save activity and manage your account.');
    };
    window.addEventListener('safelink:session-expired', sessionExpired);
    return () => {
      controller.abort();
      healthRequest.current?.abort();
      window.removeEventListener('online', checkHealth);
      window.removeEventListener('safelink:session-expired', sessionExpired);
    };
  }, []);
  useEffect(() => {
    setHistorySelection(null);
  }, [user?.id]);
  useEffect(() => {
    applyTheme(dark);
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
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [page]);
  function openAuth() {
    setMobileMenu(false);
    setAuthOpen(true);
  }
  const props = {
    user,
    notify: setNotice,
    refresh: () => setRefresh((x) => x + 1),
    requireAuth: openAuth,
    emailAvailable: Boolean(health?.email),
  };
  if (!workspace)
    return (
      <Landing
        dark={dark}
        toggleTheme={() => setDark(!dark)}
        enter={() => {
          location.hash = 'workspace';
          setWorkspace(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  return (
    <div className={'app ' + (user?.simpleMode ? 'simple' : '')}>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus({ preventScroll: true });
          scrollToElement('main');
        }}
      >
        Skip to content
      </a>
      <aside id="main-navigation" ref={menuRef} className={'sidebar ' + (mobileMenu ? 'open' : '')}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            location.hash = '';
            setWorkspace(false);
            window.scrollTo(0, 0);
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
              aria-current={page === n.id ? 'page' : undefined}
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
            aria-current={page === 'settings' ? 'page' : undefined}
            onClick={() => go('settings')}
          >
            <Settings size={19} />
            Settings
          </button>
          {user?.role === 'admin' && (
            <button
              className={'nav-item ' + (page === 'admin' ? 'active' : '')}
              aria-current={page === 'admin' ? 'page' : undefined}
              onClick={() => go('admin')}
            >
              <LockKeyhole size={19} />
              Admin panel
            </button>
          )}
          <button className="profile" onClick={() => (user ? go('settings') : openAuth())}>
            <span className="avatar">{user ? user.name[0].toUpperCase() : 'G'}</span>
            <span>
              <strong>{user?.name || 'Guest workspace'}</strong>
              <small>{user ? 'Personal account' : 'Sign in to save your scans'}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {smallScreen && mobileMenu && (
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
            <button
              type="button"
              className="header-assistant-btn"
              title="সাইবার এআই সহকারী (Ask AI Copilot)"
              onClick={() => setAssistantOpen(true)}
            >
              <Bot size={16} />
              <span>🤖 সাইবার এআই সহকারী</span>
              <span className="live-dot-pulse" />
            </button>
            <button
              type="button"
              className="panic-btn-header"
              title="প্রতারণার পর করণীয় ও সহায়তার যোগাযোগ"
              onClick={() => setGlobalPanicOpen(true)}
            >
              <ShieldAlert size={15} />
              <span>জরুরি সহায়তা</span>
            </button>
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
              <Button variant="outline" size="sm" onClick={openAuth}>
                Sign in <ArrowUpRight size={14} />
              </Button>
            )}
          </div>
        </header>
        <main id="main" key={user?.id || 'guest'} tabIndex={-1}>
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
              <Button variant="outline" size="sm" onClick={checkHealth}>
                Retry connection
              </Button>
            </div>
          )}
          {page === 'scanner' && (
            <Scanner
              {...props}
              preset={preset}
              health={health}
              onScan={() => setRefresh((x) => x + 1)}
              onOpenAssistant={() => setAssistantOpen(true)}
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
          {page === 'history' && (
            <HistoryPage {...props} version={refresh} initialSelection={historySelection} />
          )}
          {page === 'community' && <Community {...props} health={health} />}
          {page === 'family' && (
            <Family
              {...props}
              health={health}
              simpleBusy={simpleBusy}
              onSimple={async () => {
                if (!user) return openAuth();
                if (simpleRequest.current) return;
                simpleRequest.current = true;
                setSimpleBusy(true);
                try {
                  const u = await api<User>('/me', {
                    method: 'PATCH',
                    body: JSON.stringify({ simpleMode: !user.simpleMode }),
                  });
                  updateAccount(u, 'simpleMode');
                } catch (e) {
                  setNotice((e as Error).message);
                } finally {
                  simpleRequest.current = false;
                  setSimpleBusy(false);
                }
              }}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              {...props}
              health={health}
              setUser={(next) => updateAccount(next, 'name')}
              updateProfile={updateProfile}
            />
          )}
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
                  Download a controlled image below, then upload it in QR code or Screenshot mode.
                  Both use reserved example domains. The scanner does not open their destinations.
                </p>
                <div className="report-modal-actions">
                  <a
                    className="button outline"
                    href="/demo-assets/controlled-qr.png"
                    download="safelink-example-qr.png"
                  >
                    <QrCode size={16} />
                    Download QR example
                  </a>
                  <a
                    className="button outline"
                    href="/demo-assets/controlled-message.png"
                    download="safelink-example-message.png"
                  >
                    <ImagePlus size={16} />
                    Download screenshot
                  </a>
                </div>
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
            replaceSession(u);
            setAuthOpen(false);
            setRefresh((x) => x + 1);
          }}
          notify={setNotice}
        />
      )}
      {(action === 'verify' || action === 'reset') && (
        <AccountAction
          action={action}
          notify={setNotice}
          onConfirmed={() => {
            void restoreSession(undefined, true);
          }}
        />
      )}
      {globalPanicOpen && (
        <EmergencyFreezeModal
          onClose={() => setGlobalPanicOpen(false)}
          onOpenGd={() => {
            setGlobalPanicOpen(false);
            setNotice(
              'কোনো স্ক্যান রেজাল্ট থেকে পুলিশ জিডি তৈরি করতে স্ক্যানারে লিঙ্ক বা মেসেজ চেক করুন।',
            );
          }}
        />
      )}
      {assistantOpen && <CyberAssistantModal onClose={() => setAssistantOpen(false)} />}
      <button
        type="button"
        className="floating-assistant-btn"
        onClick={() => setAssistantOpen(true)}
        aria-label="Open Cyber Safety AI Assistant"
        title="সাইবার এআই সহকারী (Ask AI Bot)"
      >
        <span className="bot-pulse-dot" />
        <Bot size={21} className="bot-icon-spin" />
        <span className="bot-btn-text">🤖 সাইবার এআই সহকারী</span>
      </button>
    </div>
  );
}
type Props = {
  user: User | null;
  notify: (s: string) => void;
  refresh: () => void;
  requireAuth: () => void;
  emailAvailable?: boolean;
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
  onOpenAssistant,
}: Props & {
  preset: { kind: ScanKind; text: string } | null;
  health: any;
  onScan: () => void;
  onOpenAssistant: () => void;
}) {
  const [kind, setKind] = useState<ScanKind>('url'),
    [text, setText] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [external, setExternal] = useState(false),
    [save, setSave] = useState(true),
    [busy, setBusy] = useState(false),
    [clipboardReading, setClipboardReading] = useState(false),
    [result, setResult] = useState<ScanResult | null>(null),
    [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestRef.current?.abort();
    };
  }, []);

  function finishRequest(controller: AbortController) {
    if (requestRef.current !== controller) return;
    requestRef.current = null;
    if (mounted.current) {
      setBusy(false);
      setClipboardReading(false);
    }
  }
  function cancelRequest() {
    const controller = requestRef.current;
    if (!controller) return;
    controller.abort();
    finishRequest(controller);
  }
  async function runScan(
    scanKind: ScanKind,
    scanText: string,
    scanFile: File | null = null,
    existingRequest: AbortController | null = null,
  ) {
    if (requestRef.current && requestRef.current !== existingRequest) return;
    const controller = existingRequest || new AbortController();
    if (controller.signal.aborted || !mounted.current) return;
    requestRef.current = controller;
    setClipboardReading(false);
    setError('');
    setBusy(true);
    setResult(null);
    try {
      let r: ScanResult;
      if (scanKind === 'qr' || scanKind === 'screenshot') {
        if (!scanFile) throw new Error('Choose an image first.');
        if (scanFile.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(scanFile.type))
          throw new Error('Choose a PNG, JPEG or WebP image.');
        const body = new FormData();
        body.append('image', scanFile);
        body.append('kind', scanKind);
        body.append('external', String(external));
        body.append('save', String(save && Boolean(user)));
        r = await api('/scans/image', { method: 'POST', body, signal: controller.signal });
      } else {
        if (!scanText.trim()) throw new Error('Paste a link or message first.');
        if (scanText.length > 10000) throw new Error('Keep your input within 10,000 characters.');
        r = await api('/scans', {
          method: 'POST',
          body: JSON.stringify({
            kind: scanKind,
            text: scanText,
            external,
            save: save && Boolean(user),
          }),
          signal: controller.signal,
        });
      }
      if (!mounted.current || controller.signal.aborted) return;
      setResult(r);
      onScan();
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError((e as Error).message);
    } finally {
      finishRequest(controller);
    }
  }

  const executeDemoScan = async (demoKind: ScanKind, demoText: string) => {
    if (requestRef.current) return;
    setKind(demoKind);
    setText(demoText);
    setFile(null);
    scrollToElement('scan-input');
    await runScan(demoKind, demoText);
  };
  useEffect(() => {
    if (preset) {
      setKind(preset.kind);
      setText(preset.text);
      setFile(null);
      setError('');
      setResult(null);
    }
  }, [preset]);

  async function pasteAndAutoScan() {
    if (busy || requestRef.current) return;
    if (!navigator.clipboard?.readText) {
      notify(
        'আপনার ব্রাউজারে ক্লিপবোর্ড সরাসরি পড়ার সমর্থন নেই। ইনপুট বক্সে ম্যানুয়ালি পেস্ট করুন।',
      );
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setClipboardReading(true);
    setError('');
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      if (!mounted.current || controller.signal.aborted) return;
      if (!clip) {
        notify('ক্লিপবোর্ডে কোনো টেক্সট পাওয়া যায়নি।');
        return;
      }
      const detectedKind = detectScanKind(clip);
      setKind(detectedKind);
      setText(clip);
      setFile(null);
      await runScan(detectedKind, clip, null, controller);
    } catch {
      if (mounted.current && !controller.signal.aborted)
        notify('ক্লিপবোর্ড পড়ার অনুমতি দিন অথবা ইনপুট বক্সে ম্যানুয়ালি পেস্ট করুন।');
    } finally {
      finishRequest(controller);
    }
  }
  async function scan(e: FormEvent) {
    e.preventDefault();
    await runScan(kind, text, file);
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

          <div className="quick-demo-pills-row" aria-label="Quick example scenarios">
            <span className="pills-title">⚡ কুইক ডেমো টেস্ট:</span>
            <button
              type="button"
              className="quick-demo-pill danger"
              disabled={busy}
              onClick={() => executeDemoScan('url', 'https://bkash-reward.example/login')}
              title="bKash Spoof লিংক সরাসরি টেস্ট করুন"
            >
              <span>Look-alike link</span>
            </button>
            <button
              type="button"
              className="quick-demo-pill warning"
              disabled={busy}
              onClick={() =>
                executeDemoScan(
                  'message',
                  'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.',
                )
              }
              title="Banglish OTP ফিশিং সরাসরি টেস্ট করুন"
            >
              <span>💬 Banglish PIN</span>
            </button>
            <button
              type="button"
              className="quick-demo-pill warning"
              disabled={busy}
              onClick={() =>
                executeDemoScan(
                  'message',
                  'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।',
                )
              }
              title="Bangla Lottery প্রতারণা সরাসরি টেস্ট করুন"
            >
              <span>🎁 ৫০,০০০ টাকা লটারি</span>
            </button>
            <button
              type="button"
              className="quick-demo-pill success"
              disabled={busy}
              onClick={() => executeDemoScan('url', 'https://www.bkash.com')}
              title="পরিচিত ডোমেনের উদাহরণ পরীক্ষা করুন"
            >
              <span>Known domain</span>
            </button>
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
                <Tabs.Trigger key={k} value={k} disabled={busy}>
                  <v.icon size={19} />
                  {v.title}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value={kind}>
              <form onSubmit={scan} aria-busy={busy}>
                <div className="input-label-row">
                  <label className="input-label" htmlFor="scan-input">
                    {kind === 'url'
                      ? 'Link to analyze'
                      : kind === 'message'
                        ? 'Message to analyze'
                        : kind === 'qr'
                          ? 'QR code image'
                          : 'Screenshot to analyze'}
                  </label>
                  {(kind === 'url' || kind === 'message') && (
                    <button
                      type="button"
                      className="btn-paste-quick"
                      disabled={busy}
                      onClick={pasteAndAutoScan}
                      title="ক্লিপবোর্ড থেকে সরাসরি পেস্ট ও এআই স্ক্যান করুন"
                    >
                      <Copy size={13} />
                      <span>📋 Paste & Scan</span>
                    </button>
                  )}
                </div>
                {kind === 'url' || kind === 'message' ? (
                  <div className={'scan-input ' + (kind === 'message' ? 'message' : '')}>
                    <span>{kind === 'url' ? <Link size={19} /> : <MessageSquare size={19} />}</span>
                    <textarea
                      id="scan-input"
                      rows={kind === 'url' ? 3 : 5}
                      maxLength={10000}
                      placeholder={kindInfo[kind].placeholder}
                      value={text}
                      disabled={busy}
                      onChange={(e) => {
                        setText(e.target.value);
                        setResult(null);
                        setError('');
                      }}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          if (text.trim() && !busy) {
                            scan(e as any);
                          }
                        }
                      }}
                      required
                    />
                    {text && (
                      <button
                        type="button"
                        className="btn-textarea-clear"
                        disabled={busy}
                        onClick={() => {
                          setText('');
                          setResult(null);
                        }}
                        title="Clear text"
                        aria-label="Clear text"
                      >
                        <X size={15} />
                      </button>
                    )}
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
                      key={kind}
                      type="file"
                      disabled={busy}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setResult(null);
                        setError('');
                      }}
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
                      disabled={busy}
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
                        disabled={busy}
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
                  <div className="scan-submit-actions">
                    <button
                      type="button"
                      className="btn-paste-autoscan"
                      disabled={busy}
                      onClick={pasteAndAutoScan}
                      title="ক্লিপবোর্ড থেকে লিঙ্ক বা টেক্সট পেস্ট করে সরাসরি এআই স্ক্যান চালান"
                    >
                      <Copy size={16} />
                      <span>📋 Paste & Scan</span>
                    </button>
                    <Button type="submit" disabled={busy || health?.offline}>
                      {busy ? <Loader2 className="spin" size={18} /> : <ScanLine size={18} />}{' '}
                      {clipboardReading ? 'Reading clipboard…' : busy ? 'Analyzing…' : 'Scan Now'}{' '}
                      {!busy && <ArrowRight size={17} />}
                    </Button>
                  </div>
                </div>
              </form>
            </Tabs.Content>
          </Tabs.Root>
          <div className="demo-scenarios-panel">
            <div className="demo-scenarios-header">
              <div>
                <span className="eyebrow">CONTROLLED EXAMPLES</span>
                <h3>Try an example with the real scanner</h3>
              </div>
              <span className="demo-badge">4 EXAMPLES · SAME SCAN ENGINE</span>
            </div>
            <div className="demo-cards-grid">
              <button
                type="button"
                className="demo-scenario-card danger"
                disabled={busy}
                onClick={() => executeDemoScan('url', 'https://bkash-reward.example/login')}
                title="Tap to automatically analyze this bKash spoof link"
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">🔗</span>
                  <span className="demo-tag danger">LOOK-ALIKE DOMAIN</span>
                </div>
                <strong>bKash Spoof Link</strong>
                <p className="demo-preview">https://bkash-reward.example/login</p>
                <span className="demo-action">⚡ টেস্ট করুন ও অটো-স্ক্যান চালান →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card warning"
                disabled={busy}
                onClick={() =>
                  executeDemoScan(
                    'message',
                    'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.',
                  )
                }
                title="Tap to automatically analyze this Banglish OTP scam"
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">💬</span>
                  <span className="demo-tag warning">BANGLISH PIN</span>
                </div>
                <strong>Banglish PIN Scam</strong>
                <p className="demo-preview">
                  Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.
                </p>
                <span className="demo-action">⚡ টেস্ট করুন ও অটো-স্ক্যান চালান →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card warning"
                disabled={busy}
                onClick={() =>
                  executeDemoScan(
                    'message',
                    'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।',
                  )
                }
                title="Tap to automatically analyze this lottery trap"
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">🎁</span>
                  <span className="demo-tag warning">BANGLA LOTTERY</span>
                </div>
                <strong>Bangla Lottery Scam</strong>
                <p className="demo-preview">
                  অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।
                </p>
                <span className="demo-action">⚡ টেস্ট করুন ও অটো-স্ক্যান চালান →</span>
              </button>

              <button
                type="button"
                className="demo-scenario-card success"
                disabled={busy}
                onClick={() => executeDemoScan('url', 'https://www.bkash.com')}
                title="Analyze a known domain; a low score does not guarantee safety"
              >
                <div className="demo-card-top">
                  <span className="demo-icon-wrap">✅</span>
                  <span className="demo-tag success">OFFICIAL DOMAIN EXAMPLE</span>
                </div>
                <strong>Known Domain Example</strong>
                <p className="demo-preview">https://www.bkash.com</p>
                <span className="demo-action">⚡ টেস্ট করুন ও অটো-স্ক্যান চালান →</span>
              </button>
            </div>
          </div>

          <div className="assistant-showcase-banner">
            <div className="assistant-showcase-left">
              <div className="assistant-showcase-icon">
                <Bot size={28} />
                <span className="status-ping-dot" />
              </div>
              <div className="assistant-showcase-info">
                <span className="showcase-eyebrow">
                  সাইবার নিরাপত্তা নির্দেশনা · SAFETY ASSISTANT
                </span>
                <h4>অনলাইনে কোনো মেসেজ, কল বা লিঙ্ক নিয়ে সন্দেহ হচ্ছে?</h4>
                <p>
                  পিন বা ওটিপি প্রতারণা, অ্যাকাউন্ট নিরাপত্তা এবং সহায়তার যোগাযোগ নিয়ে সাধারণ
                  নির্দেশনা পড়ুন। উত্তর ভুল হতে পারে; প্রয়োজন হলে সংশ্লিষ্ট প্রতিষ্ঠানের সহায়তা নিন।
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-showcase-chat"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssistant();
              }}
            >
              <Sparkles size={16} />
              <span>এআই সহকারীর সাথে চ্যাট করুন</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <aside className="scan-side">
          <div className="card assistant-sidebar-card">
            <div className="assistant-sidebar-top">
              <span className="bot-sidebar-avatar">
                <Bot size={24} />
              </span>
              <span className="sidebar-live-tag">General guidance</span>
            </div>
            <h3>🤖 সাইবার এআই সহকারী</h3>
            <p>
              প্রতারণার সন্দেহ হলে করণীয় সম্পর্কে সাধারণ নির্দেশনা দেখুন। এটি পেশাদার বা আইনি
              পরামর্শ নয়।
            </p>
            <button
              type="button"
              className="btn-sidebar-ask"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssistant();
              }}
            >
              <Sparkles size={14} />
              <span>চ্যাট শুরু করুন</span>
              <ArrowRight size={14} />
            </button>
          </div>

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
            <strong>
              {clipboardReading ? 'Reading your clipboard…' : 'Looking for the signals…'}
            </strong>
            <p>
              {clipboardReading
                ? 'Allow clipboard access, or cancel and paste into the input yourself.'
                : kind === 'screenshot'
                  ? 'Reading the screenshot may take up to a minute on first use.'
                  : 'Checking available evidence. External services may take a few seconds.'}
            </p>
            <Button variant="outline" size="sm" onClick={cancelRequest}>
              Cancel scan
            </Button>
          </div>
        </div>
      )}
      {result ? (
        <div id="scan-result-card">
          <Result
            result={result}
            user={user}
            notify={notify}
            requireAuth={requireAuth}
            emailAvailable={Boolean(health?.email)}
          />
        </div>
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
  emailAvailable,
}: {
  result: ScanResult;
  onSaved?: (id: string, saved: boolean) => void;
  user: User | null;
  notify: (s: string) => void;
  requireAuth: () => void;
  emailAvailable?: boolean;
}) {
  const [saved, setSaved] = useState(Boolean(r.saved));
  const [reportOpen, setReportOpen] = useState(false);
  const [gdOpen, setGdOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);
  const [pending, setPending] = useState<'save' | 'email' | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setSaved(Boolean(r.saved));
  }, [r.id, r.saved]);
  useEffect(() => {
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
  }, [r.id]);
  return (
    <section
      ref={resultRef}
      className="card result-card"
      tabIndex={-1}
      aria-label={`Scan result: ${r.level}, risk score ${r.score} out of 100`}
      aria-live="polite"
      style={{ scrollMarginTop: 24 }}
    >
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
          <span
            className={
              'bangla-risk-tag ' +
              (r.score >= 50 ? 'tag-crit' : r.score >= 25 ? 'tag-warn' : 'tag-safe')
            }
          >
            {r.score >= 75
              ? '🔴 অতি উচ্চ ঝুঁকির সংকেত'
              : r.score >= 50
                ? '🟠 উচ্চ ঝুঁকির সংকেত'
                : r.score >= 25
                  ? '🟡 সতর্ক থাকুন'
                  : '🟢 কম ঝুঁকির সংকেত'}
          </span>
        </div>
        <div className="bangla-advisory-body">
          <h4>
            {r.score >= 50
              ? '⚠️ প্রতারণার একাধিক সতর্ক সংকেত পাওয়া গেছে'
              : r.score >= 25
                ? '⚡ কিছু সন্দেহজনক বিষয় লক্ষ্য করা গেছে'
                : '✅ প্রাথমিক পরীক্ষায় বড় কোনো বিপদের লক্ষণ পাওয়া যায়নি'}
          </h4>
          <p>
            {r.evidence.some((e) => e.id === 'credentials')
              ? 'এই কনটেন্টে গোপন পিন (PIN), ওটিপি (OTP) বা পাসওয়ার্ড চাওয়ার সংকেত পাওয়া গেছে। অন্য কাউকে এসব তথ্য দেবেন না; প্রতিষ্ঠানের নিজস্ব অ্যাপ বা পরিচিত যোগাযোগ মাধ্যমে যাচাই করুন।'
              : r.evidence.some((e) => e.id.startsWith('brand:'))
                ? 'ডোমেনে পরিচিত ব্র্যান্ডের নাম বা কাছাকাছি বানান পাওয়া গেছে। এটি ছদ্মবেশের সংকেত হতে পারে। নিজে অফিশিয়াল ঠিকানা লিখে বা প্রতিষ্ঠানের অ্যাপ দিয়ে যাচাই করুন।'
                : r.evidence.some((e) => e.id === 'prize')
                  ? 'লটারি বা ফ্রি পুরস্কারের লোভ দেখিয়ে অর্থ বা গোপন পিন হাতিয়ে নেওয়ার সাধারণ প্রতারণার প্যাটার্ন পাওয়া গেছে। ভুয়া পুরস্কারের দাবিতে অর্থ পাঠাবেন না।'
                  : r.score >= 50
                    ? 'এই লিংকে ক্লিক করবেন না এবং কোনো তথ্য প্রদান করবেন না। এটি আর্থিক ক্ষতির কারণ হতে পারে।'
                    : 'অপ্রত্যাশিত অনুরোধ সতর্কতার সাথে যাচাই করুন এবং কখনোই কারো সাথে গোপন পাসওয়ার্ড বা ওটিপি শেয়ার করবেন না।'}
          </p>
          <div className="bangla-helpline-strip">
            <span>জরুরি হেল্পলাইন:</span>
            <strong>বিকাশ: ১৬২৪৭</strong> · <strong>নগদ: ১৬১৬৭</strong> ·{' '}
            <strong>জরুরি বিপদে: ৯৯৯</strong>
          </div>
        </div>
      </div>
      <div className="result-body">
        <div>
          <h3>Evidence found by the scanner</h3>
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
      {r.score >= 50 && (
        <div className="emergency-freeze-banner">
          <div className="emergency-freeze-banner-icon">
            <ShieldAlert size={28} />
          </div>
          <div className="emergency-freeze-banner-content">
            <strong>🚨 আপনি কি এই লিংকে ভুলবশত পিন বা ওটিপি দিয়ে ফেলেছেন?</strong>
            <p>
              দ্রুত সংশ্লিষ্ট প্রতিষ্ঠানের অফিসিয়াল হটলাইনে যোগাযোগ করুন এবং সন্দেহজনক লেনদেন বন্ধ
              করার সহায়তা চান। SafeLink নিজে অ্যাকাউন্ট ফ্রিজ করতে পারে না।
            </p>
          </div>
          <button
            type="button"
            className="btn-emergency-freeze-trigger"
            onClick={() => setPanicOpen(true)}
          >
            <Zap size={14} /> জরুরি করণীয় দেখুন
          </button>
        </div>
      )}
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
        <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
          <FileText size={15} />
          Export Threat Report
        </Button>
        <Button variant="outline" size="sm" onClick={() => setGdOpen(true)}>
          <Scale size={15} />
          ১-ক্লিক পুলিশ জিডি ড্রাফট
        </Button>
        {r.score >= 50 && (
          <Button
            variant="outline"
            size="sm"
            className="btn-panic-result"
            onClick={() => setPanicOpen(true)}
          >
            <ShieldAlert size={15} />
            জরুরি সহায়তা
          </Button>
        )}
        {r.persisted && user ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(pending)}
              onClick={async () => {
                if (pending) return;
                setPending('save');
                try {
                  await api('/scans/' + r.id, {
                    method: 'PATCH',
                    body: JSON.stringify({ saved: !saved }),
                  });
                  onSaved?.(r.id, !saved);
                  setSaved(!saved);
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setPending(null);
                }
              }}
            >
              <Bookmark size={15} />
              {saved ? 'Unsave' : 'Keep scan'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(pending) || !user.verified || !emailAvailable}
              title={
                !user.verified
                  ? 'Verify your email in Settings first'
                  : !emailAvailable
                    ? 'Email delivery is not configured'
                    : 'Send a security alert to your email'
              }
              onClick={async () => {
                if (pending) return;
                setPending('email');
                try {
                  await post('/alerts', { scanId: r.id });
                  notify('Security alert sent to your email.');
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setPending(null);
                }
              }}
            >
              <Mail size={15} />
              Email alert
            </Button>
            {(!user.verified || !emailAvailable) && (
              <small>
                {!user.verified
                  ? 'Verify your email in Settings for alerts.'
                  : 'Email delivery is not configured.'}
              </small>
            )}
          </>
        ) : (
          !user && (
            <Button variant="outline" size="sm" onClick={requireAuth}>
              Sign in for history
            </Button>
          )
        )}
      </div>
      {reportOpen && <ThreatReportModal result={r} onClose={() => setReportOpen(false)} />}
      {gdOpen && <PoliceGdModal result={r} onClose={() => setGdOpen(false)} />}
      {panicOpen && (
        <EmergencyFreezeModal
          onClose={() => setPanicOpen(false)}
          onOpenGd={() => {
            setPanicOpen(false);
            setGdOpen(true);
          }}
        />
      )}
    </section>
  );
}

function ThreatReportModal({ result: r, onClose }: { result: ScanResult; onClose: () => void }) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal threat-report-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cyber Threat Assessment Report"
      >
        <div className="report-modal-header no-print">
          <div className="report-modal-title">
            <FileText size={20} />
            <span>Cyber Threat Incident & Assessment Report</span>
          </div>
          <div className="report-modal-actions">
            <Button className="primary" size="sm" onClick={() => window.print()}>
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
                <h1>SAFELINK AI</h1>
                <p>Scan analysis record · submitted content only</p>
              </div>
            </div>
            <div className="report-meta-box">
              <div>
                <strong>INCIDENT REF:</strong> <code>{r.id.slice(0, 16).toUpperCase()}</code>
              </div>
              <div>
                <strong>TIMESTAMP:</strong>{' '}
                {new Date(r.createdAt).toLocaleString('en-US', {
                  timeZone: 'Asia/Dhaka',
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                })}{' '}
                BST
              </div>
              <div>
                <strong>THREAT LEVEL:</strong>{' '}
                <span
                  className={
                    'report-pill ' +
                    (r.score >= 50 ? 'pill-crit' : r.score >= 25 ? 'pill-warn' : 'pill-safe')
                  }
                >
                  {r.level.toUpperCase()}
                </span>
              </div>
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
                    <td>
                      <strong>{r.kind.toUpperCase()}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Target / Preview</td>
                    <td className="break-all">
                      <code>
                        {r.preview ||
                          (r.urls && r.urls[0] ? r.urls[0] : 'Content obscured for privacy')}
                      </code>
                    </td>
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
                      <td>
                        <strong>{r.phones.join(', ')}</strong>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-box">
              <h3>Threat Index & Scoring Matrix</h3>
              <div className="report-score-panel">
                <div
                  className="score-big"
                  style={{
                    color: r.score >= 50 ? '#c53030' : r.score >= 25 ? '#dd6b20' : '#2f855a',
                  }}
                >
                  {r.score}
                  <span>/100</span>
                </div>
                <div>
                  <h4>{r.level}</h4>
                  <p>{r.threatType || 'No strong threat markers'}</p>
                  <small>Rule-based indicator score; not a probability or certification</small>
                </div>
              </div>
            </div>
          </div>

          <div className="report-box report-evidence-box">
            <h3>Matched warning indicators</h3>
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
                      <td>
                        <code>{e.id}</code>
                      </td>
                      <td>
                        <span className="source-tag">{e.source}</span>
                      </td>
                      <td>
                        <strong>{e.title}:</strong> {e.detail}
                      </td>
                      <td>+{e.weight} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-threat-note">
                No strong indicators were found by completed checks. This does not establish safety.
              </p>
            )}
          </div>

          {r.aiExplanation && (
            <div className="report-box report-ai-box">
              <h3>Optional AI interpretation</h3>
              <p>{r.aiExplanation}</p>
            </div>
          )}

          <div className="report-box">
            <h3>Checks and coverage</h3>
            {r.checks.map((check, index) => (
              <p key={check.name + index}>
                <strong>
                  {check.name} · {check.status}:
                </strong>{' '}
                {check.detail}
              </p>
            ))}
            <small>
              Unavailable or skipped checks provide no conclusion. A low score does not prove
              safety.
            </small>
          </div>

          <div className="report-box report-advisory-box">
            <h3>Incident Response & Actionable Advisory</h3>
            <p>
              <strong>Primary Recommendation:</strong> {r.recommendation}
            </p>
            <div className="emergency-contacts">
              <div>
                📞 <strong>bKash Fraud Helpline:</strong> 16247
              </div>
              <div>
                📞 <strong>Nagad Helpline:</strong> 16167
              </div>
              <div>
                🚨 <strong>Immediate danger:</strong> 999
              </div>
            </div>
          </div>

          <div className="report-footer">
            <div className="report-seal">
              <ShieldCheck size={18} />
              <span>SAFELINK SCAN RECORD</span>
            </div>
            <div className="report-disclaimer">
              Generated from the submitted content and checks listed above. This report is general
              guidance, not a forensic examination, legal finding or proof of fraud. Review original
              evidence independently.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiPipelineFlow({ result: r }: { result: ScanResult }) {
  return (
    <div className="ai-pipeline-card">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Activity size={18} />
          <div>
            <h4>Analysis trace</h4>
            <p>এই ফলাফলে কোন পরীক্ষা সম্পন্ন হয়েছে, কোনটি হয়নি, তা দেখুন।</p>
          </div>
        </div>
        <span className="subtle-tag">
          {r.checks.filter((c) => c.status === 'complete').length} / {r.checks.length} checks
          complete
        </span>
      </div>
      <div className="pipeline-grid">
        {r.checks.map((check, index) => (
          <div
            key={check.name + index}
            className={
              'pipeline-step-box ' + (check.status === 'complete' ? 'status-safe' : 'status-warn')
            }
          >
            <div className="pipeline-step-top">
              <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="step-badge">{check.status}</span>
            </div>
            <div className="pipeline-step-name">
              {check.status === 'complete' ? <CheckCircle2 size={15} /> : <Clock size={15} />}
              <strong>{check.name}</strong>
            </div>
            <p className="pipeline-step-detail">{check.detail}</p>
          </div>
        ))}
      </div>
      <p className="small-print">
        A completed check describes the work performed. It does not certify safety. AI
        interpretation appears only when it was returned by a configured provider.
      </p>
    </div>
  );
}

function PoliceGdModal({ result: r, onClose }: { result: ScanResult; onClose: () => void }) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const gdText = [
    'বরাবর,',
    'অফিসার ইনচার্জ / সংশ্লিষ্ট অভিযোগ গ্রহণকারী কর্মকর্তা',
    '[থানা বা কর্তৃপক্ষের নাম ও ঠিকানা]',
    '',
    'বিষয়: সন্দেহজনক অনলাইন ঘটনা সম্পর্কে অভিযোগ ও সহায়তার অনুরোধ।',
    '',
    'মহোদয়,',
    'আমার সঙ্গে [নিজের সত্য ঘটনা, তারিখ, সময় ও যোগাযোগের বিবরণ লিখুন] ঘটেছে।',
    'ক্ষতি বা লেনদেনের তথ্য: [প্রযোজ্য হলে নিজের তথ্য লিখুন; না হলে উল্লেখ করুন]।',
    '',
    'সহায়ক স্ক্যানের তথ্য:',
    'স্ক্যান রেফারেন্স: ' + r.id,
    'স্ক্যানের সময়: ' + new Date(r.createdAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }),
    'ইনপুটের সংক্ষিপ্ত বিবরণ: ' + r.preview,
    'ঝুঁকির সংকেতের স্কোর: ' + r.score + '/100 (' + r.level + ')',
    'মিল পাওয়া সতর্ক সংকেত:',
    ...r.evidence.map((e, i) => '(' + (i + 1) + ') ' + e.title + ': ' + e.detail),
    ...(r.evidence.length ? [] : ['সম্পন্ন পরীক্ষায় জোরালো সতর্ক সংকেত পাওয়া যায়নি।']),
    '',
    'SafeLink-এর স্কোর সম্ভাবনা, অপরাধের প্রমাণ বা ফরেনসিক সিদ্ধান্ত নয়। মূল মেসেজ, সময়, নম্বর ও লেনদেনের রসিদ আলাদাভাবে যাচাই করতে হবে।',
    '',
    'ঘটনা যাচাই করে প্রযোজ্য পদ্ধতি অনুযায়ী সহায়তা ও করণীয় জানানোর অনুরোধ করছি।',
    '',
    'আবেদনকারীর নাম: ___________________',
    'যোগাযোগ: ___________________',
    'ঠিকানা: ___________________',
    'তারিখ ও স্বাক্ষর: ___________________',
    '',
    'সংযুক্তি: [নিজের কাছে থাকা মূল স্ক্রিনশট, রসিদ বা অন্য আলামতের তালিকা লিখুন]।',
  ].join('\n');
  async function copyDraft() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(gdText);
      setCopied(true);
    } catch {
      setCopyError('কপি করা যায়নি। নিচের ড্রাফট থেকে লেখা নির্বাচন করে ম্যানুয়ালি কপি করুন।');
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal police-gd-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Complaint draft for review"
      >
        <div className="report-modal-header no-print">
          <div className="report-modal-title">
            <Scale size={20} />
            <span>পর্যালোচনার জন্য অভিযোগের ড্রাফট</span>
          </div>
          <div className="report-modal-actions">
            <Button size="sm" onClick={copyDraft}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'কপি হয়েছে' : 'ড্রাফট কপি করুন'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer size={16} />
              প্রিন্ট / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X size={16} />
              বন্ধ করুন
            </Button>
          </div>
        </div>
        {copyError && (
          <p className="error no-print" role="alert">
            {copyError}
          </p>
        )}
        <div className="gd-draft-sheet" id="printable-police-gd">
          <div className="gd-notice-banner">
            <Scale size={18} />
            <div>
              <strong>নিজের ঘটনা যোগ করে যাচাই করুন</strong>
              <p>
                এটি সাধারণ লেখার খসড়া। কোথায় এবং কীভাবে অভিযোগ করবেন, তা সংশ্লিষ্ট কর্তৃপক্ষের সঙ্গে
                যাচাই করুন। SafeLink অভিযোগ জমা দেয় না এবং আইনগত সিদ্ধান্ত দেয় না।
              </p>
            </div>
          </div>
          <pre className="gd-text-preview">{gdText}</pre>
        </div>
      </div>
    </div>
  );
}

function EmergencyFreezeModal({
  onClose,
  onOpenGd,
}: {
  onClose: () => void;
  onOpenGd?: () => void;
}) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const contacts = [
    { name: 'bKash', hotline: '16247', tag: 'MFS support', color: '#b91c50' },
    { name: 'Nagad', hotline: '16167', tag: 'MFS support', color: '#c2410c' },
    { name: 'Rocket / DBBL', hotline: '16216', tag: 'Bank support', color: '#7e227e' },
    { name: 'জাতীয় জরুরি সেবা', hotline: '999', tag: 'Immediate danger', color: '#b91c1c' },
  ];
  const script =
    'আমার নাম [আপনার নাম]। আমার অ্যাকাউন্টে [নিজের ঘটনার বিবরণ] ঘটেছে এবং অননুমোদিত লেনদেনের আশঙ্কা করছি। অনুগ্রহ করে পরিচয় যাচাই করে অ্যাকাউন্ট সুরক্ষিত করা এবং সন্দেহজনক লেনদেন বন্ধ করার করণীয় জানান। অভিযোগের রেফারেন্স নম্বর দিন।';
  async function copy(value: string) {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopyError('কপি করা যায়নি। নম্বর বা স্ক্রিপ্ট নির্বাচন করে ম্যানুয়ালি কপি করুন।');
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal emergency-freeze-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Emergency fraud response guidance"
      >
        <div className="report-modal-header emergency-modal-top">
          <div className="report-modal-title emergency-title">
            <ShieldAlert size={22} />
            <div>
              <strong>প্রতারণার পর জরুরি করণীয়</strong>
              <small>SafeLink cannot freeze accounts or reverse transactions.</small>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="emergency-modal-body">
          {copyError && (
            <p className="error" role="alert">
              {copyError}
            </p>
          )}
          <div className="emergency-alert-callout">
            <AlertTriangle size={24} />
            <div>
              <strong>দ্রুত সংশ্লিষ্ট প্রতিষ্ঠানের সহায়তা নিন</strong>
              <p>
                পিন বা ওটিপি দিয়ে থাকলে আর কোনো তথ্য দেবেন না। পরিচিত অফিসিয়াল অ্যাপ বা নম্বর দিয়ে
                প্রতিষ্ঠানের সঙ্গে যোগাযোগ করুন। তাৎক্ষণিক বিপদে ৯৯৯-এ কল করুন।
              </p>
            </div>
          </div>
          <div className="emergency-section">
            <h4>১. প্রতিষ্ঠানের হটলাইনে যোগাযোগ করুন</h4>
            <div className="emergency-grid">
              {contacts.map((c) => (
                <div className="emergency-contact-card" key={c.hotline}>
                  <div className="contact-info">
                    <strong>{c.name}</strong>
                    <span className="contact-tag">{c.tag}</span>
                  </div>
                  <div className="contact-actions">
                    <a
                      href={'tel:' + c.hotline}
                      className="btn-call"
                      style={{ backgroundColor: c.color }}
                    >
                      <PhoneCall size={14} />
                      {c.hotline}
                    </a>
                    <button
                      type="button"
                      className="btn-copy-num"
                      aria-label={'Copy ' + c.name + ' number'}
                      onClick={() => copy(c.hotline)}
                    >
                      {copied === c.hotline ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="emergency-section self-lock-box">
            <h4>২. অফিসিয়াল অ্যাপ দিয়ে নিরাপত্তা পরীক্ষা করুন</h4>
            <p>
              প্রতিষ্ঠান যেভাবে বলে সেভাবে পিন বা পাসওয়ার্ড পরিবর্তন করুন, অন্য ডিভাইসের সেশন বন্ধ
              করুন এবং দুই ধাপের যাচাই চালু করুন, যদি এসব সুবিধা থাকে।
            </p>
            <p>
              ইচ্ছাকৃত ভুল পিন দিয়ে অ্যাকাউন্ট সুরক্ষিত হয়েছে ধরে নেবেন না। প্রতিষ্ঠান যে নির্দেশনা
              দেয় তা মেনে অ্যাকাউন্ট বা লেনদেন স্থগিত হওয়ার বিষয়টি নিশ্চিত করুন।
            </p>
          </div>
          <div className="emergency-section">
            <div className="agent-script-header">
              <h4>৩. কাস্টমার কেয়ারে নিজের ঘটনা জানান</h4>
              <button type="button" className="btn-copy-script" onClick={() => copy(script)}>
                <Copy size={14} />
                {copied === script ? 'কপি হয়েছে' : 'স্ক্রিপ্ট কপি করুন'}
              </button>
            </div>
            <div className="agent-script-content">{script}</div>
          </div>
          <div className="emergency-section">
            <h4>৪. মূল আলামত সংরক্ষণ করুন</h4>
            <p>
              মেসেজ, নম্বর, সময় ও লেনদেনের রসিদ রাখুন। প্রয়োজন হলে অভিযোগ করার পদ্ধতি সংশ্লিষ্ট
              কর্তৃপক্ষের কাছে জানুন। টাকা ফেরত পাওয়া নিশ্চিত নয়।
            </p>
            {onOpenGd && (
              <Button onClick={onOpenGd}>
                <Scale size={16} />
                অভিযোগের ড্রাফট দেখুন
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CyberAssistantModal({ onClose }: { onClose: () => void }) {
  const modalRef = useModalFocus<HTMLDivElement>(onClose);
  const requestRef = useRef<AbortController | null>(null);
  const [external, setExternal] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      text: string;
      time: string;
      suggestions?: string[];
      hotlines?: Array<{ name: string; number: string; tag: string }>;
      source?: 'local' | 'ai' | 'error';
      externalUsed?: boolean;
    }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      text: '**SafeLink নিরাপত্তা সহকারী**\n\nসাধারণ প্রশ্নের জন্য আগে থেকে লেখা নিরাপত্তা নির্দেশনা দেখাতে পারি। External AI বেছে নিলে আপনার প্রশ্ন ও সাম্প্রতিক কথোপকথন configured provider-এ পাঠানো হবে।\n\nপিন, ওটিপি, পাসওয়ার্ড বা ব্যক্তিগত তথ্য লিখবেন না। উত্তর ভুল হতে পারে; প্রয়োজন হলে সংশ্লিষ্ট প্রতিষ্ঠান বা পেশাদারের সাহায্য নিন।',
      source: 'local',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'বিকাশ/নগদ পিন কেউ চাইলে কি করব?',
        'আমার একাউন্ট হ্যাক হলে দ্রুত কি করব?',
        'সাইবার ক্রাইম জিডি করার নিয়ম কি?',
        'টাকা খোয়া গেলে দ্রুত কী করব?',
      ],
      hotlines: [
        { name: 'তাৎক্ষণিক বিপদে', number: '999', tag: 'Emergency' },
        { name: 'বিকাশ হেল্পলাইন', number: '16247', tag: 'MFS' },
      ],
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    chatBodyRef.current?.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [messages, isTyping]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isTyping || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;

    const userMsgId = 'u_' + Date.now();
    const userMsg = {
      id: userMsgId,
      role: 'user' as const,
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    try {
      const history = messages
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.text.slice(0, 3000) }));
      const res = await api<{
        reply: string;
        suggestions: string[];
        hotlines: Array<{ name: string; number: string; tag: string }>;
        source?: 'local' | 'ai';
        externalUsed?: boolean;
      }>('/assistant', {
        method: 'POST',
        body: JSON.stringify({ message: query, history, external }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setMessages((prev) => [
        ...prev,
        {
          id: 'bot_' + Date.now(),
          role: 'assistant',
          text: res.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: res.suggestions,
          hotlines: res.hotlines,
          source: res.source || 'local',
          externalUsed: res.externalUsed,
        },
      ]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot_' + Date.now(),
          role: 'assistant',
          text:
            (error as Error).message +
            '\n\nএটি সার্ভার থেকে পাওয়া উত্তর নয়। সাধারণ নিরাপত্তা নির্দেশনা: পিন, ওটিপি বা পাসওয়ার্ড অন্য কাউকে দেবেন না। সন্দেহ হলে প্রতিষ্ঠানের অফিসিয়াল হটলাইনে যোগাযোগ করুন। তাৎক্ষণিক বিপদে ৯৯৯-এ কল করুন।',
          source: 'error',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hotlines: [
            { name: 'Immediate danger: National Emergency', number: '999', tag: 'Emergency' },
            { name: 'bKash Hotline', number: '16247', tag: 'MFS Desk' },
          ],
        },
      ]);
    } finally {
      if (!controller.signal.aborted) setIsTyping(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const formatText = (content: string) => {
    return content.split('\n').map((line, i) => {
      const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={i} className="chat-line">
          {boldParts.map((part, pi) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pi}>{part.slice(2, -2)}</strong>;
            }
            return <span key={pi}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal cyber-assistant-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cyber safety guidance assistant"
      >
        <div className="assistant-modal-header">
          <div className="assistant-title-box">
            <div className="assistant-avatar">
              <Bot size={22} />
            </div>
            <div>
              <strong>SafeLink সাইবার এআই সহকারী</strong>
              <small>
                {external
                  ? 'External AI requested · response source shown below'
                  : 'Local curated guidance · AI off'}
              </small>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          className="assistant-chat-body"
          ref={chatBodyRef}
          tabIndex={0}
          role="log"
          aria-live="polite"
          aria-label="Assistant conversation"
        >
          {messages.map((m) => (
            <div key={m.id} className={`chat-message-row ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="chat-msg-avatar">
                  <Bot size={16} />
                </div>
              )}
              <div className="chat-bubble">
                <div className="chat-bubble-text">{formatText(m.text)}</div>
                {m.hotlines && m.hotlines.length > 0 && (
                  <div className="chat-hotlines-wrap">
                    {m.hotlines.map((h) => (
                      <a key={h.number} href={`tel:${h.number}`} className="chat-hotline-chip">
                        <PhoneCall size={12} /> {h.name}: <strong>{h.number}</strong>
                      </a>
                    ))}
                  </div>
                )}
                <span className="chat-timestamp">{m.time}</span>
                {m.source && (
                  <small className="chat-source">
                    {m.source === 'ai'
                      ? 'External AI response · may be incorrect'
                      : m.source === 'error'
                        ? 'Connection error · general safety reminder'
                        : m.externalUsed
                          ? 'External AI request attempted · local guidance shown'
                          : 'Local curated guidance'}
                  </small>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat-message-row assistant">
              <div className="chat-msg-avatar">
                <Bot size={16} />
              </div>
              <div className="chat-bubble typing-bubble">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <small>উত্তরের জন্য অপেক্ষা করছি…</small>
              </div>
            </div>
          )}
        </div>

        {messages[messages.length - 1]?.suggestions && (
          <div className="assistant-suggestions-bar">
            {messages[messages.length - 1].suggestions?.map((s) => (
              <button
                key={s}
                type="button"
                className="suggestion-chip-btn"
                disabled={isTyping}
                onClick={() => sendMessage(s)}
              >
                <Sparkles size={12} /> {s}
              </button>
            ))}
          </div>
        )}

        <label className="assistant-consent">
          <input
            type="checkbox"
            checked={external}
            disabled={isTyping}
            onChange={(e) => setExternal(e.target.checked)}
          />
          <span>
            Use external AI{' '}
            <small>
              Sends your question and recent conversation excerpts to a configured AI provider.
              Remove private information first.
            </small>
          </span>
        </label>
        <form
          className="assistant-input-footer"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            type="text"
            className="assistant-text-input"
            placeholder="সাইবার নিরাপত্তা বা প্রতারণা সম্পর্কে প্রশ্ন লিখুন…"
            aria-label="Your safety question"
            maxLength={3000}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isTyping}
          />
          <button
            type="submit"
            className="assistant-send-btn"
            disabled={isTyping || !inputMessage.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
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
function AnalysisOverview() {
  return (
    <div className="threat-radar-section">
      <div className="radar-header-banner">
        <div>
          <span className="eyebrow">EXPLAINABLE CHECKS</span>
          <h2>Know what the scanner can see.</h2>
          <p>
            SafeLink analyzes submitted content. Its local rules check suspicious language and URL
            patterns; external services run only when you choose them.
          </p>
        </div>
        <span className="subtle-tag">No national monitoring feed</span>
      </div>
      <div className="radar-grid">
        {[
          {
            icon: Cpu,
            title: 'Local language & URL rules',
            text: 'Bangla, Banglish and English warning patterns, sensitive-information requests and look-alike domains. Scores describe matched indicators.',
          },
          {
            icon: QrCode,
            title: 'QR decoding & screenshot OCR',
            text: 'Inspect a QR payload or read text from an uploaded screenshot. Review extracted text because OCR can make mistakes.',
          },
          {
            icon: Users,
            title: 'Reviewed community reports',
            text: 'Approved reports can add supporting evidence. Reports alone do not establish fraud or coordinated activity.',
          },
          {
            icon: Bot,
            title: 'Optional external services',
            text: 'AI interpretation and threat reputation require configured providers and your consent. The result lists unavailable or skipped checks.',
          },
        ].map((item) => (
          <div className="card radar-card" key={item.title}>
            <div className="radar-card-head">
              <item.icon size={18} />
              <h3>{item.title}</h3>
            </div>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard(props: Props & { version: number; onOpen: (r: ScanResult) => void }) {
  const { data, error, loading, reload } = useApiResource<any>(
    '/dashboard',
    Boolean(props.user),
    props.version,
  );
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE OVERVIEW"
        title="Your digital safety activity"
        text="Understand available checks and review your own saved activity."
      />
      <AnalysisOverview />
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
        <div className="error" role="alert">
          {error}{' '}
          <Button variant="outline" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : loading || !data ? (
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
                <button
                  className="recent-row dashboard-open"
                  key={r.id}
                  onClick={() => props.onOpen(r)}
                  aria-label={'View scan: ' + r.preview}
                >
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
  const [activeCategory, setActiveCategory] = useState('all');
  const categories = [
    { id: 'all', label: 'All contacts' },
    { id: 'mfs', label: 'MFS & banking' },
    { id: 'law', label: 'Emergency & police' },
    { id: 'rules', label: 'Safety habits' },
  ];
  const contacts = [
    {
      category: 'mfs',
      name: 'bKash',
      bengaliName: 'বিকাশ',
      hotline: '16247',
      domain: 'bkash.com',
      tag: 'Customer support',
      desc: 'Ask customer support about account security or a suspicious transaction.',
      source: 'https://www.bkash.com/en/page/terms-of-use-bkash-app',
    },
    {
      category: 'mfs',
      name: 'Nagad',
      bengaliName: 'নগদ',
      hotline: '16167',
      domain: 'nagad.com.bd',
      tag: 'Customer support',
      desc: 'Contact Nagad about a lost phone, possible PIN misuse or account security.',
      source: 'https://nagadislamic.com.bd/bn/terms-and-conditions/',
    },
    {
      category: 'mfs',
      name: 'Rocket / Dutch-Bangla Bank',
      bengaliName: 'রকেট / ডাচ-বাংলা ব্যাংক',
      hotline: '16216',
      domain: 'dutchbanglabank.com',
      tag: 'Bank call center',
      desc: 'DBBL customer services and complaint contact.',
      source: 'https://www.dutchbanglabank.com/complaint-cell/central-customer-services.html',
    },
    {
      category: 'law',
      name: 'National Emergency Service',
      bengaliName: 'জাতীয় জরুরি সেবা',
      hotline: '999',
      domain: 'police.gov.bd',
      tag: 'Immediate danger',
      desc: 'Police, fire or ambulance emergency assistance. Use for immediate danger; contact your financial institution for an account dispute.',
      source: 'https://telecom-police.portal.gov.bd/pages/static-pages/695e3b0cc4774958d7b72321',
    },
    {
      category: 'law',
      name: 'Police Cyber Support for Women',
      bengaliName: 'নারীদের জন্য পুলিশ সাইবার সাপোর্ট',
      hotline: '01320000888',
      domain: 'police.gov.bd',
      tag: 'Women cyber support',
      desc: 'Specialist cyber support for women. This number belongs to PCSW, not a general CID hotline.',
      source: 'https://www.police.gov.bd/en/police_cyber_support_for_women',
    },
  ];
  const rules = [
    {
      title: 'পিন, ওটিপি ও পাসওয়ার্ড গোপন রাখুন',
      desc: 'অন্য কাউকে এসব তথ্য বলবেন না। নিজের পরিচিত অফিসিয়াল অ্যাপ বা ঠিকানা দিয়ে যাচাই করুন।',
    },
    {
      title: 'টাকা ফেরত চাওয়ার দাবি যাচাই করুন',
      desc: 'ফোন বা স্ক্রিনশটের দাবির ওপর নির্ভর না করে নিজের অ্যাপে লেনদেন দেখুন। সন্দেহ হলে প্রতিষ্ঠানের সহায়তা নিন।',
    },
    {
      title: 'অপ্রত্যাশিত ফি বা পুরস্কারের অনুরোধে থামুন',
      desc: 'আগে টাকা পাঠানো বা গোপন তথ্য দেওয়ার অনুরোধ পেলে স্বাধীনভাবে প্রতিষ্ঠান ও দাবিটি যাচাই করুন।',
    },
    {
      title: 'পরিচিত যোগাযোগ মাধ্যম ব্যবহার করুন',
      desc: 'অচেনা লিংকের লগইন পাতায় তথ্য না দিয়ে নিজে প্রতিষ্ঠানের অ্যাপ বা ঠিকানা খুলুন।',
    },
    {
      title: 'সন্দেহ হলে দ্রুত সহায়তা নিন',
      desc: 'মূল মেসেজ, সময় ও লেনদেনের রসিদ রাখুন। প্রতিষ্ঠানের কাছে অ্যাকাউন্ট সুরক্ষিত করার করণীয় জানতে চান।',
    },
  ];
  const term = query.trim().toLowerCase();
  const filtered = contacts.filter(
    (c) =>
      (activeCategory === 'all' || c.category === activeCategory) &&
      (!term || (c.name + c.bengaliName + c.hotline + c.domain).toLowerCase().includes(term)),
  );
  async function copyNumber(number: string) {
    try {
      await navigator.clipboard.writeText(number);
      notify('Copied ' + number + '.');
    } catch {
      notify('Could not copy. Select the number manually or tap it to call.');
    }
  }
  return (
    <div className="directory-page">
      <PageTitle
        eyebrow="SOURCED SUPPORT CONTACTS"
        title="Find the right support contact."
        text="Contacts checked against official sources on 4 October 2026. Open the source to confirm current details. Once this page is loaded, filtering needs no API request."
      />
      <div className="directory-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="Search support contacts"
            placeholder="Search institution, number or domain…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="directory-filter-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={activeCategory === c.id}
              className={'filter-pill ' + (activeCategory === c.id ? 'active' : '')}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {activeCategory === 'rules' ? (
        <div className="golden-rules-grid">
          {rules.map((rule) => (
            <div key={rule.title} className="card golden-rule-card">
              <strong>{rule.title}</strong>
              <p>{rule.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          {!filtered.length && (
            <Empty
              title="No matching contacts"
              text="Try another institution or clear your search."
            />
          )}
          <div className="directory-cards-grid">
            {filtered.map((c) => (
              <div key={c.hotline} className="card directory-card">
                <div className="dir-card-head">
                  <div>
                    <strong>{c.name}</strong>
                    <span className="bengali-sub">{c.bengaliName}</span>
                  </div>
                  <span className="dir-tag">{c.tag}</span>
                </div>
                <p className="dir-desc">{c.desc}</p>
                <div className="dir-numbers-strip">
                  <div className="num-block">
                    <small>CONTACT NUMBER</small>
                    <a className="hotline-link" href={'tel:' + c.hotline}>
                      <PhoneCall size={14} />
                      {c.hotline}
                    </a>
                  </div>
                </div>
                <div className="dir-foot">
                  <a
                    className="domain-pill"
                    href={c.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official source <ExternalLink size={13} />
                  </a>
                  <button type="button" className="copy-btn" onClick={() => copyNumber(c.hotline)}>
                    Copy number
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryPage(props: Props & { version: number; initialSelection?: ScanResult | null }) {
  const {
    data,
    setData,
    error,
    loading,
    reload: load,
  } = useApiResource<ScanResult[]>('/scans', Boolean(props.user), props.version);
  const rows = data || [];
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState<ScanResult | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (data)
      setSelected(
        (current) =>
          data.find((row) => row.id === (current?.id || props.initialSelection?.id)) || null,
      );
  }, [data, props.initialSelection]);
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
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {loading && <p role="status">Loading your scans…</p>}
          {error && (
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          )}
          {!loading &&
            !error &&
            rows.length > 0 &&
            !rows.some((r) =>
              (r.preview + r.level + r.kind).toLowerCase().includes(query.toLowerCase()),
            ) && (
              <Empty
                title="No matching scans"
                text="Try another domain, scan type or risk level."
              />
            )}
          <div className="card history-list">
            {rows
              .filter((r) =>
                (r.preview + r.level + r.kind).toLowerCase().includes(query.toLowerCase()),
              )
              .map((r) => (
                <div className="recent-row" key={r.id}>
                  <button
                    className="row-open"
                    aria-pressed={selected?.id === r.id}
                    onClick={() => setSelected(r)}
                  >
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
                    disabled={Boolean(deleting)}
                    onClick={async () => {
                      if (!confirm('Delete this scan permanently?')) return;
                      setDeleting(r.id);
                      try {
                        await api('/scans/' + r.id, { method: 'DELETE' });
                        setSelected((current) => (current?.id === r.id ? null : current));
                        props.refresh();
                      } catch (e) {
                        props.notify((e as Error).message);
                      } finally {
                        setDeleting(null);
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
          {selected && !loading && !error && rows.some((row) => row.id === selected.id) && (
            <Result
              key={selected.id}
              result={selected}
              {...props}
              onSaved={(id, saved) => {
                setData(
                  (rows) => rows?.map((row) => (row.id === id ? { ...row, saved } : row)) || [],
                );
                setSelected((row) => (row?.id === id ? { ...row, saved } : row));
                props.refresh();
              }}
            />
          )}
        </>
      )}
    </>
  );
}
function Community(props: Props & { health: any }) {
  const reportsResource = useApiResource<any[]>('/reports', Boolean(props.user));
  const graphResource = useApiResource<any>('/graph', Boolean(props.user));
  const categoriesResource = useApiResource<string[]>('/categories', Boolean(props.user));
  const categoryOptions = categoriesResource.data || [...categories];
  const rows = reportsResource.data || [];
  const graph = graphResource.data;
  const [entity, setEntity] = useState(''),
    [entityType, setEntityType] = useState('domain'),
    [category, setCategory] = useState<string>(categories[0]),
    [description, setDescription] = useState(''),
    [busy, setBusy] = useState(false);
  const requiresVerification = Boolean(
    props.user && !props.user.verified && props.health?.storage !== 'temporary-memory',
  );
  useEffect(() => {
    if (categoriesResource.data?.length && !categoriesResource.data.includes(category))
      setCategory(categoriesResource.data[0]);
  }, [categoriesResource.data, category]);
  const load = () => {
    reportsResource.reload();
    graphResource.reload();
    categoriesResource.reload();
  };
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
          {(reportsResource.error || graphResource.error) && (
            <p className="error" role="alert">
              {reportsResource.error || graphResource.error}{' '}
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
            </p>
          )}
          <div className="two-grid">
            <form
              className="card stack"
              aria-busy={busy}
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || requiresVerification) return;
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
                <select
                  disabled={busy}
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
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
                  disabled={busy}
                  minLength={3}
                  maxLength={2048}
                  placeholder={
                    entityType === 'phone'
                      ? '+8801XXXXXXXXX'
                      : entityType === 'message'
                        ? 'Suspicious message without personal details'
                        : entityType === 'url'
                          ? 'https://example.com/path'
                          : 'example.com'
                  }
                />
              </label>
              <label>
                Category
                <select
                  disabled={busy}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
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
                  disabled={busy}
                  placeholder="Explain the concern. Do not include OTPs, passwords or personal information."
                />
              </label>
              {requiresVerification && (
                <p className="small-print">
                  Verify your email in Settings before submitting reports.
                </p>
              )}
              <Button disabled={busy || requiresVerification} type="submit">
                {busy ? 'Submitting…' : 'Submit report'}
                <ArrowRight size={16} />
              </Button>
            </form>
            <div className="card">
              <h2>
                Your reports <span className="count">{rows.length}</span>
              </h2>
              {reportsResource.loading ? (
                <p role="status">Loading your reports…</p>
              ) : reportsResource.error ? (
                <p>Reports could not be loaded.</p>
              ) : rows.length ? (
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
            {graphResource.loading ? (
              <p role="status">Loading connections…</p>
            ) : graphResource.error ? (
              <p>Connections could not be loaded.</p>
            ) : graph?.nodes.length ? (
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
function Family(props: Props & { onSimple: () => void; simpleBusy: boolean; health: any }) {
  const contactsResource = useApiResource<any[]>('/contacts', Boolean(props.user));
  const scansResource = useApiResource<ScanResult[]>('/scans', Boolean(props.user));
  const alertsResource = useApiResource<any[]>('/alerts', Boolean(props.user));
  const contacts = contactsResource.data || [];
  const scans = scansResource.data || [];
  const alerts = alertsResource.data || [];
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [scanId, setScanId] = useState(''),
    [contactId, setContactId] = useState(''),
    [adding, setAdding] = useState(false),
    [sending, setSending] = useState(false),
    [removing, setRemoving] = useState<string | null>(null);
  useEffect(() => {
    if (contactsResource.data && !contactsResource.data.some((contact) => contact.id === contactId))
      setContactId('');
  }, [contactsResource.data, contactId]);
  useEffect(() => {
    if (scansResource.data && !scansResource.data.some((scan) => scan.id === scanId)) setScanId('');
  }, [scansResource.data, scanId]);
  const canSend = Boolean(
    props.user?.verified &&
    props.health?.email &&
    scans.some((scan) => scan.id === scanId) &&
    contacts.some((contact) => contact.id === contactId) &&
    !contactsResource.loading &&
    !scansResource.loading &&
    !contactsResource.error &&
    !scansResource.error &&
    !removing,
  );
  const load = () => {
    contactsResource.reload();
    scansResource.reload();
    alertsResource.reload();
  };
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
        <Button variant="outline" onClick={props.onSimple} disabled={props.simpleBusy}>
          {props.simpleBusy
            ? 'Updating…'
            : `${props.user?.simpleMode ? 'Turn off' : 'Turn on'} simple mode`}
        </Button>
      </div>
      {!props.user ? (
        <SignInRequired {...props} />
      ) : (
        <>
          {(contactsResource.error || scansResource.error || alertsResource.error) && (
            <p className="error" role="alert">
              {contactsResource.error || scansResource.error || alertsResource.error}{' '}
              <Button size="sm" variant="outline" onClick={load}>
                Try again
              </Button>
            </p>
          )}
          <div className="two-grid">
            <form
              className="card stack"
              aria-busy={adding}
              onSubmit={async (e) => {
                e.preventDefault();
                if (adding) return;
                setAdding(true);
                try {
                  await post('/contacts', { name, email });
                  setName('');
                  setEmail('');
                  load();
                } catch (e) {
                  props.notify((e as Error).message);
                } finally {
                  setAdding(false);
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
                  disabled={adding}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  disabled={adding}
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <p className="small-print">
                Only add someone who agrees to receive your security alerts. Adding a contact does
                not send an email.
              </p>
              <Button type="submit" disabled={adding}>
                <Plus size={16} />
                {adding ? 'Adding…' : 'Add contact'}
              </Button>
              {contactsResource.loading && <p role="status">Loading contacts…</p>}
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
                    disabled={
                      Boolean(removing) ||
                      sending ||
                      contactsResource.loading ||
                      Boolean(contactsResource.error)
                    }
                    onClick={async () => {
                      if (removing || sending) return;
                      setRemoving(c.id);
                      try {
                        await api('/contacts/' + c.id, { method: 'DELETE' });
                        if (contactId === c.id) setContactId('');
                        load();
                      } catch (e) {
                        props.notify((e as Error).message);
                      } finally {
                        setRemoving(null);
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
              aria-busy={sending}
              onSubmit={async (e) => {
                e.preventDefault();
                if (sending || !canSend) return;
                setSending(true);
                try {
                  await post('/alerts', { scanId, contactId });
                  props.notify('Security alert sent.');
                  load();
                } catch (e) {
                  props.notify((e as Error).message);
                  alertsResource.reload();
                } finally {
                  setSending(false);
                }
              }}
            >
              <h2>Send a security alert</h2>
              <label>
                Saved scan
                <select
                  required
                  value={scanId}
                  disabled={sending || scansResource.loading || Boolean(scansResource.error)}
                  onChange={(e) => setScanId(e.target.value)}
                >
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
                <select
                  required
                  value={contactId}
                  disabled={
                    sending ||
                    Boolean(removing) ||
                    contactsResource.loading ||
                    Boolean(contactsResource.error)
                  }
                  onChange={(e) => setContactId(e.target.value)}
                >
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
              {!props.user.verified && (
                <p className="small-print">Verify your email in Settings before sending alerts.</p>
              )}
              {!props.health?.email && (
                <p className="small-print">Email delivery is not configured in this workspace.</p>
              )}
              <Button type="submit" disabled={sending || !canSend}>
                <Mail size={16} />
                {sending ? 'Sending…' : 'Send security alert'}
              </Button>
              <h3>Alert history</h3>
              {alertsResource.loading ? (
                <p role="status">Loading alerts…</p>
              ) : alertsResource.error ? (
                <p>Alerts could not be loaded.</p>
              ) : alerts.length ? (
                [...alerts]
                  .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
                  .slice(0, 10)
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
function SettingsPage(
  props: Props & {
    health: any;
    setUser: (u: User | null) => boolean;
    updateProfile: (name: string) => Promise<boolean>;
  },
) {
  const [name, setName] = useState(props.user?.name || '');
  const [pending, setPending] = useState<'profile' | 'verify' | 'logout' | null>(null);
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
              if (pending) return;
              setPending('profile');
              try {
                const updated = await props.updateProfile(name);
                if (updated) props.notify('Profile updated.');
              } catch (e) {
                props.notify((e as Error).message);
              } finally {
                setPending(null);
              }
            }}
          >
            <h2>Profile</h2>
            <label>
              Name
              <input
                value={name}
                disabled={Boolean(pending)}
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
                disabled={Boolean(pending) || !props.health?.email}
                onClick={async () => {
                  setPending('verify');
                  try {
                    await post('/auth/resend', {});
                    props.notify('Verification email sent.');
                  } catch (e) {
                    props.notify((e as Error).message);
                  } finally {
                    setPending(null);
                  }
                }}
              >
                Resend verification
              </Button>
            )}
            {!props.health?.email && (
              <p className="small-print">
                Email delivery is not configured. Verification and password-reset emails cannot be
                sent yet.
              </p>
            )}
            <Button type="submit" disabled={Boolean(pending)}>
              {pending === 'profile' ? 'Saving…' : 'Save profile'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={Boolean(pending)}
              onClick={async () => {
                setPending('logout');
                try {
                  await post('/auth/logout', {});
                  props.setUser(null);
                } catch (e) {
                  props.notify((e as Error).message);
                } finally {
                  setPending(null);
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
    [name, setName] = useState(''),
    [aliases, setAliases] = useState(''),
    [domains, setDomains] = useState(''),
    [busy, setBusy] = useState(false);
  const {
    data,
    loading,
    error,
    reload: load,
  } = useApiResource<any[]>('/admin/' + tab, props.user?.role === 'admin');
  const rows = data || [];
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
      <div className="admin-tabs" role="group" aria-label="Administration views">
        {['reports', 'users', 'brands', 'threatCategories', 'scans', 'adminLogs'].map((t) => (
          <Button
            key={t}
            variant={t === tab ? 'default' : 'outline'}
            onClick={() => {
              setTab(t);
              setName('');
              setAliases('');
              setDomains('');
            }}
            disabled={busy}
            aria-pressed={tab === t}
          >
            {
              {
                reports: 'Reports',
                users: 'Users',
                brands: 'Brands',
                threatCategories: 'Threat categories',
                scans: 'Scans',
                adminLogs: 'Activity log',
              }[t]
            }
          </Button>
        ))}
      </div>
      {tab === 'brands' && (
        <form
          className="card stack"
          aria-busy={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              await post('/admin/brands', {
                name,
                aliases: aliases
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                domains: domains
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              load();
              props.notify('Brand configuration saved.');
            } catch (e) {
              props.notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Add or replace a brand</h3>
          <label>
            Name
            <input
              required
              minLength={2}
              maxLength={80}
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Aliases, comma separated
            <input
              required
              maxLength={1219}
              disabled={busy}
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
            />
          </label>
          <label>
            Official domains, comma separated
            <input
              required
              maxLength={5079}
              disabled={busy}
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save brand'}
          </Button>
        </form>
      )}
      {tab === 'threatCategories' && (
        <form
          className="card stack"
          aria-busy={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              await post('/admin/threatCategories', { name });
              setName('');
              load();
              props.notify('Threat category added.');
            } catch (e) {
              props.notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Category name
            <input
              required
              minLength={2}
              maxLength={80}
              disabled={busy}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Add category'}
          </Button>
        </form>
      )}
      <div className="card">
        {loading && <p role="status">Loading records…</p>}
        {error && (
          <p className="error" role="alert">
            {error}{' '}
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          </p>
        )}
        {!loading && !error && !rows.length && <p>No records to review.</p>}
        {!loading &&
          !error &&
          rows.map((r) => (
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
                <small>
                  {r.status ||
                    (r.role
                      ? `${r.role}${r.disabled ? ' · Disabled' : ''}`
                      : r.createdAt
                        ? new Date(r.createdAt).toLocaleString()
                        : 'Configured')}
                </small>
              </div>
              {tab === 'reports' && (
                <div>
                  {['approved', 'rejected', 'pending'].map((status) => (
                    <Button
                      size="sm"
                      variant="outline"
                      key={status}
                      disabled={busy || r.status === status}
                      onClick={async () => {
                        if (busy) return;
                        setBusy(true);
                        try {
                          await api('/admin/reports/' + r.id, {
                            method: 'PATCH',
                            body: JSON.stringify({ status }),
                          });
                          load();
                          props.notify(`Report ${status}.`);
                        } catch (e) {
                          props.notify((e as Error).message);
                        } finally {
                          setBusy(false);
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
                  disabled={busy}
                  onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      await api('/admin/users/' + r.id, {
                        method: 'PATCH',
                        body: JSON.stringify({ disabled: !r.disabled }),
                      });
                      load();
                      props.notify(r.disabled ? 'Account enabled.' : 'Account disabled.');
                    } catch (e) {
                      props.notify((e as Error).message);
                    } finally {
                      setBusy(false);
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
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const modalRef = useModalFocus(() => {
    if (!busy) onClose();
  });
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        className="modal auth-studio"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
        >
          <X />
        </button>
        <aside className="auth-story">
          <div className="auth-wordmark">
            <ShieldCheck size={25} /> SafeLink <small>AI</small>
          </div>
          <div className="auth-orb">
            <div>
              <ShieldCheck size={58} />
            </div>
            <span className="auth-orbit-label">A SECOND LOOK MATTERS</span>
          </div>
          <span className="auth-eyebrow">YOUR PERSONAL SAFETY SPACE</span>
          <h2>
            A calmer corner
            <br />
            of the internet.
          </h2>
          <p>
            Keep your checks together.
            <br />
            Make your next click a thoughtful one.
          </p>
          <div className="auth-benefits">
            <span>
              <Check size={15} /> Your scan history, in one place
            </span>
            <span>
              <Check size={15} /> Community signals & Family Shield
            </span>
          </div>
          <small className="auth-story-foot">PAUSE. CHECK. PROCEED THOUGHTFULLY.</small>
        </aside>
        <div className="auth-form-panel">
          <div className="auth-mode-switch" aria-label="Account options">
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError('');
                setShowPassword(false);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError('');
                setShowPassword(false);
              }}
            >
              Create account
            </button>
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
          <form
            aria-busy={busy}
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const data = await post('/auth/' + mode, {
                  email,
                  ...(mode !== 'forgot' ? { password } : {}),
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
                        : 'Account created. A verification email could not be sent; verification is pending.',
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
                  disabled={busy}
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
                disabled={busy}
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {mode !== 'forgot' && (
              <div className="auth-password-field">
                <label htmlFor="auth-password">Password</label>
                <div className="auth-password-wrap">
                  <input
                    id="auth-password"
                    disabled={busy}
                    placeholder={
                      mode === 'register' ? 'Create a memorable passphrase' : 'Enter your password'
                    }
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 12 : 1}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    disabled={busy}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {mode === 'register' && (
                  <div className="auth-password-hint">
                    <span className={password.length >= 12 ? 'ready' : ''} />
                    <small>
                      {password.length >= 12
                        ? 'Length requirement met'
                        : 'Use at least 12 characters. A few unrelated words work well.'}
                    </small>
                  </div>
                )}
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
              disabled={busy}
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
            {mode === 'login' && (
              <button
                disabled={busy}
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setShowPassword(false);
                }}
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="auth-footer-note">
            <ShieldCheck size={14} />
            <span>You can also explore the scanner without an account.</span>
          </div>
          <button className="auth-guest" type="button" onClick={onClose} disabled={busy}>
            Continue as guest <ArrowUpRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
function AccountAction({
  action,
  notify,
  onConfirmed,
}: {
  action: string;
  notify: (s: string) => void;
  onConfirmed: () => void;
}) {
  const [closed, setClosed] = useState(false),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [token] = useState(() => new URLSearchParams(location.search).get('token'));
  const close = () => {
    if (busy) return;
    history.replaceState({}, '', location.pathname + '#workspace');
    setClosed(true);
  };
  const modalRef = useModalFocus(close, !closed);
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
        {!token && (
          <p className="error" role="alert">
            This link has no confirmation token. Open the complete link from your email.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !token) return;
            setError('');
            setBusy(true);
            try {
              await post('/auth/confirm', {
                purpose: action,
                token,
                ...(action === 'reset' ? { password } : {}),
              });
              history.replaceState({}, '', location.pathname + '#workspace');
              setClosed(true);
              onConfirmed();
              notify(
                action === 'reset'
                  ? 'Password reset. Sign in with your new password.'
                  : 'Email verified. Your account has been updated.',
              );
            } catch (e) {
              setError((e as Error).message);
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
                autoComplete="new-password"
                disabled={busy}
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <Button disabled={busy || !token}>{busy ? 'Confirming…' : 'Confirm'}</Button>
          <Button variant="ghost" type="button" disabled={busy} onClick={close}>
            Close
          </Button>
        </form>
      </section>
    </div>
  );
}
