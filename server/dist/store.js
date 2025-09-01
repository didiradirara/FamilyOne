import { v4 as uuid } from 'uuid';
export const db = {
    users: new Map(),
    reports: new Map(),
    requests: new Map(),
    announcements: new Map(),
    checklistTemplates: new Map(),
    checklistSubmissions: new Map(),
    suggestions: new Map(),
    leaveRequests: new Map(),
    shifts: new Map(),
};
// seed some demo users and checklists
(function seed() {
    const worker = { id: uuid(), name: '현장직A', role: 'worker' };
    const manager = { id: uuid(), name: '관리자B', role: 'manager' };
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
