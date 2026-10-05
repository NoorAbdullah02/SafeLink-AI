import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:safelink_ai/api.dart';

class FaultyStorage extends FlutterSecureStorage {
  final values = <String, String>{};
  bool failDelete = false, failAllWrites = false, failSessionWrite = false;
  Completer<void>? pendingSessionWrite;
  @override
  Future<String?> read(
          {required String key,
          IOSOptions? iOptions,
          AndroidOptions? aOptions,
          LinuxOptions? lOptions,
          WebOptions? webOptions,
          MacOsOptions? mOptions,
          WindowsOptions? wOptions}) async =>
      values[key];
  @override
  Future<void> write(
      {required String key,
      required String? value,
      IOSOptions? iOptions,
      AndroidOptions? aOptions,
      LinuxOptions? lOptions,
      WebOptions? webOptions,
      MacOsOptions? mOptions,
      WindowsOptions? wOptions}) async {
    if (failAllWrites || (failSessionWrite && key == 'session')) {
      throw PlatformException(code: 'storage-unavailable');
    }
    if (key == 'session') await pendingSessionWrite?.future;
    if (value == null) {
      values.remove(key);
    } else {
      values[key] = value;
    }
  }

  @override
  Future<void> delete(
      {required String key,
      IOSOptions? iOptions,
      AndroidOptions? aOptions,
      LinuxOptions? lOptions,
      WebOptions? webOptions,
      MacOsOptions? mOptions,
      WindowsOptions? wOptions}) async {
    if (failDelete) throw PlatformException(code: 'storage-unavailable');
    values.remove(key);
  }
}

class DelayedImage extends XFile {
  final bytes = Completer<Uint8List>();
  DelayedImage() : super('fixture.png');
  @override
  Future<int> length() async => 3;
  @override
  Future<Uint8List> readAsBytes() => bytes.future;
}

