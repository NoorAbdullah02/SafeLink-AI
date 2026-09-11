import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'api.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(SafeLinkApp());
}

const green = Color(0xff19876b);

class SafeLinkApp extends StatelessWidget {
  const SafeLinkApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: 'SafeLink AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: green),
          scaffoldBackgroundColor: Color(0xfff5f7f9),
          useMaterial3: true,
          inputDecorationTheme: InputDecorationTheme(
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)))),
      darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
              seedColor: green, brightness: Brightness.dark),
          useMaterial3: true),
      home: Workspace());
}

class Workspace extends StatefulWidget {
  const Workspace({super.key});
  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  final api = SafeLinkApi();
  final input = TextEditingController();
  static const shareChannel = MethodChannel('safelink/share');
  Map<String, dynamic>? user, result;
  int page = 0;
  String kind = 'url', status = 'Connecting…';
  bool external = false, busy = false, simple = false;
  List<dynamic> history = [], contacts = [], alerts = [];
  @override
  void initState() {
    super.initState();
    initialize();
  }

  Future<void> initialize() async {
    try {
      await api.restore();
      final health = await api.call('/health');
      if (api.token != null) {
        try {
          user = Map<String, dynamic>.from(await api.call('/me'));
          simple = user?['simpleMode'] == true;
        } catch (_) {
          api.token = null;
        }
      }
      if (mounted) {
        setState(() => status = health['storage'] == 'temporary-memory'
            ? 'Temporary demo · data resets on restart'
            : 'Connected to SafeLink');
      }
      if (!kIsWeb && Platform.isAndroid) {
        shareChannel.setMethodCallHandler((call) async {
          if (call.method == 'sharedText') {
            receiveText(call.arguments as String?);
          }
        });
        receiveText(await shareChannel.invokeMethod<String>('getInitialText'));
      }
    } catch (_) {
      if (mounted) {
        setState(() => status = 'Backend unavailable. Check connection.');
      }
    }
  }

  void receiveText(String? text) {
    if (text == null || text.isEmpty || !mounted) return;
    setState(() {
      page = 0;
      kind = text.trim().startsWith('http') && !text.trim().contains(' ')
          ? 'url'
          : 'message';
      input.text = text;
      result = null;
    });
  }

  @override
  void dispose() {
    input.dispose();
    shareChannel.setMethodCallHandler(null);
    super.dispose();
  }

