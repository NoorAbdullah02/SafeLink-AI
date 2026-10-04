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
  final SafeLinkApi? api;
  final ImagePicker? imagePicker;
  const SafeLinkApp({super.key, this.api, this.imagePicker});
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: 'SafeLink AI',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.light,
      theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: green),
          scaffoldBackgroundColor: Color(0xfff5f7f9),
          splashFactory: InkRipple.splashFactory,
          useMaterial3: true,
          inputDecorationTheme: InputDecorationTheme(
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)))),
      home: Workspace(api: api, imagePicker: imagePicker));
}

class Workspace extends StatefulWidget {
  final SafeLinkApi? api;
  final ImagePicker? imagePicker;
  const Workspace({super.key, this.api, this.imagePicker});
  @override
  State<Workspace> createState() => _WorkspaceState();
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
  late final SafeLinkApi api;
  late final ImagePicker imagePicker;
  final input = TextEditingController();
  static const shareChannel = MethodChannel('safelink/share');
  Map<String, dynamic>? user, result;
  int page = 0;
  int unreadNotifications = 0;
  bool clipboardSuggestionsEnabled = false;
  bool initialized = false;
  String? pendingSharedText;
  bool pendingAutoScan = false;
  bool accountRefreshPending = false;
  bool galleryRecoveryPending = false;
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
    api = widget.api ?? SafeLinkApi();
    imagePicker = widget.imagePicker ?? ImagePicker();
    WidgetsBinding.instance.addObserver(this);
    initialize();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && clipboardSuggestionsEnabled) {
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
      if (!mounted) return;
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
        input.selection =
            TextSelection.fromPosition(TextPosition(offset: text.length));
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
    }
    try {
      await api.restore();
      initialized = true;
      // Restore the endpoint-bound token before starting shared scans; do not
      // make Android share handling wait for a slow health/profile response.
      if (!kIsWeb && Platform.isAndroid && mounted) {
        try {
          final initial =
              await shareChannel.invokeMethod<String>('getInitialText');
          if (initial != null) receiveText(initial, autoScan: true);
        } catch (_) {}
      }
      final pending = pendingSharedText;
      if (pending != null && mounted) {
        pendingSharedText = null;
        receiveText(pending, autoScan: pendingAutoScan);
      }
      if (api.token != null) {
        try {
          final account = Map<String, dynamic>.from(await api.call('/me'));
          if (mounted) {
            setState(() {
              user = account;
              simple = account['simpleMode'] == true;
            });
          }
        } on ApiException catch (e) {
          if (e.statusCode == 401 && mounted) {
            _clearAccount();
          }
        }
      }
      final health = await api.call('/health');
      if (mounted) {
        setState(() => status = health['storage'] == 'temporary-memory'
            ? 'Temporary demo · data resets on restart'
            : 'Connected to SafeLink');
      }
    } catch (_) {
      if (mounted) {
        setState(() => status = 'Backend unavailable. Check connection.');
      }
    } finally {
      initialized = true;
      final pending = pendingSharedText;
      if (pending != null && mounted) {
        pendingSharedText = null;
        receiveText(pending, autoScan: pendingAutoScan);
      }
      if (!kIsWeb && Platform.isAndroid && mounted) {
        if (busy) {
          galleryRecoveryPending = true;
        } else {
          await recoverLostImage();
        }
      }
    }
  }

  void _clearAccount() {
    if (!mounted) return;
    setState(() {
      user = null;
      history = [];
      contacts = [];
      alerts = [];
      result = null;
    });
  }

  void receiveText(String? text, {bool autoScan = false}) {
    if (text == null || text.trim().isEmpty || !mounted) return;
    final trimmed = text.trim();
    if (trimmed.length > 10000) {
      message(
          'Use at most 10,000 characters. Remove private information before scanning.');
      return;
    }
    if (!initialized || busy) {
      pendingSharedText = trimmed;
      pendingAutoScan = autoScan;
      return;
    }
    setState(() {
      page = 0;
      kind = trimmed.startsWith('http') && !trimmed.contains(' ')
          ? 'url'
          : 'message';
      input.text = trimmed;
      input.selection =
          TextSelection.fromPosition(TextPosition(offset: trimmed.length));
      result = null;
      _showClipboardBanner = false;
    });
    if (autoScan) {
      message(
          'অন্য অ্যাপ থেকে লিঙ্ক/মেসেজ শেয়ার হয়েছে — এআই স্ক্যান শুরু হচ্ছে…');
      scanText();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    input.dispose();
    shareChannel.setMethodCallHandler(null);
    if (widget.api == null) api.close();
    super.dispose();
  }

  void message(Object error) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', ''))));
    }
  }

  Future<void> action(Future<void> Function() fn) async {
    if (busy || !mounted) return;
    setState(() => busy = true);
    try {
      await fn();
    } catch (e) {
      if (e is ApiException && e.statusCode == 401) _clearAccount();
      message(e);
    } finally {
      if (mounted) {
        setState(() => busy = false);
        final pending = pendingSharedText;
        if (initialized && pending != null) {
          pendingSharedText = null;
          receiveText(pending, autoScan: pendingAutoScan);
        } else if (galleryRecoveryPending) {
          galleryRecoveryPending = false;
          recoverLostImage();
        } else if (accountRefreshPending) {
          accountRefreshPending = false;
          if (page == 2 || page == 3) loadAccountData();
        }
      }
    }
  }

  Future<void> scanText() async {
    if (busy || !mounted) return;
    final raw = input.text.trim();
    if (raw.isEmpty) {
      message('Paste a link or message first.');
      return;
    }
    if (raw.length > 10000) {
      message('Use at most 10,000 characters.');
      return;
    }
    var targetKind = kind;
    final isUrl = !RegExp(r'\s').hasMatch(raw) &&
        (raw.startsWith('http://') ||
            raw.startsWith('https://') ||
            raw.contains('.'));
    if (!isUrl && targetKind == 'url') {
      targetKind = 'message';
      if (mounted) setState(() => kind = 'message');
    } else if (isUrl &&
        targetKind == 'message' &&
        !raw.contains(' ') &&
        !raw.contains('\n')) {
      targetKind = 'url';
      if (mounted) setState(() => kind = 'url');
    }
    await action(() async {
      setState(() => result = null);
      final data = await api.scan(raw, targetKind, external);
      if (mounted) setState(() => result = data);
    });
  }

  Future<void> scanImage(String type) async {
    final consent = external;
    await action(() async {
      await api.storage.write(key: 'pending_image_kind', value: type);
      try {
        final file = await imagePicker.pickImage(
            source: ImageSource.gallery,
            maxWidth: 2200,
            maxHeight: 2200,
            imageQuality: 90);
        if (file == null || !mounted) return;
        setState(() => result = null);
        final data = await api.image(file, type, consent);
        if (mounted) {
          setState(() {
            result = data;
            page = 0;
          });
        }
      } finally {
        await api.storage.delete(key: 'pending_image_kind');
      }
    });
  }

  Future<void> recoverLostImage() async {
    await action(() async {
      final recovered = await imagePicker.retrieveLostData();
      if (recovered.isEmpty || !mounted) return;
      final files = recovered.files ??
          (recovered.file == null ? null : [recovered.file!]);
      if (files == null || files.isEmpty) {
        message(
            'The selected image could not be recovered. Please choose it again.');
        return;
      }
      final previousKind = await api.storage.read(key: 'pending_image_kind');
      final type = previousKind == 'qr' ? 'qr' : 'screenshot';
      try {
        // A restarted app has no current external-provider consent.
        final data = await api.image(files.first, type, false);
        if (mounted) {
          setState(() {
            result = data;
            page = 0;
          });
          message(
              'Recovered and scanned the image selected before the app restarted.');
        }
      } finally {
        await api.storage.delete(key: 'pending_image_kind');
      }
    });
  }

  Future<void> scanCamera() async {
    final consent = external;
    await action(() async {
      final value = await Navigator.of(context)
          .push<String>(MaterialPageRoute(builder: (_) => QrCamera()));
      if (value == null || !mounted) return;
      setState(() {
        input.text = value;
        input.selection =
            TextSelection.fromPosition(TextPosition(offset: value.length));
        kind = value.trim().startsWith('http') ||
                (!value.trim().contains(' ') && value.trim().contains('.'))
            ? 'url'
            : 'message';
        page = 0;
        result = null;
      });
      final data = await api.scan(value, 'qr', consent);
      if (mounted) setState(() => result = data);
    });
  }

  Future<void> loadAccountData() async {
    if (user == null) return;
    if (busy) {
      accountRefreshPending = true;
      return;
    }
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
    if (busy || !mounted) return;
    final value = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(builder: (_) => AuthPage(api: api)));
    if (value != null && mounted) {
      setState(() {
        user = value;
        simple = value['simpleMode'] == true;
      });
      await loadAccountData();
    }
  }

  Future<void> changeServerUrl() async {
    if (busy) return;
    final newUrl = await showDialog<String>(
        context: context, builder: (_) => ServerDialog(initialUrl: api.base));
    if (newUrl == null || !mounted) return;
    try {
      final previous = api.base;
      await api.setBaseUrl(newUrl);
      if (!mounted) return;
      if (api.base != previous) _clearAccount();
      setState(() => status = 'Connecting to SafeLink…');
      await initialize();
    } catch (e) {
      message(e);
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
                icon: Icon(Icons.smart_toy_outlined, color: green, size: 20),
                tooltip: '🤖 সাইবার এআই সহকারী (Safety Assistant)',
                onPressed: () => showCyberAssistantBottomSheet(),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(minWidth: 32, minHeight: 32),
                icon:
                    Icon(Icons.crisis_alert, color: Colors.redAccent, size: 20),
                tooltip: 'জরুরি প্রতারণা সহায়তা',
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
                  onPressed: busy ? null : login,
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
                        child: GestureDetector(
                          onTap: () => FocusScope.of(context).unfocus(),
                          behavior: HitTestBehavior.opaque,
                          child: ListView(
                            padding: EdgeInsets.all(20),
                            physics: const BouncingScrollPhysics(),
                            keyboardDismissBehavior:
                                ScrollViewKeyboardDismissBehavior.onDrag,
                            children: [
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
                                              color:
                                                  status.contains('unavailable')
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
                                    child: Center(
                                        child: CircularProgressIndicator(
                                            color: green))),
                              SizedBox(height: 20),
                              Text(
                                  'Risk scores are indicators, not guarantees.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12))
                            ],
                          ),
                        ))))),
        floatingActionButton: FloatingActionButton(
          backgroundColor: green,
          foregroundColor: Colors.white,
          tooltip: 'সাইবার এআই সহকারী (AI Copilot)',
          onPressed: () => showCyberAssistantBottomSheet(),
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
              NavigationDestination(icon: Icon(Icons.radar), label: 'Learn'),
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
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 280),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          child: _showClipboardBanner
              ? Card(
                  key: const ValueKey('clipboard_banner'),
                  elevation: 0,
                  color: green.withValues(alpha: 0.08),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                        color: green.withValues(alpha: 0.35), width: 1.2),
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.content_paste_search,
                                color: green, size: 20),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'ক্লিপবোর্ডে লিঙ্ক/মেসেজ পাওয়া গেছে!',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Color(0xFF0D4A39),
                                ),
                              ),
                            ),
                            InkWell(
                              borderRadius: BorderRadius.circular(20),
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
                            border:
                                Border.all(color: green.withValues(alpha: 0.2)),
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
                                      color: Colors.grey.shade700,
                                      fontSize: 12)),
                            ),
                            FilledButton.icon(
                              icon: Icon(Icons.bolt, size: 15),
                              label: Text('⚡ ইনস্ট্যান্ট এআই স্ক্যান',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold)),
                              style: FilledButton.styleFrom(
                                backgroundColor: green,
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () {
                                setState(() {
                                  _showClipboardBanner = false;
                                  input.text = _clipboardText;
                                  input.selection = TextSelection.fromPosition(
                                      TextPosition(
                                          offset: _clipboardText.length));
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
                )
              : const SizedBox.shrink(),
        ),
        SizedBox(height: 12),
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
              onSelectionChanged: busy
                  ? null
                  : (value) => setState(() {
                        kind = value.first;
                        result = null;
                      })),
          SizedBox(height: 20),
          TextField(
              controller: input,
              enabled: !busy,
              minLines: 3,
              maxLines: 7,
              maxLength: 10000,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => scanText(),
              buildCounter: (context,
                      {required currentLength,
                      required isFocused,
                      maxLength}) =>
                  null,
              onChanged: (val) {
                setState(() => result = null);
                final trimmed = val.trim();
                if (trimmed.isNotEmpty) {
                  final looksLikeUrl = trimmed.startsWith('http://') ||
                      trimmed.startsWith('https://') ||
                      (!trimmed.contains(' ') &&
                          !trimmed.contains('\n') &&
                          trimmed.contains('.'));
                  if (looksLikeUrl && kind != 'url') {
                    setState(() => kind = 'url');
                  } else if (!looksLikeUrl &&
                      trimmed.contains(' ') &&
                      kind != 'message') {
                    setState(() => kind = 'message');
                  } else {
                    setState(() {});
                  }
                } else {
                  setState(() {});
                }
              },
              decoration: InputDecoration(
                  labelText:
                      kind == 'url' ? 'Link to analyze' : 'Message to analyze',
                  alignLabelWithHint: true,
                  hintText: kind == 'url'
                      ? 'https://example.com'
                      : 'Paste your message…',
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (input.text.isNotEmpty)
                        IconButton(
                          tooltip: 'Clear text',
                          icon: Icon(Icons.clear,
                              color: Colors.grey.shade600, size: 20),
                          onPressed: busy
                              ? null
                              : () {
                                  setState(() {
                                    input.clear();
                                    result = null;
                                  });
                                },
                        ),
                      IconButton(
                        tooltip: 'Paste & Scan from Clipboard',
                        icon: Icon(Icons.content_paste_go, color: green),
                        onPressed: busy ? null : _pasteAndScanFromClipboard,
                      ),
                    ],
                  ))),
          SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeThumbColor: green,
              activeTrackColor: green.withValues(alpha: 0.35),
              title: Text('External AI & threat checks',
                  style: TextStyle(fontSize: 15)),
              subtitle: Text(
                  'Sends text/URLs to configured providers. Remove private information first.',
                  style: TextStyle(fontSize: 12)),
              value: external,
              onChanged: busy ? null : (v) => setState(() => external = v)),
          SizedBox(height: 10),
          FilledButton.icon(
              onPressed: busy ? null : scanText,
              icon: Icon(Icons.shield_outlined),
              label: Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(busy ? 'Analyzing…' : 'Scan Now'))),
          SizedBox(height: 8),
          FilledButton.tonalIcon(
            style: FilledButton.styleFrom(
              backgroundColor: green.withValues(alpha: 0.12),
              foregroundColor: green,
              side: BorderSide(color: green.withValues(alpha: 0.4), width: 1.2),
            ),
            onPressed: busy ? null : _pasteAndScanFromClipboard,
            icon: Icon(Icons.content_paste_go, size: 18, color: green),
            label: Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  '📋 Paste & Auto-Scan from Clipboard',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
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
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          child: result != null
              ? KeyedSubtree(
                  key: ValueKey(result!['id'] ?? 'scan_result'),
                  child: resultPanel(result!),
                )
              : const SizedBox.shrink(),
        ),
        if (result == null) ...[
          Container(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: green.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                Icon(Icons.flash_on, color: green, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '1-CLICK COMPETITION DEMO SCENARIOS',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: green,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        'Instant Test Cards (Tap any card to analyze)',
                        style: TextStyle(fontSize: 11, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: green,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '4 EXAMPLES',
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
          SizedBox(height: 12),
          _demoScenarioCard(
            icon: Icons.link,
            color: Colors.red,
            title: 'bKash Spoof Link',
            tag: 'BRAND LOOKALIKE',
            preview: 'https://bkash-reward.xyz/login',
            onTap: () =>
                loadDemoScenario('url', 'https://bkash-reward.xyz/login'),
          ),
          _demoScenarioCard(
            icon: Icons.chat_bubble_outline,
            color: Colors.deepOrange,
            title: 'Banglish PIN Scam',
            tag: 'BANGLISH OTP',
            preview:
                'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.',
            onTap: () => loadDemoScenario('message',
                'Apnar bKash account bondho hoyeche! 10 min er moddhe PIN pathan.'),
          ),
          _demoScenarioCard(
            icon: Icons.card_giftcard,
            color: Colors.orange.shade800,
            title: 'Bangla Lottery Scam',
            tag: 'BANGLA LOTTERY',
            preview:
                'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।',
            onTap: () => loadDemoScenario('message',
                'অভিনন্দন! আপনি ৫০,০০০ টাকার লটারি জিতেছেন। ফি দিতে টাকা পাঠান।'),
          ),
          _demoScenarioCard(
            icon: Icons.check_circle_outline,
            color: green,
            title: 'Official Domain Example',
            tag: 'DOMAIN EXAMPLE',
            preview: 'https://www.bkash.com',
            onTap: () => loadDemoScenario('url', 'https://www.bkash.com'),
          ),
          SizedBox(height: 14),
          Card(
            elevation: 0,
            color: green.withValues(alpha: 0.08),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side:
                  BorderSide(color: green.withValues(alpha: 0.35), width: 1.2),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => showCyberAssistantBottomSheet(),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: green,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.smart_toy_outlined,
                              color: Colors.white, size: 20),
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '🤖 সাইবার এআই সহকারী (Safety Assistant)',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: Color(0xFF10212C),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'বিকাশ/নগদ পিন ফ্রড, একাউন্ট হ্যাক বা আইনি সহায়তায় সরাসরি কথা বলুন',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: green),
                      ],
                    ),
                    SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _assistantQuickPromptChip('বিকাশ পিন ফ্রড'),
                        _assistantQuickPromptChip('ফেসবুক হ্যাক উদ্ধার'),
                        _assistantQuickPromptChip('পুলিশ জিডি গাইড'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(height: 10),
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
                    Icon(Icons.crisis_alert,
                        color: Colors.red.shade700, size: 24),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'জরুরি প্রতারণা সহায়তা',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: Colors.red.shade900,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'পিন বা ওটিপি শেয়ার করে থাকলে অফিসিয়াল সহায়তা সেবায় যোগাযোগের নির্দেশনা',
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
                  ? '⚠️ প্রতারণার একাধিক ঝুঁকির লক্ষণ পাওয়া গেছে'
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
                  ? 'বার্তায় গোপন পিন (PIN), ওটিপি বা পাসওয়ার্ড চাওয়ার লক্ষণ পাওয়া গেছে। কোনো ব্যক্তিকে এসব তথ্য দেবেন না।'
                  : (r['evidence'] as List)
                          .any((e) => (e['id'] as String).startsWith('brand:'))
                      ? 'ডোমেনে পরিচিত ব্র্যান্ডের মতো নাম পাওয়া গেছে। প্রতিষ্ঠানের অফিসিয়াল অ্যাপ বা ওয়েবসাইটে আলাদাভাবে যাচাই করুন।'
                      : (r['evidence'] as List).any((e) => e['id'] == 'prize')
                          ? 'লটারি বা ফ্রি পুরস্কারের লোভ দেখিয়ে অর্থ বা গোপন পিন হাতিয়ে নেওয়ার প্রতারণার প্যাটার্ন পাওয়া গেছে।'
                          : score >= 50
                              ? 'এই লিংকে ক্লিক করবেন না এবং কোনো তথ্য দেবেন না। এটি আর্থিক ক্ষতির কারণ হতে পারে।'
                              : 'অপ্রত্যাশিত অনুরোধ সতর্কতার সাথে যাচাই করুন এবং কখনোই কারো সাথে ওটিপি শেয়ার করবেন না।',
              style:
                  TextStyle(fontSize: 12, height: 1.4, color: Colors.black87),
            ),
            SizedBox(height: 8),
            Text('জরুরি হেল্পলাইন: বিকাশ ১৬২৪৭ · নগদ ১৬১৬৭ · পুলিশ ৯৯৯',
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, color: green)),
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
                'পিন বা ওটিপি দিয়ে থাকলে দ্রুত প্রতিষ্ঠানের অফিসিয়াল সহায়তা সেবায় যোগাযোগ করুন। SafeLink নিজে কোনো অ্যাকাউন্ট লক করতে পারে না।',
                style: TextStyle(
                    fontSize: 11.5, color: Colors.red.shade900, height: 1.35),
              ),
              SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: Icon(Icons.shield, size: 16),
                  label: Text('🚨 জরুরি সহায়তার নির্দেশনা খুলুন'),
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
          label: Text('🚨 জরুরি সহায়তা ও হটলাইন গাইড'),
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
                    final alert = await api.call('/alerts',
                        method: 'POST', body: {'scanId': r['id']});
                    message('Alert status: ${alert['status'] ?? 'unknown'}');
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
    final ref =
        id.length >= 16 ? id.substring(0, 16).toUpperCase() : id.toUpperCase();
    final evidence = (r['evidence'] as List? ?? []);
    final urls = (r['urls'] as List? ?? []).join(', ');
    final phones = (r['phones'] as List? ?? []).join(', ');

    final plainReportText = '''
==================================================
SAFELINK AI SCAN SUMMARY
User scan summary (Bangladesh)
==================================================
INCIDENT REF: $ref
TIMESTAMP: ${DateTime.tryParse(r['createdAt'] ?? '')?.toLocal().toString() ?? DateTime.now().toString()}
THREAT LEVEL: ${r['level']?.toString().toUpperCase()}
RISK INDEX: $score / 100
VECTOR TYPE: ${r['kind']?.toString().toUpperCase()}
TARGET: ${r['preview'] ?? urls}
${phones.isNotEmpty ? 'IDENTIFIED PHONES/MFS: $phones\n' : ''}
RISK INDICATORS:
${evidence.map((e) => '- [${e['id']}] ${e['title']}: ${e['detail']} (+${e['weight']} pts)').join('\n')}

${r['aiExplanation'] != null ? 'AI FRAUD INTERPRETATION:\n${r['aiExplanation']}\n\n' : ''}RECOMMENDED ACTION:
${r['recommendation']}

EMERGENCY FRAUD HELPLINES (BANGLADESH):
- bKash Helpline: 16247
- Nagad Helpline: 16167
- Police Cyber Support for Women: 01320-000888; immediate danger: 999
==================================================
Automated risk summary. This is not an official forensic record or proof of a crime.
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
                        Text('SAFELINK AI SCAN SUMMARY',
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
                          border:
                              Border.all(color: color.withValues(alpha: 0.3)),
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
                                color: green)),
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
                            style: TextStyle(fontSize: 12, color: Colors.grey)),
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
                                '• bKash: 16247  |  Nagad: 16167\n• Police Cyber Support for Women: 01320-000888; immediate danger: 999',
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
                      label: Text('Copy Scan Summary'),
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
    final checks = (r['checks'] as List?) ?? [];
    return Container(
      margin: EdgeInsets.symmetric(vertical: 14),
      padding: EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: green.withValues(alpha: .05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: green.withValues(alpha: .3))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Checks performed for this scan',
            style: TextStyle(fontWeight: FontWeight.bold, color: green)),
        SizedBox(height: 6),
        Text(
            'Only the checks reported by the server are shown. Skipped or unavailable checks do not confirm safety.',
            style: TextStyle(fontSize: 12)),
        for (final check in checks)
          ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                  check['status'] == 'complete'
                      ? Icons.check_circle_outline
                      : Icons.info_outline,
                  color: green),
              title: Text('${check['name']} · ${check['status']}'),
              subtitle: Text(check['detail']?.toString() ?? '')),
      ]),
    );
  }

  void showPoliceGdDialog(Map<String, dynamic> r) {
    final score = (r['score'] as num?)?.toInt();
    final id = (r['id'] ?? '').toString();
    final ref =
        'SL-GD-${id.length >= 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase()}';
    final List<dynamic> evidence =
        (r['evidence'] as List<dynamic>? ?? <dynamic>[]);
    final urls = (r['urls'] as List<dynamic>? ?? <dynamic>[]).join(', ');
    final phones = (r['phones'] as List<dynamic>? ?? <dynamic>[]).join(', ');
    final preview = (r['preview'] ?? urls).toString();
    final now = DateTime.now();
    final dateStr = '${now.day}/${now.month}/${now.year}';

    final gdDraftText = '''
