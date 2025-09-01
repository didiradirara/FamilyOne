package com.familyone.store;

import com.familyone.domain.Models.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryStore {
  public final Map<String, User> users = new ConcurrentHashMap<>();
  public final Map<String, Report> reports = new ConcurrentHashMap<>();
  public final Map<String, RequestItem> requests = new ConcurrentHashMap<>();
  public final Map<String, Announcement> announcements = new ConcurrentHashMap<>();
  public final Map<String, List<ChecklistItem>> checklistTemplates = new ConcurrentHashMap<>();
  public final Map<String, ChecklistSubmission> checklistSubmissions = new ConcurrentHashMap<>();
  public final Map<String, Suggestion> suggestions = new ConcurrentHashMap<>();
  public final Map<String, LeaveRequest> leaveRequests = new ConcurrentHashMap<>();
  public final Map<String, Shift> shifts = new ConcurrentHashMap<>();

  public InMemoryStore() { seed(); }

  private static String now() { return java.time.Instant.now().toString(); }

  private void seed() {
    User worker = new User(); worker.id = UUID.randomUUID().toString(); worker.name = "현장직A"; worker.role = Role.worker;
    User manager = new User(); manager.id = UUID.randomUUID().toString(); manager.name = "관리자B"; manager.role = Role.manager;
    users.put(worker.id, worker);
    users.put(manager.id, manager);

    List<ChecklistItem> safety = new ArrayList<>();
    ChecklistItem s1 = new ChecklistItem(); s1.id = UUID.randomUUID().toString(); s1.category = "safety"; s1.title = "보호장비 착용"; safety.add(s1);
    ChecklistItem s2 = new ChecklistItem(); s2.id = UUID.randomUUID().toString(); s2.category = "safety"; s2.title = "비상정지 버튼 확인"; safety.add(s2);
    checklistTemplates.put("safety", safety);

    List<ChecklistItem> quality = new ArrayList<>();
    ChecklistItem q1 = new ChecklistItem(); q1.id = UUID.randomUUID().toString(); q1.category = "quality"; q1.title = "초품 검사"; quality.add(q1);
    ChecklistItem q2 = new ChecklistItem(); q2.id = UUID.randomUUID().toString(); q2.category = "quality"; q2.title = "치수 공차 확인"; quality.add(q2);
    checklistTemplates.put("quality", quality);
  }
}