import { v4 as uuid } from 'uuid';
import {
  Announcement,
  ChecklistItem,
  ChecklistSubmission,
  LeaveRequest,
  Report,
  RequestItem,
  Shift,
  Suggestion,
  User,
} from './types.js';

export const db = {
  users: new Map<string, User>(),
  reports: new Map<string, Report>(),
  requests: new Map<string, RequestItem>(),
  announcements: new Map<string, Announcement>(),
  checklistTemplates: new Map<'safety' | 'quality', ChecklistItem[]>(),
  checklistSubmissions: new Map<string, ChecklistSubmission>(),
  suggestions: new Map<string, Suggestion>(),
  leaveRequests: new Map<string, LeaveRequest>(),
  shifts: new Map<string, Shift>(),
};

// seed some demo users and checklists
(function seed() {
  const worker: User = { id: uuid(), name: '현장직A', role: 'worker', site: 'jeonju', team: '생산지원팀' };
  const manager: User = { id: uuid(), name: '관리자B', role: 'manager', site: 'busan', team: '부산공장장' };
  db.users.set(worker.id, worker);
  db.users.set(manager.id, manager);
  db.checklistTemplates.set('safety', [
    { id: uuid(), category: 'safety', title: '보호장비 착용', checked: false },
    { id: uuid(), category: 'safety', title: '비상정지 버튼 확인', checked: false },
  ]);
  db.checklistTemplates.set('quality', [
    { id: uuid(), category: 'quality', title: '초품 검사', checked: false },
    { id: uuid(), category: 'quality', title: '치수 공차 확인', checked: false },
  ]);
})();