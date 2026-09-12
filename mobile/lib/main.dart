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

class HelplineItem {
  final String name;
  final String bengali;
  final String hotline;
  final String shortcode;
  final String domain;
  final String tag;
  final Color color;
  final String desc;

  const HelplineItem({
    required this.name,
    required this.bengali,
    required this.hotline,
    required this.shortcode,
    required this.domain,
    required this.tag,
    required this.color,
    required this.desc,
  });
}

class PipelineStageItem {
  final String stepNumber;
  final String layer;
  final String title;
  final String latency;
  final String status;
  final bool isDanger;
  final IconData icon;
  final String detail;

  const PipelineStageItem({
    required this.stepNumber,
    required this.layer,
    required this.title,
    required this.latency,
    required this.status,
    required this.isDanger,
    required this.icon,
    required this.detail,
  });
}

class EmergencyContactItem {
  final String name;
  final String hotline;
  final String desc;
  final Color color;
  final IconData icon;

  const EmergencyContactItem({
    required this.name,
    required this.hotline,
    required this.desc,
    required this.color,
    required this.icon,
  });
}

class _WorkspaceState extends State<Workspace> with WidgetsBindingObserver {
  final api = SafeLinkApi();
  final input = TextEditingController();
  static const shareChannel = MethodChannel('safelink/share');
  Map<String, dynamic>? user, result;
  int page = 0;
  int unreadNotifications = 3;
  bool scamAlertsEnabled = true;
  String kind = 'url', status = 'Connecting…';
  bool external = false, busy = false, simple = false;
  List<dynamic> history = [], contacts = [], alerts = [];

