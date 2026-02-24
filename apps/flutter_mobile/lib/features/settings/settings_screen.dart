import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/providers/notifications_provider.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ── Language options ─────────────────────────────────────────────────────────
const _languages = [
  (code: 'de', label: 'Deutsch', flag: '🇩🇪', sub: 'Deutsch (Deutschland)'),
  (code: 'en', label: 'English', flag: '🇺🇸', sub: 'English (US)'),
  (code: 'fr', label: 'Français', flag: '🇫🇷', sub: 'Français (France)'),
  (code: 'es', label: 'Español', flag: '🇪🇸', sub: 'Español (España)'),
  (code: 'it', label: 'Italiano', flag: '🇮🇹', sub: 'Italiano (Italia)'),
  (code: 'pl', label: 'Polski', flag: '🇵🇱', sub: 'Polski (Polska)'),
];

({String code, String label, String flag, String sub}) _langByCode(String code) {
  return _languages.firstWhere((l) => l.code == code,
      orElse: () => _languages.first);
}

// ── Notification settings model ──────────────────────────────────────────────
class _NotifSettings {
  final bool pushEnabled;
  final bool projectUpdates;
  final bool taskUpdates;
  final bool messages;
  final bool defectUpdates;
  final bool weeklyReports;

  const _NotifSettings({
    this.pushEnabled    = true,
    this.projectUpdates = true,
    this.taskUpdates    = true,
    this.messages       = true,
    this.defectUpdates  = true,
    this.weeklyReports  = false,
  });

  _NotifSettings copyWith({
    bool? pushEnabled,
    bool? projectUpdates,
    bool? taskUpdates,
    bool? messages,
    bool? defectUpdates,
    bool? weeklyReports,
  }) => _NotifSettings(
    pushEnabled:    pushEnabled    ?? this.pushEnabled,
    projectUpdates: projectUpdates ?? this.projectUpdates,
    taskUpdates:    taskUpdates    ?? this.taskUpdates,
    messages:       messages       ?? this.messages,
    defectUpdates:  defectUpdates  ?? this.defectUpdates,
    weeklyReports:  weeklyReports  ?? this.weeklyReports,
  );

  Map<String, dynamic> toMap() => {
    'pushNotifications': pushEnabled,
    'projectUpdates':    projectUpdates,
    'taskUpdates':       taskUpdates,
    'messages':          messages,
    'defectUpdates':     defectUpdates,
    'weeklyReports':     weeklyReports,
    // Keep legacy keys for backward compat
    'emailNotifications': pushEnabled,
  };

  factory _NotifSettings.fromMap(Map<String, dynamic> m) => _NotifSettings(
    pushEnabled:    m['pushNotifications'] ?? m['emailNotifications'] ?? true,
    projectUpdates: m['projectUpdates']    ?? true,
    taskUpdates:    m['taskUpdates']       ?? true,
    messages:       m['messages']          ?? true,
    defectUpdates:  m['defectUpdates']     ?? true,
    weeklyReports:  m['weeklyReports']     ?? false,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _loading  = true;
  bool _saving   = false;
  bool _hasPerm  = false;

  _NotifSettings _notif   = const _NotifSettings();
  String         _language = 'de';

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _checkPerm();
  }

  Future<void> _checkPerm() async {
    final has = await NotificationService.hasPermission();
    if (mounted) setState(() => _hasPerm = has);
  }

