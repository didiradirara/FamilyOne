package com.familyone.api;

import com.familyone.domain.Models.*;
import com.familyone.store.InMemoryStore;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@Validated
public class ApiController {
  private final InMemoryStore db = new InMemoryStore();

  private static String now() { return java.time.Instant.now().toString(); }

  // Auth placeholder
  public static class LoginReq { public String userId; }
  @PostMapping("/auth/login")
  public ResponseEntity<?> login(@RequestBody LoginReq req) {
    if (req == null || req.userId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    User u = db.users.get(req.userId);
    if (u == null) return ResponseEntity.status(404).body(Map.of("error","User not found (seeded users only)"));
    return ResponseEntity.ok(Map.of("token", req.userId, "user", u));
  }

  // Reports
  public static class ReportReq { public ReportType type; public String message; public String createdBy; }
  @PostMapping("/reports")
  public ResponseEntity<?> createReport(@RequestBody ReportReq req) {
    if (req == null || req.type == null || req.message == null || req.createdBy == null)
      return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    Report r = new Report();
    r.id = UUID.randomUUID().toString(); r.type = req.type; r.message = req.message; r.createdBy = req.createdBy; r.status = "new"; r.createdAt = now();
    db.reports.put(r.id, r);
    return ResponseEntity.status(201).body(r);
  }
  @GetMapping("/reports")
  public List<Report> listReports() { return new ArrayList<>(db.reports.values()); }
  public static class ReportPatch { public String status; }
  @PatchMapping("/reports/{id}")
  public ResponseEntity<?> patchReport(@PathVariable String id, @RequestBody ReportPatch patch) {
    Report r = db.reports.get(id); if (r == null) return ResponseEntity.notFound().build();
    if (patch == null || patch.status == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    r.status = patch.status; db.reports.put(id, r); return ResponseEntity.ok(r);
  }

  // Requests (e-approval)
  public static class RequestReq { public String kind; public String details; public String createdBy; }
  @PostMapping("/requests")
  public ResponseEntity<?> createRequest(@RequestBody RequestReq req) {
    if (req == null || req.kind == null || req.details == null || req.createdBy == null)
      return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    RequestItem it = new RequestItem();
    it.id = UUID.randomUUID().toString(); it.kind = req.kind; it.details = req.details; it.createdBy = req.createdBy; it.state = "pending"; it.createdAt = now();
    db.requests.put(it.id, it);
    return ResponseEntity.status(201).body(it);
  }
  @GetMapping("/requests")
  public List<RequestItem> listRequests() { return new ArrayList<>(db.requests.values()); }
  public static class ReviewerReq { public String reviewerId; }
  @PatchMapping("/requests/{id}/approve")
  public ResponseEntity<?> approve(@PathVariable String id, @RequestBody ReviewerReq req) {
    RequestItem it = db.requests.get(id); if (it == null) return ResponseEntity.notFound().build();
    if (req == null || req.reviewerId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    it.state = "approved"; it.reviewerId = req.reviewerId; it.reviewedAt = now(); db.requests.put(id, it); return ResponseEntity.ok(it);
  }
  @PatchMapping("/requests/{id}/reject")
  public ResponseEntity<?> reject(@PathVariable String id, @RequestBody ReviewerReq req) {
    RequestItem it = db.requests.get(id); if (it == null) return ResponseEntity.notFound().build();
    if (req == null || req.reviewerId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    it.state = "rejected"; it.reviewerId = req.reviewerId; it.reviewedAt = now(); db.requests.put(id, it); return ResponseEntity.ok(it);
  }

  // Announcements
  public static class AnnReq { public String title; public String body; public String createdBy; }
  @PostMapping("/announcements")
  public ResponseEntity<?> createAnn(@RequestBody AnnReq req) {
    if (req == null || req.title == null || req.body == null || req.createdBy == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    Announcement a = new Announcement(); a.id = UUID.randomUUID().toString(); a.title = req.title; a.body = req.body; a.createdAt = now(); a.createdBy = req.createdBy;
    db.announcements.put(a.id, a); return ResponseEntity.status(201).body(a);
  }
  @GetMapping("/announcements")
  public List<Announcement> listAnn() { return new ArrayList<>(db.announcements.values()); }
  public static class ReadReq { public String userId; }
  @PostMapping("/announcements/{id}/read")
  public ResponseEntity<?> markRead(@PathVariable String id, @RequestBody ReadReq req) {
    Announcement a = db.announcements.get(id); if (a == null) return ResponseEntity.notFound().build();
    if (req == null || req.userId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    if (!a.readBy.contains(req.userId)) a.readBy.add(req.userId); return ResponseEntity.ok(a);
  }

  // Checklists
  @GetMapping("/checklists/templates/{category}")
  public ResponseEntity<?> getTemplate(@PathVariable String category) {
    List<ChecklistItem> items = db.checklistTemplates.get(category);
    if (items == null) return ResponseEntity.notFound().build();
    return ResponseEntity.ok(items);
  }
  public static class ChecklistSubmitReq { public String date; public String userId; public String category; public List<ChecklistItem> items; }
  @PostMapping("/checklists/submit")
  public ResponseEntity<?> submitChecklist(@RequestBody ChecklistSubmitReq req) {
    if (req == null || req.date == null || req.userId == null || req.category == null || req.items == null)
      return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    ChecklistSubmission sub = new ChecklistSubmission(); sub.id = UUID.randomUUID().toString(); sub.date = req.date; sub.userId = req.userId; sub.category = req.category; sub.items = req.items;
    db.checklistSubmissions.put(sub.id, sub); return ResponseEntity.status(201).body(sub);
  }

  // Suggestions
  public static class SugReq { public String text; public Boolean anonymous; public String createdBy; }
  @PostMapping("/suggestions")
  public ResponseEntity<?> createSug(@RequestBody SugReq req) {
    if (req == null || req.text == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    Suggestion s = new Suggestion(); s.id = UUID.randomUUID().toString(); s.text = req.text; s.createdAt = now(); s.anonymous = req.anonymous != null ? req.anonymous : true; s.createdBy = req.createdBy;
    db.suggestions.put(s.id, s); return ResponseEntity.status(201).body(s);
  }
  @GetMapping("/suggestions")
  public List<Suggestion> listSug() { return new ArrayList<>(db.suggestions.values()); }

  // Leave requests
  public static class LeaveReq { public String userId; public String startDate; public String endDate; public String reason; public String signature; }
  @PostMapping("/leave-requests")
  public ResponseEntity<?> createLeave(@RequestBody LeaveReq req) {
    if (req == null || req.userId == null || req.startDate == null || req.endDate == null)
      return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    LeaveRequest lr = new LeaveRequest(); lr.id = UUID.randomUUID().toString(); lr.userId = req.userId; lr.startDate = req.startDate; lr.endDate = req.endDate; lr.reason = req.reason; lr.signature = req.signature; lr.state = "pending";
    db.leaveRequests.put(lr.id, lr); return ResponseEntity.status(201).body(lr);
  }
  @GetMapping("/leave-requests")
  public List<LeaveRequest> listLeave() { return new ArrayList<>(db.leaveRequests.values()); }
  @PatchMapping("/leave-requests/{id}/approve")
  public ResponseEntity<?> approveLeave(@PathVariable String id, @RequestBody ReviewerReq req) {
    LeaveRequest it = db.leaveRequests.get(id); if (it == null) return ResponseEntity.notFound().build();
    if (req == null || req.reviewerId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    it.state = "approved"; it.reviewerId = req.reviewerId; it.reviewedAt = now(); db.leaveRequests.put(id, it); return ResponseEntity.ok(it);
  }
  @PatchMapping("/leave-requests/{id}/reject")
  public ResponseEntity<?> rejectLeave(@PathVariable String id, @RequestBody ReviewerReq req) {
    LeaveRequest it = db.leaveRequests.get(id); if (it == null) return ResponseEntity.notFound().build();
    if (req == null || req.reviewerId == null) return ResponseEntity.badRequest().body(Map.of("error","Invalid payload"));
    it.state = "rejected"; it.reviewerId = req.reviewerId; it.reviewedAt = now(); db.leaveRequests.put(id, it); return ResponseEntity.ok(it);
  }

  // Schedule
  @GetMapping("/schedule")
  public List<Shift> schedule() { return new ArrayList<>(); }
}