বরাবর,
অফিসার ইনচার্জ / সাইবার ক্রাইম ইনভেস্টিগেশন ইউনিট
[নিকটস্থ থানা]

বিষয়: অনলাইন ফিশিং / আর্থিক প্রতারণার ফাঁদ সংক্রান্ত সাধারণ ডায়েরি (GD) ও আইনগত তদন্তের আবেদন।

মহোদয়,
আমি অনলাইনে একটি সন্দেহজনক বার্তা/লিংক পেয়েছি। আমার নিজের দেখা ঘটনার বিবরণ নিচে লিখেছি। SafeLink-এর স্বয়ংক্রিয় স্ক্যান কিছু ঝুঁকির লক্ষণ দেখিয়েছে; এটি অপরাধের প্রমাণ বা অফিসিয়াল ফরেনসিক রিপোর্ট নয়।

ঘটনা ও ডিজিটাল আলামতের বিবরণ:
১. ইনসিডেন্ট ট্র্যাকিং আইডি: $ref
২. স্ক্যান সারাংশ: ${score == null ? 'স্ক্যান করা হয়নি' : '$score/100'} (${r['level'] ?? 'প্রযোজ্য নয়'})
৩. সন্দেহভাজন ফিশিং লিংক / বার্তা: $preview
${phones.isNotEmpty ? '৪. চিহ্নিত সন্দেহভাজন ফোন/MFS নম্বর: $phones\n' : ''}৫. সময় ও তারিখ: ${DateTime.tryParse(r['createdAt'] ?? '')?.toLocal().toString() ?? dateStr}
৬. স্বয়ংক্রিয় স্ক্যানের ঝুঁকির লক্ষণ:
${evidence.map((dynamic e) => '- ${e is Map ? "${e['title']}: ${e['detail']}" : e.toString()}').join('\n')}

