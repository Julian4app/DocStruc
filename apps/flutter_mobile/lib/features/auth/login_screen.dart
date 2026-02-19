import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_colors.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  // Login form
  final _loginFormKey = GlobalKey<FormState>();
  final _loginEmail = TextEditingController();
  final _loginPassword = TextEditingController();

  // Register form
  final _regFormKey = GlobalKey<FormState>();
  final _regFirstName = TextEditingController();
  final _regLastName = TextEditingController();
  final _regEmail = TextEditingController();
  final _regPassword = TextEditingController();
  final _regPhone = TextEditingController();
  final _regCompany = TextEditingController();

  bool _loading = false;
  String? _error;
  bool _obscureLogin = true;
  bool _obscureReg = true;

  // Simple rate-limiting display
  int _attempts = 0;
  DateTime? _lockedUntil;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _tabCtrl.addListener(() {
      if (_tabCtrl.indexIsChanging) {
        setState(() => _error = null);
      }
    });
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _loginEmail.dispose();
    _loginPassword.dispose();
    _regFirstName.dispose();
    _regLastName.dispose();
    _regEmail.dispose();
    _regPassword.dispose();
    _regPhone.dispose();
    _regCompany.dispose();
    super.dispose();
  }

  bool get _isRateLimited {
    if (_lockedUntil == null) return false;
    if (DateTime.now().isBefore(_lockedUntil!)) return true;
    _lockedUntil = null;
    _attempts = 0;
    return false;
  }

  String get _rateLimitMessage {
    if (_lockedUntil == null) return '';
    final remaining = _lockedUntil!.difference(DateTime.now()).inSeconds;
    return 'Zu viele Versuche. Bitte warten Sie $remaining Sekunden.';
  }

  void _trackAttempt() {
    _attempts++;
    if (_attempts >= 5) {
      _lockedUntil = DateTime.now().add(const Duration(seconds: 30));
      // Auto-refresh countdown
      Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        if (_lockedUntil == null || DateTime.now().isAfter(_lockedUntil!)) {
          timer.cancel();
          setState(() {
            _lockedUntil = null;
            _attempts = 0;
          });
        } else {
          setState(() {});
        }
      });
    }
  }

  Future<void> _handleLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;
    if (_isRateLimited) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    final err = await ref.read(authProvider.notifier).signIn(
          _loginEmail.text.trim(),
          _loginPassword.text,
        );

    if (!mounted) return;

    if (err != null) {
      _trackAttempt();
      setState(() {
        _loading = false;
        _error = err;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    if (!_regFormKey.currentState!.validate()) return;
    if (_isRateLimited) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    final err = await ref.read(authProvider.notifier).signUp(
          email: _regEmail.text.trim(),
          password: _regPassword.text,
          firstName: _regFirstName.text.trim(),
          lastName: _regLastName.text.trim(),
          phone: _regPhone.text.trim().isEmpty ? null : _regPhone.text.trim(),
          companyName:
              _regCompany.text.trim().isEmpty ? null : _regCompany.text.trim(),
        );

    if (!mounted) return;

    if (err != null) {
      _trackAttempt();
      setState(() {
        _loading = false;
        _error = err;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  // ── Input decoration helper ───────────────────────────────────────────────
  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
    Widget? suffix,
  }) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(
        color: AppColors.textSecondary,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      prefixIcon: Icon(icon, size: 20, color: AppColors.textTertiary),
      suffixIcon: suffix,
      filled: true,
      fillColor: AppColors.surfaceVariant,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // ── Branded Header ────────────────────────────────────────────────
          _buildHeader(),

          // ── Tab Bar ───────────────────────────────────────────────────────
          Container(
            color: AppColors.surface,
            child: TabBar(
              controller: _tabCtrl,
              indicatorColor: AppColors.primary,
              indicatorWeight: 3,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
              unselectedLabelStyle: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 15,
              ),
              tabs: const [
                Tab(text: 'Anmelden'),
                Tab(text: 'Registrieren'),
              ],
            ),
          ),

          // ── Body ──────────────────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                _buildLoginTab(bottom),
                _buildRegisterTab(bottom),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 32,
        bottom: 28,
      ),
      decoration: const BoxDecoration(
        gradient: AppColors.primaryGradient,
      ),
      child: Column(
        children: [
          // Logo / Icon
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              LucideIcons.building2,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'DocStruc',
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Baudokumentation einfach gemacht',
            style: TextStyle(
              color: Colors.white.withOpacity(0.7),
              fontSize: 14,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }

  // ── Login tab ─────────────────────────────────────────────────────────────
  Widget _buildLoginTab(double bottomInset) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + bottomInset),
      child: Form(
        key: _loginFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Error / rate limit banner
            if (_error != null || _isRateLimited) _buildErrorBanner(),

            // Email
            TextFormField(
              controller: _loginEmail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              decoration: _inputDecoration(
                label: 'E-Mail-Adresse',
                icon: LucideIcons.mail,
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Bitte E-Mail eingeben';
                }
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) {
                  return 'Ungültige E-Mail-Adresse';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Password
            TextFormField(
              controller: _loginPassword,
              obscureText: _obscureLogin,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              decoration: _inputDecoration(
                label: 'Passwort',
                icon: LucideIcons.lock,
                suffix: IconButton(
                  icon: Icon(
                    _obscureLogin ? LucideIcons.eyeOff : LucideIcons.eye,
                    size: 20,
                    color: AppColors.textTertiary,
                  ),
                  onPressed: () =>
                      setState(() => _obscureLogin = !_obscureLogin),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Bitte Passwort eingeben';
                return null;
              },
              onFieldSubmitted: (_) => _handleLogin(),
            ),
            const SizedBox(height: 8),

            // Forgot password
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {
                  // TODO: wire up password-reset flow
                },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Passwort vergessen?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Submit
            _buildSubmitButton(
              label: 'Anmelden',
              onPressed: _handleLogin,
            ),
          ],
        ),
      ),
    );
  }

  // ── Register tab ──────────────────────────────────────────────────────────
  Widget _buildRegisterTab(double bottomInset) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + bottomInset),
      child: Form(
        key: _regFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null || _isRateLimited) _buildErrorBanner(),

            // First name / Last name row
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _regFirstName,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDecoration(
                      label: 'Vorname',
                      icon: LucideIcons.user,
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Pflichtfeld' : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _regLastName,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    decoration: _inputDecoration(
                      label: 'Nachname',
                      icon: LucideIcons.user,
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Pflichtfeld' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Email
            TextFormField(
              controller: _regEmail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: _inputDecoration(
                label: 'E-Mail-Adresse',
                icon: LucideIcons.mail,
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Bitte E-Mail eingeben';
                }
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) {
                  return 'Ungültige E-Mail-Adresse';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Password
            TextFormField(
              controller: _regPassword,
              obscureText: _obscureReg,
              textInputAction: TextInputAction.next,
              decoration: _inputDecoration(
                label: 'Passwort',
                icon: LucideIcons.lock,
                suffix: IconButton(
                  icon: Icon(
                    _obscureReg ? LucideIcons.eyeOff : LucideIcons.eye,
                    size: 20,
                    color: AppColors.textTertiary,
                  ),
                  onPressed: () =>
                      setState(() => _obscureReg = !_obscureReg),
                ),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Bitte Passwort eingeben';
                if (v.length < 6) return 'Mindestens 6 Zeichen';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Phone
            TextFormField(
              controller: _regPhone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: _inputDecoration(
                label: 'Telefon (optional)',
                icon: LucideIcons.phone,
              ),
            ),
            const SizedBox(height: 16),

            // Company
            TextFormField(
              controller: _regCompany,
              textInputAction: TextInputAction.done,
              textCapitalization: TextCapitalization.words,
              decoration: _inputDecoration(
                label: 'Firma (optional)',
                icon: LucideIcons.building,
              ),
            ),
            const SizedBox(height: 28),

            // Submit
            _buildSubmitButton(
              label: 'Konto erstellen',
              onPressed: _handleRegister,
            ),
          ],
        ),
      ),
    );
  }

  // ── Reusable widgets ──────────────────────────────────────────────────────

  Widget _buildErrorBanner() {
    final msg = _isRateLimited ? _rateLimitMessage : _error;
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 20),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.danger.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.danger.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            const Icon(LucideIcons.alertCircle,
                color: AppColors.danger, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                msg ?? '',
                style: const TextStyle(
                  color: AppColors.danger,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton({
    required String label,
    required VoidCallback onPressed,
  }) {
    final disabled = _loading || _isRateLimited;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 52,
      child: ElevatedButton(
        onPressed: disabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Colors.white,
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}