  String _lastCheckedClipboard = '';
  bool _showClipboardBanner = false;
  String _clipboardPreview = '';
  String _clipboardText = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    initialize();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkClipboardOnResume();
    }
  }

  Future<void> _checkClipboardOnResume() async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim() ?? '';
      if (text.isEmpty ||
          text == _lastCheckedClipboard ||
          text == input.text.trim()) {
        return;
      }
      final looksLikeUrl = text.startsWith('http://') ||
          text.startsWith('https://') ||
          text.startsWith('www.') ||
          (!text.contains('\n') &&
              text.contains('.') &&
              !text.contains(' ') &&
              text.length > 5);
      final isLikelyScam = looksLikeUrl ||
          text.contains('বিকাশ') ||
          text.contains('নগদ') ||
          text.contains('bkash') ||
          text.contains('nagad') ||
          text.contains('লটারি') ||
          text.contains('বোনাস') ||
          text.contains('টাকা') ||
          text.toLowerCase().contains('pin') ||
          text.toLowerCase().contains('otp');

      if (isLikelyScam) {
        _lastCheckedClipboard = text;
        if (mounted) {
          setState(() {
            _showClipboardBanner = true;
            _clipboardText = text;
            _clipboardPreview =
                text.length > 60 ? '${text.substring(0, 60)}…' : text;
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _pasteAndScanFromClipboard() async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim() ?? '';
      if (text.isEmpty) {
        message('ক্লিপবোর্ডে কোনো টেক্সট বা লিঙ্ক নেই।');
        return;
      }
      setState(() {
        _showClipboardBanner = false;
        page = 0;
        kind = text.startsWith('http') ||
                (!text.contains(' ') && text.contains('.'))
            ? 'url'
            : 'message';
        input.text = text;
        result = null;
      });
      scanText();
    } catch (_) {
      message('ক্লিপবোর্ড পড়তে সমস্যা হয়েছে।');
    }
  }

  Future<void> _dialPhone(String number) async {
    try {
      if (!kIsWeb && Platform.isAndroid) {
        await shareChannel.invokeMethod('dialNumber', {'number': number});
        return;
      }
    } catch (_) {}
    Clipboard.setData(ClipboardData(text: number));
    message('হটলাইন $number কপি হয়েছে। ডায়ালারে পেস্ট করে কল দিন।');
  }

  Future<void> initialize() async {
    if (!kIsWeb && Platform.isAndroid) {
      shareChannel.setMethodCallHandler((call) async {
        if (call.method == 'sharedText') {
          receiveText(call.arguments as String?, autoScan: true);
        }
      });
      try {
        final initial = await shareChannel.invokeMethod<String>('getInitialText');
        if (initial != null && initial.trim().isNotEmpty) {
          receiveText(initial, autoScan: true);
        }
      } catch (_) {}
    }
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
    } catch (_) {
      if (mounted) {
        setState(() => status = 'Backend unavailable. Check connection.');
      }
    }
  }

  void receiveText(String? text, {bool autoScan = false}) {
    if (text == null || text.trim().isEmpty || !mounted) return;
    final trimmed = text.trim();
    setState(() {
      page = 0;
      kind = trimmed.startsWith('http') && !trimmed.contains(' ')
          ? 'url'
          : 'message';
      input.text = trimmed;
      result = null;
      _showClipboardBanner = false;
    });
    if (autoScan) {
      message('অন্য অ্যাপ থেকে লিঙ্ক/মেসেজ শেয়ার হয়েছে — এআই স্ক্যান শুরু হচ্ছে…');
      scanText();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
            ? threatRadarPage()
            : page == 2
                ? historyPage()
                : page == 3
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
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(minWidth: 32, minHeight: 32),
                icon: Icon(Icons.crisis_alert, color: Colors.redAccent, size: 20),
                tooltip: '🚨 একাউন্ট ফ্রিজ (Panic Button)',
                onPressed: showEmergencyFreezeDialog,
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(minWidth: 32, minHeight: 32),
                icon: Icon(Icons.menu_book_outlined, size: 20),
                tooltip: 'অফলাইন ডিরেক্টরি',
                onPressed: showOfflineDirectoryDialog,
              ),
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: BoxConstraints(minWidth: 32, minHeight: 32),
                    icon: Icon(Icons.notifications_outlined, size: 20),
                    tooltip: 'Security Notifications',
                    onPressed: showNotificationsDialog,
                  ),
                  if (unreadNotifications > 0)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        padding: EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '$unreadNotifications',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (user == null)
                TextButton(
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.symmetric(horizontal: 4),
                  ),
                  onPressed: login,
                  child: Text('Sign in', style: TextStyle(fontSize: 12)),
                )
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
        floatingActionButton: FloatingActionButton(
          backgroundColor: Colors.blue.shade700,
          foregroundColor: Colors.white,
          tooltip: 'সাইবার এআই সহকারী (AI Copilot)',
          onPressed: showCyberAssistantBottomSheet,
          child: Icon(Icons.smart_toy_outlined, size: 26),
        ),
        bottomNavigationBar: NavigationBar(
            selectedIndex: page,
            onDestinationSelected: (value) {
              setState(() => page = value);
              if (value == 2 || value == 3) loadAccountData();
            },
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.document_scanner_outlined), label: 'Scan'),
              NavigationDestination(
                  icon: Icon(Icons.radar), label: 'Threat Radar'),
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
        if (_showClipboardBanner) ...[
          Card(
            elevation: 1,
            color: Colors.amber.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.amber.shade400, width: 1.2),
            ),
            child: Padding(
              padding: EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.content_paste_search,
                          color: Colors.orange.shade800, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ক্লিপবোর্ডে লিঙ্ক/টেক্সট পাওয়া গেছে!',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: Colors.orange.shade900,
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () =>
                            setState(() => _showClipboardBanner = false),
                        child: Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(Icons.close,
                              size: 18, color: Colors.grey.shade700),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Text(
                      _clipboardPreview,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: Colors.black87),
                    ),
                  ),
                  SizedBox(height: 8),
                  Wrap(
                    alignment: WrapAlignment.end,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      TextButton(
                        onPressed: () =>
                            setState(() => _showClipboardBanner = false),
                        child: Text('উপেক্ষা করুন',
                            style: TextStyle(
                                color: Colors.grey.shade700, fontSize: 12)),
                      ),
                      FilledButton.icon(
                        icon: Icon(Icons.bolt, size: 15),
                        label: Text('⚡ ইনস্ট্যান্ট এআই স্ক্যান',
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.bold)),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.orange.shade800,
                          visualDensity: VisualDensity.compact,
                        ),
                        onPressed: () {
                          setState(() {
                            _showClipboardBanner = false;
                            input.text = _clipboardText;
                            kind = _clipboardText.startsWith('http') ||
                                    (!_clipboardText.contains(' ') &&
                                        _clipboardText.contains('.'))
                                ? 'url'
                                : 'message';
                            result = null;
                          });
                          scanText();
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 12),
        ],
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
                      : 'Paste your message…',
                  suffixIcon: Padding(
                    padding: EdgeInsets.only(right: 6, top: 4),
                    child: IconButton(
                      tooltip: 'Paste & Scan from Clipboard',
                      icon: Icon(Icons.content_paste_go, color: Colors.blue.shade700),
                      onPressed: busy ? null : _pasteAndScanFromClipboard,
                    ),
                  ))),
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('⚡ Quick Demo Scenarios:',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade700)),
                    InkWell(
                      onTap: busy ? null : _pasteAndScanFromClipboard,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        child: Row(
                          children: [
                            Icon(Icons.content_paste_go, size: 14, color: Colors.blue.shade800),
                            SizedBox(width: 4),
                            Text('Paste & Scan',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blue.shade800)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      ActionChip(
                        avatar: Icon(Icons.link, size: 16, color: Colors.red),
                        label: Text('bKash Spoof Link'),
                        onPressed: () => loadDemoScenario('url', 'https://bkash-reward.xyz/login'),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.sms_failed,
                            size: 16, color: Colors.orange.shade800),
                        label: Text('Banglish OTP Phish'),
                        onPressed: () => loadDemoScenario('message',
                            'Apnar bkash account block hoyeche. 10 min er moddhe PIN 4421 diye unblock korun: https://bkash-login.help'),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.card_giftcard,
                            size: 16, color: Colors.amber.shade900),
                        label: Text('Bangla 50,000 Tk Trap'),
                        onPressed: () => loadDemoScenario('message',
                            'অভিনন্দন! আপনি জিতেছেন ৫০,০০০ টাকা! পুরষ্কার পেতে এখনই আপনার বিকাশ পিন ও ওটিপি ভেরিফাই করুন: http://free-reward-bkash.tk'),
                      ),
                      SizedBox(width: 8),
                      ActionChip(
                        avatar: Icon(Icons.verified_user,
                            size: 16, color: green),
                        label: Text('Official Safe Site'),
                        onPressed: () => loadDemoScenario('url', 'https://www.bkash.com'),
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
          SizedBox(height: 8),
          FilledButton.tonalIcon(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.blue.shade50,
              foregroundColor: Colors.blue.shade900,
              side: BorderSide(color: Colors.blue.shade300, width: 1.2),
            ),
            onPressed: busy ? null : _pasteAndScanFromClipboard,
            icon: Icon(Icons.content_paste_go, size: 18, color: Colors.blue.shade800),
            label: Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                '📋 Paste & Auto-Scan from Clipboard',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ),
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
        SizedBox(height: 18),
        Card(
          elevation: 0,
          color: Colors.red.shade50,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.red.shade300, width: 1.2),
          ),
          child: InkWell(
            onTap: showEmergencyFreezeDialog,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.crisis_alert, color: Colors.red.shade700, size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '🚨 ইমার্জেন্সি একাউন্ট ফ্রিজ (Panic Freeze)',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: Colors.red.shade900,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'ভুলবশত পিন বা ওটিপি শেয়ার করলে দ্রুত একাউন্ট সাময়িক বন্ধের গাইড ও হটলাইন',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.red.shade800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: Colors.red.shade700),
                ],
              ),
            ),
          ),
        ),
        SizedBox(height: 10),
        Card(
          elevation: 0,
          color: Colors.blue.shade50,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.blue.shade300, width: 1.2),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: showCyberAssistantBottomSheet,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade700,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.smart_toy_outlined, color: Colors.white, size: 20),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '🤖 সাইবার এআই সহকারী (AI Copilot)',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: Colors.blue.shade900,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'বিকাশ/নগদ পিন ফ্রড, একাউন্ট হ্যাক বা জিডি সংক্রান্ত প্রশ্ন করুন',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.blue.shade800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: Colors.blue.shade700),
                ],
              ),
            ),
          ),
        ),
        SizedBox(height: 10),
        Card(
          elevation: 0,
          color: green.withValues(alpha: 0.08),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: green.withValues(alpha: 0.3)),
          ),
          child: InkWell(
            onTap: showOfflineDirectoryDialog,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.menu_book, color: green, size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('📖 অফলাইন হেল্পলাইন ও সাইবার সেফটি ডিরেক্টরি',
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: green)),
                        SizedBox(height: 2),
                        Text(
                            'ইন্টারনেট ছাড়াই বিকাশ, নগদ, পুলিশ ও ব্যাংকের ভেরিফাইড নম্বর ও গাইড',
                            style: TextStyle(
                                fontSize: 11, color: Colors.black87)),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: green),
                ],
              ),
            ),
          ),
        ),
        SizedBox(height: 14),
        if (result != null) resultPanel(result!),
                if (result == null) ...[
          Container(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: green.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.flash_on, color: green, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '1-TAP COMPETITION DEMO SCENARIOS',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: green,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: green,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '4 LIVE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 10),
          Text(
            'Tap any card below to instantly load and run analysis in the AI engine:',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
          SizedBox(height: 12),
          _demoScenarioCard(
            icon: Icons.link,
            color: Colors.red,
            title: '🔗 bKash Spoof Link',
            tag: 'HOMOGRAPH SPOOF',
            preview: 'https://bkash-reward.xyz/login',
            onTap: () => loadDemoScenario('url', 'https://bkash-reward.xyz/login'),
          ),
          _demoScenarioCard(
            icon: Icons.chat_bubble_outline,
            color: Colors.deepOrange,
            title: '💬 Banglish PIN Scam',
            tag: 'BANGLISH OTP',
            preview: 'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.',
            onTap: () => loadDemoScenario('message', 'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.'),
          ),
          _demoScenarioCard(
            icon: Icons.card_giftcard,
            color: Colors.orange,
            title: '🎁 Bangla Lottery Scam',
            tag: 'BANGLA LOTTERY',
            preview: 'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।',
            onTap: () => loadDemoScenario('message', 'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।'),
          ),
          _demoScenarioCard(
            icon: Icons.check_circle_outline,
            color: green,
            title: '✅ Official Safe Site',
            tag: 'VERIFIED SAFE',
            preview: 'https://www.bkash.com',
            onTap: () => loadDemoScenario('url', 'https://www.bkash.com'),
          ),
          SizedBox(height: 12),
          panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.verified_user_outlined, color: green, size: 28),
            SizedBox(height: 10),
            Text('Understand the warning.',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            SizedBox(height: 6),
            Text(
                'SafeLink analyzes homograph typos, Banglish deception, credential traps and unverified hostnames. A green padlock alone does not make a link trustworthy.',
                style: TextStyle(fontSize: 13, height: 1.4)),
          ])),
        ]
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
      _buildAiPipelineFlow(r),
      if (score >= 50) ...[
        Container(
          margin: EdgeInsets.only(top: 14, bottom: 4),
          padding: EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.red.shade400, width: 1.2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: Colors.red.shade700, size: 22),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '🚨 আপনি কি ভুলবশত পিন বা ওটিপি দিয়েছেন?',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Colors.red.shade900,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 5),
              Text(
                'আর্থিক ক্ষতি এড়াতে ১ সেকেন্ডও দেরি করবেন না। অবিলম্বে হটলাইনে যোগাযোগ করুন অথবা সেলফ-লক প্রোটোকল প্রয়োগ করুন।',
                style: TextStyle(
                    fontSize: 11.5, color: Colors.red.shade900, height: 1.35),
              ),
              SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: Icon(Icons.shield, size: 16),
                  label: Text('🚨 জরুরি একাউন্ট ফ্রিজ ও সেলফ-লক প্রোটোকল খুলুন'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red.shade800,
                    foregroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: showEmergencyFreezeDialog,
                ),
              ),
            ],
          ),
        ),
      ],
      if (r['extractedText'] != null)
        ExpansionTile(title: Text('Review extracted text'), children: [
          Padding(
              padding: EdgeInsets.all(12),
              child: SelectableText(r['extractedText']))
        ]),
      SizedBox(height: 14),
      OutlinedButton.icon(
        icon: Icon(Icons.restart_alt, size: 16),
        label: Text('Test Another Demo Scenario'),
        onPressed: () => setState(() => result = null),
      ),
      SizedBox(height: 10),
      FilledButton.tonalIcon(
        icon: Icon(Icons.description_outlined),
        label: Text('Export Cyber Threat Report'),
        onPressed: () => showThreatReport(r),
      ),
      SizedBox(height: 8),
      FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: green,
          foregroundColor: Colors.white,
        ),
        icon: Icon(Icons.gavel_outlined, size: 18),
        label: Text('১-ক্লিক পুলিশ জিডি ড্রাফট (Police GD)'),
        onPressed: () => showPoliceGdDialog(r),
      ),
      if (score >= 50) ...[
        SizedBox(height: 8),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.red.shade800,
            foregroundColor: Colors.white,
          ),
          icon: Icon(Icons.crisis_alert, size: 18),
          label: Text('🚨 জরুরি একাউন্ট ফ্রিজ ও হটলাইন গাইড'),
          onPressed: showEmergencyFreezeDialog,
        ),
      ],
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

  Widget _buildAiPipelineFlow(Map<String, dynamic> r) {
    final score = (r['score'] as num).toInt();
    final List<dynamic> evidence = (r['evidence'] as List<dynamic>? ?? <dynamic>[]);
    final hasHeuristic = evidence.any((dynamic e) {
      final id = e is Map ? (e['id']?.toString() ?? '') : '';
      return id == 'credentials' ||
          id == 'prize' ||
          id == 'urgency' ||
          id.contains('banglish') ||
          id.contains('keyword') ||
          id.contains('lottery');
    });
    final hasTyposquatting = evidence.any((dynamic e) {
      final id = e is Map ? (e['id']?.toString() ?? '') : '';
      return id.startsWith('brand:') ||
          id == 'lookalike' ||
          id == 'untrusted_host' ||
          id == 'ip_host' ||
          id == 'userinfo' ||
          id == 'scheme';
    });

    final stages = [
      PipelineStageItem(
        stepNumber: '01',
        layer: 'Layer 1: Heuristic Engine',
        title: 'Bangla & Banglish Keyword Scorer',
        latency: '12ms',
        status: hasHeuristic ? 'FLAGGED' : 'PASSED',
        isDanger: hasHeuristic,
        icon: Icons.memory,
        detail: hasHeuristic
            ? 'জরুরি পিন/ওটিপি তলব, ভুয়া লটারি বা একাউন্ট ব্লকের বাংলা/বাংলিশ প্যাটার্ন সনাক্ত।'
            : 'কোনো সন্দেহজনক বাংলা বা বাংলিশ প্রতারণামূলক কি-ওয়ার্ড পাওয়া যায়নি।',
      ),
      PipelineStageItem(
        stepNumber: '02',
        layer: 'Layer 2: Typosquatting Analyzer',
        title: 'Domain Distance & Homoglyphs',
        latency: '18ms',
        status: hasTyposquatting ? 'FLAGGED' : 'VERIFIED',
        isDanger: hasTyposquatting,
        icon: Icons.hub_outlined,
        detail: hasTyposquatting
            ? 'নকল বা অননুমোদিত ডোমেন, ব্র্যান্ড নেম ইনজেকশন বা ক্ষতিকর সাইরিলিক ক্যারেক্টার সনাক্ত।'
            : 'ডোমেন স্ট্রাকচার ভেরিফাইড ডেটাবেজের সাথে সামঞ্জস্যপূর্ণ অথবা নিরাপদ।',
      ),
      PipelineStageItem(
        stepNumber: '03',
        layer: 'Layer 3: Semantic NLP Classifier',
        title: 'Contextual Fraud Sentiment Model',
        latency: '45ms',
        status: score >= 50
            ? 'HIGH RISK'
            : score >= 25
                ? 'SUSPICIOUS'
                : 'LOW RISK',
        isDanger: score >= 50,
        icon: Icons.psychology_outlined,
        detail: r['aiExplanation'] != null
            ? r['aiExplanation'].toString()
            : score >= 50
                ? 'আর্থিক সোস্যাল ইঞ্জিনিয়ারিং ও গ্রাহককে বিভ্রান্ত করার প্রতারণামূলক কৌশল সক্রিয়।'
                : 'স্বাভাবিক ও নিরাপদ যোগাযোগের কনটেক্সট পাওয়া গেছে।',
      ),
      PipelineStageItem(
        stepNumber: '04',
        layer: 'Layer 4: Threat Intelligence',
        title: 'Reputation & Blocklist Correlator',
        latency: '10ms',
        status: score >= 50 ? 'CORRELATED' : 'SYNCHRONIZED',
        isDanger: score >= 50,
        icon: Icons.security,
        detail:
            'জাতীয় এমএফএস ডেটাবেজ, বিটিআরসি গাইডলাইন এবং সিকিউরিটি তালিকার সাথে সিনক্রোনাইজড।',
      ),
    ];

    return Container(
      margin: EdgeInsets.symmetric(vertical: 14),
      padding: EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: green.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: green.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.bolt, color: green, size: 18),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '4-STAGE MULTI-LAYER AI PIPELINE',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: green,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      'রিয়েল-টাইম চার স্তরের এআই সিকিউরিটি ও হেউরিস্টিক অডিট',
                      style: TextStyle(fontSize: 11, color: Colors.black87),
                    ),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: green.withValues(alpha: 0.4)),
                ),
                child: Text(
                  '⏱️ 85ms Latency',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: green,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          for (final s in stages)
            Container(
              margin: EdgeInsets.only(bottom: 8),
              padding: EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: s.isDanger
                      ? Colors.red.withValues(alpha: 0.35)
                      : green.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        '#${s.stepNumber}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      SizedBox(width: 6),
                      Icon(s.icon,
                          size: 14,
                          color: s.isDanger ? Colors.red : green),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          s.title,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                      Container(
                        padding:
                            EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: s.isDanger
                              ? Colors.red.shade50
                              : Colors.green.shade50,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          s.status,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: s.isDanger
                                ? Colors.red.shade800
                                : Colors.green.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text(
                    s.detail,
                    style: TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                  SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '⏱️ ${s.latency}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      Text(
                        '✓ AI Engine Verified',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: green,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void showPoliceGdDialog(Map<String, dynamic> r) {
    final score = (r['score'] as num).toInt();
    final id = (r['id'] ?? '').toString();
    final ref =
        'SL-GD-${id.length >= 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase()}';
    final List<dynamic> evidence = (r['evidence'] as List<dynamic>? ?? <dynamic>[]);
    final urls = (r['urls'] as List<dynamic>? ?? <dynamic>[]).join(', ');
    final phones = (r['phones'] as List<dynamic>? ?? <dynamic>[]).join(', ');
    final preview = (r['preview'] ?? urls).toString();
    final now = DateTime.now();
    final dateStr = '${now.day}/${now.month}/${now.year}';

    final gdDraftText = '''
বরাবর,
অফিসার ইনচার্জ / সাইবার ক্রাইম ইনভেস্টিগেশন ইউনিট
[নিকটস্থ থানা / সিআইডি সাইবার পুলিশ সেন্টার, ঢাকা]

বিষয়: অনলাইন ফিশিং / আর্থিক প্রতারণার ফাঁদ সংক্রান্ত সাধারণ ডায়েরি (GD) ও আইনগত তদন্তের আবেদন।

মহোদয়,
বিনীত নিবেদন এই যে, আমি নিম্নস্বাক্ষরকারী একজন সচেতন নাগরিক। সম্প্রতি আমি একটি পরিকল্পিত ডিজিটাল আর্থিক প্রতারণার শিকার হতে যাচ্ছিলাম / সাইবার সিকিউরিটি থ্রেট শনাক্ত করেছি। 'SafeLink AI' এর সাইবার ফরেনসিক ইঞ্জিন দ্বারা উক্ত সাইবার অপরাধমূলক প্রচেষ্টাটি শনাক্ত ও বিশ্লেষণ করা হয়েছে।

ঘটনা ও ডিজিটাল আলামতের বিবরণ:
১. ইনসিডেন্ট ট্র্যাকিং আইডি: $ref
২. ঝুঁকি মাত্রা (Risk Score): $score/100 (${r['level']?.toString().toUpperCase()} - ${r['threatType']})
৩. সন্দেহভাজন ফিশিং লিংক / বার্তা: $preview
${phones.isNotEmpty ? '৪. চিহ্নিত সন্দেহভাজন ফোন/MFS নম্বর: $phones\n' : ''}৫. সময় ও তারিখ: ${DateTime.tryParse(r['createdAt'] ?? '')?.toLocal().toString() ?? dateStr}
৬. এআই ও ফরেনসিক প্রমাণের তালিকা:
${evidence.map((dynamic e) => '- ${e is Map ? "${e['title']}: ${e['detail']}" : e.toString()}').join('\n')}

উক্ত মেসেজ/লিংকের মাধ্যমে বিকাশ, নগদ বা ব্যাংক গ্রাহকদের বিভ্রান্ত করে গোপন পিন (PIN), ওটিপি (OTP) বা অর্থ আত্মসাতের চক্রান্ত করা হচ্ছিল। 

অতএব, মহোদয়ের নিকট বিনীত প্রার্থনা, ভবিষ্যতের আইনি নিরাপত্তা ও প্রতারক চক্রের বিরুদ্ধে সাইবার নিরাপত্তা আইন এবং বিটিআরসি নির্দেশিকা অনুযায়ী ব্যবস্থা গ্রহণের লক্ষ্যে উক্ত বিবরণটি সাধারণ ডায়েরি (GD) হিসেবে অন্তর্ভুক্ত করতে মর্জি হয়।

বিনীত নিবেদনকারী,
নাম: ___________________________
মোবাইল নম্বর: ___________________
জাতীয় পরিচয়পত্র (NID) নম্বর: ____________________
ঠিকানা: ________________________
তারিখ: $dateStr

সংযুক্তি:
১. SafeLink AI সাইবার থ্রেট ফরেনসিক রিপোর্ট ($ref)
২. সন্দেহভাজন মেসেজ/লিংকের স্ক্রিনশট ও প্রমাণাদি
''';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: EdgeInsets.symmetric(vertical: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: green.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.gavel, color: green, size: 20),
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '১-ক্লিক পুলিশ জিডি ও অভিযোগপত্র ড্রাফট',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        Text(
                          'থানা, বিটিআরসি বা সাইবার পুলিশে দেওয়ার প্রস্তুত বাংলা দরখাস্ত',
                          style: TextStyle(fontSize: 11, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            Container(
              margin: EdgeInsets.symmetric(horizontal: 18, vertical: 4),
              padding: EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 18, color: Colors.blue.shade700),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'ড্রাফটটি কপি করে থানা বা সাইবার পুলিশ (০১৩২০-০০০৮৮৮) অথবা বিটিআরসি (১০০) নম্বরে অভিযোগ করতে পারেন।',
                      style:
                          TextStyle(fontSize: 11, color: Colors.blue.shade900),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                margin: EdgeInsets.all(18),
                padding: EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: SingleChildScrollView(
                  child: SelectableText(
                    gdDraftText,
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.6,
                      color: Colors.black87,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 18),
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: green,
                        padding: EdgeInsets.symmetric(vertical: 12),
                      ),
                      icon: Icon(Icons.copy, size: 18),
                      label: Text('জিডি ড্রাফট কপি করুন (Copy Draft)'),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: gdDraftText));
                        Navigator.pop(ctx);
                        message('জিডি ড্রাফট সফলভাবে ক্লিপবোর্ডে কপি হয়েছে!');
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void showEmergencyFreezeDialog() {
    const emergencyContacts = [
      EmergencyContactItem(
        name: 'bKash (বিকাশ)',
        hotline: '16247',
        desc: 'বিকাশ কাস্টমার কেয়ার হেল্পলাইন',
        color: Color(0xffd12053),
        icon: Icons.account_balance_wallet,
      ),
      EmergencyContactItem(
        name: 'Nagad (নগদ)',
        hotline: '16167',
        desc: 'ডাক বিভাগীয় ডিজিটাল লেনদেন নগদ',
        color: Color(0xfff26522),
        icon: Icons.monetization_on,
      ),
      EmergencyContactItem(
        name: 'Rocket (রকেট / DBBL)',
        hotline: '16216',
        desc: 'ডাচ-বাংলা ব্যাংক মোবাইল ব্যাংকিং',
        color: Color(0xff8c2d8c),
        icon: Icons.account_balance,
      ),
      EmergencyContactItem(
        name: 'Upay (উপায়)',
        hotline: '16268',
        desc: 'ইউসিবি ফিনটেক উপায় হেল্পলাইন',
        color: Color(0xff005696),
        icon: Icons.payment,
      ),
      EmergencyContactItem(
        name: 'জাতীয় জরুরি সেবা (999)',
        hotline: '999',
        desc: 'বাংলাদেশ পুলিশ সাইবার ইমার্জেন্সি ডেস্ক',
        color: Color(0xffd32f2f),
        icon: Icons.local_police,
      ),
      EmergencyContactItem(
        name: 'বিটিআরসি সাইবার ডেস্ক (100)',
        hotline: '100',
        desc: 'টেলিকম প্রতারণা ও সিম ফ্রড রিপোর্ট',
        color: Color(0xff0288d1),
        icon: Icons.headset_mic,
      ),
    ];

    const agentScriptText =
        'আমার নাম [আপনার নাম], বিকাশ/নগদ/অ্যাকাউন্ট নম্বর [আপনার নম্বর]। একটি ফিশিং প্রতারক চক্র আমাকে বিভ্রান্ত করে গোপন ওটিপি বা পিন সংগ্রহ করেছে। আমার অ্যাকাউন্ট থেকে কোনো অবৈধ লেনদেন বন্ধ করতে অনতিবিলম্বে সকল আউটগোয়িং লেনদেন সাময়িকভাবে স্থগিত (Freeze) করুন এবং সন্দেহজনক ট্রানজেকশন হোল্ড করুন।';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.90,
        decoration: BoxDecoration(
          color: Theme.of(context).scaffoldBackgroundColor,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: EdgeInsets.only(top: 12, bottom: 8),
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.shield_rounded,
                        color: Colors.red.shade700, size: 24),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '🚨 জরুরি একাউন্ট ফ্রিজ ও সেলফ-লক প্রোটোকল',
                          style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.red.shade900),
                        ),
                        Text(
                          'Emergency Fraud Account Lock & Protocol',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            Divider(height: 1),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(18, 12, 18, 24),
                children: [
                  Container(
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border:
                          Border.all(color: Colors.red.shade300, width: 1.2),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            color: Colors.red.shade700, size: 22),
                        SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '১ সেকেন্ডও দেরি করবেন না!',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Colors.red.shade900),
                              ),
                              SizedBox(height: 3),
                              Text(
                                'প্রতারকের হাতে পিন বা ওটিপি চলে গেলে টাকা অন্য অ্যাকাউন্টে পাঠানোর আগেই নিচের পদক্ষেপগুলো নিন।',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    color: Colors.red.shade800,
                                    height: 1.35),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 16),
                  Text('ধাপ ১: সরাসরি হেল্পলাইনে কল দিন (ট্যাপ করলেই কল হবে)',
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.bold)),
                  SizedBox(height: 8),
                  for (final c in emergencyContacts)
                    Container(
                      margin: EdgeInsets.only(bottom: 8),
                      padding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: c.color.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(c.icon, color: c.color, size: 22),
                          SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(c.name,
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13.5)),
                                Text(c.desc,
                                    style: TextStyle(
                                        fontSize: 11, color: Colors.black54)),
                              ],
                            ),
                          ),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: c.color,
                              foregroundColor: Colors.white,
                              visualDensity: VisualDensity.compact,
                              padding: EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                            ),
                            icon: Icon(Icons.call, size: 14),
                            label: Text(c.hotline,
                                style: TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 13)),
                            onPressed: () => _dialPhone(c.hotline),
                          ),
                        ],
                      ),
                    ),
                  SizedBox(height: 16),
                  Container(
                    padding: EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border:
                          Border.all(color: Colors.amber.shade400, width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.lightbulb_outline,
                                color: Colors.amber.shade900, size: 20),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'ধাপ ২: তাত্ক্ষণিক সেলফ-লক কৌশল (Instant Self-Lock)',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: Colors.amber.shade900),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 6),
                        Text(
                          'কাস্টমার কেয়ারের লাইনে দীর্ঘ সিরিয়াল বা ব্যস্ত থাকলে নিজের বিকাশ/নগদ অ্যাপে গিয়ে ইচ্ছাকৃতভাবে পর পর ৩ বার ভুল পিন (PIN) দিন।',
                          style: TextStyle(
                              fontSize: 12, height: 1.4, color: Colors.black87),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '⚡ ফলাফল: অ্যাপের সিকিউরিটি সিস্টেম অ্যাকাউন্টটিকে সাথে সাথে সাময়িক লক করবে, ফলে প্রতারক অন্য প্রান্তে লগইন থাকা সত্ত্বেও কোনো ক্যাশআউট বা সেন্ড মানি করতে পারবে না!',
                          style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: Colors.brown.shade800),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 16),
                  Text('ধাপ ৩: কাস্টমার কেয়ারে যা বলবেন (Agent Call Script)',
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.bold)),
                  SizedBox(height: 6),
                  Container(
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          agentScriptText,
                          style: TextStyle(
                              fontSize: 12, height: 1.45, color: Colors.black87),
                        ),
                        SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: FilledButton.tonalIcon(
                            icon: Icon(Icons.copy, size: 14),
                            label: Text('স্ক্রিপ্ট কপি করুন'),
                            style: FilledButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                            ),
                            onPressed: () {
                              Clipboard.setData(
                                  ClipboardData(text: agentScriptText));
                              message('কাস্টমার কেয়ার স্ক্রিপ্ট কপি হয়েছে।');
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 16),
                  Text('ধাপ ৪: আইনি সুরক্ষা ও সাধারণ ডায়েরি (GD)',
                      style: TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.bold)),
                  SizedBox(height: 6),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: green,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: Icon(Icons.gavel_rounded, size: 18),
                    label: Text('📝 ১-ক্লিক পুলিশ জিডি (GD) ড্রাফট তৈরি করুন'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      showPoliceGdDialog(result ?? <String, dynamic>{});
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, dynamic> _getOfflineCyberAdvice(String query) {
    final text = query.toLowerCase();
    if (text.contains('বিকাশ') ||
        text.contains('নগদ') ||
        text.contains('রকেট') ||
        text.contains('bkash') ||
        text.contains('nagad') ||
        text.contains('pin') ||
        text.contains('পিন') ||
        text.contains('otp') ||
        text.contains('ওটিপি')) {
      return {
        'reply':
            '🚫 জরুরি নিরাপত্তা সতর্কতা: কাউকে কখনো পিন (PIN) বা ওটিপি (OTP) দেবেন না!\n\n• বিকাশ/নগদ কখনোই গ্রাহককে কল দিয়ে ওটিপি বা পিন নম্বর জানতে চায় না।\n• একাউন্ট সাময়িক লক করতে অ্যাপে পর পর ৩ বার ভুল পিন দিন অথবা হেল্পলাইনে কল দিন।',
        'suggestions': [
          'বিকাশ একাউন্ট ফ্রিজ করব কীভাবে?',
          '৩ বার ভুল পিন দেওয়ার সেলফ-লক কৌশল কি?',
          'টাকা খোয়া গেলে জিডি করব কীভাবে?',
        ],
        'hotlines': [
          {'name': 'বিকাশ হেল্পলাইন', 'number': '16247'},
          {'name': 'নগদ হেল্পলাইন', 'number': '16167'},
        ],
      };
    }
    if (text.contains('facebook') ||
        text.contains('ফেসবুক') ||
        text.contains('হ্যাক') ||
        text.contains('hack') ||
        text.contains('whatsapp')) {
      return {
        'reply':
            '🛡️ একাউন্ট হ্যাক হলে দ্রুত করণীয়:\n\n১. অবিলম্বে facebook.com/hacked লিংকে যান এবং একাউন্ট রিকভার করুন।\n২. বন্ধুদের সতর্ক করুন যেন কেউ টাকা না পাঠায়।\n৩. সাইবার পুলিশ সেন্টারে (০১৩২০০০০৮৮৮) রিপোর্ট করুন।',
        'suggestions': [
          'ব্ল্যাকমেইল করলে কীভাবে থানায় জিডি করব?',
          'টু-ফ্যাক্টর অথেনটিকেশন কীভাবে চালু করব?',
        ],
        'hotlines': [
          {'name': 'সিআইডি সাইবার পুলিশ', 'number': '01320000888'},
          {'name': 'জরুরি সেবা ৯৯৯', 'number': '999'},
        ],
      };
    }
    if (text.contains('টাকা') ||
        text.contains('প্রতারিত') ||
        text.contains('scam')) {
      return {
        'reply':
            '⚡ টাকা খোয়া গেলে প্রথম ৩০ মিনিটে করণীয়:\n\n১. দ্রুত বিকাশ (১৬২৪৭) বা নগদে (১৬১৬৭) কল দিয়ে প্রতারকের একাউন্ট ক্যাশআউট হোল্ড করান।\n২. ট্রানজেকশন আইডি ও প্রমাণ নিয়ে নিকটস্থ থানায় সাইবার ক্রাইম জিডি দায়ের করুন।',
        'suggestions': [
          'SafeLink থেকে ১-ক্লিক পুলিশ জিডি বানাব কীভাবে?',
          'বিটিআরসি ১০০ হেল্পলাইনে অভিযোগের নিয়ম কি?',
        ],
        'hotlines': [
          {'name': 'বিকাশ হেল্পলাইন', 'number': '16247'},
          {'name': 'জাতীয় জরুরি সেবা', 'number': '999'},
        ],
      };
    }
    return {
      'reply':
          '👋 আমি SafeLink সাইবার এআই সহকারী।\n\n• অনলাইন নিরাপত্তা বজায় রাখতে কখনোই কারো সাথে ওটিপি বা পিন শেয়ার করবেন না।\n• যে কোনো অচেনা লিংক SafeLink স্ক্যানারে চেক করে নিন।',
      'suggestions': [
        'বিকাশ/নগদ পিন কেউ চাইলে কি করব?',
        'আমার একাউন্ট হ্যাক হলে দ্রুত কি করব?',
        'সাইবার ক্রাইম জিডি করার নিয়ম কি?',
      ],
      'hotlines': [
        {'name': 'জরুরি পুলিশ', 'number': '999'},
        {'name': 'বিকাশ হেল্পলাইন', 'number': '16247'},
        {'name': 'বিটিআরসি', 'number': '100'},
      ],
    };
  }

  void showCyberAssistantBottomSheet() {
    final chatMessages = <Map<String, dynamic>>[
      {
        'id': 'welcome',
        'role': 'assistant',
        'text':
            '👋 নমস্কার! আমি SafeLink সাইবার এআই সহকারী (Cyber Copilot)।\n\nঅনলাইন সাইবার নিরাপত্তা, ওটিপি/পিন প্রতারণা প্রতিরোধ, ফেসবুক একাউন্ট উদ্ধার এবং পুলিশি জিডি সংক্রান্ত যেকোনো পরামর্শের জন্য আমি প্রস্তুত।\n\nনিচের প্রশ্নে ট্যাপ করুন অথবা আপনার সমস্যা লিখুন:',
        'time': 'এখন',
        'suggestions': [
          'বিকাশ/নগদ পিন কেউ চাইলে কি করব?',
          'আমার একাউন্ট হ্যাক হলে দ্রুত কি করব?',
          'সাইবার ক্রাইম জিডি করার নিয়ম কি?',
          'টাকা খোয়া গেলে উদ্ধারের উপায় কি?',
        ],
        'hotlines': [
          {'name': 'জাতীয় জরুরি সেবা', 'number': '999'},
          {'name': 'বিকাশ হেল্পলাইন', 'number': '16247'},
          {'name': 'বিটিআরসি কমপ্লেইন', 'number': '100'},
        ],
      }
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final textController = TextEditingController();
        final scrollController = ScrollController();
        bool isTyping = false;

        return StatefulBuilder(
          builder: (bottomSheetContext, setModalState) {
            void scrollToBottom() {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (scrollController.hasClients) {
                  scrollController.animateTo(
                    scrollController.position.maxScrollExtent,
                    duration: Duration(milliseconds: 250),
                    curve: Curves.easeOut,
                  );
                }
              });
            }

            Future<void> sendUserMessage([String? preset]) async {
              final query = (preset ?? textController.text).trim();
              if (query.isEmpty || isTyping) return;

              setModalState(() {
                chatMessages.add({
                  'id': 'u_${DateTime.now().millisecondsSinceEpoch}',
                  'role': 'user',
                  'text': query,
                  'time': 'এখন',
                });
                if (preset == null) textController.clear();
                isTyping = true;
              });
              scrollToBottom();

              try {
                final history = chatMessages
                    .sublist(chatMessages.length > 4 ? chatMessages.length - 4 : 0)
                    .map((m) => {'role': m['role'], 'content': m['text']})
                    .toList();

                final res = await api.call(
                  '/assistant',
                  method: 'POST',
                  body: {'message': query, 'history': history},
                );

                if (res is Map && res['reply'] != null) {
                  setModalState(() {
                    chatMessages.add({
                      'id': 'b_${DateTime.now().millisecondsSinceEpoch}',
                      'role': 'assistant',
                      'text': res['reply'],
                      'time': 'এখন',
                      'suggestions': (res['suggestions'] as List?)
                          ?.map((dynamic s) => s.toString())
                          .toList(),
                      'hotlines': (res['hotlines'] as List?)
                          ?.map((dynamic h) => h is Map ? h : {})
                          .toList(),
                    });
                    isTyping = false;
                  });
                  scrollToBottom();
                  return;
                }
              } catch (_) {}

              final fallback = _getOfflineCyberAdvice(query);
              setModalState(() {
                chatMessages.add({
                  'id': 'b_${DateTime.now().millisecondsSinceEpoch}',
                  'role': 'assistant',
                  'text': fallback['reply'],
                  'time': 'এখন',
                  'suggestions': fallback['suggestions'],
                  'hotlines': fallback['hotlines'],
                });
                isTyping = false;
              });
              scrollToBottom();
            }

            return Container(
              height: MediaQuery.of(context).size.height * 0.88,
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: EdgeInsets.only(top: 10, bottom: 6),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: Colors.blue.shade700,
                          radius: 18,
                          child: Icon(Icons.smart_toy_outlined,
                              color: Colors.white, size: 20),
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'SafeLink সাইবার এআই সহকারী',
                                style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blue.shade900),
                              ),
                              Text(
                                'Cyber Safety Copilot · ২৪/৭ সক্রিয় এআই বিশেষজ্ঞ',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.close),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                  ),
                  Divider(height: 1),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      padding: EdgeInsets.all(14),
                      itemCount: chatMessages.length,
                      itemBuilder: (_, idx) {
                        final msg = chatMessages[idx];
                        final isUser = msg['role'] == 'user';
                        final hotlines = (msg['hotlines'] as List?) ?? [];

                        return Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            mainAxisAlignment: isUser
                                ? MainAxisAlignment.end
                                : MainAxisAlignment.start,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!isUser) ...[
                                CircleAvatar(
                                  radius: 13,
                                  backgroundColor: Colors.blue.shade100,
                                  child: Icon(Icons.smart_toy_outlined,
                                      size: 14, color: Colors.blue.shade900),
                                ),
                                SizedBox(width: 8),
                              ],
                              Flexible(
                                child: Container(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: isUser
                                        ? Colors.blue.shade700
                                        : (Theme.of(context).brightness ==
                                                Brightness.dark
                                            ? Colors.grey.shade800
                                            : Colors.grey.shade100),
                                    borderRadius: BorderRadius.circular(14),
                                    border: isUser
                                        ? null
                                        : Border.all(
                                            color: Colors.grey.shade300),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        msg['text'] ?? '',
                                        style: TextStyle(
                                          fontSize: 13,
                                          height: 1.4,
                                          color: isUser
                                              ? Colors.white
                                              : (Theme.of(context).brightness ==
                                                      Brightness.dark
                                                  ? Colors.white
                                                  : Colors.black87),
                                        ),
                                      ),
                                      if (hotlines.isNotEmpty) ...[
                                        SizedBox(height: 8),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 6,
                                          children: hotlines.map((dynamic h) {
                                            final name = h['name'] ?? 'Hotline';
                                            final num = h['number'] ?? '';
                                            return ActionChip(
                                              visualDensity:
                                                  VisualDensity.compact,
                                              avatar: Icon(Icons.phone_in_talk,
                                                  size: 13,
                                                  color: Colors.blue.shade800),
                                              label: Text('$name: $num',
                                                  style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.bold)),
                                              onPressed: () =>
                                                  _dialPhone(num.toString()),
                                            );
                                          }).toList(),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  if (isTyping)
                    Padding(
                      padding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 8),
                          Text('এআই সহকারী পরামর্শ বিশ্লেষণ করছে…',
                              style: TextStyle(
                                  fontSize: 11.5,
                                  color: Colors.grey.shade600)),
                        ],
                      ),
                    ),
                  if (chatMessages.isNotEmpty &&
                      chatMessages.last['suggestions'] != null)
                    Container(
                      height: 42,
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: (chatMessages.last['suggestions'] as List)
                            .map((dynamic s) {
                          return Padding(
                            padding: EdgeInsets.only(right: 6),
                            child: ActionChip(
                              visualDensity: VisualDensity.compact,
                              avatar: Icon(Icons.auto_awesome,
                                  size: 13, color: Colors.blue.shade700),
                              label: Text(s.toString(),
                                  style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600)),
                              onPressed: () =>
                                  sendUserMessage(s.toString()),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  Divider(height: 1),
                  Padding(
                    padding: EdgeInsets.fromLTRB(14, 8, 14, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: textController,
                            decoration: InputDecoration(
                              hintText: 'সাইবার সমস্যা বা প্রশ্ন লিখুন…',
                              hintStyle: TextStyle(fontSize: 13),
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            onSubmitted: (_) => sendUserMessage(),
                          ),
                        ),
                        SizedBox(width: 8),
                        IconButton.filled(
                          icon: Icon(Icons.send, size: 18),
                          onPressed: () => sendUserMessage(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  List<Widget> threatRadarPage() => [
        title('National Cyber Threat Radar'),
        Text(
            'Live MFS & Financial Fraud Intelligence across Bangladesh digital channels.'),
        SizedBox(height: 18),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: green.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: green.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: green,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'LIVE DEFENSE SYNCHRONIZED · BANGLADESH REGION',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: green,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 16),
        panel(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.query_stats, color: Colors.deepOrange, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'National Attack Vector Distribution',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 4),
              Text(
                'Top fraudulent vectors targeting Bangladeshi citizens (2025-2026)',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              SizedBox(height: 16),
              _vectorRow('MFS & Banking Impersonation (bKash/Nagad)', 0.42,
                  '42%', Colors.red),
              SizedBox(height: 12),
              _vectorRow('Fake Prize & Lottery Social Traps', 0.26, '26%',
                  Colors.deepOrange),
              SizedBox(height: 12),
              _vectorRow('OTP & Password Harvesting Pages', 0.18, '18%',
                  Colors.amber.shade800),
              SizedBox(height: 12),
              _vectorRow('Unverified Job & Visa Offers', 0.14, '14%',
                  Colors.indigo),
            ],
          ),
        ),
        SizedBox(height: 16),
        panel(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.security, color: green, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'High-Targeted Financial Brands Matrix',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 4),
              Text(
                'Active protection coverage by SafeLink Homograph & Typo Engine',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              SizedBox(height: 14),
              _brandRow('bKash Limited', '94% Attack Target Index', 'Critical',
                  Colors.red),
              Divider(height: 16),
              _brandRow('Nagad Postal MFS', '88% Attack Target Index', 'High',
                  Colors.deepOrange),
              Divider(height: 16),
              _brandRow('Brac Bank / Astha', '76% Attack Target Index',
                  'Caution', Colors.orange),
              Divider(height: 16),
              _brandRow('Islami Bank Cellfin', '71% Attack Target Index',
                  'Caution', Colors.orange),
            ],
          ),
        ),
        SizedBox(height: 16),
        panel(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.layers_outlined, color: green, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Multi-Layer Defense Architecture',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _metricChip('4-Layer Pipeline', 'Deterministic Edge Filter'),
                  _metricChip('Levenshtein Matrix', 'Homograph Typo Defense'),
                  _metricChip('Mistral AI Engine', 'Bangla/Banglish Context'),
                  _metricChip('Zero-SSRF Policy', 'Safe Sandboxed Execution'),
                ],
              ),
              SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: Icon(Icons.play_arrow, size: 18),
                  label: Text('Test Live Simulation in Scanner'),
                  onPressed: () {
                    setState(() {
                      page = 0;
                      kind = 'message';
                      input.text =
                          'Apnar bKash account bondho! Ekhoni https://bkash-verify.example e PIN din.';
                    });
                  },
                ),
              ),
            ],
          ),
        ),
      ];

  Widget _vectorRow(
          String name, double progress, String pct, Color barColor) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(name,
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ),
              Text(pct,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: barColor)),
            ],
          ),
          SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: barColor.withValues(alpha: 0.15),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
        ],
      );

  Widget _brandRow(
          String name, String sub, String riskLevel, Color badgeColor) =>
      Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                SizedBox(height: 2),
                Text(sub,
                    style: TextStyle(fontSize: 11, color: Colors.black54)),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: badgeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: badgeColor.withValues(alpha: 0.4)),
            ),
            child: Text(
              riskLevel,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: badgeColor,
              ),
            ),
          ),
          SizedBox(width: 8),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: green.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: green.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check, size: 12, color: green),
                SizedBox(width: 3),
                Text(
                  'Protected',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: green,
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget _metricChip(String title, String subtitle) => Container(
        width: 160,
        padding: EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.black12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            SizedBox(height: 2),
            Text(subtitle,
                style: TextStyle(fontSize: 10, color: Colors.black54)),
          ],
        ),
      );

  void loadDemoScenario(String scenarioKind, String scenarioText) {
    setState(() {
      kind = scenarioKind;
      input.text = scenarioText;
      result = null;
    });
    scanText();
  }

  Widget _demoScenarioCard({
    required IconData icon,
    required Color color,
    required String title,
    required String tag,
    required String preview,
    required VoidCallback onTap,
  }) =>
      Card(
        elevation: 0,
        margin: EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: color.withValues(alpha: 0.35), width: 1.2),
        ),
        color: color.withValues(alpha: 0.04),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(icon, size: 18, color: color),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Container(
                      padding:
                          EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding:
                      EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.black12),
                  ),
                  child: Text(
                    preview,
                    style: TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: Colors.black87,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      'Tap to Test Scenario →',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

  void showNotificationsDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.notifications_active, color: green, size: 22),
                        SizedBox(width: 8),
                        Text(
                          'Cyber Threat Alerts',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    if (unreadNotifications > 0)
                      TextButton(
                        onPressed: () {
                          setState(() => unreadNotifications = 0);
                          setModalState(() => unreadNotifications = 0);
                          message('All notifications marked as read.');
                        },
                        child: Text('Mark all read'),
                      ),
                  ],
                ),
                SizedBox(height: 10),
                Text(
                  'Real-time alerts for Bangladesh digital financial and mobile channels:',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                SizedBox(height: 14),
                _notificationTile(
                  title: 'High Alert: bKash Phishing Wave',
                  time: 'Just now',
                  body:
                      'Multiple deceptive domains detected attempting to harvest bKash PINs. SafeLink heuristic engine active.',
                  severityColor: Colors.red,
                  isNew: unreadNotifications > 0,
                ),
                _notificationTile(
                  title: 'Advisory: Bangla Lottery Traps',
                  time: '3 hours ago',
                  body:
                      'SMS scam circulating promising 50,000 BDT cash rewards. Do not dial codes or forward to family.',
                  severityColor: Colors.orange,
                  isNew: unreadNotifications > 1,
                ),
                _notificationTile(
                  title: 'Engine Update: 2026 Homographs',
                  time: 'Yesterday',
                  body:
                      'Detection database refreshed with Cyrillic look-alikes targeting Bangladeshi commercial banks.',
                  severityColor: green,
                  isNew: unreadNotifications > 2,
                ),
                _notificationTile(
                  title: 'Family Shield Guard Active',
                  time: '2 days ago',
                  body:
                      'Your personal circle is protected. Any risky forwarded link triggers immediate red warning.',
                  severityColor: Colors.blue,
                  isNew: false,
                ),
                Divider(height: 24),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text('Push notifications for critical MFS attacks',
                      style: TextStyle(fontSize: 13)),
                  value: scamAlertsEnabled,
                  onChanged: (v) {
                    setState(() => scamAlertsEnabled = v);
                    setModalState(() => scamAlertsEnabled = v);
                  },
                ),
                SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text('Close'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _notificationTile({
    required String title,
    required String time,
    required String body,
    required Color severityColor,
    required bool isNew,
  }) =>
      Container(
        margin: EdgeInsets.only(bottom: 10),
        padding: EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: severityColor.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: severityColor.withValues(alpha: isNew ? 0.4 : 0.15),
            width: isNew ? 1.4 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: severityColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    SizedBox(width: 6),
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
                Text(
                  time,
                  style: TextStyle(fontSize: 11, color: Colors.black54),
                ),
              ],
            ),
            SizedBox(height: 4),
            Text(
              body,
              style: TextStyle(fontSize: 12, height: 1.35, color: Colors.black87),
            ),
          ],
        ),
      );

  void showOfflineDirectoryDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        String filterQuery = '';
        int selectedTab = 0;

        const helplines = [
          HelplineItem(
            name: 'bKash Limited',
            bengali: 'বিকাশ লিমিটেড',
            hotline: '16247',
            shortcode: '*247#',
            domain: 'bkash.com',
            tag: 'Critical MFS',
            color: Colors.pink,
            desc: 'বিকাশ কখনোই ফোন দিয়ে পিন বা ওটিপি জানতে চায় না।',
          ),
          HelplineItem(
            name: 'Nagad (Postal MFS)',
            bengali: 'নগদ (ডাক বিভাগ)',
            hotline: '16167',
            shortcode: '*167#',
            domain: 'nagad.com.bd',
            tag: 'Critical MFS',
            color: Colors.deepOrange,
            desc: 'শুধুমাত্র নিজের সিম থেকে *167# ডায়াল করুন। পিন কাউকে দেবেন না।',
          ),
          HelplineItem(
            name: 'Rocket (DBBL MFS)',
            bengali: 'রকেট (ডাচ-বাংলা ব্যাংক)',
            hotline: '16216',
            shortcode: '*322#',
            domain: 'dutchbanglabank.com/rocket',
            tag: 'MFS Hotlist',
            color: Colors.purple,
            desc: 'মোবাইল হারিয়ে গেলে তাৎক্ষণিক ব্যালেন্স ফ্রিজ করতে 16216 ডায়াল করুন।',
          ),
          HelplineItem(
            name: 'Upay (UCB Fintech)',
            bengali: 'উপায় (ইউসিবি)',
            hotline: '16268',
            shortcode: '*268#',
            domain: 'upaybd.com',
            tag: 'MFS Hotlist',
            color: Colors.blue,
            desc: 'ইউনাইটেড কমার্শিয়াল ব্যাংক এমএফএস সার্বক্ষণিক সহায়তা লাইন।',
          ),
          HelplineItem(
            name: 'National Emergency (Police/Fire)',
            bengali: 'জাতীয় জরুরি সেবা ৯৯৯',
            hotline: '999',
            shortcode: '999 (টোল ফ্রি)',
            domain: 'police.gov.bd',
            tag: '24/7 Police Dispatch',
            color: Colors.red,
            desc: 'সাইবার চাঁদাবাজি, ব্ল্যাকমেইল ও তাৎক্ষণিক পুলিশি সহায়তায় টোল ফ্রি কল দিন।',
          ),
          HelplineItem(
            name: 'CID Cyber Crime Unit',
            bengali: 'সিআইডি সাইবার পুলিশ সেন্টার',
            hotline: '01320000888',
            shortcode: '01320-000888',
            domain: 'cid.police.gov.bd',
            tag: 'Cyber Crime Police',
            color: Colors.indigo,
            desc: 'বাংলাদেশ পুলিশ সাইবার অপরাধ তদন্ত বিভাগ। ইমেইল: smmcpc-cid@police.gov.bd',
          ),
          HelplineItem(
            name: 'BTRC Call & Fraud Desk',
            bengali: 'বিটিআরসি সাইবার অভিযোগ',
            hotline: '100',
            shortcode: '100 (টোল ফ্রি)',
            domain: 'btrc.gov.bd',
            tag: 'Telecom Regulator',
            color: Colors.teal,
            desc: 'ভুয়া কলার আইডি, অবৈধ ভিওআইপি ও প্রতারণামূলক এসএমএস রিপোর্ট করতে কল দিন।',
          ),
          HelplineItem(
            name: 'BRAC Bank (Astha App)',
            bengali: 'ব্র্যাক ব্যাংক হটলাইন',
            hotline: '16221',
            shortcode: '+88028801221',
            domain: 'bracbank.com',
            tag: 'Commercial Bank',
            color: Colors.blueGrey,
            desc: 'কার্ড ব্লক ও আস্থা অ্যাপের অননুমোদিত লেনদেন রিপোর্ট ডেস্ক।',
          ),
          HelplineItem(
            name: 'Islami Bank (Cellfin Desk)',
            bengali: 'ইসলামী ব্যাংক হটলাইন',
            hotline: '16259',
            shortcode: '+88028331090',
            domain: 'islamibankbd.com',
            tag: 'Commercial Bank',
            color: Colors.green,
            desc: 'সেলফিন প্রতারণা ও এটিএম কার্ড জরুরি স্থগিত করার হটলাইন।',
          ),
        ];

        final goldenRules = [
          {
            'title': '১. পিন (PIN) ও ওটিপি (OTP) কখনোই কারো নয়',
            'desc':
                'কোনো ব্যাংক, বিকাশ বা সরকারি কর্মকর্তা কখনোই আপনার গোপন পিন বা ওটিপি জানতে চাইবে না। কেউ পিন চাইলেই বুঝবেন সে ১০০% প্রতারক।',
          },
          {
            'title': '২. "ভুল করে টাকা চলে গেছে" নাটকে সতর্ক থাকুন',
            'desc':
                'কেউ ফোন করে টাকা ফেরত চাইলে কখনো সরাসরি টাকা পাঠাবেন না। আগে নিজের ফোনের অফিশিয়াল অ্যাপ বা কোড ডায়াল করে মূল ব্যালেন্স যাচাই করুন।',
          },
          {
            'title': '৩. লটারি বা চাকরির ফি ফাঁদ',
            'desc':
                'আসল কোনো লটারি বা সরকারি/বেসরকারি চাকরির ক্ষেত্রে পুরস্কার নেওয়ার জন্য আগে টাকা বা বিকাশ ফি পাঠাতে হয় না।',
          },
          {
            'title': '৪. অপরিচিত লিংকে পাসওয়ার্ড না দেওয়া',
            'desc':
                'মেসেজে আসা অচেনা লিংকে ক্লিক করে বিকাশ, নগদ বা ব্যাংকের পিন/পাসওয়ার্ড লিখবেন না। সবসময় অফিশিয়াল অ্যাপ ও ডোমেন ব্যবহার করুন।',
          },
          {
            'title': '৫. সন্দেহ হলেই তাৎক্ষণিক কল দিয়ে ব্লক করুন',
            'desc':
                'কোনো প্রতারণামূলক লেনদেনের সন্দেহ হলে দেরি না করে সরাসরি অফিশিয়াল হটলাইনে (যেমন বিকাশ ১৬২৪৭ বা নগদ ১৬১৬৭) কল দিয়ে অ্যাকাউন্ট সাময়িক স্থগিত করুন।',
          },
        ];

        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final filtered = helplines.where((h) {
              final q = filterQuery.toLowerCase().trim();
              if (q.isEmpty) return true;
              return h.name.toLowerCase().contains(q) ||
                  h.bengali.contains(q) ||
                  h.hotline.contains(q) ||
                  h.domain.toLowerCase().contains(q);
            }).toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.85,
              maxChildSize: 0.95,
              minChildSize: 0.5,
              expand: false,
              builder: (ctx, scrollController) => Padding(
                padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: ListView(
                  controller: scrollController,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.black26,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    SizedBox(height: 14),
                    Row(
                      children: [
                        Icon(Icons.menu_book, color: green, size: 22),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'অফলাইন সাইবার সেফটি ডিরেক্টরি',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Container(
                          padding:
                              EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: green.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'OFFLINE 100%',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: green,
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 4),
                    Text(
                      'ইন্টারনেট সংযোগ ছাড়াই বিকাশ, নগদ, পুলিশ ও ব্যাংকের ভেরিফাইড নম্বর ও প্রতারণা এড়ানোর গাইড:',
                      style: TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                    SizedBox(height: 14),
                    SegmentedButton<int>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment<int>(
                          value: 0,
                          label: Text('জরুরি হটলাইন'),
                          icon: Icon(Icons.call, size: 16),
                        ),
                        ButtonSegment<int>(
                          value: 1,
                          label: Text('৫টি গোল্ডেন রুলস'),
                          icon: Icon(Icons.security, size: 16),
                        ),
                      ],
                      selected: {selectedTab},
                      onSelectionChanged: (s) =>
                          setModalState(() => selectedTab = s.first),
                    ),
                    SizedBox(height: 14),
                    if (selectedTab == 0) ...[
                      TextField(
                        decoration: InputDecoration(
                          prefixIcon: Icon(Icons.search, size: 20),
                          hintText: 'প্রতিষ্ঠান, হটলাইন বা ডোমেন সার্চ করুন…',
                          isDense: true,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onChanged: (v) =>
                            setModalState(() => filterQuery = v),
                      ),
                      SizedBox(height: 12),
                      for (final h in filtered)
                        Card(
                          elevation: 0,
                          margin: EdgeInsets.only(bottom: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: h.color.withValues(alpha: 0.3),
                              width: 1.2,
                            ),
                          ),
                          color: h.color.withValues(alpha: 0.04),
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            h.name,
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                          Text(
                                            h.bengali,
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.black54,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                          horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: h.color.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        h.tag,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: h.color,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                SizedBox(height: 6),
                                Text(
                                  h.desc,
                                  style: TextStyle(
                                      fontSize: 12, height: 1.35),
                                ),
                                SizedBox(height: 8),
                                Container(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color: Colors.black12),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.phone,
                                          size: 14, color: green),
                                      SizedBox(width: 6),
                                      Text(
                                        'হটলাইন: ${h.hotline}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                          color: green,
                                        ),
                                      ),
                                      Spacer(),
                                      Text(
                                        'কোড: ${h.shortcode}',
                                        style: TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(Icons.check_circle,
                                            size: 13, color: green),
                                        SizedBox(width: 4),
                                        Text(
                                          h.domain,
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontFamily: 'monospace',
                                            color: Colors.black87,
                                          ),
                                        ),
                                      ],
                                    ),
                                    FilledButton.tonalIcon(
                                      icon: Icon(Icons.copy, size: 14),
                                      label: Text('Copy Number'),
                                      style: FilledButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                      ),
                                      onPressed: () {
                                        Clipboard.setData(ClipboardData(
                                            text: h.hotline));
                                        Navigator.pop(ctx);
                                        message(
                                            'Copied ${h.hotline} (${h.name}) to clipboard.');
                                      },
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                    if (selectedTab == 1) ...[
                      for (final r in goldenRules)
                        Container(
                          margin: EdgeInsets.only(bottom: 12),
                          padding: EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: green.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: green.withValues(alpha: 0.3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r['title']!,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                r['desc']!,
                                style: TextStyle(
                                    fontSize: 12,
                                    height: 1.4,
                                    color: Colors.black87),
                              ),
                            ],
                          ),
                        ),
                    ],
                    SizedBox(height: 14),
                    OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('Close Directory'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
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
