import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_colors.dart';

class DatenschutzScreen extends StatelessWidget {
  const DatenschutzScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Datenschutz')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.shield,
                          size: 22, color: Color(0xFF10B981)),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Datenschutzerklärung',
                              style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.text)),
                          Text('Zuletzt aktualisiert: Januar 2025',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textTertiary)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const _LegalSection(
                  title: '1. Verantwortlicher',
                  content:
                      'Verantwortlich für die Datenverarbeitung ist DocStruc GmbH. '
                      'Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst und behandeln Ihre personenbezogenen Daten vertraulich '
                      'und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.',
                ),
                const _LegalSection(
                  title: '2. Erhebung und Speicherung personenbezogener Daten',
                  content:
                      'Bei der Nutzung unserer App werden folgende Daten erhoben:\n\n'
                      '• Name und E-Mail-Adresse bei der Registrierung\n'
                      '• Projektdaten und zugehörige Informationen\n'
                      '• Kommunikationsdaten innerhalb der App\n'
                      '• Nutzungsdaten zur Verbesserung unserer Dienste\n'
                      '• Hochgeladene Dateien und Bilder',
                ),
                const _LegalSection(
                  title: '3. Zweck der Datenverarbeitung',
                  content:
                      'Wir verarbeiten Ihre Daten zum Zweck der:\n\n'
                      '• Bereitstellung und Verbesserung unserer Dienste\n'
                      '• Verwaltung Ihres Benutzerkontos\n'
                      '• Projektverwaltung und Zusammenarbeit\n'
                      '• Kommunikation zwischen Projektmitgliedern\n'
                      '• Erfüllung gesetzlicher Pflichten',
                ),
                const _LegalSection(
                  title: '4. Datensicherheit',
                  content:
                      'Wir verwenden SSL-Verschlüsselung und setzen auf die sichere Infrastruktur von Supabase '
                      'für die Speicherung Ihrer Daten. Alle Daten werden in EU-Rechenzentren gespeichert.',
                ),
                const _LegalSection(
                  title: '5. Ihre Rechte',
                  content:
                      'Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung '
                      'Ihrer personenbezogenen Daten. Wenden Sie sich hierzu an unseren Datenschutzbeauftragten '
                      'unter datenschutz@docstruc.de.',
                ),
                const _LegalSection(
                  title: '6. Kontakt',
                  content:
                      'Bei Fragen zum Datenschutz können Sie uns jederzeit kontaktieren:\n\n'
                      'E-Mail: datenschutz@docstruc.de',
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _LegalSection extends StatelessWidget {
  final String title;
  final String content;

  const _LegalSection({required this.title, required this.content});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 8),
          Text(content,
              style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.6)),
        ],
      ),
    );
  }
}
