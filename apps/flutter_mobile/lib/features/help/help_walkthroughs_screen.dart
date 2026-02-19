import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/services/supabase_service.dart';
import '../../../core/theme/app_colors.dart';

class HelpWalkthroughsScreen extends StatefulWidget {
  const HelpWalkthroughsScreen({super.key});

  @override
  State<HelpWalkthroughsScreen> createState() =>
      _HelpWalkthroughsScreenState();
}

class _HelpWalkthroughsScreenState extends State<HelpWalkthroughsScreen> {
  bool _loading = true;
  List<dynamic> _walkthroughs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final w = await SupabaseService.getWalkthroughs();
    if (mounted) setState(() { _walkthroughs = w; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Erste Schritte')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _walkthroughs.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.rocket,
                          size: 48, color: AppColors.textTertiary),
                      SizedBox(height: 12),
                      Text('Keine Anleitungen',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _walkthroughs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final w = _walkthroughs[i];
                    return _WalkthroughCard(
                      index: i + 1,
                      title: w['title'] ?? '',
                      description: w['description'] ?? '',
                      steps: (w['steps'] as List<dynamic>?) ?? [],
                    );
                  },
                ),
    );
  }
}

class _WalkthroughCard extends StatefulWidget {
  final int index;
  final String title;
  final String description;
  final List<dynamic> steps;

  const _WalkthroughCard({
    required this.index,
    required this.title,
    required this.description,
    required this.steps,
  });

  @override
  State<_WalkthroughCard> createState() => _WalkthroughCardState();
}

class _WalkthroughCardState extends State<_WalkthroughCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text('${widget.index}',
                          style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF10B981))),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.title,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.text)),
                        if (widget.description.isNotEmpty)
                          Text(widget.description,
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  Icon(
                    _expanded
                        ? LucideIcons.chevronUp
                        : LucideIcons.chevronDown,
                    size: 18,
                    color: AppColors.textTertiary,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1),
            if (widget.description.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(widget.description,
                    style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                        height: 1.5)),
              ),
            if (widget.steps.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: widget.steps.asMap().entries.map((e) {
                    final step = e.value;
                    final stepText =
                        step is Map ? step['text'] ?? step.toString() : step.toString();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text('${e.key + 1}',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.primary)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(stepText,
                                style: const TextStyle(
                                    fontSize: 14, color: AppColors.text)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
