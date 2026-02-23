import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // Fade-in for logo
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  // Hook bouncing up/down
  late AnimationController _hookCtrl;
  late Animation<double> _hookAnim;

  @override
  void initState() {
    super.initState();

    // Logo fade + slight scale
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
    _fadeCtrl.forward();

    // Hook oscillation: moves 0 → 24px → 0 repeatedly
    _hookCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _hookAnim = Tween<double>(begin: 0.0, end: 24.0).animate(
      CurvedAnimation(parent: _hookCtrl, curve: Curves.easeInOut),
    );

    // Navigate after 2.8 seconds
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) context.go('/login');
    });
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _hookCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Full-screen background image ────────────────────────────────
          Image.asset(
            'assets/images/SplashScreen_ohneLogo.png',
            fit: BoxFit.cover,
            width: size.width,
            height: size.height,
          ),

          // ── Centered logo + animated hook ───────────────────────────────
          FadeTransition(
            opacity: _fadeAnim,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo image
                  Image.asset(
                    'assets/images/DocStruc_Logo_plain.png',
                    width: size.width * 0.55,
                    fit: BoxFit.contain,
                  ),

                  const SizedBox(height: 56),

                  // ── Crane hook loading animation ─────────────────────
                  AnimatedBuilder(
                    animation: _hookAnim,
                    builder: (context, _) {
                      return _CraneHookWidget(hookOffset: _hookAnim.value);
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Draws a simplified crane hook that moves up/down.
/// [hookOffset] is the vertical distance the hook has descended (0–24).
class _CraneHookWidget extends StatelessWidget {
  final double hookOffset;

  const _CraneHookWidget({required this.hookOffset});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 72 + hookOffset,
      child: CustomPaint(
        painter: _HookPainter(hookOffset: hookOffset),
      ),
    );
  }
}

class _HookPainter extends CustomPainter {
  final double hookOffset;

  _HookPainter({required this.hookOffset});

  @override
  void paint(Canvas canvas, Size size) {
    const strokeW = 3.5;
    const color = Colors.white;

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = strokeW
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final cx = size.width / 2;

    // Vertical cable from top to hook knot
    final cableBottom = 30.0 + hookOffset;
    canvas.drawLine(
      Offset(cx, 0),
      Offset(cx, cableBottom),
      linePaint,
    );

    // Hook shape: a small circle at the top + curved hook body
    final hookPath = Path();
    final hookTopY = cableBottom;
    final hookR = 9.0;

    // Shank (short vertical line below the knot)
    hookPath.moveTo(cx, hookTopY);
    hookPath.lineTo(cx, hookTopY + hookR * 1.4);

    // Curved hook: arc going left-then-down-then-right
    hookPath.arcTo(
      Rect.fromCircle(
        center: Offset(cx - hookR * 0.7, hookTopY + hookR * 1.4),
        radius: hookR,
      ),
      0, // start angle (right)
      3.14159 * 1.4, // sweep: left + down + curl
      false,
    );

    canvas.drawPath(hookPath, linePaint);

    // Small horizontal bar at the very top (trolley)
    final barPaint = Paint()
      ..color = color.withValues(alpha: 0.85)
      ..strokeWidth = strokeW + 1
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    canvas.drawLine(
      Offset(cx - 10, 0),
      Offset(cx + 10, 0),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(_HookPainter old) => old.hookOffset != hookOffset;
}
