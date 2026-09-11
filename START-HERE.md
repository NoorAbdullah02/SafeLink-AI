# SafeLink AI — শুরু করার নির্দেশনা

এই folder-টাই তোমার GitHub repository-তে project root হিসেবে রাখবে।

## Website চালানো

1. Node.js 22.12+ এবং pnpm 10 install করো।
2. এই folder-এ terminal খোলো।
3. `pnpm install` চালাও।
4. `.env.example` copy করে `.env` বানাও।
5. `pnpm dev` চালাও।
6. Browser-এ `http://localhost:5173` খোলো।

প্রথমে temporary demo mode-এ website চলবে। এতে আসল scanner কাজ করে, কিন্তু server restart হলে account/history মুছে যায়। স্থায়ী data-এর জন্য Neon connection দিতে হবে।

## নিজের account ও services যুক্ত করা

- `.env`-এ Neon-এর `DATABASE_URL` বসাও, `DEMO_MEMORY=false` করো, তারপর `pnpm db:migrate` চালাও।
- Brevo key ও verified sender দিলে verification/reset/alert email চলবে।
- AI এবং threat-intelligence key দিলে optional external checks চালু করা যাবে।
- কোনো key GitHub-এ দেবে না। `.env` ইতিমধ্যেই ignore করা আছে।

## Mobile app

`mobile/`-এ Android/iOS Flutter source আছে। Flutter ও Android SDK setup করে `flutter pub get`, তারপর `flutter run --dart-define=API_URL=http://10.0.2.2:3001` চালাও (Android emulator)। নিজের ফোনে চালালে PC-এর LAN IP বা deployed HTTPS API URL ব্যবহার করো।

Release signing-এর জন্য নিজের keystore লাগবে। iOS build করতে Mac/Xcode লাগবে।

## GitHub ও deployment

তোমার repository: `https://github.com/NoorAbdullah02/SafeLink-AI.git`

Push command ও hosting setup আছে [deployment guide](docs/DEPLOYMENT.md)-এ। এখানে কোনো GitHub push বা public deployment করা হয়নি।

কোন কাজ পরীক্ষা করা হয়েছে এবং কোনটি credentials/device ছাড়া বাকি আছে: [validation record](docs/VALIDATION.md)।
