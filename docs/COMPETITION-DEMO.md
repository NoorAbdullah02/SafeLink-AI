# SafeLink competition demo

প্রথম পুরস্কারের ফল judges ও competition rules-এর ওপর নির্ভর করে। লক্ষ্য হলো working feature, প্রয়োজন, evidence ও সীমাবদ্ধতা পরিষ্কার করে দেখানো। বানানো accuracy, live national statistics বা guaranteed recovery দেখাবেন না।

## তিন মিনিটের demo

1. **সমস্যা, ২০ সেকেন্ড:** “লিঙ্ক, মেসেজ বা QR দেখে বোঝা কঠিন হতে পারে কোথায় প্রতারণার সংকেত আছে। SafeLink ক্লিক করার আগে সেই সংকেত ও করণীয় বোঝাতে সাহায্য করে।”
2. **Scan, ৬০ সেকেন্ড:** নিচের Banglish sample দিন। PIN request, urgency ও look-alike domain-এর evidence দেখান। External checks বন্ধ রেখে local rules-এর ফল দেখান।
3. **ছবি, ৪০ সেকেন্ড:** `demo-assets/controlled-qr.png` দিয়ে decoded destination দেখান। `demo-assets/controlled-message.png` দিয়ে ছবির pixels থেকে পাওয়া OCR text ও evidence দেখান। এগুলো controlled examples বলে জানান।
4. **Privacy ও phone, ৩০ সেকেন্ড:** External opt-in, redacted history, mobile layout এবং ফোনের app-এ একই API result দেখান। Physical-phone rehearsal আগে সম্পন্ন হতে হবে।
5. **সীমাবদ্ধতা, ৩০ সেকেন্ড:** Neutral message দেখান। বলুন, “Low Risk নিরাপত্তার সনদ নয়। আমরা destination খুলি না, bank account বন্ধ করি না। Software tests detection accuracy প্রমাণ করে না।”

## Controlled inputs

| Input | কী দেখাবেন |
|---|---|
| `Apnar bKash account bondho hoye jabe! Ekhoni https://bkash-verify.example/login e apnar PIN din.` | Credential request, urgency, account threat, brand look-alike and link. |
| `অভিনন্দন! আপনি লটারি জিতেছেন। পুরস্কার পেতে এখনই টাকা পাঠান এবং OTP দিন। https://prize.example/claim` | Prize/payment/credential language; several signals add up. |
| `https://bkash-secure.example/verify` | Brand look-alike signal. A URL alone can score lower than a message with several indicators. |
| `আজ বিকেল পাঁচটায় লাইব্রেরিতে দেখা হবে। কোনো পরিবর্তন হলে জানিও।` | No strong local indicators; explain remaining uncertainty. |
| `https://www.bkash.com` | Configured-domain match. The website's content has not been inspected or certified. |

`.example` controlled placeholder হিসেবে ব্যবহার করুন। সন্দেহজনক বাস্তব destination খুলবেন না। Exact score মুখস্থ দাবি না করে returned evidence দেখান।

## Judges-এর প্রশ্ন

**AI কোথায়?** মূল scan rules, QR ও OCR দিয়ে চলে। Configured language model ঐচ্ছিক semantic interpretation যোগ করতে পারে। Complete/skipped/unavailable status এবং assistant-এর source দেখানো হয়।

**নিজেদের model train করেছেন? Accuracy কত?** এই version-এ trained scam classifier বা independently measured detection accuracy নেই। Automated tests implementation/privacy behaviour পরীক্ষা করে। Future evaluation-এ independently labelled scam ও benign examples, Bangla/Banglish coverage, false positives/negatives ও independent hold-out set দরকার। Percentage বানাবেন না।

**কী আলাদা?** বাংলা/Banglish patterns, বাংলাদেশি পরিচিত brand-এর look-alike checks, URL/message/QR/screenshot এক জায়গায়, shared web/mobile API, আর result-এর কারণ দেখানো। Working demo-তে দেখান; comparative evidence ছাড়া অন্য product-এর চেয়ে ভালো দাবি করবেন না।

**Data কোথায় যায়?** নিজের SafeLink backend-এ যায়। External checks বন্ধ থাকলে optional AI/Google-এ যায় না। Opt-in হলে কিছু text/URL provider-এ যায়; redaction নিখুঁত নয়। Raw message/OCR text history-তে রাখা হয় না।

**Internet চলে গেলে?** Local backend ও preloaded OCR থাকলে laptop-এ deterministic website demo চলতে পারে। Phone-এর local access একই network ও সঠিক API URL-এর ওপর নির্ভর করে। Cloud database/provider কাজ unavailable হতে পারে।

## জমা দেওয়ার আগে

1. Latest source দিয়ে tests/build চালান; published website-এ fixes deploy করুন। App নতুন করে build ও install করুন।
2. ফোনে camera, gallery, Android share, keyboard, login/logout, history ও server-switch পরীক্ষা করুন।
3. Database history reload/restart persistence যাচাই করুন। AI/email demo চাইলে পরিচয়হীন sample ও সম্মত test recipient ব্যবহার করুন।
4. Short screen recording রাখুন; recorded demo বলে জানান। Local fallback ও charged phone প্রস্তুত রাখুন।
5. Competition rules, time limit, judging criteria ও submission format মিলিয়ে pitch বদলান।