  Future<void> _loadSettings() async {
    try {
      final data = await SupabaseService.getUserSettings();
      if (data != null && data['settings'] != null && mounted) {
        final s = data['settings'] as Map<String, dynamic>;
        setState(() {
          _notif    = _NotifSettings.fromMap(s);
          _language = s['language'] ?? 'de';
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _saveSettings() async {
    setState(() => _saving = true);
    try {
      final settingsMap = {
        ..._notif.toMap(),
        'language': _language,
        'updated_at': DateTime.now().toIso8601String(),
      };
      await SupabaseService.upsertUserSettings({'settings': settingsMap});

      // Push updated settings into the notifications provider
      ref.read(notificationsProvider.notifier).updateSettings(settingsMap);

      // If push enabled and no permission yet, request it
      if (_notif.pushEnabled && !_hasPerm) {
        final granted = await NotificationService.requestPermission();
        setState(() => _hasPerm = granted);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(children: [
              Icon(LucideIcons.check, size: 16, color: Colors.white),
              SizedBox(width: 10),
              Text('Einstellungen gespeichert'),
            ]),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.success,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
          ? const LottieLoader()
          : ListView(
              padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).padding.bottom + 96),
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

                // Permission banner (shown if push is on but no permission)
                if (_notif.pushEnabled && !_hasPerm)
                  _PermissionBanner(
                    onRequest: () async {
                      final ok = await NotificationService.requestPermission();
                      setState(() => _hasPerm = ok);
                    },
                  ),

                _NotifCard(
                  settings: _notif,
                  onChanged: (updated) => setState(() => _notif = updated),
                ),
                const SizedBox(height: 24),

                // ── Language ────────────────────────────────────
                _SectionHeader('Sprache & Region'),
                _LanguageTile(
                  language: _language,
                  onChanged: (v) => setState(() => _language = v),
                ),
                const SizedBox(height: 16),

                // ── Save ────────────────────────────────────────
                _SaveButton(saving: _saving, onSave: _saveSettings),
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
                _AboutCard(),
                const SizedBox(height: 24),

                // ── Logout ──────────────────────────────────────
                _LogoutButton(),
              ],
            ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Notification Card ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _NotifCard extends StatelessWidget {
  final _NotifSettings settings;
  final ValueChanged<_NotifSettings> onChanged;
  const _NotifCard({required this.settings, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          // Master push toggle (prominent)
          _MasterToggle(
            value: settings.pushEnabled,
            onChanged: (v) => onChanged(settings.copyWith(pushEnabled: v)),
          ),

          // Sub-toggles – only visible when master is ON
          AnimatedSize(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeInOut,
            child: settings.pushEnabled
                ? Column(
                    children: [
                      _sDivider(),
                      _SubToggle(
                        icon: LucideIcons.building2,
                        color: const Color(0xFF3B82F6),
                        label: 'Projekt Updates',
                        subtitle: 'Status- und Mitgliederänderungen',
                        value: settings.projectUpdates,
                        onChanged: (v) => onChanged(settings.copyWith(projectUpdates: v)),
                      ),
                      _sDivider(),
                      _SubToggle(
                        icon: LucideIcons.checkSquare,
                        color: const Color(0xFF10B981),
                        label: 'Aufgaben',
                        subtitle: 'Zuweisung und Abschluss von Aufgaben',
                        value: settings.taskUpdates,
                        onChanged: (v) => onChanged(settings.copyWith(taskUpdates: v)),
                      ),
                      _sDivider(),
                      _SubToggle(
                        icon: LucideIcons.messageCircle,
                        color: const Color(0xFF8B5CF6),
                        label: 'Nachrichten',
                        subtitle: 'Neue Kommentare und Nachrichten',
                        value: settings.messages,
                        onChanged: (v) => onChanged(settings.copyWith(messages: v)),
                      ),
                      _sDivider(),
                      _SubToggle(
                        icon: LucideIcons.alertTriangle,
                        color: const Color(0xFFF97316),
                        label: 'Mängel',
                        subtitle: 'Neue und abgeschlossene Mängel',
                        value: settings.defectUpdates,
                        onChanged: (v) => onChanged(settings.copyWith(defectUpdates: v)),
                      ),
                      _sDivider(),
                      _SubToggle(
                        icon: LucideIcons.barChart3,
                        color: const Color(0xFF64748B),
                        label: 'Wöchentliche Berichte',
                        subtitle: 'Zusammenfassung jeden Montag',
                        value: settings.weeklyReports,
                        onChanged: (v) => onChanged(settings.copyWith(weeklyReports: v)),
                        isLast: true,
                      ),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  static Widget _sDivider() => Container(
    height: 1,
    margin: const EdgeInsets.symmetric(horizontal: 16),
    color: AppColors.borderLight,
  );
}

class _MasterToggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _MasterToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: value
                  ? AppColors.primary.withValues(alpha: 0.1)
                  : AppColors.background,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              value ? LucideIcons.bell : LucideIcons.bellOff,
              size: 20,
              color: value ? AppColors.primary : AppColors.textTertiary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Push-Benachrichtigungen',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text)),
                Text(
                  value
                      ? 'Benachrichtigungen sind aktiviert'
                      : 'Benachrichtigungen sind deaktiviert',
                  style: TextStyle(
                      fontSize: 12,
                      color: value ? AppColors.success : AppColors.textTertiary),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

class _SubToggle extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isLast;

  const _SubToggle({
    required this.icon,
    required this.color,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 10, 16, isLast ? 14 : 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 17, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text)),
                const SizedBox(height: 1),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: color,
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Permission Banner ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _PermissionBanner extends StatelessWidget {
  final VoidCallback onRequest;
  const _PermissionBanner({required this.onRequest});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.alertCircle, size: 20, color: Color(0xFFF97316)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Berechtigung erforderlich',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFC2410C))),
                SizedBox(height: 2),
                Text('Erlauben Sie Benachrichtigungen für Push-Alerts.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF9A3412))),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRequest,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFF97316),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('Erlauben',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Language Tile ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _LanguageTile extends StatelessWidget {
  final String language;
  final ValueChanged<String> onChanged;
  const _LanguageTile({required this.language, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final lang = _langByCode(language);
    return GestureDetector(
      onTap: () => _showLanguagePicker(context),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            // Globe icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.globe, size: 20, color: AppColors.primary),
            ),
            const SizedBox(width: 14),
            // Label + current selection
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Sprache',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text)),
                  const SizedBox(height: 2),
                  Text(lang.sub,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textTertiary)),
                ],
              ),
            ),
            // Flag + chevron
            Row(children: [
              Text(lang.flag, style: const TextStyle(fontSize: 22)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Row(children: [
                  Text(lang.label,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary)),
                  const SizedBox(width: 4),
                  const Icon(LucideIcons.chevronDown, size: 14, color: AppColors.primary),
                ]),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  void _showLanguagePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _LanguageSheet(
        currentCode: language,
        onSelect: (code) {
          onChanged(code);
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _LanguageSheet extends StatelessWidget {
  final String currentCode;
  final ValueChanged<String> onSelect;
  const _LanguageSheet({required this.currentCode, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Title
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 10, 20, 6),
            child: Row(
              children: [
                Icon(LucideIcons.globe, size: 18, color: AppColors.primary),
                SizedBox(width: 10),
                Text('Sprache wählen',
                    style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text)),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Text(
              'Die Sprache der Benutzeroberfläche',
              style: TextStyle(fontSize: 13, color: AppColors.textTertiary),
            ),
          ),
          // Language list
          ..._languages.map((lang) {
            final isSelected = lang.code == currentCode;
            return GestureDetector(
              onTap: () => onSelect(lang.code),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withValues(alpha: 0.07)
                      : AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.primary.withValues(alpha: 0.3)
                        : AppColors.border,
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    // Flag
                    Text(lang.flag,
                        style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 14),
                    // Labels
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lang.label,
                              style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: isSelected
                                      ? AppColors.primary
                                      : AppColors.text)),
                          Text(lang.sub,
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textTertiary)),
                        ],
                      ),
                    ),
                    // Checkmark
                    AnimatedOpacity(
                      opacity: isSelected ? 1.0 : 0.0,
                      duration: const Duration(milliseconds: 200),
                      child: Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(LucideIcons.check,
                            size: 14, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Reusable Widgets ─────────────────────────────────────────────────────────
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
                  width: 40,
                  height: 40,
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

class _SaveButton extends StatelessWidget {
  final bool saving;
  final VoidCallback onSave;
  const _SaveButton({required this.saving, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: saving ? null : onSave,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
        ),
        child: saving
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2.5, color: Colors.white))
            : const Text('Einstellungen speichern',
                style:
                    TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class _AboutCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
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
                width: 48,
                height: 48,
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
    );
  }
}

class _LogoutButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: 52,
      child: OutlinedButton.icon(
        onPressed: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: const Text('Abmelden'),
              content:
                  const Text('Möchten Sie sich wirklich abmelden?'),
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
              borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