http.Response sessionResponse() => http.Response(
    jsonEncode({
      'token': 'fixture-session',
      'user': {'name': 'Fixture'},
    }),
    200);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('Server switch never forwards the previous bearer session', () async {
    final requests = <http.Request>[];
    final api = SafeLinkApi(client: MockClient((request) async {
      requests.add(request);
      if (request.url.path.endsWith('/login')) {
        return http.Response(
            jsonEncode({
              'token': 'test-session',
              'user': {'name': 'Tester'}
            }),
            200);
      }
      return http.Response('{}', 200);
    }));
    addTearDown(api.close);
    await api.authenticate('login', 'user@example.test', 'test-password', '');
    await api.setBaseUrl('https://different.example.test/api/');
    await api.call('/health');
    expect(api.base, 'https://different.example.test');
    expect(api.token, isNull);
    expect(requests.last.headers['Authorization'], isNull);
    expect(await api.storage.read(key: 'session'), isNull);
  });

  test('Local development server survives restore', () async {
    FlutterSecureStorage.setMockInitialValues({
      'api_url': 'http://192.168.1.5:3001',
      'session_api_base': 'http://192.168.1.5:3001',
      'session': 'test-session',
    });
    final api = SafeLinkApi();
    addTearDown(api.close);
    await api.restore();
    expect(api.base, 'http://192.168.1.5:3001');
    expect(api.token, 'test-session');
  });

  test('Unbound legacy session is cleared during restore', () async {
    FlutterSecureStorage.setMockInitialValues({'session': 'legacy-session'});
    final api = SafeLinkApi();
    addTearDown(api.close);
    await api.restore();
    expect(api.token, isNull);
  });

  test('Logout clears local session even when the server is unavailable',
      () async {
    final api = SafeLinkApi(client: MockClient((_) async {
      throw http.ClientException('Offline');
    }));
    addTearDown(api.close);
    api.token = 'test-session';
    await api.storage.write(key: 'session', value: api.token);
    await expectLater(api.logout(), throwsA(isA<ApiException>()));
    expect(api.token, isNull);
    expect(await api.storage.read(key: 'session'), isNull);
  });

  test('Unauthorized response clears expired session', () async {
    final api = SafeLinkApi(
        client: MockClient(
            (_) async => http.Response('{"error":"Sign in again"}', 401)));
    addTearDown(api.close);
    api.token = 'test-session';
    await expectLater(
        api.call('/me'),
        throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    expect(api.token, isNull);
  });

  test('Redirects are rejected before bearer credentials can be forwarded',
      () async {
    final api = SafeLinkApi(client: MockClient((request) async {
      expect(request.followRedirects, isFalse);
      return http.Response('', 302,
          headers: {'location': 'https://other.example.test'});
    }));
    addTearDown(api.close);
    await expectLater(api.call('/health'), throwsA(isA<ApiException>()));
  });

  test('HTML server errors produce a readable failure', () async {
    final api = SafeLinkApi(
        client: MockClient(
            (_) async => http.Response('<html>Unavailable</html>', 502)));
    addTearDown(api.close);
    await expectLater(
        api.call('/health'),
        throwsA(isA<ApiException>().having(
            (e) => e.message, 'message', contains('unexpected response'))));
  });

  test('Timeout includes a stalled response body', () async {
    final stream = StreamController<List<int>>();
    final api = SafeLinkApi(
        timeout: Duration(milliseconds: 10),
        client: MockClient.streaming(
            (_, __) async => http.StreamedResponse(stream.stream, 200)));
    addTearDown(api.close);
    await expectLater(
        api.call('/health'),
        throwsA(isA<ApiException>()
            .having((e) => e.message, 'message', contains('too long'))));
    await stream.close();
  });

  test('Invalid server URLs cannot change the endpoint', () async {
    final api = SafeLinkApi();
    addTearDown(api.close);
    for (final value in [
      'https://user:pass@example.test',
      'https://example.test?token=x',
      'ftp://example.test',
      'https://'
    ]) {
      await expectLater(api.setBaseUrl(value), throwsA(isA<ApiException>()));
      expect(api.base, SafeLinkApi.defaultBase);
    }
  });
  test(
      'A late unauthorized response cannot clear a newly authenticated session',
      () async {
    final oldResponse = Completer<http.Response>();
    final api = SafeLinkApi(client: MockClient((request) async {
      if (request.url.path.endsWith('/me')) return oldResponse.future;
      return http.Response(
          jsonEncode({
            'token': 'new-session',
            'user': {'name': 'New user'}
          }),
          200);
    }));
    addTearDown(api.close);
    api.token = 'old-session';
    final oldRequest = api.call('/me');
    final oldCheck = expectLater(
        oldRequest,
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', isNot(401))));
    await api.authenticate('login', 'new@example.test', 'test-password', '');
    oldResponse.complete(http.Response('{"error":"Expired"}', 401));
    await oldCheck;
    expect(api.token, 'new-session');
    expect(await api.storage.read(key: 'session'), 'new-session');
  });

  test('An older login response cannot replace a newer login session',
      () async {
    final older = Completer<http.Response>();
    final newer = Completer<http.Response>();
    final api = SafeLinkApi(
        client: MockClient((request) async =>
            (jsonDecode(request.body)['email'] == 'old@example.test'
                    ? older
                    : newer)
                .future));
    addTearDown(api.close);
    final oldLogin =
        api.authenticate('login', 'old@example.test', 'test-password', '');
    final oldCheck = expectLater(oldLogin, throwsA(isA<ApiException>()));
    final newLogin =
        api.authenticate('login', 'new@example.test', 'test-password', '');
    newer.complete(http.Response(
        jsonEncode({
          'token': 'new-session',
          'user': {'name': 'New user'}
        }),
        200));
    await newLogin;
    older.complete(http.Response(
        jsonEncode({
          'token': 'old-session',
          'user': {'name': 'Old user'}
        }),
        200));
    await oldCheck;
    expect(api.token, 'new-session');
    expect(await api.storage.read(key: 'session'), 'new-session');
  });

  test('A result from the previous server is rejected after a server switch',
      () async {
    final response = Completer<http.Response>();
    final api = SafeLinkApi(client: MockClient((_) async => response.future));
    addTearDown(api.close);
    final request = api.call('/health');
    final check = expectLater(
        request,
        throwsA(isA<ApiException>()
            .having((e) => e.message, 'message', contains('changed'))));
    await api.setBaseUrl('https://new.example.test');
    response.complete(http.Response('{}', 200));
    await check;
    expect(api.base, 'https://new.example.test');
  });

  test('Unauthorized HTML errors retain status for account UI reset', () async {
    final api = SafeLinkApi(
        client: MockClient(
            (_) async => http.Response('<html>Expired</html>', 401)));
    addTearDown(api.close);
    api.token = 'expired-session';
    await expectLater(
        api.call('/me'),
        throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    expect(api.token, isNull);
  });

  test('Incomplete scan results fail before reaching the result widget',
      () async {
    final api = SafeLinkApi(
        client: MockClient((_) async => http.Response('{"score":12}', 200)));
    addTearDown(api.close);
    await expectLater(
        api.scan('Example message', 'message', false),
        throwsA(isA<ApiException>()
            .having((e) => e.message, 'message', contains('incomplete scan'))));
  });

  test('Dismissed sign-in cannot persist a late session', () async {
    final response = Completer<http.Response>();
    final storage = FaultyStorage();
    final api = SafeLinkApi(
        storage: storage, client: MockClient((_) async => response.future));
    addTearDown(api.close);
    var active = true;
    final login = api.authenticate(
        'login', 'fixture@example.test', 'password', '',
        isActive: () => active);
    final check = expectLater(login, throwsA(isA<ApiException>()));
    active = false;
    response.complete(sessionResponse());
    await check;
    expect(api.token, isNull);
    expect(storage.values, isEmpty);
  });

  test('Dismissal during secure write removes the uncommitted session',
      () async {
    final storage = FaultyStorage()..pendingSessionWrite = Completer<void>();
    final api = SafeLinkApi(
        storage: storage, client: MockClient((_) async => sessionResponse()));
    addTearDown(api.close);
    var active = true;
    final login = api.authenticate(
        'login', 'fixture@example.test', 'password', '',
        isActive: () => active);
    final check = expectLater(login, throwsA(isA<ApiException>()));
    await Future<void>.delayed(Duration.zero);
    expect(storage.values['session_api_base'], api.base);
    active = false;
    storage.pendingSessionWrite!.complete();
    await check;
    expect(api.token, isNull);
    expect(storage.values, isEmpty);
  });

  test('Partial secure-storage failure cannot leave a restorable login',
      () async {
    final storage = FaultyStorage()..failSessionWrite = true;
    final api = SafeLinkApi(
        storage: storage, client: MockClient((_) async => sessionResponse()));
    addTearDown(api.close);
    await expectLater(
        api.authenticate('login', 'fixture@example.test', 'password', ''),
        throwsA(isA<ApiException>()
            .having((e) => e.message, 'message', contains('Secure storage'))));
    expect(api.token, isNull);
    expect(storage.values, isEmpty);
  });

  test('Logout invalidates stored credentials when secure deletion fails',
      () async {
    final storage = FaultyStorage()..failDelete = true;
    final api = SafeLinkApi(
        storage: storage,
        client: MockClient((_) async => http.Response('{}', 200)));
    addTearDown(api.close);
    api.token = 'fixture-session';
    storage.values
        .addAll({'session': api.token!, 'session_api_base': api.base});
    await api.logout();
    expect(api.token, isNull);
    expect(storage.values['session'], '');
    await api.restore();
    expect(api.token, isNull);
    expect(api.headers['Authorization'], isNull);
  });

  test('Storage failure retains unauthorized status for account reset',
      () async {
    final storage = FaultyStorage()
      ..failDelete = true
      ..failAllWrites = true;
    final api = SafeLinkApi(
        storage: storage,
        client: MockClient((_) async => http.Response('{}', 401)));
    addTearDown(api.close);
    api.token = 'fixture-session';
    await expectLater(
        api.call('/me'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'status', 401)
            .having((e) => e.message, 'message', contains('Secure storage'))));
    expect(api.token, isNull);
  });

  test('Image waiting on file bytes cannot send after logout', () async {
    var requests = 0;
    final api = SafeLinkApi(client: MockClient((_) async {
      requests++;
      return http.Response('{}', 200);
    }));
    addTearDown(api.close);
    api.token = 'fixture-session';
    final file = DelayedImage();
    final upload = api.image(file, 'qr', false);
    final check = expectLater(upload, throwsA(isA<ApiException>()));
    await Future<void>.delayed(Duration.zero);
    await api.clearSession();
    file.bytes.complete(Uint8List.fromList([1, 2, 3]));
    await check;
    expect(requests, 0);
  });
}
