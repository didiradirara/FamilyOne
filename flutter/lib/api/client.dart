import 'dart:convert';
import 'package:http/http.dart' as http;
import 'session.dart';

const String apiBase = String.fromEnvironment('API_BASE_URL',
    defaultValue: 'http://localhost:4000');

class ApiClient {
  final String base;
  ApiClient({String? baseUrl}) : base = baseUrl ?? apiBase;

  Map<String, String> _headers([Map<String, String>? extra]) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final t = ApiSession.token;
    if (t != null && t.isNotEmpty) headers['Authorization'] = 'Bearer ' + t;
    if (extra != null) headers.addAll(extra);
    return headers;
  }

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$base$path'),
        headers: _headers({'Content-Type': 'application/json'}));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(res.body.isEmpty ? 'null' : res.body);
    }
    if (res.statusCode == 401) { try { ApiSession.onUnauthorized?.call(); } catch (_) {} }
    throw Exception('GET $path failed: ${res.statusCode}');
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(Uri.parse('$base$path'),
        headers: _headers(), body: jsonEncode(body));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(res.body.isEmpty ? 'null' : res.body);
    }
    if (res.statusCode == 401) { try { ApiSession.onUnauthorized?.call(); } catch (_) {} }
    throw Exception('POST $path failed: ${res.statusCode} ${res.body}');
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final req = http.Request('PATCH', Uri.parse('$base$path'))
      ..headers.addAll(_headers())
      ..body = jsonEncode(body);
    final res = await http.Client().send(req);
    final bodyStr = await res.stream.bytesToString();
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(bodyStr.isEmpty ? 'null' : bodyStr);
    }
    if (res.statusCode == 401) { try { ApiSession.onUnauthorized?.call(); } catch (_) {} }
    throw Exception('PATCH $path failed: ${res.statusCode} $bodyStr');
  }

  Future<http.Response> deleteRaw(String path) async {
    final res = await http.delete(Uri.parse('$base$path'), headers: _headers());
    if (res.statusCode == 401) { try { ApiSession.onUnauthorized?.call(); } catch (_) {} }
    return res;
  }
}
