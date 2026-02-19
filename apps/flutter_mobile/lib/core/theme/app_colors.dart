import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFF0E2A47);
  static const Color secondary = Color(0xFF2E3238);
  static const Color accent = Color(0xFFF28C28);

  // Surface
  static const Color background = Color(0xFFF2F4F6);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF8FAFC);

  // Text
  static const Color text = Color(0xFF2E3238);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textTertiary = Color(0xFF94A3B8);

  // Border
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderLight = Color(0xFFF1F5F9);

  // Semantic
  static const Color success = Color(0xFF34C759);
  static const Color warning = Color(0xFFFF9500);
  static const Color danger = Color(0xFFFF3B30);
  static const Color info = Color(0xFF3B82F6);

  // Status colors (project)
  static const Color statusPlanning = Color(0xFF3B82F6);
  static const Color statusActive = Color(0xFF10B981);
  static const Color statusCompleted = Color(0xFF6366F1);
  static const Color statusArchived = Color(0xFF94A3B8);

  // Priority colors
  static const Color priorityCritical = Color(0xFFEF4444);
  static const Color priorityHigh = Color(0xFFF97316);
  static const Color priorityMedium = Color(0xFFF59E0B);
  static const Color priorityLow = Color(0xFF10B981);

  // Task status
  static const Color taskTodo = Color(0xFF94A3B8);
  static const Color taskInProgress = Color(0xFF3B82F6);
  static const Color taskReview = Color(0xFF8B5CF6);
  static const Color taskDone = Color(0xFF10B981);
  static const Color taskBlocked = Color(0xFFEF4444);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF0E2A47), Color(0xFF1E3A5F)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient accentGradient = LinearGradient(
    colors: [Color(0xFFF28C28), Color(0xFFE67E22)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Helpers
  static Color statusColor(String status) {
    switch (status) {
      // Real German DB values (stored by web app)
      case 'Angefragt':     return const Color(0xFF0EA5E9);
      case 'In Planung':    return const Color(0xFF8B5CF6);
      case 'Genehmigt':     return const Color(0xFF10B981);
      case 'In Ausführung': return const Color(0xFFF59E0B);
      case 'Abgeschlossen': return const Color(0xFF059669);
      case 'Pausiert':      return const Color(0xFF64748B);
      case 'Abgebrochen':   return const Color(0xFFEF4444);
      case 'Nachbesserung': return const Color(0xFFF97316);
      // Legacy English fallbacks
      case 'planning':      return statusPlanning;
      case 'active':        return statusActive;
      case 'completed':     return statusCompleted;
      case 'archived':      return statusArchived;
      default:              return textSecondary;
    }
  }

  static Color priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return priorityCritical;
      case 'high':
        return priorityHigh;
      case 'medium':
        return priorityMedium;
      case 'low':
        return priorityLow;
      default:
        return textSecondary;
    }
  }

  static Color taskStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'todo':
        return taskTodo;
      case 'in_progress':
        return taskInProgress;
      case 'review':
        return taskReview;
      case 'done':
        return taskDone;
      case 'blocked':
        return taskBlocked;
      default:
        return taskTodo;
    }
  }
}
