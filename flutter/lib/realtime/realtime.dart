import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../api/session.dart';
import '../api/client.dart';

class RealtimeStore extends ChangeNotifier {
  static final RealtimeStore I = RealtimeStore._();
  RealtimeStore._();

  bool connected = false;
  int requests = 0;
  int announcements = 0;
  int reports = 0;
  IO.Socket? _socket;

  void connect() {
    disconnect();
    final base = ApiClient().base; // e.g., http://host:4000
    try {
      _socket = IO.io(
          base,
          IO.OptionBuilder()
              .setTransports(['websocket'])
              .setAuth(
                  ApiSession.token != null ? {'token': ApiSession.token} : {})
              .build());
      _socket!.onConnect((_) {
        connected = true;
        notifyListeners();
      });
      _socket!.onDisconnect((_) {
        connected = false;
        notifyListeners();
      });

      void incReports(_) {
        reports++;
        notifyListeners();
      }

      void incReq(_) {
        requests++;
        notifyListeners();
      }

      void incAnn(_) {
        announcements++;
        notifyListeners();
      }

      _socket!.on('report:new', incReports);
      _socket!.on('report:updated', incReports);
      _socket!.on('request:new', incReq);
      _socket!.on('announcement:new', incAnn);
      _socket!.on('announcement:read', (_) {/* ignore */});
      _socket!.on('leave:new', (_) {/* leave counter not tracked in tabs */});
    } catch (_) {
      // noop
    }
  }

  void clear(String key) {
    if (key == 'reports') {
      reports = 0;
    } else if (key == 'requests')
      // ignore: curly_braces_in_flow_control_structures
      requests = 0;
    // ignore: curly_braces_in_flow_control_structures
    else if (key == 'announcements') announcements = 0;
    notifyListeners();
  }

  void disconnect() {
    try {
      _socket?.dispose();
    } catch (_) {}
    _socket = null;
    connected = false;
  }
}
