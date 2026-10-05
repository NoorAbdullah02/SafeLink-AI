import { extractUrls, normalizeUrl, credentialRequestDetail } from './engine.js';
import type { ScanResult } from '../shared/types.js';

export function privateHistoryResult(result: ScanResult): ScanResult {
  const urls = result.urls.flatMap((value) => {
    try { return [normalizeUrl(value).origin]; } catch { return []; }
  });
  return {
    ...result,
    extractedText: undefined,
    aiExplanation: null,
    urls,
    phones: [],
    preview: result.kind === 'url' && urls[0] ? urls[0] : 'Message content hidden',
    evidence: result.evidence.map((entry) => ({
      ...entry,
      detail: entry.id === 'credentials' && entry.source === 'local'
        ? credentialRequestDetail
        : sanitizeExternalText(entry.detail),
    })),
  };
}

// This reduces accidental disclosure; it cannot identify every secret in free text.
export function sanitizeExternalText(value: string): string {
  let text = value;
  // The ten-link local scan limit must never limit privacy redaction.
  for (const raw of extractUrls(text, Number.POSITIVE_INFINITY)) {
    try {
      text = text.split(raw).join(normalizeUrl(raw).origin);
    } catch {
      text = text.split(raw).join('[link removed]');
    }
  }
  // Redact full URLs before email-like userinfo can break their recognition.
  text = text.replace(/[\p{L}\p{M}\p{N}._%+-]+@[\p{L}\p{M}\p{N}.-]+\.[\p{L}\p{M}]{2,}/giu, '[email removed]');
  // Preserve placeholders as complete units on repeated history/provider passes.
  return text.split(/(\[(?:secret|number|email|link) removed\])/gi).map((part) => {
    if (/^\[(?:secret|number|email|link) removed\]$/i.test(part)) return part;
    return part
      .replace(/(?<![\p{L}\p{N}_])((?:otp|pin|password|passcode|token|secret|ওটিপি|পিন|পাসওয়ার্ড|পাসওয়ার্ড)(?![\p{L}\p{N}_])(?:\s*(?:is\b|হলো|[:=])\s*|\s+))("[^"\r\n]*"|'[^'\r\n]*'|[^\s]+)/giu, (match, prefix: string, candidate: string) => {
        // A conjunction or ordinary safety term is not a credential value.
        const word = candidate.replace(/[.,!?;:।]+$/u, '');
        if (/^[:=]+$/.test(candidate)) return match;
        if (!/[:=]/.test(prefix) && /^(?:or|and|to|for|from|with|your|my|our|the|a|an|should|must|can|never|not|private|safe|request|requested|requests|protection|security|information|removal|removed|otp|pin|password|passcode|token|secret|বা|এবং|কখনো|কখনও|কাউকে|দেবেন|দিন|দেওয়া|দেওয়া|পাঠাবেন|শেয়ার|শেয়ার|গোপন|ওটিপি|পিন|পাসওয়ার্ড|পাসওয়ার্ড)$/iu.test(word)) return match;
        return prefix + '[secret removed]';
      })
      .replace(/[\p{N}][\p{N}\s+-]{2,}[\p{N}]/gu, '[number removed]');
  }).join('');
}
