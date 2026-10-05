import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

class SafeLinkApi {
  static const defaultBase = String.fromEnvironment('API_URL',
      defaultValue: 'https://safelink-ai-8q6c.onrender.com');
  final FlutterSecureStorage storage;
  final http.Client client;
  final Duration timeout;
  String? token;
  String? customBase;
  int _sessionRevision = 0;
  Future<void> _storageQueue = Future<void>.value();

  SafeLinkApi(
      {FlutterSecureStorage? storage,
      http.Client? client,
      this.timeout = const Duration(seconds: 90)})
      : storage = storage ?? const FlutterSecureStorage(),
        client = client ?? http.Client();

  String get base => customBase ?? normalizeBase(defaultBase);
  int get sessionRevision => _sessionRevision;

  Future<T> _withStorage<T>(Future<T> Function() operation) {
    final result = _storageQueue.then((_) async {
      try {
        return await operation();
      } on PlatformException {
        throw const ApiException(
            'Secure storage is unavailable. Please retry before closing the app.');
      }
    });
    _storageQueue =
        result.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return result;
  }

  static String normalizeBase(String value) {
    var clean = value.trim();
    if (!clean.contains('://')) clean = 'https://$clean';
    final uri = Uri.tryParse(clean);
    if (uri == null ||
        !['https', 'http'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const ApiException(
          'Enter a valid HTTPS server URL without credentials, a query or a fragment.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw const ApiException('Release apps require an HTTPS server.');
    }
    var path = uri.path.replaceAll(RegExp(r'/+$'), '');
    if (path.endsWith('/api')) path = path.substring(0, path.length - 4);
    return uri.replace(path: path).toString().replaceAll(RegExp(r'/+$'), '');
  }

  Future<void> restore() async {
    final revision = ++_sessionRevision;
    await _withStorage(() async {
      final savedBase = await storage.read(key: 'api_url');
      final savedToken = await storage.read(key: 'session');
      final sessionBase = await storage.read(key: 'session_api_base');
      if (revision != _sessionRevision) return;
      try {
        customBase = savedBase == null ? null : normalizeBase(savedBase);
      } on ApiException {
        customBase = null;
        await storage.delete(key: 'api_url');
      }
      // Never forward a session issued by one server to another server.
      token = sessionBase == base && savedToken?.isNotEmpty == true
          ? savedToken
          : null;
      if (token == null) {
        await _eraseStoredSession();
      }
    });
  }

  Future<void> clearSession() async {
    _sessionRevision++;
    token = null;
    await _withStorage(_eraseStoredSession);
  }

  Future<void> _eraseStoredSession() async {
    // Invalidate the server binding first. If deletion fails, an empty value
    // also prevents a stored bearer session from being restored.
    Object? failure;
    for (final key in ['session_api_base', 'session']) {
      try {
        await storage.delete(key: key);
      } on PlatformException {
        try {
          await storage.write(key: key, value: '');
        } on PlatformException catch (error) {
          failure = error;
        }
      }
    }
    if (failure != null) throw failure;
  }

  Future<void> setBaseUrl(String? url) async {
    final newBase =
        url == null || url.trim().isEmpty ? null : normalizeBase(url);
    final changed = (newBase ?? normalizeBase(defaultBase)) != base;
    if (changed) {
      _sessionRevision++;
      token = null;
    }
    customBase = newBase;
    await _withStorage(() async {
      if (changed) {
        await _eraseStoredSession();
      }
      if (newBase == null) {
        await storage.delete(key: 'api_url');
      } else {
        await storage.write(key: 'api_url', value: newBase);
      }
    });
  }

  Map<String, String> get headers => {
        'Content-Type': 'application/json',
        'X-SafeLink-Client': 'mobile',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _send(http.BaseRequest request) async {
    final requestBase = base;
    final revision = _sessionRevision;
    if (!request.url.toString().startsWith('$requestBase/api/')) {
      throw const ApiException('The server changed. Please try again.');
    }
    request.followRedirects = false;
    http.Response response;
    try {
      response = await (() async =>
              http.Response.fromStream(await client.send(request)))()
          .timeout(timeout);
    } on TimeoutException {
      throw const ApiException('The server took too long. Please try again.');
    } on http.ClientException {
      throw const ApiException(
          'Cannot reach SafeLink. Check your connection and server URL.');
    }
    if (requestBase != base || revision != _sessionRevision) {
      throw const ApiException(
          'The server or session changed. Please try again.');
    }
    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw const ApiException(
          'The server redirected this request. Check the server URL.');
    }
    if (response.statusCode == 401 &&
        request.headers['Authorization'] != null &&
        request.headers['Authorization'] == headers['Authorization']) {
      try {
        await clearSession();
      } on ApiException catch (error) {
        throw ApiException(error.message, statusCode: 401);
      }
    }
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } on FormatException {
      throw ApiException(
          'The server returned an unexpected response. Please try again.',
          statusCode: response.statusCode >= 400 ? response.statusCode : null);
    }
    if (response.statusCode >= 400) {
      throw ApiException(
          data is Map
              ? (data['error'] ?? 'Request failed.').toString()
              : 'Request failed.',
          statusCode: response.statusCode);
    }
    return data;
  }

  Future<dynamic> call(String path,
      {String method = 'GET', Map<String, dynamic>? body}) async {
    final request = http.Request(method, Uri.parse('$base/api$path'))
      ..headers.addAll(headers);
    if (['/auth/login', '/auth/register', '/auth/forgot'].contains(path)) {
      request.headers.remove('Authorization');
    }
    if (body != null) request.body = jsonEncode(body);
    return _send(request);
  }

  Future<Map<String, dynamic>> authenticate(
      String mode, String email, String password, String name,
      {bool Function()? isActive}) async {
    final sessionBase = base;
    final revision = ++_sessionRevision;
    final data = await call('/auth/$mode', method: 'POST', body: {
      'email': email,
      'password': password,
      if (mode == 'register') 'name': name,
    });
    if (data is! Map ||
        data['token'] is! String ||
        data['user'] is! Map ||
        (data['token'] as String).isEmpty ||
        base != sessionBase ||
        revision != _sessionRevision) {
      throw const ApiException('The server did not issue a mobile session.');
    }
    await _withStorage(() async {
      if (revision != _sessionRevision ||
          base != sessionBase ||
          isActive?.call() == false) {
        throw const ApiException(
            'The server or session changed. Please sign in again.');
      }
      try {
        await storage.write(key: 'session_api_base', value: sessionBase);
        await storage.write(key: 'session', value: data['token'] as String);
      } on PlatformException {
        token = null;
        await _eraseStoredSession();
        rethrow;
      }
      if (revision != _sessionRevision || isActive?.call() == false) {
        await _eraseStoredSession();
        throw const ApiException(
            'The server or session changed. Please sign in again.');
      }
      token = data['token'] as String;
    });
    return Map<String, dynamic>.from(data['user']);
  }

  Future<void> logout() async {
    final revision = _sessionRevision;
    try {
      await call('/auth/logout', method: 'POST');
    } finally {
      if (revision == _sessionRevision) await clearSession();
    }
  }

  Map<String, dynamic> _scanResult(dynamic data) {
    if (data is! Map ||
        data['score'] is! num ||
        !(data['score'] as num).isFinite ||
        data['score'] < 0 ||
        data['score'] > 100 ||
        !['level', 'threatType', 'explanation', 'recommendation']
            .every((key) => data[key] is String) ||
        data['evidence'] is! List ||
        data['checks'] is! List ||
        !(data['evidence'] as List).every((entry) =>
            entry is Map &&
            ['id', 'title', 'detail', 'source']
                .every((key) => entry[key] is String)) ||
        !(data['checks'] as List).every((entry) =>
            entry is Map &&
            ['name', 'status', 'detail']
                .every((key) => entry[key] is String))) {
      throw const ApiException(
          'The server returned an incomplete scan result. Please try again.');
    }
    return Map<String, dynamic>.from(data);
  }

  Future<Map<String, dynamic>> scan(
          String text, String kind, bool external) async =>
      _scanResult(await call('/scans',
          method: 'POST',
          body: {'text': text, 'kind': kind, 'external': external}));

  Future<Map<String, dynamic>> image(
      XFile file, String kind, bool external) async {
    final revision = _sessionRevision;
    final requestBase = base;
    if (await file.length() > 5 * 1024 * 1024) {
      throw const ApiException('Choose an image smaller than 5 MB.');
    }
    final request =
        http.MultipartRequest('POST', Uri.parse('$base/api/scans/image'));
    request.headers.addAll({
      'X-SafeLink-Client': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token',
    });
    request.fields.addAll({'kind': kind, 'external': '$external'});
    request.files.add(http.MultipartFile.fromBytes(
        'image', await file.readAsBytes(),
        filename: file.name));
    if (revision != _sessionRevision || requestBase != base) {
      throw const ApiException(
          'The server or session changed. Please try again.');
    }
    final data = await _send(request);
    return _scanResult(data);
  }

  void close() => client.close();
}