আমার নিজের দেখা ঘটনার বিবরণ: [কি ঘটেছে, কবে ঘটেছে, লেনদেন হলে তার পরিমাণ ও রেফারেন্স লিখুন। কোনো পিন/ওটিপি লিখবেন না।]

ঘটনাটি যাচাই করে প্রযোজ্য প্রক্রিয়া ও প্রয়োজনীয় পরবর্তী পদক্ষেপ সম্পর্কে আমাকে সাহায্য করার অনুরোধ করছি।

বিনীত নিবেদনকারী,
নাম: ___________________________
মোবাইল নম্বর: ___________________
জাতীয় পরিচয়পত্র (NID) নম্বর: ____________________
ঠিকানা: ________________________
তারিখ: $dateStr

সংযুক্তি:
১. SafeLink স্বয়ংক্রিয় স্ক্যান সারাংশ ($ref)
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
                          'নিজের দেখা তথ্য যাচাই ও সম্পাদনার জন্য খসড়া',
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
                color: green.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: green.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 18, color: green),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'এটি সম্পাদনাযোগ্য খসড়া। নিজের দেখা তথ্য যাচাই করে পূরণ করুন এবং প্রযোজ্য জমাদান পদ্ধতি স্থানীয় থানায় জেনে নিন। SafeLink কোনো অভিযোগ জমা দেয় না।',
                      style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF0F3D30),
                          fontWeight: FontWeight.w500),
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
        name: 'জাতীয় জরুরি সেবা (999)',
        hotline: '999',
        desc: 'তাৎক্ষণিক বিপদ বা জরুরি সহায়তা',
        color: Color(0xffd32f2f),
        icon: Icons.local_police,
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
                          '🚨 জরুরি প্রতারণা সহায়তা',
                          style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.red.shade900),
                        ),
                        Text(
                          'Support contacts and recovery guidance',
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
                  Text('ধাপ ১: অফিসিয়াল হেল্পলাইন (ডায়ালার বা নম্বর কপি)',
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
                                'ধাপ ২: প্রতিষ্ঠানের নির্দেশনা অনুসরণ করুন',
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
                          'অফিসিয়াল অ্যাপ বা ওয়েবসাইট থেকে পিন পরিবর্তন/অ্যাকাউন্ট রিকভারি পদ্ধতি দেখুন। সহায়তা সেবাকে সন্দেহজনক লেনদেন ও অ্যাকাউন্ট সুরক্ষার বিষয়ে জানান।',
                          style: TextStyle(
                              fontSize: 12, height: 1.4, color: Colors.black87),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'SafeLink অ্যাকাউন্ট ফ্রিজ বা লেনদেন বন্ধ করতে পারে না। ইচ্ছাকৃতভাবে ভুল পিন দিলে টাকা সুরক্ষিত হবে—এমন নিশ্চয়তা নেই।',
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
                              fontSize: 12,
                              height: 1.45,
                              color: Colors.black87),
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
            '🚫 জরুরি নিরাপত্তা সতর্কতা: কাউকে কখনো পিন (PIN) বা ওটিপি (OTP) দেবেন না!\n\n• বিকাশ/নগদ কখনোই গ্রাহককে কল দিয়ে ওটিপি বা পিন নম্বর জানতে চায় না।\n• অফিসিয়াল সহায়তা সেবায় যোগাযোগ করুন এবং তাদের অ্যাকাউন্ট সুরক্ষার নির্দেশনা অনুসরণ করুন। SafeLink অ্যাকাউন্ট লক করতে পারে না।',
        'suggestions': [
          'বিকাশ একাউন্ট ফ্রিজ করব কীভাবে?',
          'অফিসিয়াল সহায়তা সেবায় কী বলব?',
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
            '🛡️ একাউন্ট হ্যাক হলে দ্রুত করণীয়:\n\n১. অবিলম্বে facebook.com/hacked লিংকে যান এবং একাউন্ট রিকভার করুন।\n২. বন্ধুদের সতর্ক করুন যেন কেউ টাকা না পাঠায়।\n৩. প্রয়োজন হলে স্থানীয় থানায় যোগাযোগ করুন। নারী ভুক্তভোগীদের জন্য Police Cyber Support for Women: ০১৩২০০০০৮৮৮।',
        'suggestions': [
          'ব্ল্যাকমেইল করলে কীভাবে থানায় জিডি করব?',
          'টু-ফ্যাক্টর অথেনটিকেশন কীভাবে চালু করব?',
        ],
        'hotlines': [
          {'name': 'Police Cyber Support for Women', 'number': '01320000888'},
          {'name': 'জরুরি সেবা ৯৯৯', 'number': '999'},
        ],
      };
    }
    if (text.contains('টাকা') ||
        text.contains('প্রতারিত') ||
        text.contains('scam')) {
      return {
        'reply':
            'টাকা খোয়া গেলে দ্রুত করণীয়:\n\n১. দ্রুত বিকাশ (১৬২৪৭) বা নগদে (১৬১৬৭) কল দিয়ে সন্দেহজনক লেনদেন রিপোর্ট করুন এবং কী ব্যবস্থা সম্ভব জেনে নিন। টাকা ফেরত পাওয়ার নিশ্চয়তা নেই।\n২. ট্রানজেকশন আইডি ও প্রমাণ নিয়ে নিকটস্থ থানায় সাইবার ক্রাইম জিডি দায়ের করুন।',
        'suggestions': [
          'SafeLink থেকে ১-ক্লিক পুলিশ জিডি বানাব কীভাবে?',
          'লেনদেনের প্রমাণ কীভাবে সংরক্ষণ করব?',
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
      ],
    };
  }

  void showCyberAssistantBottomSheet([String? initialPrompt]) {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => CyberAssistantSheet(
            api: api,
            onDial: _dialPhone,
            localAdvice: _getOfflineCyberAdvice,
            initialPrompt: initialPrompt));
  }

  List<Widget> threatRadarPage() => [
        title('Scam awareness'),
        Text(
            'Common patterns to check for. These examples are educational; they are not national incident statistics or a live threat feed.'),
        SizedBox(height: 18),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.password, color: Colors.red),
              title: Text('PIN and OTP requests'),
              subtitle: Text(
                  'Do not share account secrets with anyone who contacts you.')),
          ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.link, color: Colors.orange),
              title: Text('Lookalike domains'),
              subtitle: Text(
                  'A familiar brand name in a URL does not prove that the site belongs to that brand.')),
          ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.card_giftcard, color: Colors.orange),
              title: Text('Prize fees and urgent payments'),
              subtitle: Text(
                  'Verify unexpected offers independently before sending money.')),
        ])),
        panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          title('How scans work'),
          Text(
              'The server checks message patterns and domain structure. Optional external checks report their own availability. A risk score is an indicator, not an accuracy estimate.'),
          SizedBox(height: 14),
          FilledButton.icon(
              icon: Icon(Icons.play_arrow),
              label: Text('Try a scam message example'),
              onPressed: () => loadDemoScenario('message',
                  'Apnar bKash account bondho! Ekhoni https://bkash-verify.example e PIN din.')),
        ])),
      ];

  void loadDemoScenario(String scenarioKind, String scenarioText) {
    setState(() {
      page = 0;
      kind = scenarioKind;
      input.text = scenarioText;
      input.selection =
          TextSelection.fromPosition(TextPosition(offset: scenarioText.length));
      result = null;
    });
    scanText();
  }

  Widget _assistantQuickPromptChip(String promptText) => ActionChip(
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.symmetric(horizontal: 4),
        avatar: Icon(Icons.auto_awesome, size: 12, color: green),
        backgroundColor: green.withValues(alpha: 0.08),
        side: BorderSide(color: green.withValues(alpha: 0.25)),
        label: Text(
          promptText,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: green,
          ),
        ),
        onPressed: () => showCyberAssistantBottomSheet(promptText),
      );

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
          side: BorderSide(color: color.withValues(alpha: 0.45), width: 1.4),
        ),
        color: Colors.white,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(icon, size: 18, color: color),
                        ),
                        SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF10212C),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: Color(0xFFF8FAFC),
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
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.bolt, size: 14, color: color),
                        SizedBox(width: 3),
                        Flexible(
                          child: Text(
                            '১-ট্যাপ অটো-স্ক্যান',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            'Test Scenario',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: color,
                            ),
                          ),
                        ),
                        SizedBox(width: 2),
                        Icon(Icons.arrow_forward_rounded,
                            size: 14, color: color),
                      ],
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
        builder: (ctx) => SafeArea(
            child: ConstrainedBox(
                constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(ctx).height * .8),
                child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.all(20),
                    children: [
                      title('Security alert deliveries'),
                      Text(
                          'Alerts are sent only when you request an email. Background push notifications and a national threat feed are not available.'),
                      SizedBox(height: 14),
                      if (user == null)
                        Text('Sign in to view your email alert records.')
                      else if (alerts.isEmpty)
                        Text(
                            'No alert records loaded. Open Family to refresh your records.'),
                      for (final alert in alerts.reversed.take(20))
                        ListTile(
                            leading: Icon(Icons.mail_outline, color: green),
                            title: Text(alert['status']?.toString() ??
                                'Unknown status'),
                            subtitle:
                                Text(alert['createdAt']?.toString() ?? '')),
                      SizedBox(height: 12),
                      FilledButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: Text('Close')),
                    ]))));
  }

  void showOfflineDirectoryDialog() {
    const entries = [
      {
        'name': 'bKash',
        'number': '16247',
        'note': 'Account support',
        'source': 'https://www.bkash.com/en/page/terms-of-use-bkash-app'
      },
      {
        'name': 'Nagad',
        'number': '16167',
        'note': 'Account support',
        'source': 'https://nagadislamic.com.bd/bn/terms-and-conditions/'
      },
      {
        'name': 'Dutch-Bangla Bank / Rocket',
        'number': '16216',
        'note': 'Account support',
        'source':
            'https://www.dutchbanglabank.com/complaint-cell/central-customer-services.html'
      },
      {
        'name': 'Police Cyber Support for Women',
        'number': '01320000888',
        'note': 'For women affected by cybercrime',
        'source': 'https://www.police.gov.bd/en/police_cyber_support_for_women'
      },
      {
        'name': 'Emergency services',
        'number': '999',
        'note': 'Immediate danger or emergency',
        'source': 'https://telecom-police.portal.gov.bd'
      },
    ];
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => SafeArea(
            child: SizedBox(
                height: MediaQuery.sizeOf(ctx).height * .8,
                child: ListView(padding: EdgeInsets.all(20), children: [
                  title('Saved support directory'),
                  Text(
                      'This guide is stored in the app and can be read offline. Scans require the server. Contacts checked 4 October 2026; confirm current details on the official website.'),
                  SizedBox(height: 14),
                  for (final entry in entries)
                    Card(
                        child: Padding(
                            padding: EdgeInsets.all(14),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(entry['name']!,
                                      style: TextStyle(
                                          fontWeight: FontWeight.bold)),
                                  Text(entry['note']!),
                                  SizedBox(height: 4),
                                  SelectableText(entry['source']!,
                                      style: TextStyle(fontSize: 11)),
                                  TextButton.icon(
                                      icon: Icon(Icons.phone_outlined),
                                      onPressed: () =>
                                          _dialPhone(entry['number']!),
                                      label: Text(
                                          'Dial / copy ${entry['number']}')),
                                ]))),
                  SizedBox(height: 12),
                  Text(
                      'পিন বা ওটিপি কাউকে দেবেন না। সন্দেহজনক লেনদেনের রেফারেন্স ও স্ক্রিনশট রাখুন। SafeLink অ্যাকাউন্ট লক, টাকা উদ্ধার বা অভিযোগ জমা দিতে পারে না।'),
                  SizedBox(height: 12),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('Close')),
                ]))));
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
            method: 'POST',
            body: {'name': name.text.trim(), 'email': email.text.trim()});
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
      final alert = await api.call('/alerts',
          method: 'POST',
          body: {'scanId': selected, 'contactId': contact['id']});
      message('Alert status: ${alert['status'] ?? 'unknown'}');
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
                      try {
                        await api.logout();
                      } finally {
                        _clearAccount();
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
          SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Clipboard suggestions'),
              subtitle: Text(
                  'Read your clipboard when you return to SafeLink. Off by default; manual paste always works.'),
              value: clipboardSuggestionsEnabled,
              onChanged: (value) => setState(() {
                    clipboardSuggestionsEnabled = value;
                    if (!value) _showClipboardBanner = false;
                  })),
          Text(
              'Images are processed in memory. Raw message and OCR text are not saved in history. External checks are optional and send content to configured providers. Remove sensitive information before scanning.\n\nA low score is not a guarantee of safety. We do not visit suspicious links or follow redirects.\n\nUse the website for community reports and the full threat dashboard.')
        ]))
      ];
}

