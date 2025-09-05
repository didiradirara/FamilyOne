import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'session.dart';

const _kToken = 'auth/token';
const _kUser = 'auth/user';

Future<void> saveAuth(String token, Map<String, dynamic> user) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kToken, token);
  await prefs.setString(_kUser, jsonEncode(user));
}

Future<void> clearAuth() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_kToken);
  await prefs.remove(_kUser);
}

Future<bool> loadAuth() async {
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString(_kToken);
  final userJson = prefs.getString(_kUser);
  if (token != null && token.isNotEmpty) {
    ApiSession.token = token;
  }
  if (userJson != null && userJson.isNotEmpty) {
    final user = jsonDecode(userJson) as Map<String, dynamic>;
    ApiSession.userId = user['id'] as String?;
    ApiSession.userName = user['name'] as String?;
    ApiSession.role = user['role'] as String?;
    ApiSession.site = user['site'] as String?;
  }
  return (ApiSession.token ?? '').isNotEmpty;
}

