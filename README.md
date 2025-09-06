
﻿# FamilyOne

현장-사무 실시간 소통/업무 플랫폼 MVP 모노레포.

- backend: server (Express + TypeScript)
- mobile: mobile (Expo React Native, to be added)

## Server (API)

 - 개발 실행: cd server && npm run dev (기본 포트 80)
- API 베이스: /api
- 현재 인메모리 저장소(빠른 프로토타입). 추후 DB 교체 권장.

### 주요 엔드포인트
- POST /api/reports (원클릭 보고)
- POST /api/requests + 승인/반려
- GET/POST /api/announcements + 읽음 체크
- GET 템플릿/POST /api/checklists/submit
- POST/GET /api/suggestions (익명 가능)
- POST/GET/PATCH /api/leave-requests
- GET /api/schedule

## Next
- Expo RN 앱 스캐폴딩 및 화면 연결
- 간단 인증(JWT)과 역할(현장/관리자)
- 영속 저장소(예: SQLite/Prisma → Postgres)

## Mobile (Expo)

- 실행: cd mobile && npm run web (웹), 또는 
pm run android / 
pm run ios
- API 주소 설정: mobile/app.json의 expo.extra.API_BASE_URL 수정
- 데모는 간단한 탭 내비게이션과 각 핵심 기능의 최소 화면을 제공합니다.

## Roadmap
- 푸시 알림(Expo Push / FCM)
- 역할 기반 권한 및 JWT 인증
- 영속 저장(DB) 및 감사 로그
- 실시간(요청/보고) 알림: WebSocket/Socket.IO
- 다국어(ko/en) 지원

## Spring Boot (Java) 서버
- 경로: spring-server
- 실행 전제: JDK 17+, JAVA_HOME 설정
- 실행: cd spring-server && mvnw.cmd spring-boot:run 또는 mvnw.cmd -DskipTests package 후 java -jar target/*.jar
 - 포트: 80
 - 헬스체크: GET http://34.47.82.64/health (외부) / http://10.178.0.2/health (내부)
 - 루트: GET http://34.47.82.64/ (헬스 정보 반환)
- API 베이스: /api

### 엔드포인트(동일 스펙)
- 보고: POST /api/reports / PATCH /api/reports/{id} / GET /api/reports
- 요청/결재: POST /api/requests / PATCH /api/requests/{id}/approve|reject / GET /api/requests
- 공지: POST/GET /api/announcements / 읽음 POST /api/announcements/{id}/read
- 체크리스트: 템플릿 GET /api/checklists/templates/:category / 제출 POST /api/checklists/submit
- 제안: POST/GET /api/suggestions
- 휴가: POST/GET /api/leave-requests / 승인·반려 PATCH /api/leave-requests/{id}/approve|reject
- 스케줄: GET /api/schedule

## Flutter 앱
- API 주소: lib/api/client.dart 내 piBase (기본 http://34.47.82.64)
- 실기기 접속 시: piBase를 PC IP로 변경 (예: http://192.168.x.x)
  - Node API: server (포트 80)

- 가입: POST http://34.47.82.64/api/auth/register body { name, role: worker|manager|admin } → { token, user }
- 로그인: POST http://34.47.82.64/api/auth/login body { userId? , name? } → { token, user }
- 클라이언트: Authorization: Bearer <token> 헤더 첨부
- 응답 스키마는 기존과 동일(예: 공지 
eadBy는 문자열 배열)


  const socket = io('http://34.47.82.64', { transports: ['websocket'] })
  final socket = IO.io('http://34.47.82.64', IO.OptionBuilder().setTransports(['websocket']).build());
  ```
  - Expo RN: mobile (API 주소는 mobile/app.json에서 설정)


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

