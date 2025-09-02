export type Role = 'worker' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  site: 'hq' | 'jeonju' | 'busan';
  team: string;
  teamDetail?: string | null;
}

export type ReportType = 'machine_fault' | 'material_shortage' | 'defect' | 'other';

export interface Report {
  id: string;
  type: ReportType;
  message: string;
  createdAt: string;
  createdBy: string; // userId
  status: 'new' | 'ack' | 'resolved';
  images?: string[]; // data URLs or http URLs
}

export interface RequestItem {
  id: string;
  kind: 'mold_change' | 'material_add' | 'maintenance' | 'other';
  details: string;
  createdAt: string;
  createdBy: string; // userId
  state: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewedAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string;
  readBy: string[]; // userIds
}

export interface ChecklistItem {
  id: string;
  category: 'safety' | 'quality';
  title: string;
  checked: boolean;
}

export interface ChecklistSubmission {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  category: 'safety' | 'quality';
  items: ChecklistItem[];
}

export interface Suggestion {
  id: string;
  text: string;
  createdAt: string;
  anonymous: boolean;
  createdBy?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  state: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewedAt?: string;
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  shift: 'A' | 'B' | 'C' | 'D';
}
