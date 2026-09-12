import type { AIProvider } from './providers.js';

export interface AssistantResponse {
  reply: string;
  suggestions: string[];
  hotlines: Array<{ name: string; number: string; tag: string }>;
}

export function getCyberExpertResponse(userMessage: string): AssistantResponse {
  const text = userMessage.toLowerCase().trim();

  // 1. MFS / bKash / Nagad / Rocket OTP & PIN Scams
  if (
    text.includes('বিকাশ') ||
    text.includes('নগদ') ||
    text.includes('রকেট') ||
    text.includes('উপায়') ||
    text.includes('bkash') ||
    text.includes('nagad') ||
    text.includes('rocket') ||
    text.includes('pin') ||
    text.includes('পিন') ||
    text.includes('otp') ||
    text.includes('ওটিপি') ||
    text.includes('code') ||
    text.includes('কোড')
  ) {
    return {
      reply: `🚫 **জরুরি নিরাপত্তা সতর্কতা: কাউকে কখনো পিন (PIN) বা ওটিপি (OTP) দেবেন না!**\n\n• **অফিশিয়াল নিয়ম:** বিকাশ, নগদ বা কোনো ব্যাংক কখনোই গ্রাহককে কল দিয়ে ওটিপি, পিন বা পাসওয়ার্ড জানতে চায় না। কোনো ব্যক্তি যদি নিজেকে "কাস্টমার কেয়ার অফিসার" দাবি করেও পিন চায়, তবে সে ১০০% প্রতারক।\n• **তাৎক্ষণিক করণীয়:**\n  ১. অবিলম্বে কল কেটে দিন এবং কোনো লিংকে ক্লিক করবেন না।\n  ২. প্রতারক যদি ইতোমধ্যে তথ্য জেনে ফেলে, তবে সরাসরি আপনার বিকাশ/নগদ অ্যাপে ঢুকে **পরপর ৩ বার ভুল পিন দিন**। এতে অ্যাপটি নিজে থেকেই সাময়িক লক হয়ে যাবে এবং প্রতারক টাকা তুলতে পারবে না।\n  ৩. দ্রুত অফিশিয়াল হটলাইনে কল দিয়ে একাউন্ট সাময়িক ফ্রিজ করান।`,
      suggestions: [
        'বিকাশ একাউন্ট ফ্রিজ করার উপায় কি?',
        '৩ বার ভুল পিন দেওয়ার সেলফ-লক হ্যাক কি?',
        'টাকা খোয়া গেলে জিডি কীভাবে করব?',
      ],
      hotlines: [
        { name: 'bKash Helpline', number: '16247', tag: 'MFS 24/7' },
        { name: 'Nagad Helpline', number: '16167', tag: 'Postal MFS' },
        { name: 'Rocket Helpline', number: '16216', tag: 'DBBL' },
      ],
    };
  }

  // 2. Account Hacked / Facebook / WhatsApp / Social Media Hijack
  if (
    text.includes('facebook') ||
    text.includes('ফেসবুক') ||
    text.includes('whatsapp') ||
    text.includes('হোয়াটসঅ্যাপ') ||
    text.includes('হ্যাক') ||
    text.includes('hack') ||
    text.includes('আইডি হ্যাক') ||
    text.includes('recover') ||
    text.includes('উদ্ধার')
  ) {
    return {
      reply: `🛡️ **সোশ্যাল মিডিয়া একাউন্ট (Facebook/WhatsApp) হ্যাক হলে করণীয়:**\n\n১. **অফিশিয়াল রিকভারি লিঙ্ক:** অবিলম্বে [facebook.com/hacked](https://www.facebook.com/hacked) লিংকে যান এবং "My account is compromised" অপশনে গিয়ে ইমেইল ও ফোন নম্বর যাচাই করে পাসওয়ার্ড রিসেট করুন।\n২. **টু-ফ্যাক্টর অথেনটিকেশন (2FA):** একাউন্ট ফিরে পাওয়া মাত্রই সেটিংস থেকে টু-ফ্যাক্টর অথেনটিকেশন (যেমন Google Authenticator) চালু করুন।\n৩. **পরিচিতদের দ্রুত সতর্ক করুন:** আপনার অন্য কোনো মাধ্যম বা বন্ধুদের মাধ্যমে জানিয়ে দিন যেন আপনার নাম ভাঙিয়ে কেউ টাকা ধার চাইলে না দেয়।\n৪. **পুলিশি সহায়তা:** আইডি উদ্ধার না হলে বা প্রতারক কোনো অনৈতিক পোস্ট দেওয়ার হুমকি দিলে সরাসরি সিআইডি সাইবার পুলিশ সেন্টারে যোগাযোগ করুন।`,
      suggestions: [
        'হ্যাক হওয়া আইডি দিয়ে ব্ল্যাকমেইল করলে কি করব?',
        'অনলাইনে সাইবার ক্রাইম জিডি করার নিয়ম কি?',
        'টু-ফ্যাক্টর অথেনটিকেশন (2FA) চালু করার নিয়ম কি?',
      ],
      hotlines: [
        { name: 'CID Cyber Police Center', number: '01320000888', tag: 'Cyber CID' },
        { name: 'National Emergency', number: '999', tag: 'Toll-Free Police' },
      ],
    };
  }

  // 3. Blackmail / Harassment / Fake Video / Photo Threats
  if (
    text.includes('ব্ল্যাকমেইল') ||
    text.includes('blackmail') ||
    text.includes('ছবি') ||
    text.includes('ভিডিও') ||
    text.includes('হুমকি') ||
    text.includes('threat') ||
    text.includes('মানহানি') ||
    text.includes('টাকা দাবি')
  ) {
    return {
      reply: `🚨 **সাইবার ব্ল্যাকমেইল ও অনলাইনের হুমকির বিরুদ্ধে আইনি সুরক্ষা গাইড:**\n\n১. **প্রতারককে ১ টাকাও পাঠাবেন না:** একবার টাকা দিলে প্রতারক ক্রমাগত আরও বেশি টাকা দাবি করবে। টাকা দিয়ে ব্ল্যাকমেইল থামানো যায় না।\n২. **ডিজিটাল প্রমাণ সুরক্ষিত রাখুন:** চ্যাট হিস্ট্রি, হুমকি দেওয়া অডিও মেসেজ, প্রোফাইল ইউআরএল এবং লেনদেনের স্ক্রিনশট ভালো করে ক্লাউডে বা ড্রাইভে ব্যাকআপ রাখুন। চ্যাট ডিলিট করবেন না।\n৩. **পুলিশ সাইবার সাপোর্ট ফর উইমেন (PCSF):** ভুক্তভোগী নারী হলে বাংলাদেশ পুলিশের বিশেষ হেল্পলাইন **০১৩২০০০০৮৮৮** বা ফেসবুক পেজে যোগাযোগ করুন (সম্পূর্ণ গোপনীয়তা বজায় রাখা হয়)।\n৪. **সাইবার নিরাপত্তা আইন ২০২৩:** এটি একটি জামিন-অযোগ্য গুরুতর অপরাধ। নিকটস্থ থানায় গিয়ে দ্রুত জিডি বা এজাহার দায়ের করুন।`,
      suggestions: [
        'পুলিশ সাইবার সাপোর্ট ফর উইমেন (PCSF) কীভাবে কাজ করে?',
        'সাইবার ক্রাইম জিডি করার নমুনা ড্রাফট কোথায় পাব?',
        'প্রতারকের বিকাশ নম্বর কীভাবে ব্লক করাব?',
      ],
      hotlines: [
        { name: 'Police Cyber Support (PCSF)', number: '01320000888', tag: 'Women Support' },
        { name: 'National Police Emergency', number: '999', tag: 'Emergency' },
        { name: 'BTRC Call & Cyber Desk', number: '100', tag: 'Telecom' },
      ],
    };
  }

  // 4. Money Lost / Stolen / Scam Transfer (Golden Hour Guidance)
  if (
    text.includes('টাকা চলে গেছে') ||
    text.includes('টাকা কেটে') ||
    text.includes('টাকা পাঠিয়ে') ||
    text.includes('প্রতারিত') ||
    text.includes('scammed') ||
    text.includes('money lost') ||
    text.includes('টাকা ফেরত')
  ) {
    return {
      reply: `⚡ **টাকা খোয়া গেলে প্রথম ৩০ মিনিট (Golden Hour) করণীয়:**\n\n১. **তাৎক্ষণিক ক্যাশ-আউট বন্ধ করুন:** প্রতারক টাকা পাঠানোর সাথে সাথেই ক্যাশ-আউট করে ফেলতে পারে। এখনই সংশ্লিষ্ট এমএফএস হেল্পলাইনে (বিকাশ ১৬২৪৭, নগদ ১৬১৬৭) কল করে বলুন: *"আমি একটি প্রতারণার শিকার হয়েছি, অমুক ট্রানজেকশন আইডিতে পাঠানো টাকা অবিলম্বে ফ্রিজ/হোল্ড করুন।"*\n২. **ট্রানজেকশন স্টেটমেন্ট সংরক্ষণ:** অ্যাপ থেকে ট্রানজেকশন আইডি (TrxID), সময় ও প্রতারকের নম্বর স্ক্রিনশট নিন।\n৩. **থানায় সাইবার জিডি দায়ের:** SafeLink AI-এর **১-ক্লিক পুলিশ জিডি জেনারেটর** দিয়ে তৎক্ষণাৎ প্রস্তুতকৃত জিডি কপি নিয়ে থানায় জমা দিন। ব্যাংক বা এমএফএস আদালত/পুলিশি রিকুইজিশন ছাড়া সম্পূর্ণ টাকা ফেরত দিতে পারে না, তাই জিডি করা বাধ্যতামূলক।`,
      suggestions: [
        'SafeLink থেকে ১-ক্লিক পুলিশ জিডি বানাব কীভাবে?',
        'বিকাশ ও নগদ হটলাইনে কীভাবে একাউন্ট ফ্রিজ করব?',
        'বিটিআরসিতে সিম ব্লক করার নিয়ম কি?',
      ],
      hotlines: [
        { name: 'bKash Emergency Freeze', number: '16247', tag: 'MFS' },
        { name: 'Nagad Emergency Freeze', number: '16167', tag: 'Postal MFS' },
        { name: 'National Emergency', number: '999', tag: 'Police' },
      ],
    };
  }

  // 5. Filing Online Police GD / Legal Complaint
  if (
    text.includes('জিডি') ||
    text.includes('gd') ||
    text.includes('অভিযোগ') ||
    text.includes('মামলা') ||
    text.includes('আইন') ||
    text.includes('পুলিশ') ||
    text.includes('police')
  ) {
    return {
      reply: `📝 **সাইবার ক্রাইম সাধারণ ডায়েরি (Police GD) করার নির্দেশিকা:**\n\n১. **SafeLink 1-Click GD Generator:** আমাদের অ্যাপের যেকোনো স্ক্যান রেজাল্টে অথবা রেজাল্ট স্ক্রিনে থাকা **"১-ক্লিক পুলিশ জিডি ড্রাফট (Police GD)"** বাটনে ট্যাপ করলেই স্বয়ংক্রিয়ভাবে সঠিক আইনি ধারাসহ একটি পূর্ণাঙ্গ বাংলা আবেদনপত্র তৈরি হয়ে যায়।\n২. **প্রয়োজনীয় কাগজপত্র:** আপনার জাতীয় পরিচয়পত্র (NID), সিমের মালিকানা, প্রতারণামূলক মেসেজ/লিঙ্কের স্ক্রিনশট এবং আর্থিক লেনদেনের ট্রানজেকশন স্টেটমেন্ট প্রিন্ট কপি।\n৩. **অনলাইন জিডি পোর্টাল:** গুগল প্লে স্টোর থেকে বাংলাদেশ পুলিশের অফিসিয়াল **Online GD** অ্যাপ দিয়ে ঘরে বসেই জিডি সাবমিট করতে পারবেন, অথবা সরাসরি নিকটস্থ থানার ডিউটি অফিসারের কাছে জমা দিতে পারেন।`,
      suggestions: [
        'জিডি করার সময় কী কী প্রমাণ সাথে নিতে হবে?',
        'টাকা উদ্ধারের আইনি প্রক্রিয়া কী?',
        'বিটিআরসি ১০০ হেল্পলাইনে রিপোর্ট কীভাবে করব?',
      ],
      hotlines: [
        { name: 'National Emergency Dispatch', number: '999', tag: '24/7 Police' },
        { name: 'CID Cyber Crime Unit', number: '01320000888', tag: 'CID Desk' },
      ],
    };
  }

  // 6. Lottery, Job Offer, Telegram Task, Prize Scams
  if (
    text.includes('লটারি') ||
    text.includes('পুরস্কার') ||
    text.includes('চাকরি') ||
    text.includes('job') ||
    text.includes('টেলিগ্রাম') ||
    text.includes('telegram') ||
    text.includes('টাস্ক')
  ) {
    return {
      reply: `⚠️ **অনলাইন লটারি, ফেক চাকরি ও টেলিগ্রাম টাস্ক প্রতারণার ফাঁদ:**\n\n• **সাধারণ প্রতারণার ধরন:** প্রতারকরা টেলিগ্রাম বা হোয়াটসঅ্যাপে যোগাযোগ করে ইউটিউব ভিডিও লাইক দেওয়া বা রিভিউ দেওয়ার বিনিময়ে প্রতিদিন ১,০০০–৩,০০০ টাকা আয়ের লোভ দেখায়। প্রথমে ছোট অংক দিয়ে বিশ্বাস অর্জন করে, পরবর্তীতে "ভিআইপি টাস্ক" বা "ডিপোজিট" এর নামে ৫০,০০০ থেকে কয়েক লাখ টাকা হাতিয়ে নেয়।\n• **লটারি প্রতারণা:** কোনো লটারির টিকিট না কেটে কোনো পুরস্কার পাওয়া সম্ভব নয়! "প্রসেসিং ফি" বা "ট্যাক্স" এর নামে কোনো টাকা পাঠাবেন না।\n• **সুরক্ষা নিয়ম:** কোনো বৈধ প্রতিষ্ঠান কাজের জন্য অগ্রিম টাকা চায় না। সন্দেহজনক লিংক SafeLink AI স্ক্যানারে পেস্ট করে পরীক্ষা করুন।`,
      suggestions: [
        'টেলিগ্রাম জব স্ক্যাম চিনব কীভাবে?',
        'বিকাশ spoof লিংক পরীক্ষা করব কীভাবে?',
        'অফিশিয়াল নিরাপদ সাইট চিনব কীভাবে?',
      ],
      hotlines: [
        { name: 'BTRC Fraud Desk', number: '100', tag: 'Govt Helpline' },
        { name: 'CID Cyber Police', number: '01320000888', tag: 'Investigation' },
      ],
    };
  }

  // 7. Malicious APK / Fake App Installation Threats
  if (
    text.includes('apk') ||
    text.includes('অ্যাপ') ||
    text.includes('install') ||
    text.includes('ডাউনলোড') ||
    text.includes('ফাইল পাঠিয়েছে')
  ) {
    return {
      reply: `🛑 **বিপজ্জনক এপিকে (APK) বা ফাইল সংক্রান্ত সতর্কতা:**\n\n• **কখনো অচেনা APK ফাইল ইনস্টল করবেন না:** হোয়াটসঅ্যাপ বা মেসেঞ্জারে আসা কোনো ফাইল (যেমন: *bkash_update.apk*, *police_notice.apk* ইত্যাদি) কখনোই ফোনে ইন্সটল করবেন না। এটি একটি ম্যালওয়্যার/ট্রোজান যা আপনার ফোনের ওটিপি ও মেসেজ চুরি করে হ্যাকারের কাছে পাঠিয়ে দেয়।\n• **ইতোমধ্যে ইনস্টল করে থাকলে করণীয়:**\n  ১. অবিলম্বে ফোনের ইন্টারনেট (WiFi ও মোবাইল ডাটা) বন্ধ করুন এবং ফোনটি **Flight Mode** করুন।\n  ২. ফোনের Settings > Apps-এ গিয়ে সন্দেহজনক অ্যাপটি আনইনস্টল করুন।\n  ৩. অন্য নিরাপদ ডিভাইস থেকে দ্রুত আপনার বিকাশ/নগদ/ফেসবুকের পাসওয়ার্ড পরিবর্তন করুন।`,
      suggestions: [
        'ফোনে ম্যালওয়্যার ঢুকলে কীভাবে রিমুভ করব?',
        'বিকাশ একাউন্ট সাময়িক সেলফ-লক করার উপায় কি?',
        'অফিশিয়াল গুগল প্লে স্টোর ছাড়া অ্যাপ নামালে কী ক্ষতি?',
      ],
      hotlines: [
        { name: 'CID Cyber Police', number: '01320000888', tag: 'Malware Help' },
        { name: 'National Emergency', number: '999', tag: 'Emergency' },
      ],
    };
  }

  // 8. Fake Courier / Parcel / Delivery SMS Scams
  if (
    text.includes('পার্সেল') ||
    text.includes('parcel') ||
    text.includes('কুরিয়ার') ||
    text.includes('courier') ||
    text.includes('ডেলিভারি') ||
    text.includes('সুন্দরবন') ||
    text.includes('রেডএক্স') ||
    text.includes('পাঠাও')
  ) {
    return {
      reply: `📦 **ফেক কুরিয়ার ও পার্সেল এসএমএস প্রতারণা সতর্কতা:**\n\n• **প্রতারণার কৌশল:** আপনাকে এসএমএস দিয়ে বলা হয়— *"আপনার একটি পার্সেল আটকে আছে, ঠিকানা আপডেট করতে বা ২০-৫০ টাকা ডেলিভারি ফি দিতে লিংকে যান।"*\n• **আসল উদ্দেশ্য:** লিংকে ঢুকলে হুবহু ব্যাংক বা বিকাশ পেমেন্ট গেটওয়ের মতো ভুয়া ফিশিং পেজ খুলে যায় এবং আপনার কার্ড বা পিন চুরি করা হয়।\n• **নিরাপদ পদক্ষেপ:** কোনো ডেলিভারি মেসেজের লিংকে না ঢুকে সরাসরি সংশ্লিষ্ট কুরিয়ারের অফিশিয়াল নম্বরে ফোন দিয়ে ট্র্যাকিং আইডি যাচাই করুন।`,
      suggestions: [
        'পার্সেল ফিশিং লিংক SafeLink দিয়ে কীভাবে স্ক্যান করব?',
        'ভুল করে পিন দিলে সাথে সাথে কী করতে হবে?',
        'বিটিআরসিতে প্রতারক সিম ব্লক করব কীভাবে?',
      ],
      hotlines: [
        { name: 'BTRC Cyber Helpline', number: '100', tag: 'Telecom' },
        { name: 'National Emergency', number: '999', tag: 'Police' },
      ],
    };
  }

  // 9. Crypto, Forex & High-Return Investment Scams
  if (
    text.includes('crypto') ||
    text.includes('ক্রিপ্টো') ||
    text.includes('ট্রেডিং') ||
    text.includes('trading') ||
    text.includes('বিনিয়োগ') ||
    text.includes('মুনাফা') ||
    text.includes('forex')
  ) {
    return {
      reply: `📈 **অনলাইন ট্রেডিং ও ভুয়া ইনভেস্টমেন্ট প্রতারণা সতর্কতা:**\n\n• **আইনি বিধান:** বাংলাদেশে বাংলাদেশ ব্যাংক কর্তৃক অনুমোদনহীন যেকোনো ক্রিপ্টোকারেন্সি (Bitcoin, USDT ইত্যাদি) বা ফরেক্স ট্রেডিং প্ল্যাটফর্ম সম্পূর্ণ অবৈধ এবং এর মাধ্যমে অর্থপাচার মানিলন্ডারিং প্রতিরোধ আইনে শাস্তিযোগ্য অপরাধ।\n• **প্রতারণার ফাঁদ:** অনলাইনে "প্রতিদিন ১০০০ টাকা দিলে ২০০০ টাকা লাভ" এমন কোনো বৈধ ব্যবসা নেই। এগুলো পঞ্জি স্কিম বা পিরামিড জালিয়াতি।\n• **করণীয়:** কোনো অজানা বিদেশি বা দেশি অ্যাপে টাকা বা ক্রিপ্টো ডিপোজিট করবেন না। কোনো প্রতারক চক্রের খপ্পরে পড়লে সিআইডি সাইবার পুলিশকে জানান।`,
      suggestions: [
        'অনলাইন ইনভেস্টমেন্ট স্ক্যাম কীভাবে শনাক্ত করব?',
        'টাকা খোয়া গেলে জিডি করার সঠিক নিয়ম কি?',
        'সিআইডি ফিন্যান্সিয়াল ক্রাইম ইউনিটে যোগাযোগ কীভাবে করব?',
      ],
      hotlines: [
        { name: 'CID Financial Crime', number: '01320000888', tag: 'CID Desk' },
        { name: 'National Police Emergency', number: '999', tag: '24/7 Police' },
      ],
    };
  }

  // Default / Open Knowledge Base Advisor
  return {
    reply: `👋 **নমস্কার! আমি SafeLink সাইবার এআই সহকারী (Cyber Copilot)।**\n\nআমি আপনাকে অনলাইন সাইবার নিরাপত্তা, ফিশিং লিংক শনাক্তকরণ, আর্থিক প্রতারণা প্রতিরোধ এবং আইনি পদক্ষেপে শতভাগ নির্ভুল পরামর্শ দিতে প্রস্তুত।\n\n🛡️ **দ্রুত কিছু জরুরি সাইবার পরামর্শ:**\n• যে কোনো সন্দেহজনক মেসেজ বা লিঙ্ক আমাদের হোমপেজের **SafeLink AI স্ক্যানারে** পেস্ট করে পরীক্ষা করে নিন।\n• কখনোই কারো সাথে নিজের পিন (PIN), পাসওয়ার্ড বা ওটিপি (OTP) শেয়ার করবেন না।\n• অপ্রত্যাশিত লটারি বা অফার পেলে আগে যাচাই করুন।\n\nআপনার যেকোনো সাইবার সমস্যা বা প্রশ্ন নিচে বাংলায় বা বাংলিশে লিখুন!`,
    suggestions: [
      'বিকাশ/নগদ পিন কেউ চাইলে কি করব?',
      'আমার একাউন্ট হ্যাক হলে দ্রুত কি করব?',
      'সাইবার ক্রাইম জিডি করার নিয়ম কি?',
      'টাকা প্রতারিত হলে তাৎক্ষণিক উদ্ধার প্রক্রিয়া কি?',
    ],
    hotlines: [
      { name: 'National Emergency', number: '999', tag: 'Police' },
      { name: 'bKash Hotline', number: '16247', tag: 'MFS' },
      { name: 'BTRC Helpline', number: '100', tag: 'Telecom' },
    ],
  };
}

