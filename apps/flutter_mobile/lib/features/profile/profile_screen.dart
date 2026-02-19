import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

import '../../core/providers/auth_provider.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_colors.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _positionCtrl = TextEditingController();
  bool _saving = false;
  bool _initialized = false;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _companyCtrl.dispose();
    _positionCtrl.dispose();
    super.dispose();
  }

  void _initFields(Map<String, dynamic>? profile) {
    if (_initialized || profile == null) return;
    _initialized = true;
    _firstNameCtrl.text = profile['first_name'] ?? '';
    _lastNameCtrl.text = profile['last_name'] ?? '';
    _emailCtrl.text = profile['email'] ?? '';
    _phoneCtrl.text = profile['phone'] ?? '';
    _companyCtrl.text = profile['company_name'] ?? profile['company'] ?? '';
    _positionCtrl.text = profile['position'] ?? '';
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final auth = ref.read(authProvider);
      if (auth.userId == null) return;
      await SupabaseService.updateProfile(auth.userId!, {
        'first_name': _firstNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'company_name': _companyCtrl.text.trim(),
        'position': _positionCtrl.text.trim(),
      });
      await ref.read(authProvider.notifier).refreshProfile();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(LucideIcons.check, size: 16, color: Colors.white),
                SizedBox(width: 10),
                Text('Profil gespeichert'),
              ],
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF34C759),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fehler: $e'), backgroundColor: const Color(0xFFFF3B30)),
        );
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
        source: ImageSource.gallery, maxWidth: 512, maxHeight: 512);
    if (image == null) return;

    setState(() => _saving = true);
    try {
      final auth = ref.read(authProvider);
      if (auth.userId == null) return;
      final file = File(image.path);
      final bytes = await file.readAsBytes();
      final path = 'avatars/${auth.userId}/${image.name}';
      final url = await SupabaseService.uploadFileSimple(path, bytes, image.name);
      await SupabaseService.updateProfile(auth.userId!, {'avatar_url': url});
      await ref.read(authProvider.notifier).refreshProfile();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Fehler: $e')),
        );
      }
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    _initFields(auth.profile);

    final avatarUrl = auth.profile?['avatar_url'];
    final initials = auth.initials;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profil'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Speichern',
                    style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar
          Center(
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 52,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  backgroundImage:
                      avatarUrl != null ? NetworkImage(avatarUrl) : null,
                  child: avatarUrl == null
                      ? Text(initials,
                          style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primary))
                      : null,
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: _pickAvatar,
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: const Icon(LucideIcons.camera,
                          size: 16, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(auth.email ?? '',
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
          ),
          const SizedBox(height: 28),

          // Form fields
          _Section(
            title: 'Persönliche Daten',
            children: [
              TextField(
                controller: _firstNameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Vorname',
                  prefixIcon: Icon(LucideIcons.user, size: 18),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _lastNameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Nachname',
                  prefixIcon: Icon(LucideIcons.user, size: 18),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _emailCtrl,
                decoration: const InputDecoration(
                  labelText: 'E-Mail',
                  prefixIcon: Icon(LucideIcons.mail, size: 18),
                ),
                enabled: false,
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _phoneCtrl,
                decoration: const InputDecoration(
                  labelText: 'Telefon',
                  prefixIcon: Icon(LucideIcons.phone, size: 18),
                ),
                keyboardType: TextInputType.phone,
              ),
            ],
          ),
          const SizedBox(height: 20),
          _Section(
            title: 'Beruflich',
            children: [
              TextField(
                controller: _companyCtrl,
                decoration: const InputDecoration(
                  labelText: 'Unternehmen',
                  prefixIcon: Icon(LucideIcons.building2, size: 18),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _positionCtrl,
                decoration: const InputDecoration(
                  labelText: 'Position',
                  prefixIcon: Icon(LucideIcons.briefcase, size: 18),
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authProvider.notifier).signOut();
            },
            icon: const Icon(LucideIcons.logOut,
                size: 18, color: AppColors.danger),
            label: const Text('Abmelden',
                style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.danger),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text)),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}
