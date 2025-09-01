import 'dart:convert';
import 'package:http/http.dart' as http;

const String apiBase = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:8080');

class ApiClient {
  final String base;
  ApiClient({String? baseUrl}) : base = baseUrl ?? apiBase;

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$base$path'));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(res.body.isEmpty ? 'null' : res.body);
    }
    throw Exception('GET $path failed: ${res.statusCode}');
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(Uri.parse('$base$path'), headers: {'Content-Type':'application/json'}, body: jsonEncode(body));
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(res.body.isEmpty ? 'null' : res.body);
    }
    throw Exception('POST $path failed: ${res.statusCode} ${res.body}');
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final req = http.Request('PATCH', Uri.parse('$base$path'))
      ..headers['Content-Type'] = 'application/json'
      ..body = jsonEncode(body);
    final res = await http.Client().send(req);
    final bodyStr = await res.stream.bytesToString();
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(bodyStr.isEmpty ? 'null' : bodyStr);
    }
    throw Exception('PATCH $path failed: ${res.statusCode} $bodyStr');
  }
}