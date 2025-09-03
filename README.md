
# FamilyOne

- 클라이언트: Authorization: Bearer <token> 헤더 첨부

## DB 영속화 (Node API)
- 개발 DB: SQLite (server/dev.db)
- 의존성: etter-sqlite3
- 초기화/시드: 서버 구동 시 테이블 생성 + 사용자/체크리스트 템플릿 seed
- 저장 위치: server/src/db/sqlite.ts, server/src/repo.ts
- 마이그레이션: 간단한 DDL로 자동 생성 (초기 MVP). 향후 Prisma/Knex로 전환 가능

### 엔드포인트 영향
- 모든 엔드포인트가 인메모리 대신 SQLite를 사용하도록 변경됨
- 응답 스키마는 기존과 동일(예: 공지 
eadBy는 문자열 배열)


## 실시간 알림 (Socket.IO)
- 서버 초기화: HTTP 서버에 Socket.IO 바인딩(`initRealtime`).
- 네임스페이스: 기본(`/`) 사용, CORS 허용.
- 이벤트 목록:
  - `report:new`, `report:updated`
  - `request:new`, `request:approved`, `request:rejected`
  - `announcement:new`, `announcement:read`
  - `checklist:submitted`
  - `suggestion:new`
  - `leave:new`, `leave:approved`, `leave:rejected`
- 접속 예시 (웹/RN):
  ```js
  import { io } from 'socket.io-client'
  const socket = io('http://localhost:4000', { transports: ['websocket'] })
  socket.on('report:new', (payload) => console.log('report:new', payload))
  ```
- Flutter 예시:
  ```dart
  import 'package:socket_io_client/socket_io_client.dart' as IO;
  final socket = IO.io('http://localhost:4000', IO.OptionBuilder().setTransports(['websocket']).build());
  socket.on('report:new', (data) { print(data); });
  ```
