import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _loading = true;
  bool _saving = false;

  // Notification settings
  bool _emailNotifications = true;
  bool _projectUpdates = true;
  bool _weeklyReports = false;
  bool _marketingEmails = false;

  // Preferences
  String _language = 'de';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await SupabaseService.getUserSettings();
      if (data != null && data['settings'] != null && mounted) {
        final s = data['settings'] as Map<String, dynamic>;
        setState(() {
          _emailNotifications = s['emailNotifications'] ?? true;
          _projectUpdates = s['projectUpdates'] ?? true;
          _weeklyReports = s['weeklyReports'] ?? false;
          _marketingEmails = s['marketingEmails'] ?? false;
          _language = s['language'] ?? 'de';
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _saveSettings() async {
    setState(() => _saving = true);
    try {
      await SupabaseService.upsertUserSettings({
        'settings': {
          'emailNotifications': _emailNotifications,
          'projectUpdates': _projectUpdates,
          'weeklyReports': _weeklyReports,
          'marketingEmails': _marketingEmails,
          'language': _language,
        },
        'updated_at': DateTime.now().toIso8601String(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(LucideIcons.check, size: 16, color: Colors.white),
                SizedBox(width: 10),
                Text('Einstellungen gespeichert'),
              ],
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.success,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fehler: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Mehr')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              children: [
                // ── Quick Links ─────────────────────────────────
                _SectionHeader('Schnellzugriff'),
                _NavTile(
                  icon: LucideIcons.messageSquare,
                  label: 'Feedback geben',
                  subtitle: 'Helfen Sie uns DocStruc zu verbessern',
                  color: const Color(0xFFF59E0B),
                  onTap: () => context.go('/feedback'),
                ),
                _NavTile(
                  icon: LucideIcons.helpCircle,
                  label: 'Hilfe-Center',
                  subtitle: 'FAQ, Tutorials & Dokumentation',
                  color: const Color(0xFF3B82F6),
                  onTap: () => context.go('/help'),
                ),
                const SizedBox(height: 24),

                // ── Notifications ───────────────────────────────
                _SectionHeader('Benachrichtigungen'),
                _SettingsCard(
                  children: [
                    _ToggleRow(
                      icon: LucideIcons.mail,
                      label: 'E-Mail Benachrichtigungen',
                      subtitle: 'Erhalten Sie Benachrichtigungen per E-Mail',
                      value: _emailNotifications,
                      onChanged: (v) =>
                          setState(() => _emailNotifications = v),
                    ),
                    const _Divider(),
                    _ToggleRow(
                      icon: LucideIcons.building2,
                      label: 'Projekt Updates',
                      subtitle: 'Bei Änderungen an Ihren Projekten',
                      value: _projectUpdates,
                      onChanged: (v) =>
                          setState(() => _projectUpdates = v),
                    ),
                    const _Divider(),
                    _ToggleRow(
                      icon: LucideIcons.barChart3,
                      label: 'Wöchentliche Berichte',
                      subtitle: 'Zusammenfassung Ihrer Aktivitäten',
                      value: _weeklyReports,
                      onChanged: (v) =>
                          setState(() => _weeklyReports = v),
                    ),
                    const _Divider(),
                    _ToggleRow(
                      icon: LucideIcons.megaphone,
                      label: 'Marketing E-Mails',
                      subtitle: 'Neuigkeiten und Angebote erhalten',
                      value: _marketingEmails,
                      onChanged: (v) =>
                          setState(() => _marketingEmails = v),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Language ────────────────────────────────────
                _SectionHeader('Sprache & Region'),
                _SettingsCard(
                  children: [
                    _DropdownRow(
                      icon: LucideIcons.globe,
                      label: 'Sprache',
                      value: _language,
                      items: const [
                        DropdownMenuItem(value: 'de', child: Text('Deutsch')),
                        DropdownMenuItem(value: 'en', child: Text('English')),
                      ],
                      onChanged: (v) {
                        if (v != null) setState(() => _language = v);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // ── Save button ─────────────────────────────────
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _saveSettings,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Einstellungen speichern',
                            style: TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 32),

                // ── Legal ───────────────────────────────────────
                _SectionHeader('Rechtliches'),
                _NavTile(
                  icon: LucideIcons.shield,
                  label: 'Datenschutz',
                  subtitle: 'Datenschutzerklärung einsehen',
                  color: const Color(0xFF10B981),
                  onTap: () => context.go('/datenschutz'),
                ),
                _NavTile(
                  icon: LucideIcons.fileText,
                  label: 'Impressum',
                  subtitle: 'Rechtliche Informationen',
                  color: const Color(0xFF64748B),
                  onTap: () => context.go('/impressum'),
                ),
                const SizedBox(height: 24),

                // ── About ───────────────────────────────────────
                _SectionHeader('Über'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48, height: 48,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                  colors: [AppColors.primary, Color(0xFF1E40AF)]),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Text('D',
                                  style: TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white)),
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('DocStruc',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.text)),
                                Text('Version 1.0.0',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textTertiary)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Professionelle Bauprojektverwaltung für Teams und Unternehmen.',
                        style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ── Logout ──────────────────────────────────────
                SizedBox(
                  height: 50,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16)),
                          title: const Text('Abmelden'),
                          content: const Text(
                              'Möchten Sie sich wirklich abmelden?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Abbrechen'),
                            ),
                            ElevatedButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.danger),
                              child: const Text('Abmelden',
                                  style: TextStyle(color: Colors.white)),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true && context.mounted) {
                        await ref.read(authProvider.notifier).signOut();
                      }
                    },
                    icon: const Icon(LucideIcons.logOut,
                        size: 18, color: AppColors.danger),
                    label: const Text('Abmelden',
                        style: TextStyle(
                            color: AppColors.danger,
                            fontSize: 15,
                            fontWeight: FontWeight.w600)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.danger),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Reusable Widgets ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, left: 2),
      child: Text(title,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
              letterSpacing: 0.5)),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _NavTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 18, color: color),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textTertiary)),
                    ],
                  ),
                ),
                const Icon(LucideIcons.chevronRight,
                    size: 18, color: AppColors.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final List<Widget> children;
  const _SettingsCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleRow({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _DropdownRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final List<DropdownMenuItem<String>> items;
  final ValueChanged<String?> onChanged;

  const _DropdownRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 14),
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.text)),
          ),
          DropdownButton<String>(
            value: value,
            items: items,
            onChanged: onChanged,
            underline: const SizedBox(),
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
            icon: const Icon(LucideIcons.chevronDown,
                size: 16, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      color: AppColors.borderLight,
    );
  }
}
