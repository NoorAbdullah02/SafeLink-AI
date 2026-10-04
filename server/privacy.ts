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
  let text = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]');
  for (const raw of extractUrls(text)) {
    try {
      text = text.split(raw).join(normalizeUrl(raw).origin);
    } catch {
      text = text.split(raw).join('[link removed]');
    }
  }
  // Preserve placeholders as complete units on repeated history/provider passes.
  return text.split(/(\[(?:secret|number|email|link) removed\])/gi).map((part) => {
    if (/^\[(?:secret|number|email|link) removed\]$/i.test(part)) return part;
    return part
      .replace(/\b((?:otp|pin|password|passcode|token|secret)\b(?:\s*(?:is\b|[:=])\s*|\s+))([^\s,.;!?]+)/gi, (match, prefix: string, candidate: string) => {
        // A conjunction or ordinary safety term is not a credential value.
        if (!/[:=]/.test(prefix) && /^(?:or|and|to|for|from|with|your|my|our|the|a|an|should|must|can|never|not|private|safe|request|requested|requests|protection|security|information|removal|removed|otp|pin|password|passcode|token|secret)$/i.test(candidate)) return match;
        return prefix + '[secret removed]';
      })
      .replace(/[\p{N}][\p{N}\s+-]{2,}[\p{N}]/gu, '[number removed]');
  }).join('');
}