  void message(Object error) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', ''))));
    }
  }

  Future<void> action(Future<void> Function() fn) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await fn();
    } catch (e) {
      message(e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> scanText() async {
    if (input.text.trim().isEmpty) {
      message('Paste a link or message first.');
      return;
    }
    await action(() async {
      final data = await api.scan(input.text.trim(), kind, external);
      if (mounted) setState(() => result = data);
    });
  }

  Future<void> scanImage(String type) async {
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null || !mounted) return;
      await action(() async {
        final data = await api.image(file, type, external);
        if (mounted) {
          setState(() {
            result = data;
            page = 0;
          });
        }
      });
    } catch (e) {
      message(e);
    }
  }

  Future<void> scanCamera() async {
    final value = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => QrCamera()));
    if (value == null || !mounted) return;
    setState(() {
      input.text = value;
      kind = 'message';
      page = 0;
    });
    await action(() async {
      final data = await api.scan(value, 'qr', external);
      if (mounted) setState(() => result = data);
    });
  }

  Future<void> loadAccountData() async {
    if (user == null) return;
    await action(() async {
      final results = await Future.wait(
          [api.call('/scans'), api.call('/contacts'), api.call('/alerts')]);
      if (mounted) {
        setState(() {
          history = results[0];
          contacts = results[1];
          alerts = results[2];
        });
      }
    });
  }

  Future<void> login() async {
    final value = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(builder: (_) => AuthPage(api: api)));
    if (value != null && mounted) {
      setState(() {
        user = value;
        simple = value['simpleMode'] == true;
      });
    }
  }

  Future<void> changeServerUrl() async {
    final newUrl = await showDialog<String>(
        context: context,
        builder: (_) => ServerDialog(initialUrl: api.base));
    if (newUrl != null && mounted) {
      await api.setBaseUrl(newUrl);
      setState(() => status = 'Connecting to ${api.base}…');
      await initialize();
    }
  }

  Widget panel(Widget child) => Card(
      margin: EdgeInsets.only(bottom: 18),
      child: Padding(padding: EdgeInsets.all(22), child: child));
  Widget title(String text) => Padding(
      padding: EdgeInsets.only(bottom: 14),
      child: Text(text,
          style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700)));
  @override
  Widget build(BuildContext context) {
    final content = page == 0
        ? scanner()
        : page == 1
            ? historyPage()
            : page == 2
                ? familyPage()
                : accountPage();
    return Scaffold(
        appBar: AppBar(
            title: Row(children: [
              Icon(Icons.shield_outlined, color: green),
              SizedBox(width: 9),
              Expanded(
                  child: Text('SafeLink AI',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontWeight: FontWeight.w700)))
            ]),
            actions: [
              if (user == null)
                TextButton(onPressed: login, child: Text('Sign in'))
            ]),
        body: SafeArea(
            child: Center(
                child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: 820),
                    child: MediaQuery(
                        data: MediaQuery.of(context).copyWith(
                            textScaler: simple
                                ? TextScaler.linear(
                                    MediaQuery.textScalerOf(context).scale(1) *
                                        1.15)
                                : MediaQuery.textScalerOf(context)),
                        child: ListView(padding: EdgeInsets.all(20), children: [
                          InkWell(
                            onTap: changeServerUrl,
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 4),
                              child: Row(children: [
                                Expanded(
                                  child: Text(status,
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: status.contains('unavailable')
                                              ? Colors.red
                                              : green,
                                          fontWeight: FontWeight.w600)),
                                ),
                                Icon(Icons.tune, size: 16, color: green)
                              ]),
                            ),
                          ),
                          SizedBox(height: 22),
                          ...content,
                          if (busy)
                            Padding(
                                padding: EdgeInsets.all(18),
                                child:
                                    Center(child: CircularProgressIndicator())),
                          SizedBox(height: 20),
                          Text('Risk scores are indicators, not guarantees.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12))
                        ]))))),
        bottomNavigationBar: NavigationBar(
            selectedIndex: page,
            onDestinationSelected: (value) {
              setState(() => page = value);
              if (value == 1 || value == 2) loadAccountData();
            },
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.document_scanner_outlined), label: 'Scan'),
              NavigationDestination(
                  icon: Icon(Icons.history), label: 'History'),
              NavigationDestination(
                  icon: Icon(Icons.favorite_border), label: 'Family'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline), label: 'Account')
            ]));
  }

  List<Widget> scanner() => [
        title('A safer click starts here.'),
        Text(
            'Check links, বাংলা / Banglish messages, QR codes and screenshots.'),
        SizedBox(height: 22),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SegmentedButton<String>(
              showSelectedIcon: false,
              expandedInsets: EdgeInsets.zero,
              style: ButtonStyle(
                  padding: WidgetStatePropertyAll(
                      EdgeInsets.symmetric(horizontal: 8))),
              segments: const [
                ButtonSegment(
                    value: 'url', label: Text('Link'), icon: Icon(Icons.link)),
                ButtonSegment(
                    value: 'message',
                    label: Text('Message'),
                    icon: Icon(Icons.chat_bubble_outline))
              ],
              selected: {kind},
              onSelectionChanged: (value) => setState(() {
                    kind = value.first;
                    result = null;
                  })),
          SizedBox(height: 20),
          TextField(
              controller: input,
              minLines: 3,
              maxLines: 7,
              maxLength: 10000,
              decoration: InputDecoration(
                  labelText:
                      kind == 'url' ? 'Link to analyze' : 'Message to analyze',
                  alignLabelWithHint: true,
                  hintText: kind == 'url'
                      ? 'https://example.com'
                      : 'Paste your message…')),
          SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('External AI & threat checks',
                  style: TextStyle(fontSize: 15)),
              subtitle: Text(
                  'Sends text/URLs to configured providers. Remove private information first.',
                  style: TextStyle(fontSize: 12)),
              value: external,
              onChanged: (v) => setState(() => external = v)),
          Padding(
            padding: EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('⚡ Quick Demo Scenarios:',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade700)),
                SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ActionChip(
                        avatar: Icon(Icons.link, size: 16, color: Colors.red),
                        label: Text('bKash Spoof Link'),
                        onPressed: () => setState(() {
                          kind = 'url';
                          input.text = 'https://bkash-reward.xyz/login';
                          result = null;
                        }),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.chat_bubble_outline,
                            size: 16, color: Colors.orange),
                        label: Text('Banglish PIN Scam'),
                        onPressed: () => setState(() {
                          kind = 'message';
                          input.text =
                              'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.';
                          result = null;
                        }),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.card_giftcard,
                            size: 16, color: Colors.orange),
                        label: Text('Bangla Lottery Scam'),
                        onPressed: () => setState(() {
                          kind = 'message';
                          input.text =
                              'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।';
                          result = null;
                        }),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.check_circle_outline,
                            size: 16, color: green),
                        label: Text('Official Safe Site'),
                        onPressed: () => setState(() {
                          kind = 'url';
                          input.text = 'https://www.bkash.com';
                          result = null;
                        }),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
              onPressed: busy ? null : scanText,
              icon: Icon(Icons.shield_outlined),
              label: Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(busy ? 'Analyzing…' : 'Scan Now'))),
          SizedBox(height: 12),
          Text('Links are never opened automatically.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 12))
        ])),
        Wrap(spacing: 10, runSpacing: 10, children: [
          OutlinedButton.icon(
              onPressed: busy ? null : scanCamera,
              icon: Icon(Icons.qr_code_scanner),
              label: Text('QR camera')),
          OutlinedButton.icon(
              onPressed: busy ? null : () => scanImage('qr'),
              icon: Icon(Icons.qr_code),
              label: Text('QR image')),
          OutlinedButton.icon(
              onPressed: busy ? null : () => scanImage('screenshot'),
              icon: Icon(Icons.image_outlined),
              label: Text('Screenshot'))
        ]),
        SizedBox(height: 22),
        if (result != null) resultPanel(result!),
        if (result == null)
          panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.verified_user_outlined, color: green, size: 30),
            SizedBox(height: 12),
            Text('Understand the warning.',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            SizedBox(height: 8),
            Text(
                'Get a risk score, specific evidence and practical next steps. A padlock alone does not make a website trustworthy.'),
            TextButton(
                onPressed: () => setState(() {
                      kind = 'message';
                      input.text =
                          'Apnar bKash account bondho! Ekhoni https://bkash-verify.example e PIN din.';
                    }),
                child: Text('Try a controlled sample →'))
          ]))
      ];
  Widget resultPanel(Map<String, dynamic> r) {
    final score = (r['score'] as num).toInt();
    final color = score >= 50
        ? Colors.deepOrange
        : score >= 25
            ? Colors.orange
            : green;
    return panel(
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('$score',
            style: TextStyle(
                fontSize: 48, color: color, fontWeight: FontWeight.w700)),
        Text(' /100'),
        SizedBox(width: 18),
        Expanded(
            child: Text(r['level'],
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)))
      ]),
      Text('RISK SCORE · ${r['threatType']}', style: TextStyle(fontSize: 12)),
      SizedBox(height: 14),
      Container(
        padding: EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.shield_outlined, size: 16, color: color),
                SizedBox(width: 6),
                Expanded(
                  child: Text('🇧🇩 সাধারণ মানুষের জন্য সহজ বাংলা পরামর্শ',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: color)),
                ),
              ],
            ),
            SizedBox(height: 8),
            Text(
              score >= 50
                  ? '⚠️ ভুয়া বা প্রতারণামূলক ফাঁদ ধরা পড়েছে!'
                  : score >= 25
                      ? '⚡ কিছু সন্দেহজনক বিষয় লক্ষ্য করা গেছে'
                      : '✅ প্রাথমিক পরীক্ষায় বড় কোনো বিপদের লক্ষণ পাওয়া যায়নি',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: Colors.black87),
            ),
            SizedBox(height: 4),
            Text(
              (r['evidence'] as List).any((e) => e['id'] == 'credentials')
                  ? 'প্রতারকরা আপনার বিকাশ/নগদ/ব্যাংকের গোপন পিন (PIN), ওটিপি বা পাসওয়ার্ড হাতিয়ে নেওয়ার চেষ্টা করছে। কোনো প্রতিষ্ঠান কখনোই আপনার পিন জানতে চায় না।'
                  : (r['evidence'] as List).any((e) => (e['id'] as String).startsWith('brand:'))
                      ? 'আসল ওয়েবসাইটের মতো দেখতে নকল ওয়েবসাইট বানিয়ে প্রতারণা করা হচ্ছে। এটি সম্পূর্ণ অননুমোদিত।'
                      : (r['evidence'] as List).any((e) => e['id'] == 'prize')
                          ? 'লটারি বা ফ্রি পুরস্কারের লোভ দেখিয়ে অর্থ বা গোপন পিন হাতিয়ে নেওয়ার প্রতারণার প্যাটার্ন পাওয়া গেছে।'
                          : score >= 50
                              ? 'এই লিংকে ক্লিক করবেন না এবং কোনো তথ্য দেবেন না। এটি আর্থিক ক্ষতির কারণ হতে পারে।'
                              : 'অপ্রত্যাশিত অনুরোধ সতর্কতার সাথে যাচাই করুন এবং কখনোই কারো সাথে ওটিপি শেয়ার করবেন না।',
              style: TextStyle(fontSize: 12, height: 1.4, color: Colors.black87),
            ),
            SizedBox(height: 8),
            Text('জরুরি হেল্পলাইন: বিকাশ ১৬২৪৭ · নগদ ১৬১৬৭ · পুলিশ ৯৯৯',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: green)),
          ],
        ),
      ),
      Divider(height: 30),
      Text('Why SafeLink is warning you',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      if ((r['evidence'] as List).isEmpty) Text(r['explanation']),
      for (final e in r['evidence'])
        ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.warning_amber, color: color),
            title: Text(e['title']),
            subtitle: Text('${e['detail']}\n${e['source']} evidence')),
      if (r['aiExplanation'] != null) ...[
        Text('AI language interpretation',
            style: TextStyle(fontWeight: FontWeight.bold)),
        Text(r['aiExplanation']),
        Text('AI can be wrong. Technical evidence is listed separately.',
            style: TextStyle(fontSize: 12))
      ],
      Container(
          margin: EdgeInsets.symmetric(vertical: 20),
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: green.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(12)),
          child: Text(r['recommendation'])),
      for (final c in r['checks'])
        ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
                c['status'] == 'complete'
                    ? Icons.check_circle_outline
                    : Icons.info_outline,
                color: green),
            title: Text('${c['name']} · ${c['status']}',
                style: TextStyle(fontSize: 14)),
            subtitle: Text(c['detail'])),
      if (r['extractedText'] != null)
        ExpansionTile(title: Text('Review extracted text'), children: [
          Padding(
              padding: EdgeInsets.all(12),
              child: SelectableText(r['extractedText']))
        ]),
      SizedBox(height: 14),
      FilledButton.tonalIcon(
        icon: Icon(Icons.description_outlined),
        label: Text('Export Cyber Threat Report'),
        onPressed: () => showThreatReport(r),
      ),
      SizedBox(height: 10),
      if (r['persisted'] == true)
        Wrap(spacing: 10, children: [
          TextButton.icon(
              icon: Icon(Icons.bookmark_outline),
              label: Text('Keep scan'),
              onPressed: () => action(() async {
                    await api.call('/scans/${r['id']}',
                        method: 'PATCH', body: {'saved': true});
                    message('Scan kept.');
                  })),
          TextButton.icon(
              icon: Icon(Icons.mail_outline),
              label: Text('Email me an alert'),
              onPressed: () => action(() async {
                    await api.call('/alerts',
                        method: 'POST', body: {'scanId': r['id']});
                    message('Alert sent.');
                  }))
        ]),
      if (r['persisted'] != true)
        Text('This result has not been saved.', style: TextStyle(fontSize: 12))
    ]));
  }

  void showThreatReport(Map<String, dynamic> r) {
    final score = (r['score'] as num).toInt();
    final color = score >= 50
        ? Colors.deepOrange
        : score >= 25
            ? Colors.orange
            : green;
    final id = (r['id'] ?? '').toString();
    final ref = id.length >= 16 ? id.substring(0, 16).toUpperCase() : id.toUpperCase();
    final evidence = (r['evidence'] as List? ?? []);
    final urls = (r['urls'] as List? ?? []).join(', ');
    final phones = (r['phones'] as List? ?? []).join(', ');

    final plainReportText = '''
==================================================
SAFELINK AI CYBER DEFENSE LABS
National Cyber Fraud Assessment & Incident Registry (Bangladesh)
==================================================
INCIDENT REF: $ref
TIMESTAMP: ${DateTime.tryParse(r['createdAt'] ?? '')?.toLocal().toString() ?? DateTime.now().toString()}
THREAT LEVEL: ${r['level']?.toString().toUpperCase()}
RISK INDEX: $score / 100
VECTOR TYPE: ${r['kind']?.toString().toUpperCase()}
TARGET: ${r['preview'] ?? urls}
${phones.isNotEmpty ? 'IDENTIFIED PHONES/MFS: $phones\n' : ''}
FORENSIC FINDINGS:
${evidence.map((e) => '- [${e['id']}] ${e['title']}: ${e['detail']} (+${e['weight']} pts)').join('\n')}

${r['aiExplanation'] != null ? 'AI FRAUD INTERPRETATION:\n${r['aiExplanation']}\n\n' : ''}RECOMMENDED ACTION:
${r['recommendation']}

EMERGENCY FRAUD HELPLINES (BANGLADESH):
- bKash Helpline: 16247
- Nagad Helpline: 16167
- Bangladesh Police Cyber Support: 01320-000888 / 999
==================================================
Official forensic audit record generated by SafeLink AI.
''';

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Container(
          constraints: BoxConstraints(
              maxWidth: 600,
              maxHeight: MediaQuery.of(context).size.height * 0.85),
          padding: EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                        color: green, borderRadius: BorderRadius.circular(8)),
                    child: Icon(Icons.shield_outlined,
                        color: Colors.white, size: 22),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('SAFELINK AI CYBER DEFENSE',
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                letterSpacing: 0.5)),
                        Text('Incident Investigation Report',
                            style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                  IconButton(
                      icon: Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              Divider(height: 24),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: color.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            Text('$score',
                                style: TextStyle(
                                    fontSize: 36,
                                    fontWeight: FontWeight.w800,
                                    color: color)),
                            Text(' /100',
                                style: TextStyle(fontWeight: FontWeight.w600)),
                            SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(r['level'] ?? '',
                                      style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w700)),
                                  Text(r['threatType'] ?? '',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade700)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 14),
                      Text('INCIDENT REFERENCE: $ref',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5)),
                      Text('VECTOR: ${r['kind']?.toString().toUpperCase()}',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade800)),
                      if (r['preview'] != null) ...[
                        SizedBox(height: 4),
                        Text('TARGET: ${r['preview']}',
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                      if (phones.isNotEmpty) ...[
                        SizedBox(height: 4),
                        Text('IDENTIFIED PHONE: $phones',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.blue.shade800)),
                      ],
                      SizedBox(height: 14),
                      Text('FORENSIC EVIDENCE & FINDINGS',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5)),
                      SizedBox(height: 6),
                      if (evidence.isEmpty)
                        Text('No malicious indicators found.',
                            style:
                                TextStyle(fontSize: 12, color: Colors.grey)),
                      for (final e in evidence)
                        Padding(
                          padding: EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.warning_amber_rounded,
                                  size: 16, color: color),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                    '${e['title']}: ${e['detail']} (+${e['weight']} pts)',
                                    style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                      if (r['aiExplanation'] != null) ...[
                        SizedBox(height: 14),
                        Text('AI FRAUD ANALYSIS',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5)),
                        SizedBox(height: 4),
                        Container(
                          padding: EdgeInsets.all(10),
                          decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(8)),
                          child: Text(r['aiExplanation'],
                              style: TextStyle(
                                  fontSize: 12, color: Colors.green.shade900)),
                        ),
                      ],
                      SizedBox(height: 14),
                      Text('INCIDENT RESPONSE ADVISORY',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5)),
                      SizedBox(height: 4),
                      Text(r['recommendation'] ?? '',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w500)),
                      SizedBox(height: 12),
                      Container(
                        padding: EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('BANGLADESH FRAUD HELPLINES:',
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey.shade700)),
                            SizedBox(height: 4),
                            Text(
                                '• bKash: 16247  |  Nagad: 16167\n• Bangladesh Police Cyber Crime: 01320-000888 / 999',
                                style: TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Divider(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: Icon(Icons.copy, size: 16),
                      label: Text('Copy Official Report'),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: plainReportText));
                        Navigator.pop(ctx);
                        message('Cyber Threat Report copied to clipboard.');
                      },
                    ),
                  ),
                  SizedBox(width: 10),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text('Done'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget signInPanel() => panel(Column(children: [
        Icon(Icons.lock_outline, size: 32),
        SizedBox(height: 12),
        Text('Sign in to access your personal workspace.'),
        SizedBox(height: 12),
        FilledButton(onPressed: login, child: Text('Sign in'))
      ]));
  List<Widget> historyPage() => [
        title('Your scan history'),
        if (user == null)
          signInPanel()
        else ...[
          Text(
              'Redacted results only. Unkept scans expire after the configured retention period.'),
          SizedBox(height: 16),
          if (history.isEmpty) panel(Text('No saved scans yet.')),
          for (final r in history)
            panel(Column(children: [
              ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.shield_outlined, color: green),
                  title: Text('${r['level']} · ${r['score']}/100'),
                  subtitle: Text('${r['preview']}\n${r['createdAt']}'),
                  onTap: () => setState(() {
                        result = Map<String, dynamic>.from(r);
                        page = 0;
                      })),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                TextButton(
                    onPressed: () => action(() async {
                          await api.call('/scans/${r['id']}',
                              method: 'PATCH',
                              body: {'saved': r['saved'] != true});
                          r['saved'] = r['saved'] != true;
                          message(r['saved'] ? 'Scan kept.' : 'Scan unkept.');
                        }),
                    child: Text(r['saved'] == true ? 'Unkeep' : 'Keep')),
                IconButton(
                    tooltip: 'Delete scan',
                    icon: Icon(Icons.delete_outline),
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (c) => AlertDialog(
                                  title: Text('Delete this scan?'),
                                  content: Text('This cannot be undone.'),
                                  actions: [
                                    TextButton(
                                        onPressed: () =>
                                            Navigator.pop(c, false),
                                        child: Text('Cancel')),
                                    TextButton(
                                        onPressed: () => Navigator.pop(c, true),
                                        child: Text('Delete'))
                                  ]));
                      if (confirmed == true) {
                        await action(() async {
                          await api.call('/scans/${r['id']}', method: 'DELETE');
                        });
                        await loadAccountData();
                      }
                    })
              ])
            ]))
        ]
      ];
  Future<void> addContact() async {
    final name = TextEditingController(), email = TextEditingController();
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: Text('Add trusted contact'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: name,
                      decoration: InputDecoration(labelText: 'Name')),
                  SizedBox(height: 12),
                  TextField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(labelText: 'Email')),
                  SizedBox(height: 12),
                  Text('Only add someone who agrees to receive your alerts.',
                      style: TextStyle(fontSize: 12))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: Text('Cancel')),
                  TextButton(
                      onPressed: () => Navigator.pop(c, true),
                      child: Text('Add'))
                ]));
    if (confirmed == true) {
      await action(() async {
        await api.call('/contacts',
            method: 'POST', body: {'name': name.text, 'email': email.text});
      });
      await loadAccountData();
    }
    name.dispose();
    email.dispose();
  }

  Future<void> alertContact(dynamic contact) async {
    if (history.isEmpty) {
      message('Save a scan first.');
      return;
    }
    final selected = await showModalBottomSheet<String>(
        context: context,
        builder: (c) => SafeArea(
                child: ListView(shrinkWrap: true, children: [
              ListTile(
                  title: Text('Choose a scan to send to ${contact['name']}')),
              for (final scan in history)
                ListTile(
                    title: Text('${scan['level']} · ${scan['score']}/100'),
                    subtitle: Text(scan['createdAt']),
                    onTap: () => Navigator.pop(c, scan['id']))
            ])));
    if (selected == null) return;
    await action(() async {
      await api.call('/alerts',
          method: 'POST',
          body: {'scanId': selected, 'contactId': contact['id']});
      message('Security alert sent.');
    });
    await loadAccountData();
  }

  List<Widget> familyPage() => [
        title('Family Shield'),
        panel(SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('Simple mode'),
            subtitle: Text('Larger text for easier scanning.'),
            value: simple,
            onChanged: (v) {
              setState(() => simple = v);
              if (user != null) {
                action(() async {
                  await api
                      .call('/me', method: 'PATCH', body: {'simpleMode': v});
                });
              }
            })),
        if (user == null)
          signInPanel()
        else ...[
          FilledButton.icon(
              onPressed: addContact,
              icon: Icon(Icons.person_add_alt),
              label: Text('Add trusted contact')),
          SizedBox(height: 20),
          if (contacts.isEmpty)
            panel(Text('Your trusted contacts will appear here.')),
          for (final c in contacts)
            panel(
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c['name'],
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text(c['email']),
              Wrap(spacing: 8, children: [
                TextButton.icon(
                    onPressed: () => alertContact(c),
                    icon: Icon(Icons.mail_outline),
                    label: Text('Send security alert')),
                TextButton(
                    onPressed: () async {
                      await action(() async {
                        await api.call('/contacts/${c['id']}',
                            method: 'DELETE');
                      });
                      await loadAccountData();
                    },
                    child: Text('Remove'))
              ])
            ])),
          title('Security alerts'),
          if (alerts.isEmpty) Text('No alerts sent yet.'),
          for (final a in alerts.reversed.take(10))
            ListTile(
                leading: Icon(Icons.mail_outline),
                title: Text(a['status']),
                subtitle: Text(a['createdAt']))
        ]
      ];
  List<Widget> accountPage() => [
        title('Your account'),
        if (user == null)
          signInPanel()
        else
          panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user!['name'],
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            Text(user!['email']),
            SizedBox(height: 12),
            Text(user!['verified'] == true
                ? 'Email verified'
                : 'Email verification pending'),
            if (user!['verified'] != true)
              TextButton(
                  onPressed: () => action(() async {
                        await api.call('/auth/resend', method: 'POST');
                        message('Verification email sent.');
                      }),
                  child: Text('Send verification email')),
            TextButton(
                onPressed: () => action(() async {
                      await api.logout();
                      if (mounted) {
                        setState(() {
                          user = null;
                          history = [];
                          contacts = [];
                          alerts = [];
                        });
                      }
                    }),
                child: Text('Sign out'))
          ])),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          title('Server Connection'),
          Text('Current API: ${api.base}',
              style: TextStyle(fontSize: 13, color: Colors.grey)),
          SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: changeServerUrl,
              icon: Icon(Icons.dns_outlined),
              label: Text('Change Server URL')),
        ])),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          title('Privacy & protection'),
          Text(
              'Images are processed in memory. Raw message and OCR text are not saved in history. External checks are optional and send content to configured providers. Remove sensitive information before scanning.\n\nA low score is not a guarantee of safety. We do not visit suspicious links or follow redirects.\n\nUse the website for community reports and the full threat dashboard.')
        ]))
      ];
}

