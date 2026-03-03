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
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: builder(dialogCtx),
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