export async function askCyberAssistant(
  userMessage: string,
  _history?: Array<{ role: string; content: string }>,
): Promise<AssistantResponse> {
  const mistralKey = process.env.MISTRAL_KEY || process.env.MISTRIAL_KEY;
  const apiKey = process.env.LLM_API_KEY || mistralKey;
  const base = process.env.LLM_BASE_URL || (mistralKey ? 'https://api.mistral.ai/v1' : 'https://api.openai.com/v1');
  const model = process.env.LLM_MODEL || (mistralKey ? 'mistral-small-latest' : 'gpt-4o-mini');

  // If LLM configured, query it; otherwise fall back cleanly to our expert rule base
  if (apiKey && base) {
    try {
      const response = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are SafeLink AI Cyber Safety Assistant, a polite, authoritative, 100% accurate Bangladeshi cybersecurity and digital law expert. STRICT RULES: Never hallucinate or give vague advice. Never recommend paying scammers, unofficial tools, or unauthorized recovery hackers. Give structured, step-by-step practical Bangla guidance. Emphasize that MFS (bKash/Nagad) NEVER asks for PIN/OTP. Mention official hotlines accurately: bKash (16247), Nagad (16167), Police (999), BTRC (100), CID Cyber Police (01320000888), Police Cyber Support for Women (01320000888).',
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
      });
      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && typeof content === 'string' && content.length > 20) {
          const fallback = getCyberExpertResponse(userMessage);
          return {
            reply: content,
            suggestions: fallback.suggestions,
            hotlines: fallback.hotlines,
          };
        }
      }
    } catch {
      // Fallback cleanly
    }
  }

  return getCyberExpertResponse(userMessage);
}
