import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// Reusable loading widget that shows the "wall under construction" Lottie
/// animation. Drop-in replacement for full-page `CircularProgressIndicator`.
class LottieLoader extends StatelessWidget {
  /// Width & height of the animation (default 150).
  final double size;

  /// Optional label shown below the animation.
  final String? label;

  const LottieLoader({super.key, this.size = 150, this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Lottie.asset(
            'assets/wall.json',
            width: size,
            height: size,
            fit: BoxFit.contain,
            repeat: true,
          ),
          if (label != null) ...[
            const SizedBox(height: 12),
            Text(
              label!,
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 14,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