class QrCamera extends StatefulWidget {
  const QrCamera({super.key});
  @override
  State<QrCamera> createState() => _QrCameraState();
}

class _QrCameraState extends State<QrCamera> {
  final controller = MobileScannerController(formats: [BarcodeFormat.qrCode]);
  bool done = false;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text('QR Shield')),
      body: Column(children: [
        Padding(
            padding: EdgeInsets.all(20),
            child: Text(
                'Point at a QR code. The destination is analyzed before you open anything.')),
        Expanded(
            child: MobileScanner(
                controller: controller,
                errorBuilder: (_, error) => Center(
                    child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                            'Camera unavailable. Allow camera access in settings, or use QR image upload.'))),
                onDetect: (capture) {
                  if (done) return;
                  final values =
                      capture.barcodes.where((b) => b.rawValue != null);
                  if (values.isEmpty) return;
                  done = true;
                  controller.stop();
                  Navigator.pop(context, values.first.rawValue);
                }))
      ]));
}

class AuthPage extends StatefulWidget {
  final SafeLinkApi api;
  const AuthPage({super.key, required this.api});
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final form = GlobalKey<FormState>(),
      email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController();
  bool register = false, busy = false;
  String? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text(register ? 'Create account' : 'Sign in')),
      body: Center(
          child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 460),
              child: ListView(padding: EdgeInsets.all(24), children: [
                Icon(Icons.shield_outlined, size: 52, color: green),
                SizedBox(height: 25),
                Form(
                    key: form,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (register) ...[
                            TextFormField(
                                controller: name,
                                decoration: InputDecoration(labelText: 'Name'),
                                validator: (s) => (s?.trim().length ?? 0) < 2
                                    ? 'Enter your name.'
                                    : null),
                            SizedBox(height: 18)
                          ],
                          TextFormField(
                              controller: email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              decoration: InputDecoration(labelText: 'Email'),
                              validator: (s) => s?.contains('@') == true
                                  ? null
                                  : 'Enter a valid email.'),
                          SizedBox(height: 18),
                          TextFormField(
                              controller: password,
                              obscureText: true,
                              decoration:
                                  InputDecoration(labelText: 'Password'),
                              validator: (s) => (s?.length ?? 0) <
                                      (register ? 12 : 1)
                                  ? 'Use at least 12 characters for a new account.'
                                  : null),
                          SizedBox(height: 18),
                          if (error != null)
                            Padding(
                                padding: EdgeInsets.only(bottom: 15),
                                child: Text(error!,
                                    style: TextStyle(color: Colors.red))),
                          FilledButton(
                              onPressed: busy
                                  ? null
                                  : () async {
                                      if (!form.currentState!.validate()) {
                                        return;
                                      }
                                      setState(() {
                                        busy = true;
                                        error = null;
                                      });
                                      try {
                                        final user = await widget.api
                                            .authenticate(
                                                register ? 'register' : 'login',
                                                email.text.trim(),
                                                password.text,
                                                name.text.trim());
                                        if (context.mounted) {
                                          Navigator.pop(context, user);
                                        }
                                      } catch (e) {
                                        if (mounted) {
                                          setState(() => error = e
                                              .toString()
                                              .replaceFirst('Exception: ', ''));
                                        }
                                      } finally {
                                        if (mounted) {
                                          setState(() => busy = false);
                                        }
                                      }
                                    },
                              child: Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Text(busy
                                      ? 'Please wait…'
                                      : register
                                          ? 'Create account'
                                          : 'Sign in'))),
                          TextButton(
                              onPressed: () => setState(() {
                                    register = !register;
                                    error = null;
                                  }),
                              child: Text(register
                                  ? 'Already have an account? Sign in'
                                  : 'Create an account')),
                          TextButton(
                              onPressed: () async {
                                try {
                                  final data = await widget.api.call(
                                      '/auth/forgot',
                                      method: 'POST',
                                      body: {'email': email.text.trim()});
                                  if (mounted) {
                                    setState(() => error = data['message']);
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    setState(() => error = e.toString());
                                  }
                                }
                              },
                              child: Text('Send password reset email'))
                        ]))
              ]))));
}

class ServerDialog extends StatefulWidget {
  final String initialUrl;
  const ServerDialog({super.key, required this.initialUrl});
  @override
  State<ServerDialog> createState() => _ServerDialogState();
}

class _ServerDialogState extends State<ServerDialog> {
  late final TextEditingController controller;
  @override
  void initState() {
    super.initState();
    controller = TextEditingController(text: widget.initialUrl);
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text('Server Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                'Enter SafeLink API URL (e.g. your PC IP http://192.168.0.100:3001 or deployed Render URL):',
                style: TextStyle(fontSize: 13)),
            SizedBox(height: 14),
            TextField(
                controller: controller,
                decoration: InputDecoration(
                    labelText: 'API URL',
                    hintText: 'http://192.168.0.100:3001')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, null),
              child: Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: Text('Save & Connect')),
        ],
      );
}
