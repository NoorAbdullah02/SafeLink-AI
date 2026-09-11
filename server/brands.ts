import type { Brand } from '../shared/types.js';
export const defaultBrands: Brand[] = [
  { id: 'bkash', name: 'bKash', aliases: ['bkash', 'বিকাশ'], domains: ['bkash.com'] },
  { id: 'nagad', name: 'Nagad', aliases: ['nagad', 'নগদ'], domains: ['nagad.com.bd'] },
  {
    id: 'rocket',
    name: 'Rocket',
    aliases: ['dutchbanglabank', 'rocket', 'রকেট'],
    domains: ['dutchbanglabank.com'],
  },
  {
    id: 'google',
    name: 'Google',
    aliases: ['google', 'gmail'],
    domains: ['google.com', 'gmail.com'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    aliases: ['facebook', 'ফেসবুক'],
    domains: ['facebook.com', 'fb.com'],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    aliases: ['microsoft', 'outlook'],
    domains: ['microsoft.com', 'live.com', 'outlook.com'],
  },
  { id: 'paypal', name: 'PayPal', aliases: ['paypal'], domains: ['paypal.com'] },
];
