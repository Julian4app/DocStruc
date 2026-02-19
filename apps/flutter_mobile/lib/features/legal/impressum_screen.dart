import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_colors.dart';

class ImpressumScreen extends StatelessWidget {
  const ImpressumScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Impressum')),
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
                        color: const Color(0xFF64748B).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.fileText,
                          size: 22, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(width: 14),
                    const Text('Impressum',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.text)),
                  ],
                ),
                const SizedBox(height: 24),
                const _InfoBlock(
                  title: 'Angaben gemäß § 5 TMG',
                  content:
                      'DocStruc GmbH\n'
                      'Musterstraße 1\n'
                      '10115 Berlin\n'
                      'Deutschland',
                ),
                const _InfoBlock(
                  title: 'Vertreten durch',
                  content: 'Geschäftsführer: Max Mustermann',
                ),
                const _InfoBlock(
                  title: 'Kontakt',
                  content:
                      'Telefon: +49 (0) 30 12345678\n'
                      'E-Mail: info@docstruc.de\n'
                      'Website: www.docstruc.de',
                ),
                const _InfoBlock(
                  title: 'Registereintrag',
                  content:
                      'Eintragung im Handelsregister\n'
                      'Registergericht: Amtsgericht Berlin-Charlottenburg\n'
                      'Registernummer: HRB 123456',
                ),
                const _InfoBlock(
                  title: 'Umsatzsteuer-ID',
                  content:
                      'Umsatzsteuer-Identifikationsnummer gemäß §27a\n'
                      'Umsatzsteuergesetz: DE123456789',
                ),
                const _InfoBlock(
                  title: 'Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV',
                  content:
                      'Max Mustermann\n'
                      'DocStruc GmbH\n'
                      'Musterstraße 1\n'
                      '10115 Berlin',
                ),
                const Divider(height: 32),
                const _InfoBlock(
                  title: 'Haftungsausschluss',
                  content:
                      'Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung '
                      'für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten '
                      'sind ausschließlich deren Betreiber verantwortlich.',
                ),
                const _InfoBlock(
                  title: 'Urheberrecht',
                  content:
                      'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten '
                      'unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, '
                      'Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes '
                      'bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.',
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

class _InfoBlock extends StatelessWidget {
  final String title;
  final String content;

  const _InfoBlock({required this.title, required this.content});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 6),
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
