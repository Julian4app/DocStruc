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

  // Logo bob up/down
  late AnimationController _bobCtrl;
  late Animation<double> _bobAnim;

  @override
  void initState() {
    super.initState();

    // Logo fade-in
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
    _fadeCtrl.forward();

    // Logo bob: moves -10px → +10px → -10px repeatedly
    _bobCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _bobAnim = Tween<double>(begin: -10.0, end: 10.0).animate(
      CurvedAnimation(parent: _bobCtrl, curve: Curves.easeInOut),
    );

    // Navigate after 2.8 seconds
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) context.go('/login');
    });
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _bobCtrl.dispose();
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

          // ── Centered logo with bob animation ────────────────────────────
          FadeTransition(
            opacity: _fadeAnim,
            child: Center(
              child: AnimatedBuilder(
                animation: _bobAnim,
                builder: (context, child) => Transform.translate(
                  offset: Offset(0, _bobAnim.value),
                  child: child,
                ),
                child: Image.asset(
                  'assets/images/DocStruc_Logo_plain.png',
                  width: size.width * 0.55,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

