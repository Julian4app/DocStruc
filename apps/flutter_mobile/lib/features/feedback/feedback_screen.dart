import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';

class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  int _rating = 0;
  final _messageCtrl = TextEditingController();
  String _category = 'allgemein';
  bool _sending = false;
  bool _sent = false;

  @override
  void dispose() {
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0 || _messageCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content:
                Text('Bitte geben Sie eine Bewertung und Nachricht ein')),
      );
      return;
    }

    setState(() => _sending = true);
    try {
      await SupabaseService.sendFeedback({
        'rating': _rating,
        'message': _messageCtrl.text.trim(),
        'category': _category,
        'user_id': ref.read(authProvider).userId,
      });
      setState(() => _sent = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fehler: $e')),
        );
      }
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Feedback')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.checkCircle2,
                      size: 40, color: AppColors.success),
                ),
                const SizedBox(height: 24),
                const Text('Vielen Dank!',
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text)),
                const SizedBox(height: 8),
                const Text(
                  'Ihr Feedback wurde erfolgreich gesendet. Wir schätzen Ihre Meinung!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.5),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _sent = false;
                      _rating = 0;
                      _messageCtrl.clear();
                      _category = 'allgemein';
                    });
                  },
                  child: const Text('Weiteres Feedback'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Feedback')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, Color(0xFF1E3A5F)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Column(
              children: [
                Icon(LucideIcons.messageSquare,
                    size: 36, color: Colors.white),
                SizedBox(height: 12),
                Text('Wie gefällt Ihnen DocStruc?',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
                SizedBox(height: 4),
                Text('Ihre Meinung hilft uns, besser zu werden',
                    style: TextStyle(
                        fontSize: 13, color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Star rating
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                const Text('Bewertung',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text)),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(5, (i) {
                    final filled = i < _rating;
                    return GestureDetector(
                      onTap: () => setState(() => _rating = i + 1),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Icon(
                          filled ? LucideIcons.star : LucideIcons.star,
                          size: 40,
                          color: filled
                              ? const Color(0xFFF59E0B)
                              : AppColors.border,
                        ),
                      ),
                    );
                  }),
                ),
                if (_rating > 0) ...[
                  const SizedBox(height: 8),
                  Text(
                    _ratingText(_rating),
                    style: const TextStyle(
                        fontSize: 14, color: AppColors.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Category & message
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  value: _category,
                  decoration:
                      const InputDecoration(labelText: 'Kategorie'),
                  items: const [
                    DropdownMenuItem(
                        value: 'allgemein', child: Text('Allgemein')),
                    DropdownMenuItem(
                        value: 'bug', child: Text('Fehlerbericht')),
                    DropdownMenuItem(
                        value: 'feature',
                        child: Text('Funktionswunsch')),
                    DropdownMenuItem(
                        value: 'design', child: Text('Design')),
                    DropdownMenuItem(
                        value: 'performance',
                        child: Text('Performance')),
                  ],
                  onChanged: (v) => setState(() => _category = v!),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _messageCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Ihre Nachricht *',
                    alignLabelWithHint: true,
                  ),
                  maxLines: 5,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _sending ? null : _submit,
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Feedback senden'),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  String _ratingText(int r) {
    switch (r) {
      case 1: return 'Schlecht';
      case 2: return 'Verbesserungswürdig';
      case 3: return 'In Ordnung';
      case 4: return 'Gut';
      case 5: return 'Ausgezeichnet';
      default: return '';
    }
  }
}
