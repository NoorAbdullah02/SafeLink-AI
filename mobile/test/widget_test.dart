import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:safelink_ai/api.dart';
import 'package:safelink_ai/main.dart';

class FakeApi extends SafeLinkApi {
  final Completer<dynamic>? assistant;
  Map<String, dynamic>? assistantBody;
  FakeApi({this.assistant, super.storage});
  final calls = <String>[];
  Completer<Map<String, dynamic>>? scanPending;
  final scans = <Map<String, dynamic>>[];
  final images = <Map<String, dynamic>>[];
  Map<String, dynamic>? account;
  int historyLoads = 0;
  @override
  Future<void> restore() async {
    if (account != null) token = 'test-session';
  }

  @override
  Future<Map<String, dynamic>> scan(
      String text, String kind, bool external) async {
    scans.add({'text': text, 'kind': kind, 'external': external});
    return scanPending?.future ?? scanFixture();
  }

  @override
  Future<Map<String, dynamic>> image(
      XFile file, String kind, bool external) async {
    images.add({'kind': kind, 'external': external});
    return scanFixture();
  }

  @override
  Future<dynamic> call(String path,
      {String method = 'GET', Map<String, dynamic>? body}) async {
    calls.add('$method $path');
    if (path == '/assistant') {
      assistantBody = body;
      return assistant?.future ?? {'reply': 'Local advice', 'source': 'local'};
    }
    if (path == '/me') return account;
    if (path == '/scans') {
      historyLoads++;
      return [scanFixture()];
    }
    if (path == '/contacts' || path == '/alerts') return [];
    return {'storage': 'temporary-memory'};
  }
}

class ServerWriteFailureStorage extends FlutterSecureStorage {
  @override
  Future<void> write(
      {required String key,
      required String? value,
      IOSOptions? iOptions,
      AndroidOptions? aOptions,
      LinuxOptions? lOptions,
      WebOptions? webOptions,
      MacOsOptions? mOptions,
      WindowsOptions? wOptions}) {
    if (key == 'api_url') throw PlatformException(code: 'storage-unavailable');
    return super.write(
        key: key,
        value: value,
        iOptions: iOptions,
        aOptions: aOptions,
        lOptions: lOptions,
        webOptions: webOptions,
        mOptions: mOptions,
        wOptions: wOptions);
  }
}

Map<String, dynamic> scanFixture() => {
      'id': 'fixture-scan',
      'kind': 'message',
      'score': 65,
      'level': 'High risk',
      'threatType': 'Credential request',
      'evidence': [
        {
          'id': 'credentials',
          'title': 'Credential request',
          'detail': 'Example secret request',
          'source': 'local',
          'weight': 65
        }
      ],
      'checks': [
        {
          'name': 'Local rules',
          'status': 'complete',
          'detail': 'Local analysis only'
        }
      ],
      'explanation': 'Illustrative result for UI regression testing.',
      'recommendation': 'Verify independently.',
      'preview': 'Message content hidden',
      'createdAt': '2026-10-04T00:00:00Z',
      'persisted': false,
    };

class FakePicker extends ImagePicker {
  final Completer<XFile?>? pending;
  final LostDataResponse? recovered;
  double? requestedWidth;
  FakePicker({this.pending, this.recovered});
  @override
  Future<XFile?> pickImage(
      {required ImageSource source,
      double? maxWidth,
      double? maxHeight,
      int? imageQuality,
      CameraDevice preferredCameraDevice = CameraDevice.rear,
      bool requestFullMetadata = true}) async {
    requestedWidth = maxWidth;
    return pending?.future;
  }

