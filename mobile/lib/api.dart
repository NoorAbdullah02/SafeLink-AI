import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

class SafeLinkApi {
  static const defaultBase =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3001');
  final storage = const FlutterSecureStorage();
  String? token;
  String? customBase;

  String get base => customBase ?? defaultBase;

  Future<void> restore() async {
    token = await storage.read(key: 'session');
    customBase = await storage.read(key: 'api_url');
  }

  Future<void> setBaseUrl(String? url) async {
    if (url != null && url.trim().isNotEmpty) {
      customBase = url.trim().replaceAll(RegExp(r'/+$'), '');
      await storage.write(key: 'api_url', value: customBase);
    } else {
      customBase = null;
      await storage.delete(key: 'api_url');
    }
  }

  Map<String, String> get headers => {
        'Content-Type': 'application/json',
        'X-SafeLink-Client': 'mobile',
        if (token != null) 'Authorization': 'Bearer $token'
      };
  Future<dynamic> call(String path,
      {String method = 'GET', Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$base/api$path');
    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
        await request.send().timeout(Duration(seconds: 45)));
    dynamic data;
    try {
      data = jsonDecode(response.body);
    } catch (_) {
      throw Exception('The server returned an unexpected response.');
    }
    if (response.statusCode >= 400) {
      throw Exception(
          data is Map ? data['error'] ?? 'Request failed.' : 'Request failed.');
    }
    return data;
  }

  Future<Map<String, dynamic>> authenticate(
      String mode, String email, String password, String name) async {
    final data = await call('/auth/$mode', method: 'POST', body: {
      'email': email,
      'password': password,
      if (mode == 'register') 'name': name
    });
    token = data['token'] as String?;
    if (token == null) {
      throw Exception('The server did not issue a mobile session.');
    }
    await storage.write(key: 'session', value: token);
    return Map<String, dynamic>.from(data['user']);
  }

  Future<void> logout() async {
    await call('/auth/logout', method: 'POST');
    token = null;
    await storage.delete(key: 'session');
  }

  Future<Map<String, dynamic>> scan(
          String text, String kind, bool external) async =>
      Map<String, dynamic>.from(await call('/scans',
          method: 'POST',
          body: {'text': text, 'kind': kind, 'external': external}));
  Future<Map<String, dynamic>> image(
      XFile file, String kind, bool external) async {
    if (await file.length() > 5 * 1024 * 1024) {
      throw Exception('Choose an image smaller than 5 MB.');
    }
    final request =
        http.MultipartRequest('POST', Uri.parse('$base/api/scans/image'));
    request.headers.addAll({
      'X-SafeLink-Client': 'mobile',
      if (token != null) 'Authorization': 'Bearer $token'
    });
    request.fields.addAll({'kind': kind, 'external': '$external'});
    request.files.add(http.MultipartFile.fromBytes(
        'image', await file.readAsBytes(),
        filename: file.name));
    final response = await http.Response.fromStream(
        await request.send().timeout(Duration(seconds: 90)));
    final data = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      throw Exception(data['error'] ?? 'Image could not be scanned.');
    }
    return Map<String, dynamic>.from(data);
  }
}
