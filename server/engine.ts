import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { domainToUnicode } from 'node:url';
import { parse } from 'tldts';
import type { Brand, Evidence, ScanKind, ScanResult } from '../shared/types.js';
import { defaultBrands } from './brands.js';
import { InputError } from './errors.js';
export function normalizeUrl(input: string): URL {
  const s = input.trim();
  if (!s || /[\s\u0000-\u001f]/u.test(s)) throw new InputError('Enter a valid URL without spaces.');
  const hostWithPort = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+:\d+(?:[/?#]|$)|^localhost:\d+(?:[/?#]|$)/u.test(s);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s) && !hostWithPort)
    throw new InputError('Only HTTP and HTTPS URLs are supported.');
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); }
  catch { throw new InputError('Enter a valid HTTP or HTTPS URL.'); }
  if (
    !u.hostname ||
    (!u.hostname.includes('.') &&
      !isIP(u.hostname.replace(/[\[\]]/g, '')) &&
      u.hostname !== 'localhost')
  )
    throw new InputError('Enter a complete domain, such as example.com.');
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!isIP(u.hostname.replace(/[\[\]]/g,'')) && (u.hostname.length>253 || u.hostname.split('.').some(label=>!label || label.length>63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)))) throw new InputError('The domain name is not valid.');
  u.hash = '';
  return u;
}
export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}
export function skeleton(s: string) {
  const lookalikes: Record<string, string> = {
    а: 'a',
    е: 'e',
    о: 'o',
    р: 'p',
    с: 'c',
    у: 'y',
    х: 'x',
    і: 'i',
    ј: 'j',
    ӏ: 'l',
    '0': 'o',
    '1': 'l',
    '3': 'e',
  };
  return domainToUnicode(s).replace(/[аеорсу хіјӏ013]/g, (c) => lookalikes[c] || c);
}
export function extractUrls(text: string): string[] {
  const matches =
    text.match(
      /(?:https?:\/\/|www\.)[^\s<>"\u0964]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|xyz|top|bd|example|test)(?:\/[^\s<>"\u0964]*)?/gi,
    ) || [];
  return [...new Set(matches.map((s) => s.replace(/[.,!?;:।)\]}]+$/u, '')))].slice(0, 10);
}
export function normalizePhone(s: string) {
  let n = s.replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/[^0-9+]/g, '');
  if (/^01\d{9}$/.test(n)) n = '+88' + n;
  if (/^8801\d{9}$/.test(n)) n = '+' + n;
  return n;
}
export function extractPhones(s: string): string[] {
  return [
    ...new Set(
      (s.match(/(?:\+?88)?[০0][১1][০-৯0-9\s-]{9,14}/g) || [])
        .map(normalizePhone)
        .filter((n) => /^\+8801\d{9}$/.test(n)),
    ),
  ].slice(0, 10);
}
export function localScan(
  input: string,
  kind: ScanKind,
  brands: Brand[] = defaultBrands,
): ScanResult {
  const evidence: Evidence[] = [];
  const add = (id: string, title: string, detail: string, weight: number) => {
    if (!evidence.some((e) => e.id === id))
      evidence.push({ id, source: 'local', title, detail, weight });
  };
  const text = input.normalize('NFKC');
  const raw = kind === 'url' ? [input] : extractUrls(text);
  const urls: string[] = [];
  for (const value of raw) {
    let u: URL;
    try {
      u = normalizeUrl(value);
    } catch {
      if (kind === 'url') throw new InputError('Please enter a valid HTTP or HTTPS URL.');
      continue;
    }
    urls.push(u.href);
    const host = u.hostname;
    const domain = parse(host).domain || host;
    const label = (parse(host).domainWithoutSuffix || host).toLowerCase();
    if (u.username || u.password)
      add(
        'userinfo',
        'Misleading URL credentials',
        'The URL contains text before @; the destination is ' + host + '.',
        25,
      );
    if (isIP(host.replace(/[\[\]]/g, '')))
      add(
        'ip',
        'IP address destination',
        'An IP address is used instead of a recognizable domain.',
        15,
      );
    if (u.protocol === 'http:')
      add(
        'http',
        'Unencrypted connection',
        'HTTP does not encrypt the connection. HTTPS alone would not establish trust either.',
        8,
      );
    if (host.split('.').length - domain.split('.').length > 2)
      add(
        'subdomains',
        'Many subdomains',
        'Multiple subdomain levels can obscure the actual registered domain.',
        8,
      );
    if (u.href.length > 180)
      add(
        'long',
        'Unusually long URL',
        'Long URLs can obscure their destination; this is a weak signal.',
        5,
      );
    if (['bit.ly', 'tinyurl.com', 't.co', 'shorturl.at', 'is.gd'].includes(domain))
      add(
        'shortener',
        'Shortened destination',
        'The final destination is hidden. SafeLink does not follow redirects.',
        12,
      );
    if (host.includes('xn--'))
      add(
        'unicode',
        'Internationalized domain',
        'The Unicode domain ' +
          domainToUnicode(host) +
          ' may contain look-alike characters. Internationalized domains can also be legitimate.',
        12,
      );
    if (/(?:\.zip|\.mov|\.top|\.click|\.xyz)$/.test(host))
      add(
        'tld',
        'Domain suffix signal',
        'This suffix is a weak signal and does not establish maliciousness.',
        4,
      );
    if (/%[0-9a-f]{2}/i.test(u.pathname) || host.split('-').length > 3)
      add(
        'obfuscation',
        'Obscured URL structure',
        'Encoded path characters or repeated hyphens deserve closer inspection.',
        5,
      );
    for (const b of brands) {
      const official = b.domains.some((d) => host === d || host.endsWith('.' + d));
      if (official) continue;
      const aliases = b.aliases.map(a=>a.toLowerCase()).filter((a) => /^[a-z]{4,}$/i.test(a));
      const normalized = skeleton(label);
      if (
        aliases.some(
          (a) => host.includes(a) || distance(label, a) <= 1 || distance(normalized, a) <= 1,
        )
      )
        add(
          'brand:' + b.id,
          'Possible ' + b.name + ' impersonation',
          'The hostname resembles ' +
            b.name +
            ' but does not match a configured official domain (' +
            b.domains.join(', ') +
            ').',
          30,
        );
      else if (
        b.aliases.some((a) => text.toLowerCase().includes(a.toLowerCase())) &&
        /verify|login|account|payment|পিন|অ্যাকাউন্ট|pin/i.test(text)
      )
        add(
          'mismatch:' + b.id,
          'Brand and destination mismatch',
          'The message mentions ' +
            b.name +
            ' but links to ' +
            host +
            '. Legitimate third-party links are possible.',
          15,
        );
    }
  }
  if (kind !== 'url') {
    const lower = text.toLowerCase();
    const credentialRequest = lower.split(/[.!?।\n]+|\b(?:but|however)\b/iu).some(sentence => {
      const sensitive = /\b(?:otp|pin|password|passcode)\b|ওটিপি|পিন|পাসওয়ার্ড|পাসওয়ার্ড/iu.test(sentence);
      const request = /\b(?:send|share|provide|enter|submit|tell|din|den|pathan|janan)\b|দেন|দিন|পাঠান|জানান|লিখুন/iu.test(sentence);
      const negated = /\b(?:never|do not|don't|dont|share korben na|diben na)\b|কখনো|কখনও|দিবেন না|দেবেন না|শেয়ার করবেন না/iu.test(sentence);
      return sensitive && request && !negated;
    });
    if (credentialRequest)
      add(
        'credentials',
        'Sensitive information requested',
        'The message asks for an OTP, PIN or password.',
        35,
      );
    if (/urgent|immediately|ekhoni|taratari|এখনই|জরুরি|দ্রুত/i.test(lower))
      add(
        'urgency',
        'Pressure to act quickly',
        'Urgency language pressures the reader into a quick decision.',
        10,
      );
    if (
      /suspend|blocked|bondho|বন্ধ|ব্লক|স্থগিত/i.test(lower) &&
      /account|অ্যাকাউন্ট|একাউন্ট/i.test(lower)
    )
      add(
        'suspension',
        'Account suspension threat',
        'The message threatens loss of account access.',
        15,
      );
    if (/\b(?:lottery|won|winner|prize)\b|লটারি|পুরস্কার|জিতেছেন/i.test(lower))
      add(
        'prize',
        'Prize or lottery claim',
        'Unexpected prize claims are a common scam pattern.',
        15,
      );
    if (
      /send money|pay now|payment required|taka (?:pathan|din)|টাকা পাঠান|পেমেন্ট করুন|ফি দিন/i.test(
        lower,
      )
    )
      add('payment', 'Payment request', 'The content requests a transfer or upfront payment.', 20);
    if (urls.length && evidence.some((e) => e.id === 'credentials'))
      add(
        'link-credentials',
        'Link with credential request',
        'A sensitive-information request appears together with a link.',
        10,
      );
  }
  const score = Math.min(
    100,
    evidence.reduce((s, e) => s + e.weight, 0),
  );
  return finish({
    id: randomUUID(),
    kind,
    score,
    level: '',
    threatType: '',
    evidence,
    checks: [
      {
        name: 'Local rules',
        status: 'complete',
        detail: 'URL structure and language rules; no destination was opened.',
      },
    ],
    explanation: '',
    aiExplanation: null,
    recommendation: '',
    urls: [...new Set(urls)],
    phones: extractPhones(text),
    createdAt: new Date().toISOString(),
    preview: kind === 'url' ? redactUrl(urls[0] || input) : 'Message content hidden',
    ...(kind === 'screenshot' ? { extractedText: input } : {}),
  });
}
export function redactUrl(url: string) {
  try {
    const u = normalizeUrl(url);
    return u.origin + u.pathname.slice(0, 80) + (u.search ? '?[redacted]' : '');
  } catch {
    return '[invalid URL]';
  }
}
export function finish(r: ScanResult): ScanResult {
  r.score = Math.max(0, Math.min(100, r.score));
  r.level =
    r.score >= 75
      ? 'Critical Risk'
      : r.score >= 50
        ? 'High Risk'
        : r.score >= 25
          ? 'Caution'
          : 'Low Risk';
  r.threatType = r.evidence.some((e) => e.id === 'credentials')
    ? 'Credential theft'
    : r.evidence.some((e) => e.id.startsWith('brand:'))
      ? 'Possible impersonation'
      : r.evidence.some((e) => e.id === 'prize')
        ? 'Prize scam indicators'
        : r.evidence.length
          ? 'Suspicious indicators'
          : 'No strong indicators';
  r.explanation = r.evidence.length
    ? r.evidence.map((e) => e.title).join('. ') + '.'
    : 'No strong scam indicators were found by the completed checks. This does not establish that the content is safe.';
  r.recommendation =
    r.score >= 50
      ? 'Do not open the link or provide OTP, PIN, passwords or payment information. Contact the service through its official app.'
      : r.score >= 25
        ? 'Pause and verify the sender through an independent official channel before taking action.'
        : 'Stay cautious. Verify unexpected requests and never share OTPs, PINs or passwords.';
  return r;
}
