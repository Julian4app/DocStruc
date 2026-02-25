/// Shared tablet-detection helper.
/// A device is considered a "tablet" when its shortest screen side is ≥ 600 dp.
library tablet_utils;

import 'package:flutter/material.dart';

bool isTablet(BuildContext context) {
  final size = MediaQuery.of(context).size;
  return size.shortestSide >= 600;
}

/// Shows content as a centered dialog on tablet, bottom sheet on phone.
/// Use for large create/edit forms that look bad as a narrow bottom sheet on iPad.
/// On tablet the dialog has a close (×) button in the top-right corner.
Future<T?> showAdaptiveSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  double maxWidth = 580,
  double maxHeight = 820,
  bool isScrollControlled = true,
}) {
  if (isTablet(context)) {
    return showDialog<T>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (dialogCtx) => Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth, maxHeight: maxHeight),
          child: Material(
            color: Colors.transparent,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: builder(dialogCtx),
                ),
                // ── Close button ──────────────────────────────────────────
                Positioned(
                  top: 10,
                  right: 10,
                  child: GestureDetector(
                    onTap: () => Navigator.of(dialogCtx).pop(),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Icon(Icons.close, size: 17, color: Color(0xFF64748B)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: Colors.transparent,
    builder: builder,
  );
}
