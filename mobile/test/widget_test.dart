import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:safelink_ai/api.dart';
import 'package:safelink_ai/main.dart';

class FakeApi extends SafeLinkApi {
  final Completer<dynamic>? assistant;
  Map<String, dynamic>? assistantBody;
  FakeApi({this.assistant});
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
    expect(tester.widget<TextField>(find.byType(TextField)).decoration?.labelText,
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
}