class CyberAssistantSheet extends StatefulWidget {
  final SafeLinkApi api;
  final Future<void> Function(String) onDial;
  final Map<String, dynamic> Function(String) localAdvice;
  final String? initialPrompt;
  const CyberAssistantSheet(
      {super.key,
      required this.api,
      required this.onDial,
      required this.localAdvice,
      this.initialPrompt});
  @override
  State<CyberAssistantSheet> createState() => _CyberAssistantSheetState();
}

class _CyberAssistantSheetState extends State<CyberAssistantSheet> {
  final textController = TextEditingController();
  final scrollController = ScrollController();
  final messages = <Map<String, dynamic>>[
    {
      'role': 'assistant',
      'text':
          'অনলাইন নিরাপত্তা বিষয়ে সাধারণ পরামর্শ দিতে পারি। পিন, ওটিপি বা পাসওয়ার্ড লিখবেন না। SafeLink অ্যাকাউন্ট ফ্রিজ বা অভিযোগ জমা দেয় না।',
      'source': 'local',
      'suggestions': [
        'বিকাশ/নগদ পিন কেউ চাইলে কি করব?',
        'আমার একাউন্ট হ্যাক হলে কি করব?'
      ],
    }
  ];
  bool external = false;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialPrompt != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) send(widget.initialPrompt);
      });
    }
  }

  @override
  void dispose() {
    textController.dispose();
    scrollController.dispose();
    super.dispose();
  }

  void scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && scrollController.hasClients) {
        scrollController.animateTo(scrollController.position.maxScrollExtent,
            duration: Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  Future<void> send([String? preset]) async {
    final query = (preset ?? textController.text).trim();
    if (query.isEmpty || sending || !mounted) return;
    final history = messages.skip(1).toList();
    final recent = history
        .skip(history.length > 4 ? history.length - 4 : 0)
        .map((m) => {'role': m['role'], 'content': m['text']})
        .toList();
    setState(() {
      messages.add({'role': 'user', 'text': query});
      sending = true;
      textController.clear();
    });
    scrollToBottom();
    Map<String, dynamic> reply;
    try {
      final data = await widget.api.call('/assistant',
          method: 'POST',
          body: {'message': query, 'history': recent, 'external': external});
      if (data is! Map || data['reply'] is! String) {
        throw const ApiException('Unexpected assistant response.');
      }
      reply = Map<String, dynamic>.from(data);
    } catch (_) {
      reply = {
        ...widget.localAdvice(query),
        'source': 'local',
        'offline': true
      };
    }
    if (!mounted) return;
    setState(() {
      messages.add({...reply, 'role': 'assistant', 'text': reply['reply']});
      sending = false;
    });
    scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return SafeArea(
        child: SizedBox(
      height: MediaQuery.sizeOf(context).height * .88,
      child: Column(children: [
        Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 8, 0),
            child: Row(children: [
              Icon(Icons.smart_toy_outlined, color: green),
              SizedBox(width: 10),
              Expanded(
                  child: Text('সাইবার নিরাপত্তা সহকারী',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16))),
              IconButton(
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Close assistant',
                  icon: Icon(Icons.close)),
            ])),
        SwitchListTile(
            dense: true,
            title: Text('Optional external AI'),
            subtitle: Text(
                'On: your question and recent chat are sent to the configured AI provider. Off: local guidance.'),
            value: external,
            onChanged:
                sending ? null : (value) => setState(() => external = value)),
        Divider(height: 1),
        Expanded(
            child: ListView.builder(
                controller: scrollController,
                padding: EdgeInsets.all(14),
                itemCount: messages.length,
                itemBuilder: (_, index) {
                  final msg = messages[index];
                  final isUser = msg['role'] == 'user';
                  final hotlines = (msg['hotlines'] as List?) ?? [];
                  return Align(
                      alignment:
                          isUser ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: EdgeInsets.symmetric(vertical: 6),
                        padding: EdgeInsets.all(12),
                        decoration: BoxDecoration(
                            color: isUser
                                ? colors.primaryContainer
                                : colors.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(14)),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!isUser)
                                Text(
                                    msg['source'] == 'ai'
                                        ? 'External AI · may be wrong'
                                        : msg['externalUsed'] == true
                                            ? 'External AI attempted · local guidance shown'
                                            : msg['offline'] == true
                                                ? 'Offline local guidance'
                                                : 'Local safety guidance',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: colors.onSurfaceVariant)),
                              SizedBox(height: 4),
                              SelectableText(msg['text']?.toString() ?? '',
                                  style: TextStyle(fontSize: 13, height: 1.45)),
                              if (hotlines.isNotEmpty)
                                Wrap(spacing: 6, runSpacing: 6, children: [
                                  for (final hotline in hotlines)
                                    if (hotline is Map)
                                      ActionChip(
                                          avatar: Icon(Icons.phone_outlined,
                                              size: 16),
                                          label: Text(
                                              '${hotline['name']}: ${hotline['number']}'),
                                          onPressed: () => widget.onDial(
                                              hotline['number']?.toString() ??
                                                  '')),
                                ]),
                            ]),
                      ));
                })),
        if (sending) LinearProgressIndicator(),
        if ((messages.last['suggestions'] as List?)?.isNotEmpty == true)
          SizedBox(
              height: 46,
              child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  children: [
                    for (final suggestion
                        in messages.last['suggestions'] as List)
                      Padding(
                          padding: EdgeInsets.only(right: 6),
                          child: ActionChip(
                              label: Text(suggestion.toString()),
                              onPressed: sending
                                  ? null
                                  : () => send(suggestion.toString()))),
                  ])),
        Padding(
            padding: EdgeInsets.fromLTRB(
                14, 8, 14, 12 + MediaQuery.viewInsetsOf(context).bottom),
            child: Row(children: [
              Expanded(
                  child: TextField(
                      controller: textController,
                      maxLength: 3000,
                      maxLines: 2,
                      minLines: 1,
                      decoration: InputDecoration(
                          hintText: 'প্রশ্ন লিখুন…', counterText: ''),
                      onSubmitted: (_) => send())),
              SizedBox(width: 8),
              IconButton.filled(
                  tooltip: 'Send question',
                  onPressed: sending ? null : () => send(),
                  icon: Icon(Icons.send)),
            ])),
      ]),
    ));
  }
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
                  final values = capture.barcodes
                      .where((b) => b.rawValue?.trim().isNotEmpty == true);
                  if (values.isEmpty) return;
                  done = true;
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
                                enabled: !busy,
                                maxLength: 80,
                                decoration: InputDecoration(labelText: 'Name'),
                                validator: (s) => (s?.trim().length ?? 0) < 2
                                    ? 'Enter your name.'
                                    : null),
                            SizedBox(height: 18)
                          ],
                          TextFormField(
                              controller: email,
                              enabled: !busy,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              decoration: InputDecoration(labelText: 'Email'),
                              validator: (s) => s?.contains('@') == true
                                  ? null
                                  : 'Enter a valid email.'),
                          SizedBox(height: 18),
                          TextFormField(
                              controller: password,
                              enabled: !busy,
                              maxLength: 128,
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
                              onPressed: busy
                                  ? null
                                  : () => setState(() {
                                        register = !register;
                                        error = null;
                                      }),
                              child: Text(register
                                  ? 'Already have an account? Sign in'
                                  : 'Create an account')),
                          TextButton(
                              onPressed: busy
                                  ? null
                                  : () async {
                                      setState(() {
                                        busy = true;
                                        error = null;
                                      });
                                      try {
                                        final data = await widget.api.call(
                                            '/auth/forgot',
                                            method: 'POST',
                                            body: {'email': email.text.trim()});
                                        if (mounted) {
                                          setState(
                                              () => error = data['message']);
                                        }
                                      } catch (e) {
                                        if (mounted) {
                                          setState(() => error = e.toString());
                                        }
                                      } finally {
                                        if (mounted) {
                                          setState(() => busy = false);
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
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: Text('Save & Connect')),
        ],
      );
}
