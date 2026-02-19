import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';

class HelpDocumentsScreen extends StatefulWidget {
  const HelpDocumentsScreen({super.key});

  @override
  State<HelpDocumentsScreen> createState() => _HelpDocumentsScreenState();
}

class _HelpDocumentsScreenState extends State<HelpDocumentsScreen> {
  bool _loading = true;
  List<dynamic> _documents = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final d = await SupabaseService.getDocuments();
    if (mounted) setState(() { _documents = d; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Dokumentation')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _documents.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.fileText,
                          size: 48, color: AppColors.textTertiary),
                      SizedBox(height: 12),
                      Text('Keine Dokumente',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _documents.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _DocumentCard(_documents[i]),
                ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  final Map<String, dynamic> doc;
  const _DocumentCard(this.doc);

  @override
  Widget build(BuildContext context) {
    final title = doc['title'] ?? '';
    final description = doc['description'] ?? '';
    final url = doc['file_url'] ?? doc['url'] ?? '';
    final category = doc['category'] ?? '';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          if (url.isNotEmpty) {
            final uri = Uri.tryParse(url);
            if (uri != null) await launchUrl(uri);
          } else {
            // Show content in bottom sheet
            _showContent(context);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(LucideIcons.fileText,
                    size: 22, color: Color(0xFF3B82F6)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.text),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    if (category.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(category,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF3B82F6))),
                    ],
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(description,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
              const Icon(LucideIcons.externalLink,
                  size: 16, color: AppColors.textTertiary),
            ],
          ),
        ),
      ),
    );
  }

  void _showContent(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        constraints:
            BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: ListView(
          shrinkWrap: true,
          children: [
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(doc['title'] ?? '',
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text)),
            const SizedBox(height: 16),
            Text(doc['content'] ?? doc['description'] ?? 'Kein Inhalt',
                style: const TextStyle(
                    fontSize: 14, height: 1.6, color: AppColors.text)),
          ],
        ),
      ),
    );
  }
}
