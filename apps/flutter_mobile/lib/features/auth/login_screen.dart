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
  // 0 = Login, 1 = Register
  int _tabIndex = 0;

  // Login form
  final _loginFormKey  = GlobalKey<FormState>();
  final _loginEmail    = TextEditingController();
  final _loginPassword = TextEditingController();

  // Register form
  final _regFormKey   = GlobalKey<FormState>();
  final _regFirstName = TextEditingController();
  final _regLastName  = TextEditingController();
  final _regEmail     = TextEditingController();
  final _regPassword  = TextEditingController();
  final _regConfirm   = TextEditingController();
  final _regPhone     = TextEditingController();
  final _regCompany   = TextEditingController();

  bool _loading      = false;
  String? _error;
  bool _obscureLogin = true;
  bool _obscureReg   = true;
  bool _obscureConf  = true;
  bool _rememberMe   = false;

  // Rate limiting
  int _attempts = 0;
  DateTime? _lockedUntil;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _loginEmail.dispose();
    _loginPassword.dispose();
    _regFirstName.dispose();
    _regLastName.dispose();
    _regEmail.dispose();
    _regPassword.dispose();
    _regConfirm.dispose();
    _regPhone.dispose();
    _regCompany.dispose();
    super.dispose();
  }

  bool get _isRateLimited {
    if (_lockedUntil == null) return false;
    if (DateTime.now().isBefore(_lockedUntil!)) return true;
    _lockedUntil = null;
    _attempts    = 0;
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
      Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) { timer.cancel(); return; }
        if (_lockedUntil == null || DateTime.now().isAfter(_lockedUntil!)) {
          timer.cancel();
          setState(() { _lockedUntil = null; _attempts = 0; });
        } else {
          setState(() {});
        }
      });
    }
  }

  Future<void> _handleLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;
    if (_isRateLimited) return;
    setState(() { _loading = true; _error = null; });

    final err = await ref.read(authProvider.notifier).signIn(
          _loginEmail.text.trim(),
          _loginPassword.text,
        );

    if (!mounted) return;
    if (err != null) {
      _trackAttempt();
      setState(() { _loading = false; _error = err; });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleRegister() async {
    if (!_regFormKey.currentState!.validate()) return;
    if (_isRateLimited) return;
    setState(() { _loading = true; _error = null; });

    final err = await ref.read(authProvider.notifier).signUp(
          email: _regEmail.text.trim(),
          password: _regPassword.text,
          firstName: _regFirstName.text.trim(),
          lastName: _regLastName.text.trim(),
          phone: _regPhone.text.trim().isEmpty ? null : _regPhone.text.trim(),
          companyName: _regCompany.text.trim().isEmpty ? null : _regCompany.text.trim(),
        );

    if (!mounted) return;
    if (err != null) {
      _trackAttempt();
      setState(() { _loading = false; _error = err; });
    } else {
      setState(() => _loading = false);
    }
  }

  // ── Input decoration ──────────────────────────────────────────────────────
  InputDecoration _fieldDec({
    required String label,
    required IconData icon,
    Widget? suffix,
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      labelStyle: TextStyle(color: Colors.grey.shade500, fontSize: 14, fontWeight: FontWeight.w500),
      prefixIcon: Icon(icon, size: 19, color: Colors.grey.shade400),
      suffixIcon: suffix,
      filled: true,
      fillColor: Colors.grey.shade50,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.danger)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.danger, width: 1.5)),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final size   = MediaQuery.of(context).size;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          // ── Full-screen gradient background ───────────────────────────────
          Container(
            width: double.infinity,
            height: double.infinity,
            decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
          ),

          // ── Header content ────────────────────────────────────────────────
          Positioned(
            top: topPad + 36,
            left: 0, right: 0,
            child: Column(children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.5),
                ),
                child: const Center(
                  child: Text('DS', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 1)),
                ),
              ),
              const SizedBox(height: 14),
              const Text('DocStruc', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
              const SizedBox(height: 4),
              Text('Baudokumentation einfach gemacht',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 14)),
            ]),
          ),

          // ── White card panel ──────────────────────────────────────────────
          Positioned(
            bottom: 0, left: 0, right: 0,
            height: size.height * 0.67,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                boxShadow: [BoxShadow(color: Color(0x18000000), blurRadius: 20, offset: Offset(0, -4))],
              ),
              child: Column(children: [
                const SizedBox(height: 22),

                // ── Segmented toggle ────────────────────────────────────────
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(children: [
                    _tabBtn('Log In', 0),
                    _tabBtn('Sign Up', 1),
                  ]),
                ),

                const SizedBox(height: 4),

                // ── Animated tab content ─────────────────────────────────────
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                    child: KeyedSubtree(
                      key: ValueKey(_tabIndex),
                      child: _tabIndex == 0
                          ? _buildLoginTab(bottom)
                          : _buildRegisterTab(bottom),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabBtn(String label, int index) {
    final active = _tabIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() { _tabIndex = index; _error = null; }),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: active
                ? [const BoxShadow(color: Color(0x12000000), blurRadius: 6, offset: Offset(0, 2))]
                : [],
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? AppColors.primary : Colors.grey.shade500,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Login tab ─────────────────────────────────────────────────────────────
  Widget _buildLoginTab(double bottomInset) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 10, 24, 16 + bottomInset),
      child: Form(
        key: _loginFormKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_error != null || _isRateLimited) ...[
            _errorBanner(),
            const SizedBox(height: 14),
          ],

          TextFormField(
            controller: _loginEmail,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            decoration: _fieldDec(label: 'E-Mail-Adresse', icon: LucideIcons.mail),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Bitte E-Mail eingeben';
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) return 'Ungültige E-Mail-Adresse';
              return null;
            },
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _loginPassword,
            obscureText: _obscureLogin,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            decoration: _fieldDec(
              label: 'Passwort',
              icon: LucideIcons.lock,
              suffix: IconButton(
                icon: Icon(_obscureLogin ? LucideIcons.eyeOff : LucideIcons.eye, size: 19, color: Colors.grey.shade400),
                onPressed: () => setState(() => _obscureLogin = !_obscureLogin),
              ),
            ),
            validator: (v) => (v == null || v.isEmpty) ? 'Bitte Passwort eingeben' : null,
            onFieldSubmitted: (_) => _handleLogin(),
          ),
          const SizedBox(height: 8),

          Row(children: [
            GestureDetector(
              onTap: () => setState(() => _rememberMe = !_rememberMe),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(
                  width: 20, height: 20,
                  child: Checkbox(
                    value: _rememberMe,
                    onChanged: (v) => setState(() => _rememberMe = v ?? false),
                    activeColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                const SizedBox(width: 6),
                Text('Angemeldet bleiben', style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
              ]),
            ),
            const Spacer(),
            TextButton(
              onPressed: () {},
              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
              child: const Text('Passwort vergessen?', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
            ),
          ]),
          const SizedBox(height: 18),

          _submitBtn(label: 'Log In', onPressed: _handleLogin),
          const SizedBox(height: 18),
          _divider(),
          const SizedBox(height: 14),
          _socialButtons(),
          const SizedBox(height: 16),

          Center(child: GestureDetector(
            onTap: () => setState(() { _tabIndex = 1; _error = null; }),
            child: RichText(text: TextSpan(
              text: 'Noch kein Konto? ',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
              children: const [TextSpan(text: 'Konto erstellen', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600))],
            )),
          )),
        ]),
      ),
    );
  }

  // ── Register tab ──────────────────────────────────────────────────────────
  Widget _buildRegisterTab(double bottomInset) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 10, 24, 16 + bottomInset),
      child: Form(
        key: _regFormKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_error != null || _isRateLimited) ...[
            _errorBanner(),
            const SizedBox(height: 14),
          ],

          Row(children: [
            Expanded(child: TextFormField(
              controller: _regFirstName,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.words,
              decoration: _fieldDec(label: 'Vorname', icon: LucideIcons.user),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Pflichtfeld' : null,
            )),
            const SizedBox(width: 10),
            Expanded(child: TextFormField(
              controller: _regLastName,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.words,
              decoration: _fieldDec(label: 'Nachname', icon: LucideIcons.user),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Pflichtfeld' : null,
            )),
          ]),
          const SizedBox(height: 12),

          TextFormField(
            controller: _regEmail,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: _fieldDec(label: 'E-Mail-Adresse', icon: LucideIcons.mail),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Bitte E-Mail eingeben';
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) return 'Ungültige E-Mail';
              return null;
            },
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _regPassword,
            obscureText: _obscureReg,
            textInputAction: TextInputAction.next,
            decoration: _fieldDec(
              label: 'Passwort',
              icon: LucideIcons.lock,
              suffix: IconButton(
                icon: Icon(_obscureReg ? LucideIcons.eyeOff : LucideIcons.eye, size: 19, color: Colors.grey.shade400),
                onPressed: () => setState(() => _obscureReg = !_obscureReg),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Pflichtfeld';
              if (v.length < 6) return 'Mindestens 6 Zeichen';
              return null;
            },
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _regConfirm,
            obscureText: _obscureConf,
            textInputAction: TextInputAction.done,
            decoration: _fieldDec(
              label: 'Passwort bestätigen',
              icon: LucideIcons.lock,
              suffix: IconButton(
                icon: Icon(_obscureConf ? LucideIcons.eyeOff : LucideIcons.eye, size: 19, color: Colors.grey.shade400),
                onPressed: () => setState(() => _obscureConf = !_obscureConf),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Pflichtfeld';
              if (v != _regPassword.text) return 'Passwörter stimmen nicht überein';
              return null;
            },
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _regPhone,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            decoration: _fieldDec(label: 'Telefon (optional)', icon: LucideIcons.phone),
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _regCompany,
            textInputAction: TextInputAction.done,
            textCapitalization: TextCapitalization.words,
            decoration: _fieldDec(label: 'Firma (optional)', icon: LucideIcons.building),
          ),
          const SizedBox(height: 20),

          _submitBtn(label: 'Konto erstellen', onPressed: _handleRegister),
          const SizedBox(height: 18),
          _divider(),
          const SizedBox(height: 14),
          _socialButtons(),
          const SizedBox(height: 16),

          Center(child: GestureDetector(
            onTap: () => setState(() { _tabIndex = 0; _error = null; }),
            child: RichText(text: TextSpan(
              text: 'Bereits ein Konto? ',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
              children: const [TextSpan(text: 'Anmelden', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600))],
            )),
          )),
        ]),
      ),
    );
  }

  // ── Shared widgets ────────────────────────────────────────────────────────
  Widget _errorBanner() {
    final msg = _isRateLimited ? _rateLimitMessage : _error ?? '';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        const Icon(LucideIcons.alertCircle, color: AppColors.danger, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: const TextStyle(color: AppColors.danger, fontSize: 13, fontWeight: FontWeight.w500))),
      ]),
    );
  }

  Widget _submitBtn({required String label, required VoidCallback onPressed}) {
    final disabled = _loading || _isRateLimited;
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: disabled ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: _loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
            : Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _divider() {
    return Row(children: [
      Expanded(child: Divider(color: Colors.grey.shade200)),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Text('Oder weiter mit', style: TextStyle(fontSize: 12, color: Colors.grey.shade400, fontWeight: FontWeight.w500)),
      ),
      Expanded(child: Divider(color: Colors.grey.shade200)),
    ]);
  }

  Widget _socialButtons() {
    return Row(children: [
      Expanded(child: _socialBtn(label: 'Google', icon: const _GoogleIcon(), onPressed: () {})),
      const SizedBox(width: 12),
      Expanded(child: _socialBtn(
        label: 'Apple',
        icon: Icon(LucideIcons.apple, size: 18, color: Colors.grey.shade800),
        onPressed: () {},
      )),
    ]);
  }

  Widget _socialBtn({required String label, required Widget icon, required VoidCallback onPressed}) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.black87,
        side: BorderSide(color: Colors.grey.shade200),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 12),
        backgroundColor: Colors.white,
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        icon,
        const SizedBox(width: 8),
        Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade800)),
      ]),
    );
  }
}

// ── Simple Google logo ────────────────────────────────────────────────────────
class _GoogleIcon extends StatelessWidget {
  const _GoogleIcon();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18, height: 18,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  const _GooglePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    final center = Offset(r, r);
    final stroke = size.width * 0.22;

    Paint p(Color c) => Paint()
      ..color = c
      ..strokeWidth = stroke
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.butt;

    final rect = Rect.fromCircle(center: center, radius: r - stroke / 2);

    canvas.drawArc(rect, -1.72, 1.7,  false, p(const Color(0xFF4285F4)));
    canvas.drawArc(rect,  3.14, 1.0,  false, p(const Color(0xFFEA4335)));
    canvas.drawArc(rect,  4.14, 0.96, false, p(const Color(0xFFFBBC05)));
    canvas.drawArc(rect, -0.15, 1.2,  false, p(const Color(0xFF34A853)));

    canvas.drawLine(
      Offset(r, r),
      Offset(size.width - stroke / 2, r),
      Paint()
        ..color = const Color(0xFF4285F4)
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}
