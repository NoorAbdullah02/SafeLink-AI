export type ScanKind = 'url' | 'message' | 'qr' | 'screenshot';
export type Evidence = {
  id: string;
  source: 'local' | 'community' | 'intelligence';
  title: string;
  detail: string;
  weight: number;
};
export type Check = {
  name: string;
  status: 'complete' | 'unavailable' | 'skipped';
  detail: string;
};
export type ScanResult = {
  id: string;
  kind: ScanKind;
  score: number;
  level: string;
  threatType: string;
  evidence: Evidence[];
  checks: Check[];
  explanation: string;
  aiExplanation: string | null;
  recommendation: string;
  urls: string[];
  phones: string[];
  extractedText?: string;
  createdAt: string;
  saved?: boolean;
  preview: string;
  persisted?: boolean;
};
export type Brand = { id: string; name: string; aliases: string[]; domains: string[] };
export const categories = [
  'Phishing',
  'Fake Payment',
  'Account Theft',
  'OTP Scam',
  'Fake Prize',
  'Impersonation',
  'Other',
] as const;
export const demos = [
  {
    title: 'Banglish account warning',
    kind: 'message' as ScanKind,
    text: 'Apnar bKash account bondho hoye jabe! Ekhoni https://bkash-verify.example/login e apnar PIN din.',
  },
  {
    title: 'Bangla prize message',
    kind: 'message' as ScanKind,
    text: 'অভিনন্দন! আপনি লটারি জিতেছেন। পুরস্কার পেতে এখনই টাকা পাঠান এবং OTP দিন। https://prize.example/claim',
  },
  {
    title: 'Look-alike domain',
    kind: 'url' as ScanKind,
    text: 'https://bkash-secure.example/verify',
  },
  {
    title: 'Neutral message',
    kind: 'message' as ScanKind,
    text: 'আজ বিকেল পাঁচটায় লাইব্রেরিতে দেখা হবে। কোনো পরিবর্তন হলে জানিও।',
  },
];
