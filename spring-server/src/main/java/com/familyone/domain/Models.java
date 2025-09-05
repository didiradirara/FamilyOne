package com.familyone.domain;

import java.util.*;

public class Models {
  public enum Role { worker, manager, admin }
  public static class User {
    public String id;
    public String name;
    public Role role;
  }

  public enum ReportType { machine_fault, material_shortage, defect, other }
  public static class Report {
    public String id;
    public ReportType type;
    public String message;
    public String createdAt;
    public String createdBy;
    public String status; // new | ack | resolved
  }

  public static class RequestItem {
    public String id;
    public String kind; // mold_change | material_add | maintenance | other
    public String details;
    public String createdAt;
    public String createdBy;
    public String state; // pending | approved | rejected
    public String reviewerId;
    public String reviewedAt;
  }

  public static class Announcement {
    public String id;
    public String title;
    public String body;
    public String createdAt;
    public String createdBy;
    public List<String> readBy = new ArrayList<>();
  }

  public static class ChecklistItem {
    public String id;
    public String category; // safety | quality
    public String title;
    public boolean checked;
  }

  public static class ChecklistSubmission {
    public String id;
    public String date; // YYYY-MM-DD
    public String userId;
    public String category; // safety | quality
    public List<ChecklistItem> items = new ArrayList<>();
  }

  public static class Suggestion {
    public String id;
    public String text;
    public String createdAt;
    public boolean anonymous;
    public String createdBy;
  }

  public static class LeaveRequest {
    public String id;
    public String userId;
    public String startDate;
    public String endDate;
    public String reason;
    public String signature;
    public String state; // pending | approved | rejected
    public String reviewerId;
    public String reviewedAt;
  }

  public static class Shift {
    public String id;
    public String date; // YYYY-MM-DD
    public String userId;
    public String shift; // A|B|C|D
  }
}