  @override
  Future<LostDataResponse> retrieveLostData() async =>
      recovered ?? LostDataResponse.empty();
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final width in [320.0, 768.0, 1440.0]) {
    testWidgets('Scanner adapts to width $width', (tester) async {
      tester.view.physicalSize = Size(width, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = FakeApi();
      addTearDown(api.close);
      await tester.pumpWidget(SafeLinkApp(api: api));
      await tester.pumpAndSettle();
      expect(find.text('SafeLink AI'), findsOneWidget);
      expect(find.text('A safer click starts here.'), findsOneWidget);
      expect(find.text('Scan Now'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('History requires an account', (tester) async {
    final api = FakeApi();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('Your scan history'), findsOneWidget);
    expect(find.text('Sign in to access your personal workspace.'),
        findsOneWidget);
  });
  testWidgets('System dark mode keeps the supported light UI readable',
      (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    final api = FakeApi();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    final theme = Theme.of(tester.element(find.byType(Workspace)));
    expect(theme.brightness, Brightness.light);
    expect(theme.scaffoldBackgroundColor, Color(0xfff5f7f9));
    expect(find.text('A safer click starts here.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Core pages and support guide fit 320px at 180% text scale',
      (tester) async {
    tester.view.physicalSize = Size(320, 1000);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final api = FakeApi();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('Message'));
    await tester.pumpAndSettle();
    expect(find.text('Message').hitTestable(), findsOneWidget);
    await tester.tap(find.text('Message'));
    await tester.pumpAndSettle();
    expect(
        tester.widget<TextField>(find.byType(TextField)).decoration?.labelText,
        'Message to analyze');
    for (var step = 0; step < 4; step++) {
      await tester.drag(find.byType(Scrollable).first, Offset(0, -650));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Message demo cards');
    }
    for (final label in ['Learn', 'History', 'Family', 'Account']) {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: label);
    }
    await tester.tap(find.byTooltip('অফলাইন ডিরেক্টরি'));
    await tester.pumpAndSettle();
    expect(find.text('Saved support directory'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Awareness does not invent live national statistics',
      (tester) async {
    final api = FakeApi();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Learn'));
    await tester.pumpAndSettle();
    expect(find.text('Scam awareness'), findsOneWidget);
    expect(find.textContaining('not national incident statistics'),
        findsOneWidget);
    expect(find.textContaining('42%'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Assistant defaults to local, survives dismissal during request',
      (tester) async {
    final pending = Completer<dynamic>();
    final api = FakeApi(assistant: pending);
    addTearDown(api.close);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: Scaffold(
            body: CyberAssistantSheet(
          api: api,
          onDial: (_) async {},
          localAdvice: (_) => {'reply': 'Fallback'},
        ))));
    await tester.enterText(find.byType(TextField), 'Help with OTP');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pump();
    expect(api.assistantBody!['external'], isFalse);
    expect(api.assistantBody!['history'], isEmpty);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: Scaffold()));
    pending.complete({'reply': 'Late reply', 'source': 'local'});
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  testWidgets(
      'Text scan holds input steady and editing clears the previous result',
      (tester) async {
    tester.view.physicalSize = Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = FakeApi()..scanPending = Completer<Map<String, dynamic>>();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byType(TextField), 'https://example.test please send PIN');
    await tester.ensureVisible(find.text('Scan Now'));
    await tester.tap(find.text('Scan Now'));
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
    expect(api.scans.single['kind'], 'message');
    api.scanPending!.complete(scanFixture());
    await tester.pumpAndSettle();
    final dynamic state = tester.state(find.byType(Workspace));
    expect(state.result, isNotNull);
    await tester.ensureVisible(find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'Different message');
    await tester.pump();
    expect(state.result, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('History refresh requested during a scan runs after that scan',
      (tester) async {
    tester.view.physicalSize = Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = FakeApi()
      ..account = {
        'name': 'Test',
        'email': 'test@example.test',
        'simpleMode': false
      }
      ..scanPending = Completer<Map<String, dynamic>>();
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Send your PIN now');
    await tester.ensureVisible(find.text('Scan Now'));
    await tester.tap(find.text('Scan Now'));
    await tester.pump();
    await tester.tap(find.text('History'));
    await tester.pump();
    expect(api.historyLoads, 0);
    api.scanPending!.complete(scanFixture());
    await tester.pumpAndSettle();
    expect(api.historyLoads, 1);
    expect(find.text('High risk · 65/100'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Gallery selection locks the scan and cancellation restores it',
      (tester) async {
    tester.view.physicalSize = Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = FakeApi();
    addTearDown(api.close);
    final picker = FakePicker(pending: Completer<XFile?>());
    await tester.pumpWidget(SafeLinkApp(api: api, imagePicker: picker));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Screenshot'));
    await tester.tap(find.text('Screenshot'));
    await tester.pump();
    final dynamic state = tester.state(find.byType(Workspace));
    expect(state.busy, isTrue);
    expect(
        tester
            .widget<OutlinedButton>(
                find.widgetWithText(OutlinedButton, 'Screenshot'))
            .onPressed,
        isNull);
    expect(picker.requestedWidth, 2200);
    picker.pending!.complete(null);
    await tester.pumpAndSettle();
    expect(state.busy, isFalse);
    expect(
        tester
            .widget<OutlinedButton>(
                find.widgetWithText(OutlinedButton, 'Screenshot'))
            .onPressed,
        isNotNull);
    expect(await api.storage.read(key: 'pending_image_kind'), isNull);
    expect(api.images, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Recovered gallery scan restores QR kind and requires fresh external consent',
      (tester) async {
    final api = FakeApi();
    addTearDown(api.close);
    final picker = FakePicker(
        recovered: LostDataResponse(files: [
      XFile.fromData(Uint8List.fromList([1, 2, 3]), name: 'qr.png')
    ], type: RetrieveType.image));
    await api.storage.write(key: 'pending_image_kind', value: 'qr');
    await tester.pumpWidget(SafeLinkApp(api: api, imagePicker: picker));
    await tester.pumpAndSettle();
    final dynamic state = tester.state(find.byType(Workspace));
    state.external = true;
    await state.recoverLostImage();
    await tester.pumpAndSettle();
    expect(api.images.single, {'kind': 'qr', 'external': false});
    expect(await api.storage.read(key: 'pending_image_kind'), isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Server storage failure clears old account and cannot restore its token',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({
      'session': 'old-session',
      'session_api_base': SafeLinkApi.defaultBase,
    });
    final storage = ServerWriteFailureStorage();
    final api = FakeApi(storage: storage)
      ..account = {
        'name': 'Old account',
        'email': 'old@example.test',
        'simpleMode': false,
      };
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    final dynamic state = tester.state(find.byType(Workspace));
    expect(state.user, isNotNull);
    unawaited(state.changeServerUrl());
    await tester.pumpAndSettle();
    await tester.enterText(
        find.descendant(
            of: find.byType(ServerDialog), matching: find.byType(TextField)),
        'https://new.example.test');
    await tester.tap(find.text('Save & Connect'));
    await tester.pumpAndSettle();
    expect(api.base, 'https://new.example.test');
    expect(api.token, isNull);
    expect(state.user, isNull);
    expect(state.history, isEmpty);
    final restored = SafeLinkApi(storage: storage);
    addTearDown(restored.close);
    await restored.restore();
    expect(restored.base, SafeLinkApi.defaultBase);
    expect(restored.token, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Closing sign-in during request never creates a hidden session',
      (tester) async {
    final response = Completer<http.Response>();
    final api = SafeLinkApi(client: MockClient((_) async => response.future));
    addTearDown(api.close);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: Builder(
            builder: (context) => Scaffold(
                body: TextButton(
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                            builder: (_) => AuthPage(api: api))),
                    child: Text('Open sign-in'))))));
    await tester.tap(find.text('Open sign-in'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byType(TextFormField).at(0), 'fixture@example.test');
    await tester.enterText(
        find.byType(TextFormField).at(1), 'fixture-password');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump();
    Navigator.of(tester.element(find.byType(AuthPage))).pop();
    await tester.pumpAndSettle();
    response.complete(http.Response(
        jsonEncode({
          'token': 'late-session',
          'user': {'name': 'Fixture'},
        }),
        200));
    await tester.pumpAndSettle();
    expect(api.token, isNull);
    expect(await api.storage.read(key: 'session'), isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Assistant ignores malformed optional response fields',
      (tester) async {
    final response = Completer<dynamic>();
    final api = FakeApi(assistant: response);
    addTearDown(api.close);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: Scaffold(
            body: CyberAssistantSheet(
                api: api,
                onDial: (_) async {},
                localAdvice: (_) => {'reply': 'Fallback'}))));
    await tester.enterText(
        find.byType(TextField), 'Help with a suspicious message');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pump();
    response.complete(
        {'reply': 'Advice', 'suggestions': 'invalid-list', 'hotlines': 123});
    await tester.pumpAndSettle();
    expect(find.text('Advice'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Assistant unauthorized response clears account UI and keeps local guidance',
      (tester) async {
    FlutterSecureStorage.setMockInitialValues({
      'session': 'expired-session',
      'session_api_base': SafeLinkApi.defaultBase,
    });
    final api = SafeLinkApi(client: MockClient((request) async {
      if (request.url.path == '/api/assistant') {
        return http.Response('{"error":"Session expired"}', 401);
      }
      if (request.url.path == '/api/me') {
        return http.Response(
            jsonEncode({
              'name': 'Fixture',
              'email': 'fixture@example.test',
              'simpleMode': false,
            }),
            200);
      }
      return http.Response('{"storage":"temporary-memory"}', 200);
    }));
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    final dynamic state = tester.state(find.byType(Workspace));
    expect(state.user, isNotNull);
    state.history = [scanFixture()];
    state.contacts = [
      {'id': 'fixture-contact', 'name': 'Fixture'}
    ];
    state.alerts = [
      {'id': 'fixture-alert'}
    ];
    state.showCyberAssistantBottomSheet();
    await tester.pumpAndSettle();
    await tester.enterText(
        find.descendant(
            of: find.byType(CyberAssistantSheet),
            matching: find.byType(TextField)),
        'Help with OTP');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pumpAndSettle();
    expect(api.token, isNull);
    expect(state.user, isNull);
    expect(state.history, isEmpty);
    expect(state.contacts, isEmpty);
    expect(state.alerts, isEmpty);
    expect(find.text('Offline local guidance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Oversized Unicode assistant preset is rejected before a request',
      (tester) async {
    final api = FakeApi();
    addTearDown(api.close);
    await tester.pumpWidget(MaterialApp(
        theme: ThemeData(splashFactory: InkRipple.splashFactory),
        home: Scaffold(
            body: CyberAssistantSheet(
                api: api,
                onDial: (_) async {},
                initialPrompt: List.filled(1600, '🙂').join(),
                localAdvice: (_) => {'reply': 'Fallback'}))));
    await tester.pumpAndSettle();
    expect(api.assistantBody, isNull);
    expect(
        find.text('Keep the question within 3000 characters.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Contact confirmation cannot post into a changed session',
      (tester) async {
    final api = FakeApi()
      ..account = {
        'name': 'Fixture',
        'email': 'fixture@example.test',
        'simpleMode': false,
      };
    addTearDown(api.close);
    await tester.pumpWidget(SafeLinkApp(api: api));
    await tester.pumpAndSettle();
    final dynamic state = tester.state(find.byType(Workspace));
    unawaited(state.addContact());
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'Trusted person');
    await tester.enterText(
        find.byType(TextFormField).at(1), 'trusted@example.test');
    await api.clearSession();
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    expect(api.calls, isNot(contains('POST /contacts')));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'Auth contact server and assistant forms fit 320px at 180% with keyboard',
      (tester) async {
    tester.view.physicalSize = Size(320, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final api = FakeApi();
    addTearDown(api.close);
    final theme = ThemeData(splashFactory: InkRipple.splashFactory);
    await tester
        .pumpWidget(MaterialApp(theme: theme, home: AuthPage(api: api)));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Create an account'));
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    tester.view.viewInsets = FakeViewPadding(bottom: 280);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(TextFormField).first);
    expect(tester.takeException(), isNull,
        reason: 'Registration with keyboard');
    tester.view.resetViewInsets();
    await tester.pumpWidget(MaterialApp(
        theme: theme,
        home: Builder(
            builder: (context) => Scaffold(
                    body: Column(children: [
                  TextButton(
                      onPressed: () => showDialog<void>(
                          context: context,
                          builder: (_) => TrustedContactDialog()),
                      child: Text('Open contact')),
                  TextButton(
                      onPressed: () => showDialog<void>(
                          context: context,
                          builder: (_) => ServerDialog(initialUrl: api.base)),
                      child: Text('Open server')),
                  TextButton(
                      onPressed: () => showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          builder: (_) => CyberAssistantSheet(
                              api: api,
                              onDial: (_) async {},
                              localAdvice: (_) => {'reply': 'Fallback'})),
                      child: Text('Open assistant')),
                ])))));
    await tester.pumpAndSettle();
    for (final label in ['Open contact', 'Open server', 'Open assistant']) {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      tester.view.viewInsets = FakeViewPadding(bottom: 280);
      await tester.pumpAndSettle();
      if (label == 'Open contact') {
        await tester.tap(find.text('Add'));
        await tester.pumpAndSettle();
        expect(find.text('Use 2–80 characters.'), findsOneWidget);
      }
      expect(tester.takeException(), isNull, reason: '$label with keyboard');
      final route = label == 'Open contact'
          ? find.byType(TrustedContactDialog)
          : label == 'Open server'
              ? find.byType(ServerDialog)
              : find.byType(CyberAssistantSheet);
      Navigator.of(tester.element(route)).pop();
      await tester.pumpAndSettle();
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: '$label dismissal');
    }
  });
}
