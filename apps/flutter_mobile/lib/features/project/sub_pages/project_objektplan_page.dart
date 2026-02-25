// ignore_for_file: use_build_context_synchronously
import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/burger_menu_leading.dart';
import 'package:docstruc_mobile/core/widgets/lottie_loader.dart';

// ─── Data Models ─────────────────────────────────────────────────────────────

class _Staircase {
  final String id;
  String name;
  final int order;
  List<_Floor> floors;
  _Staircase({required this.id, required this.name, required this.order, required this.floors});
  factory _Staircase.fromMap(Map<String, dynamic> m) => _Staircase(
        id: m['id'] as String,
        name: m['name'] as String,
        order: (m['order'] ?? 0) as int,
        floors: ((m['building_floors'] ?? []) as List)
            .map((f) => _Floor.fromMap(f as Map<String, dynamic>))
            .toList()
          ..sort((a, b) => a.level.compareTo(b.level)),
      );
}

class _Floor {
  final String id;
  String name;
  final int level;
  final String staircaseId;
  List<_Apartment> apartments;
  _Floor({required this.id, required this.name, required this.level, required this.staircaseId, required this.apartments});
  factory _Floor.fromMap(Map<String, dynamic> m) => _Floor(
        id: m['id'] as String,
        name: m['name'] as String,
        level: (m['level'] ?? 0) as int,
        staircaseId: m['staircase_id'] as String,
        apartments: ((m['building_apartments'] ?? []) as List)
            .map((a) => _Apartment.fromMap(a as Map<String, dynamic>))
            .toList()
          ..sort((a, b) => a.name.compareTo(b.name)),
      );
}

class _Apartment {
  final String id;
  String name;
  final String? floorId;
  final String? projectId;
  final String? floorPlanData;
  final String? technicalPlanData;
  final List<_Attachment> attachments;
  _Apartment({required this.id, required this.name, this.floorId, this.projectId, this.floorPlanData, this.technicalPlanData, required this.attachments});
  factory _Apartment.fromMap(Map<String, dynamic> m) => _Apartment(
        id: m['id'] as String,
        name: m['name'] as String,
        floorId: m['floor_id'] as String?,
        projectId: m['project_id'] as String?,
        floorPlanData: _encodeJsonField(m['floor_plan_data']),
        technicalPlanData: _encodeJsonField(m['technical_plan_data']),
        attachments: ((m['building_attachments'] ?? []) as List)
            .map((a) => _Attachment.fromMap(a as Map<String, dynamic>))
            .toList()
          ..sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt)),
      );

  /// Converts a Supabase JSONB field (may be List/Map or already a String) to a JSON string.
  static String? _encodeJsonField(dynamic value) {
    if (value == null) return null;
    if (value is String) return value; // already a JSON string
    return jsonEncode(value); // List or Map from Supabase JSONB
  }
}

class _Attachment {
  final String id;
  final String name;
  final String url;
  final String? type;
  final int size;
  final DateTime uploadedAt;
  _Attachment({required this.id, required this.name, required this.url, this.type, required this.size, required this.uploadedAt});
  factory _Attachment.fromMap(Map<String, dynamic> m) => _Attachment(
        id: m['id'] as String,
        name: m['name'] as String,
        url: m['url'] as String,
        type: m['type'] as String?,
        size: (m['size'] ?? 0) as int,
        uploadedAt: DateTime.tryParse(m['uploaded_at'] ?? '') ?? DateTime.now(),
      );
}

// ─── Canvas Drawing Models ────────────────────────────────────────────────────

enum _ElementType { freehand, line, rect, circle, wall, door, window, terraceDoor, terrace, text, dimension }
enum _DrawTool { select, pan, freehand, line, rect, circle, wall, door, window, terraceDoor, terrace, text, dimension, eraser }
enum _PlanMode { free, technical }

class _CanvasElement {
  final String id;
  final _ElementType type;
  double x, y;
  double? x2, y2;
  double? width, height;
  List<Offset>? points;
  String? text;
  double fontSize;
  Color color;
  double strokeWidth;
  Color? fill;
  double? length;
  double? wallThickness;

  _CanvasElement({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
    this.x2,
    this.y2,
    this.width,
    this.height,
    this.points,
    this.text,
    this.fontSize = 20,
    required this.color,
    required this.strokeWidth,
    this.fill,
    this.length,
    this.wallThickness,
  });

  /// Serialize color to a hex CSS string (#rrggbb or #aarrggbb) — readable by both Flutter and web.
  static String _colorToHex(Color c) {
    final v = c.toARGB32();
    // If fully opaque, write 6-char hex; otherwise 8-char
    if ((v >> 24 & 0xFF) == 0xFF) {
      return '#${(v & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
    }
    return '#${v.toRadixString(16).padLeft(8, '0')}';
  }

  /// Parse a color that may be a CSS hex string (web) OR an ARGB int (older Flutter saves).
  static Color _parseColor(dynamic raw, Color fallback) {
    if (raw == null) return fallback;
    if (raw is int) return Color(raw);
    if (raw is String) {
      final s = raw.startsWith('#') ? raw.substring(1) : raw;
      final v = int.tryParse(s, radix: 16);
      if (v == null) return fallback;
      // 6-char hex = opaque RGB
      return s.length == 6 ? Color(0xFF000000 | v) : Color(v);
    }
    return fallback;
  }

  /// Web uses 'patio_door', Flutter uses 'terraceDoor' — normalise on read.
  static _ElementType _parseType(String? raw) {
    if (raw == 'patio_door') return _ElementType.terraceDoor;
    return _ElementType.values.firstWhere(
      (e) => e.name == raw,
      orElse: () => _ElementType.line,
    );
  }

  /// On save always write 'patio_door' so the web app can read it too.
  static String _typeName(_ElementType t) {
    if (t == _ElementType.terraceDoor) return 'patio_door';
    return t.name;
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'type': _typeName(type),
        'x': x, 'y': y,
        if (x2 != null) 'x2': x2,
        if (y2 != null) 'y2': y2,
        if (width != null) 'width': width,
        if (height != null) 'height': height,
        if (points != null) 'points': points!.map((p) => {'x': p.dx, 'y': p.dy}).toList(),
        if (text != null) 'text': text,
        'fontSize': fontSize,
        'color': _colorToHex(color),
        'strokeWidth': strokeWidth,
        if (fill != null) 'fill': _colorToHex(fill!),
        if (length != null) 'length': length,
        if (wallThickness != null) 'wallThickness': wallThickness,
      };

  factory _CanvasElement.fromMap(Map<String, dynamic> m) {
    return _CanvasElement(
      id: m['id'] as String? ?? _CanvasElement._fallbackId(),
      type: _parseType(m['type'] as String?),
      x: (m['x'] as num?)?.toDouble() ?? 0,
      y: (m['y'] as num?)?.toDouble() ?? 0,
      x2: (m['x2'] as num?)?.toDouble(),
      y2: (m['y2'] as num?)?.toDouble(),
      width: (m['width'] as num?)?.toDouble(),
      height: (m['height'] as num?)?.toDouble(),
      points: (m['points'] as List?)?.map((p) => Offset(
        (p['x'] as num?)?.toDouble() ?? 0,
        (p['y'] as num?)?.toDouble() ?? 0,
      )).toList(),
      text: m['text'] as String?,
      fontSize: (m['fontSize'] as num?)?.toDouble() ?? 20,
      color: _parseColor(m['color'], const Color(0xFF1e293b)),
      strokeWidth: (m['strokeWidth'] as num?)?.toDouble() ?? 2,
      fill: m['fill'] != null ? _parseColor(m['fill'], const Color(0xFF000000)) : null,
      length: (m['length'] as num?)?.toDouble(),
      wallThickness: (m['wallThickness'] as num?)?.toDouble(),
    );
  }

  static String _fallbackId() => DateTime.now().microsecondsSinceEpoch.toRadixString(16);

  _CanvasElement copyWith({
    double? x, double? y, double? x2, double? y2,
    double? width, double? height, List<Offset>? points,
    String? text, double? fontSize, Color? color,
    double? strokeWidth, Color? fill, double? length, double? wallThickness,
  }) => _CanvasElement(
        id: id, type: type,
        x: x ?? this.x, y: y ?? this.y,
        x2: x2 ?? this.x2, y2: y2 ?? this.y2,
        width: width ?? this.width, height: height ?? this.height,
        points: points ?? (this.points != null ? List<Offset>.from(this.points!) : null),
        text: text ?? this.text, fontSize: fontSize ?? this.fontSize,
        color: color ?? this.color, strokeWidth: strokeWidth ?? this.strokeWidth,
        fill: fill ?? this.fill, length: length ?? this.length,
        wallThickness: wallThickness ?? this.wallThickness,
      );
}

// ─── Canvas Painter ───────────────────────────────────────────────────────────

class _FloorPlanPainter extends CustomPainter {
  final List<_CanvasElement> elements;
  final List<Offset> currentPoints;
  final _DrawTool tool;
  final bool isDrawing;
  final Offset? drawStart;
  final Offset? drawCurrent;
  final String? selectedId;
  final double scale;
  final Offset offset;
  final bool showGrid;
  final _PlanMode mode;
  final Color strokeColor;
  final double strokeWidth;
  final double wallThickness;

  const _FloorPlanPainter({
    required this.elements,
    required this.currentPoints,
    required this.tool,
    required this.isDrawing,
    this.drawStart,
    this.drawCurrent,
    this.selectedId,
    required this.scale,
    required this.offset,
    required this.showGrid,
    required this.mode,
    required this.strokeColor,
    required this.strokeWidth,
    required this.wallThickness,
  });

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate(offset.dx, offset.dy);
    canvas.scale(scale);

    // Grid
    if (showGrid) {
      final gridSize = mode == _PlanMode.technical ? 20.0 : 40.0;
      final startX = (-offset.dx / scale / gridSize).floor() * gridSize - gridSize;
      final startY = (-offset.dy / scale / gridSize).floor() * gridSize - gridSize;
      final endX = startX + size.width / scale + gridSize * 2;
      final endY = startY + size.height / scale + gridSize * 2;

      final minorPaint = Paint()..color = const Color(0xFFcbd5e1)..strokeWidth = 0.5 / scale;
      for (var x = startX; x < endX; x += gridSize) {
        canvas.drawLine(Offset(x, startY), Offset(x, endY), minorPaint);
      }
      for (var y = startY; y < endY; y += gridSize) {
        canvas.drawLine(Offset(startX, y), Offset(endX, y), minorPaint);
      }
      final majorPaint = Paint()..color = const Color(0xFF94a3b8)..strokeWidth = 1.0 / scale;
      for (var x = startX; x < endX; x += gridSize * 5) {
        canvas.drawLine(Offset(x, startY), Offset(x, endY), majorPaint);
      }
      for (var y = startY; y < endY; y += gridSize * 5) {
        canvas.drawLine(Offset(startX, y), Offset(endX, y), majorPaint);
      }
    }

    // Draw elements
    for (final el in elements) {
      final isSelected = el.id == selectedId;
      _drawElement(canvas, el, isSelected);
    }

    // Draw preview while dragging
    if (isDrawing && drawStart != null && drawCurrent != null) {
      _drawPreview(canvas, drawStart!, drawCurrent!);
    }
    if (isDrawing && tool == _DrawTool.freehand && currentPoints.length > 1) {
      final paint = Paint()
        ..color = strokeColor
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      final path = Path()..moveTo(currentPoints[0].dx, currentPoints[0].dy);
      for (var i = 1; i < currentPoints.length; i++) {
        path.lineTo(currentPoints[i].dx, currentPoints[i].dy);
      }
      canvas.drawPath(path, paint);
    }

    canvas.restore();
  }

  void _drawElement(Canvas canvas, _CanvasElement el, bool isSelected) {
    final paint = Paint()
      ..color = el.color
      ..strokeWidth = el.strokeWidth / scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    if (isSelected) {
      paint.color = paint.color.withValues(alpha: 0.9);
    }

    switch (el.type) {
      case _ElementType.freehand:
        if (el.points != null && el.points!.length > 1) {
          final path = Path()..moveTo(el.points![0].dx, el.points![0].dy);
          for (var i = 1; i < el.points!.length; i++) {
            path.lineTo(el.points![i].dx, el.points![i].dy);
          }
          canvas.drawPath(path, paint);
        }
        break;

      case _ElementType.line:
        canvas.drawLine(Offset(el.x, el.y), Offset(el.x2 ?? el.x, el.y2 ?? el.y), paint);
        if (el.length != null) {
          _drawDimensionLabel(canvas, Offset((el.x + (el.x2 ?? el.x)) / 2, (el.y + (el.y2 ?? el.y)) / 2 - 20 / scale), _formatLength(el.length!), el.color);
        }
        break;

      case _ElementType.rect:
        if (el.fill != null) {
          canvas.drawRect(Rect.fromLTWH(el.x, el.y, el.width ?? 0, el.height ?? 0), Paint()..color = el.fill!..style = PaintingStyle.fill);
        }
        canvas.drawRect(Rect.fromLTWH(el.x, el.y, el.width ?? 0, el.height ?? 0), paint);
        break;

      case _ElementType.circle:
        if (el.fill != null) {
          canvas.drawOval(Rect.fromLTWH(el.x, el.y, el.width ?? 0, el.height ?? 0), Paint()..color = el.fill!..style = PaintingStyle.fill);
        }
        canvas.drawOval(Rect.fromLTWH(el.x, el.y, el.width ?? 0, el.height ?? 0), paint);
        break;

      case _ElementType.wall:
        _drawWall(canvas, el);
        break;

      case _ElementType.door:
        _drawDoor(canvas, el);
        break;

      case _ElementType.window:
        _drawWindow(canvas, el);
        break;

      case _ElementType.text:
        final tp = TextPainter(
          text: TextSpan(text: el.text ?? '', style: TextStyle(color: el.color, fontSize: el.fontSize / scale, fontWeight: FontWeight.w500)),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(el.x, el.y));
        break;

      case _ElementType.terraceDoor:
        _drawTerraceDoor(canvas, el);
        break;
      case _ElementType.terrace:
        _drawTerrace(canvas, el);
        break;
      case _ElementType.dimension:
        _drawDimensionLine(canvas, el);
        break;
    }

    // Selection handles
    if (isSelected && tool == _DrawTool.select) {
      _drawSelectionHandles(canvas, el);
    }
  }

  void _drawWall(Canvas canvas, _CanvasElement el) {
    final dx = (el.x2 ?? el.x) - el.x;
    final dy = (el.y2 ?? el.y) - el.y;
    final len = math.sqrt(dx * dx + dy * dy);
    if (len == 0) return;
    final thick = (el.wallThickness ?? 15) / 2;
    final nx = -dy / len * thick, ny = dx / len * thick;

    final path = Path()
      ..moveTo(el.x + nx, el.y + ny)
      ..lineTo(el.x - nx, el.y - ny)
      ..lineTo((el.x2 ?? el.x) - nx, (el.y2 ?? el.y) - ny)
      ..lineTo((el.x2 ?? el.x) + nx, (el.y2 ?? el.y) + ny)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFF334155)..style = PaintingStyle.fill);
    canvas.drawPath(path, Paint()..color = const Color(0xFF1e293b)..strokeWidth = 1 / scale..style = PaintingStyle.stroke);

    if (el.length != null) {
      final mx = (el.x + (el.x2 ?? el.x)) / 2, my = (el.y + (el.y2 ?? el.y)) / 2;
      _drawDimensionLabel(canvas, Offset(mx, my - ny.abs() * 2 - 25 / scale), _formatLength(el.length!), const Color(0xFF3B82F6));
    }
  }

  void _drawDoor(Canvas canvas, _CanvasElement el) {
    final dw = el.width ?? 60;
    final paint = Paint()..color = const Color(0xFFF59E0B)..strokeWidth = 2 / scale..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(el.x, el.y), Offset(el.x + dw, el.y), paint);
    // Arc for door swing
    final rect = Rect.fromCircle(center: Offset(el.x, el.y), radius: dw);
    final dashPaint = Paint()..color = const Color(0xFFF59E0B)..strokeWidth = 1.5 / scale..style = PaintingStyle.stroke;
    canvas.drawArc(rect, 0, -math.pi / 2, false, dashPaint);
    if (el.length != null) {
      _drawDimensionLabel(canvas, Offset(el.x + dw / 2, el.y - 25 / scale), _formatLength(el.length!), const Color(0xFFF59E0B));
    }
  }

  void _drawWindow(Canvas canvas, _CanvasElement el) {
    final ww = el.width ?? 80;
    final paint = Paint()..color = const Color(0xFF3B82F6)..strokeWidth = 3 / scale..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(el.x, el.y), Offset(el.x + ww, el.y), paint);
    final linePaint = Paint()..color = const Color(0xFF3B82F6)..strokeWidth = 1 / scale..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(el.x + 4, el.y - 4 / scale), Offset(el.x + ww - 4, el.y - 4 / scale), linePaint);
    canvas.drawLine(Offset(el.x + 4, el.y + 4 / scale), Offset(el.x + ww - 4, el.y + 4 / scale), linePaint);
    if (el.length != null) {
      _drawDimensionLabel(canvas, Offset(el.x + ww / 2, el.y - 28 / scale), _formatLength(el.length!), const Color(0xFF3B82F6));
    }
  }

  void _drawTerraceDoor(Canvas canvas, _CanvasElement el) {
    // Terrace door: double door (two arcs)
    final dw = (el.width ?? 80) / 2;
    final paint = Paint()..color = const Color(0xFF10B981)..strokeWidth = 2 / scale..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(el.x, el.y), Offset(el.x + dw * 2, el.y), paint);
    final arc1 = Rect.fromCircle(center: Offset(el.x, el.y), radius: dw);
    final arc2 = Rect.fromCircle(center: Offset(el.x + dw * 2, el.y), radius: dw);
    canvas.drawArc(arc1, 0, -math.pi / 2, false, paint);
    canvas.drawArc(arc2, math.pi, math.pi / 2, false, paint);
    if (el.length != null) {
      _drawDimensionLabel(canvas, Offset(el.x + dw, el.y - 25 / scale), _formatLength(el.length!), const Color(0xFF10B981));
    }
  }

  void _drawTerrace(Canvas canvas, _CanvasElement el) {
    // Terrace: dashed/hatched rectangle
    final w = el.width ?? 120, h = el.height ?? 80;
    final fillPaint = Paint()..color = const Color(0xFF6366F1).withValues(alpha: 0.15)..style = PaintingStyle.fill;
    final borderPaint = Paint()..color = const Color(0xFF6366F1)..strokeWidth = 2 / scale..style = PaintingStyle.stroke;
    canvas.drawRect(Rect.fromLTWH(el.x, el.y, w, h), fillPaint);
    canvas.drawRect(Rect.fromLTWH(el.x, el.y, w, h), borderPaint);
    // Hatch lines
    final hatchPaint = Paint()..color = const Color(0xFF6366F1).withValues(alpha: 0.4)..strokeWidth = 1 / scale..style = PaintingStyle.stroke;
    for (var d = 10.0; d < w + h; d += 15) {
      final x1 = el.x + math.max(0, d - h);
      final y1 = el.y + math.min(d, h);
      final x2 = el.x + math.min(d, w);
      final y2 = el.y + math.max(0, d - w);
      canvas.drawLine(Offset(x1, y1), Offset(x2, y2), hatchPaint);
    }
    if (el.length != null) {
      _drawDimensionLabel(canvas, Offset(el.x + w / 2, el.y + h / 2), _formatLength(el.length!), const Color(0xFF6366F1));
    }
  }

  void _drawDimensionLine(Canvas canvas, _CanvasElement el) {
    final paint = Paint()..color = const Color(0xFFEF4444)..strokeWidth = 1.5 / scale..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(el.x, el.y), Offset(el.x2 ?? el.x, el.y2 ?? el.y), paint);
    if (el.length != null) {
      final mx = (el.x + (el.x2 ?? el.x)) / 2, my = (el.y + (el.y2 ?? el.y)) / 2;
      _drawDimensionLabel(canvas, Offset(mx, my - 22 / scale), _formatLength(el.length!), const Color(0xFFEF4444));
    }
  }

  void _drawPreview(Canvas canvas, Offset start, Offset current) {
    final paint = Paint()
      ..color = strokeColor.withValues(alpha: 0.7)
      ..strokeWidth = strokeWidth / scale
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    switch (tool) {
      case _DrawTool.line:
        canvas.drawLine(start, current, paint);
        break;
      case _DrawTool.rect:
        canvas.drawRect(Rect.fromPoints(start, current), paint);
        break;
      case _DrawTool.circle:
        canvas.drawOval(Rect.fromPoints(start, current), paint);
        break;
      case _DrawTool.wall:
        final dx = current.dx - start.dx, dy = current.dy - start.dy;
        final len = math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          final thick = wallThickness / 2;
          final nx = -dy / len * thick, ny = dx / len * thick;
          final path = Path()
            ..moveTo(start.dx + nx, start.dy + ny)
            ..lineTo(start.dx - nx, start.dy - ny)
            ..lineTo(current.dx - nx, current.dy - ny)
            ..lineTo(current.dx + nx, current.dy + ny)
            ..close();
          canvas.drawPath(path, Paint()..color = const Color(0x88334155)..style = PaintingStyle.fill);
          canvas.drawPath(path, paint);
        }
        break;
      case _DrawTool.door:
        canvas.drawLine(start, Offset(start.dx + 60, start.dy), paint);
        canvas.drawArc(Rect.fromCircle(center: start, radius: 60), 0, -math.pi / 2, false, paint);
        break;
      case _DrawTool.window:
        canvas.drawLine(start, Offset(start.dx + 80, start.dy), paint);
        break;
      case _DrawTool.terraceDoor:
        canvas.drawLine(start, Offset(start.dx + 80, start.dy), paint);
        canvas.drawArc(Rect.fromCircle(center: start, radius: 40), 0, -math.pi / 2, false, paint);
        canvas.drawArc(Rect.fromCircle(center: Offset(start.dx + 80, start.dy), radius: 40), math.pi, math.pi / 2, false, paint);
        break;
      case _DrawTool.terrace:
        canvas.drawRect(Rect.fromPoints(start, current), paint);
        break;
      case _DrawTool.dimension:
        canvas.drawLine(start, current, paint);
        break;
      default:
        break;
    }
  }

  void _drawSelectionHandles(Canvas canvas, _CanvasElement el) {
    final handlePaint = Paint()..color = AppColors.primary..strokeWidth = 2 / scale..style = PaintingStyle.stroke;
    final fillPaint = Paint()..color = Colors.white..style = PaintingStyle.fill;
    const hs = 8.0;

    void drawHandle(Offset pos) {
      final r = hs / scale;
      canvas.drawCircle(pos, r, fillPaint);
      canvas.drawCircle(pos, r, handlePaint);
    }

    if (el.type == _ElementType.line || el.type == _ElementType.wall || el.type == _ElementType.dimension) {
      drawHandle(Offset(el.x, el.y));
      drawHandle(Offset(el.x2 ?? el.x, el.y2 ?? el.y));
    } else if (el.type == _ElementType.rect || el.type == _ElementType.circle || el.type == _ElementType.terrace) {
      drawHandle(Offset(el.x, el.y));
      drawHandle(Offset(el.x + (el.width ?? 0), el.y + (el.height ?? 0)));
    } else if (el.type == _ElementType.door || el.type == _ElementType.window || el.type == _ElementType.terraceDoor) {
      drawHandle(Offset(el.x, el.y));
      drawHandle(Offset(el.x + (el.width ?? 60), el.y));
    }
  }

  void _drawDimensionLabel(Canvas canvas, Offset pos, String text, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: 12 / scale, fontWeight: FontWeight.w600)),
      textDirection: TextDirection.ltr,
    )..layout();
    final padding = 4.0 / scale;
    final bgRect = Rect.fromCenter(center: pos, width: tp.width + padding * 4, height: tp.height + padding * 2);
    canvas.drawRRect(RRect.fromRectAndRadius(bgRect, Radius.circular(4 / scale)), Paint()..color = Colors.white..style = PaintingStyle.fill);
    canvas.drawRRect(RRect.fromRectAndRadius(bgRect, Radius.circular(4 / scale)), Paint()..color = color..strokeWidth = 1 / scale..style = PaintingStyle.stroke);
    tp.paint(canvas, Offset(bgRect.left + padding * 2, bgRect.top + padding));
  }

  String _formatLength(double cm) {
    if (cm >= 100) return '${(cm / 100).toStringAsFixed(2)} m';
    return '${cm.round()} cm';
  }

  @override
  bool shouldRepaint(_FloorPlanPainter old) => true;
}

// ─── Canvas Editor Page ───────────────────────────────────────────────────────

class _CanvasEditorPage extends StatefulWidget {
  final _Apartment apartment;
  final _PlanMode mode;
  final VoidCallback onClose;
  final Future<void> Function(List<_CanvasElement>) onSave;

  const _CanvasEditorPage({
    required this.apartment,
    required this.mode,
    required this.onClose,
    required this.onSave,
  });

  @override
  State<_CanvasEditorPage> createState() => _CanvasEditorPageState();
}

class _CanvasEditorPageState extends State<_CanvasEditorPage> {
  late _PlanMode _mode;
  // Separate element lists per mode so switching doesn't lose data
  late List<_CanvasElement> _freeElements;
  late List<_CanvasElement> _techElements;
  List<_CanvasElement> get _elements => _mode == _PlanMode.free ? _freeElements : _techElements;
  set _elements(List<_CanvasElement> v) { if (_mode == _PlanMode.free) { _freeElements = v; } else { _techElements = v; } }
  final List<List<_CanvasElement>> _undoStack = [];
  final List<List<_CanvasElement>> _redoStack = [];

  _DrawTool _tool = _DrawTool.freehand;
  bool _showGrid = true;
  bool _snapToGrid = false;
  double _fontSize = 20.0;
  double _scale = 1.0;
  Offset _offset = Offset.zero;
  Offset? _panStart;
  Offset? _drawStart;
  Offset? _drawCurrent;
  bool _isDrawing = false;
  String? _selectedId;
  List<Offset> _currentPoints = [];
  Color _strokeColor = const Color(0xFF1e293b);
  double _strokeWidth = 2.0;
  double _wallThickness = 15.0;
  bool _isSaving = false;
  bool _showTextInput = false;
  final _textCtrl = TextEditingController();
  Offset? _textInsertPos;

  List<_CanvasElement> _parseElements(String? raw) {
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).map((e) => _CanvasElement.fromMap(e as Map<String, dynamic>)).toList();
    } catch (_) { return []; }
  }

  @override
  void initState() {
    super.initState();
    _mode = widget.mode;
    _tool = _mode == _PlanMode.technical ? _DrawTool.wall : _DrawTool.freehand;
    _freeElements = _parseElements(widget.apartment.floorPlanData);
    _techElements = _parseElements(widget.apartment.technicalPlanData);
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  void _pushUndo() {
    _undoStack.add(_elements.map((e) => e.copyWith()).toList());
    _redoStack.clear();
  }

  void _undo() {
    if (_undoStack.isEmpty) return;
    setState(() {
      _redoStack.add(_elements.map((e) => e.copyWith()).toList());
      _elements = _undoStack.removeLast();
    });
  }

  void _redo() {
    if (_redoStack.isEmpty) return;
    setState(() {
      _undoStack.add(_elements.map((e) => e.copyWith()).toList());
      _elements = _redoStack.removeLast();
    });
  }

  Offset _toCanvas(Offset local) {
    final raw = (local - _offset) / _scale;
    if (!_snapToGrid) return raw;
    final gridSize = _mode == _PlanMode.technical ? 20.0 : 40.0;
    return Offset(
      (raw.dx / gridSize).round() * gridSize,
      (raw.dy / gridSize).round() * gridSize,
    );
  }

  String _genId() => math.Random().nextInt(0xFFFFFFFF).toRadixString(16);

  double _calcLength(Offset a, Offset b) {
    final dx = b.dx - a.dx, dy = b.dy - a.dy;
    return math.sqrt(dx * dx + dy * dy);
  }

  void _finishElement(Offset end) {
    if (_drawStart == null) return;
    final start = _drawStart!;
    _pushUndo();
    final id = _genId();
    final len = _calcLength(start, end) * 2; // pixel ≈ 0.5 cm at default scale

    switch (_tool) {
      case _DrawTool.line:
        _elements.add(_CanvasElement(id: id, type: _ElementType.line, x: start.dx, y: start.dy, x2: end.dx, y2: end.dy, color: _strokeColor, strokeWidth: _strokeWidth, length: len));
        break;
      case _DrawTool.rect:
        _elements.add(_CanvasElement(id: id, type: _ElementType.rect, x: math.min(start.dx, end.dx), y: math.min(start.dy, end.dy), width: (end.dx - start.dx).abs(), height: (end.dy - start.dy).abs(), color: _strokeColor, strokeWidth: _strokeWidth));
        break;
      case _DrawTool.circle:
        _elements.add(_CanvasElement(id: id, type: _ElementType.circle, x: math.min(start.dx, end.dx), y: math.min(start.dy, end.dy), width: (end.dx - start.dx).abs(), height: (end.dy - start.dy).abs(), color: _strokeColor, strokeWidth: _strokeWidth));
        break;
      case _DrawTool.wall:
        _elements.add(_CanvasElement(id: id, type: _ElementType.wall, x: start.dx, y: start.dy, x2: end.dx, y2: end.dy, color: _strokeColor, strokeWidth: _strokeWidth, wallThickness: _wallThickness, length: len));
        break;
      case _DrawTool.door:
        _elements.add(_CanvasElement(id: id, type: _ElementType.door, x: start.dx, y: start.dy, width: 60, color: const Color(0xFFF59E0B), strokeWidth: 2, length: 60 * 2));
        break;
      case _DrawTool.window:
        _elements.add(_CanvasElement(id: id, type: _ElementType.window, x: start.dx, y: start.dy, width: 80, color: const Color(0xFF3B82F6), strokeWidth: 3, length: 80 * 2));
        break;
      case _DrawTool.terraceDoor:
        _elements.add(_CanvasElement(id: id, type: _ElementType.terraceDoor, x: start.dx, y: start.dy, width: 80, color: const Color(0xFF10B981), strokeWidth: 2, length: 80 * 2));
        break;
      case _DrawTool.terrace:
        _elements.add(_CanvasElement(id: id, type: _ElementType.terrace, x: math.min(start.dx, end.dx), y: math.min(start.dy, end.dy), width: (end.dx - start.dx).abs(), height: (end.dy - start.dy).abs(), color: const Color(0xFF6366F1), strokeWidth: 2, length: len));
        break;
      case _DrawTool.dimension:
        _elements.add(_CanvasElement(id: id, type: _ElementType.dimension, x: start.dx, y: start.dy, x2: end.dx, y2: end.dy, color: const Color(0xFFEF4444), strokeWidth: 1.5, length: len));
        break;
      default:
        break;
    }

    setState(() {
      _drawStart = null;
      _drawCurrent = null;
      _isDrawing = false;
    });
  }

  void _finishFreehand() {
    if (_currentPoints.length < 2) {
      setState(() { _currentPoints = []; _isDrawing = false; });
      return;
    }
    _pushUndo();
    _elements.add(_CanvasElement(id: _genId(), type: _ElementType.freehand, x: _currentPoints[0].dx, y: _currentPoints[0].dy, points: List.from(_currentPoints), color: _strokeColor, strokeWidth: _strokeWidth));
    setState(() { _currentPoints = []; _isDrawing = false; });
  }

  void _handleTapDown(TapDownDetails details) {
    final pos = _toCanvas(details.localPosition);
    if (_tool == _DrawTool.select) {
      // Hit test
      String? hit;
      for (final el in _elements.reversed) {
        if (_hitTest(el, pos)) { hit = el.id; break; }
      }
      setState(() => _selectedId = hit);
    } else if (_tool == _DrawTool.eraser) {
      _pushUndo();
      String? hit;
      for (final el in _elements.reversed) {
        if (_hitTest(el, pos)) { hit = el.id; break; }
      }
      if (hit != null) setState(() => _elements.removeWhere((e) => e.id == hit));
    } else if (_tool == _DrawTool.text) {
      setState(() {
        _textInsertPos = pos;
        _showTextInput = true;
      });
    }
  }

  void _handlePanStart(DragStartDetails details) {
    final pos = _toCanvas(details.localPosition);
    if (_tool == _DrawTool.pan) {
      _panStart = details.localPosition;
    } else if (_tool == _DrawTool.freehand) {
      _pushUndo();
      setState(() { _isDrawing = true; _currentPoints = [pos]; });
    } else if (_tool != _DrawTool.select && _tool != _DrawTool.eraser && _tool != _DrawTool.text) {
      setState(() { _drawStart = pos; _drawCurrent = pos; _isDrawing = true; });
    }
  }

  void _handlePanUpdate(DragUpdateDetails details) {
    if (_tool == _DrawTool.pan) {
      if (_panStart != null) {
        setState(() {
          _offset += details.localPosition - _panStart!;
          _panStart = details.localPosition;
        });
      }
    } else if (_tool == _DrawTool.freehand && _isDrawing) {
      final pos = _toCanvas(details.localPosition);
      setState(() => _currentPoints.add(pos));
    } else if (_isDrawing && _drawStart != null) {
      setState(() => _drawCurrent = _toCanvas(details.localPosition));
    }
  }

  void _handlePanEnd(DragEndDetails details) {
    if (_tool == _DrawTool.pan) {
      _panStart = null;
    } else if (_tool == _DrawTool.freehand) {
      _finishFreehand();
    } else if (_isDrawing && _drawStart != null && _drawCurrent != null) {
      _finishElement(_drawCurrent!);
    }
  }

  bool _hitTest(_CanvasElement el, Offset pos) {
    const tol = 12.0;
    switch (el.type) {
      case _ElementType.freehand:
        if (el.points == null) return false;
        for (var i = 0; i < el.points!.length - 1; i++) {
          if (_distPointToSegment(pos, el.points![i], el.points![i + 1]) < tol) return true;
        }
        return false;
      case _ElementType.line:
      case _ElementType.wall:
      case _ElementType.dimension:
        return _distPointToSegment(pos, Offset(el.x, el.y), Offset(el.x2 ?? el.x, el.y2 ?? el.y)) < tol;
      case _ElementType.rect:
      case _ElementType.circle:
        return Rect.fromLTWH(el.x, el.y, el.width ?? 0, el.height ?? 0).inflate(tol).contains(pos);
      case _ElementType.door:
      case _ElementType.window:
      case _ElementType.terraceDoor:
        return _distPointToSegment(pos, Offset(el.x, el.y), Offset(el.x + (el.width ?? 60), el.y)) < tol;
      case _ElementType.terrace:
        return Rect.fromLTWH(el.x, el.y, el.width ?? 120, el.height ?? 80).inflate(tol).contains(pos);
      case _ElementType.text:
        return (pos - Offset(el.x, el.y)).distance < 40;
    }
  }

  double _distPointToSegment(Offset p, Offset a, Offset b) {
    final dx = b.dx - a.dx, dy = b.dy - a.dy;
    final len2 = dx * dx + dy * dy;
    if (len2 == 0) return (p - a).distance;
    var t = ((p.dx - a.dx) * dx + (p.dy - a.dy) * dy) / len2;
    t = t.clamp(0.0, 1.0);
    return (p - Offset(a.dx + t * dx, a.dy + t * dy)).distance;
  }

  void _deleteSelected() {
    if (_selectedId == null) return;
    _pushUndo();
    setState(() {
      _elements.removeWhere((e) => e.id == _selectedId);
      _selectedId = null;
    });
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    // Save current mode's elements
    await widget.onSave(_elements);
    setState(() => _isSaving = false);
  }

  Widget _toolButton(_DrawTool t, IconData icon, String tooltip, {Color? color}) {
    final isActive = _tool == t;
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: () => setState(() { _tool = t; _selectedId = null; }),
        child: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isActive ? AppColors.primary : const Color(0xFFe2e8f0)),
          ),
          child: Icon(icon, size: 18, color: isActive ? Colors.white : (color ?? const Color(0xFF334155))),
        ),
      ),
    );
  }

  void _switchMode(_PlanMode newMode) {
    if (newMode == _mode) return;
    setState(() {
      _mode = newMode;
      _undoStack.clear();
      _redoStack.clear();
      _selectedId = null;
      _isDrawing = false;
      _drawStart = null;
      _drawCurrent = null;
      _currentPoints = [];
      _tool = newMode == _PlanMode.technical ? _DrawTool.wall : _DrawTool.freehand;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF8FAFC),
      child: Column(
        children: [
        // ── Header bar ────────────────────────────────────────────────────
        Container(
          height: 56,
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFe2e8f0))),
          ),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(LucideIcons.arrowLeft, size: 20, color: Color(0xFF334155)),
                onPressed: widget.onClose,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(widget.apartment.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0f172a))),
                    Text(_mode == _PlanMode.free ? 'Freies Zeichnen' : 'Technischer Grundriss', style: const TextStyle(fontSize: 11, color: Color(0xFF64748b))),
                  ],
                ),
              ),
              // Mode toggle
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _modeTab('Frei', _PlanMode.free, LucideIcons.pencil),
                    _modeTab('Technisch', _PlanMode.technical, LucideIcons.ruler),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: _isSaving ? null : _save,
                icon: _isSaving
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(LucideIcons.save, size: 14),
                label: const Text('Speichern', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                style: TextButton.styleFrom(foregroundColor: AppColors.primary),
              ),
              const SizedBox(width: 8),
            ],
          ),
        ),
        // ── Toolbar ───────────────────────────────────────────────────────
        _buildToolbar(),
        // ── Canvas area ───────────────────────────────────────────────────
        Expanded(
          child: ClipRect(
            child: ColoredBox(
              color: const Color(0xFFF8FAFC),
              child: Stack(
                clipBehavior: Clip.hardEdge,
        children: [
          GestureDetector(
            onTapDown: _handleTapDown,
            onPanStart: _tool == _DrawTool.pan ? (d) { _panStart = d.localPosition; } : _handlePanStart,
            onPanUpdate: _handlePanUpdate,
            onPanEnd: _handlePanEnd,
            child: LayoutBuilder(
              builder: (context, constraints) => CustomPaint(
              painter: _FloorPlanPainter(
                elements: _elements,
                currentPoints: _currentPoints,
                tool: _tool,
                isDrawing: _isDrawing,
                drawStart: _drawStart,
                drawCurrent: _drawCurrent,
                selectedId: _selectedId,
                scale: _scale,
                offset: _offset,
                showGrid: _showGrid,
                mode: _mode,
                strokeColor: _strokeColor,
                strokeWidth: _strokeWidth,
                wallThickness: _wallThickness,
              ),
              size: Size(constraints.maxWidth, constraints.maxHeight),
              ),
            ),
          ),
          // Zoom controls
          Positioned(
            bottom: 16, right: 16,
            child: Column(
              children: [
                _floatBtn(LucideIcons.plus, () => setState(() => _scale = (_scale * 1.2).clamp(0.1, 5.0))),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)]),
                  child: Text('${(_scale * 100).round()}%', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748b))),
                ),
                const SizedBox(height: 6),
                _floatBtn(LucideIcons.minus, () => setState(() => _scale = (_scale / 1.2).clamp(0.1, 5.0))),
                const SizedBox(height: 6),
                _floatBtn(LucideIcons.maximize2, () => setState(() { _scale = 1.0; _offset = Offset.zero; })),
              ],
            ),
          ),
          // Selected element actions
          if (_selectedId != null)
            Positioned(
              bottom: 16, left: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8)]),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons.mousePointer2, size: 14, color: Color(0xFF64748b)),
                    const SizedBox(width: 8),
                    const Text('Element ausgewählt', style: TextStyle(fontSize: 12, color: Color(0xFF334155))),
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: _deleteSelected,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0xFFfee2e2), borderRadius: BorderRadius.circular(6)),
                        child: const Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(LucideIcons.trash2, size: 12, color: Color(0xFFdc2626)),
                          SizedBox(width: 4),
                          Text('Löschen', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFdc2626))),
                        ]),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // Text input overlay
          if (_showTextInput && _textInsertPos != null)
            Positioned(
              left: _textInsertPos!.dx * _scale + _offset.dx,
              top: _textInsertPos!.dy * _scale + _offset.dy,
              child: Material(
                elevation: 8,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 160,
                        child: TextField(
                          controller: _textCtrl,
                          autofocus: true,
                          style: const TextStyle(fontSize: 14),
                          decoration: const InputDecoration(hintText: 'Text eingeben...', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6), border: OutlineInputBorder()),
                          onSubmitted: (val) {
                            if (val.isNotEmpty && _textInsertPos != null) {
                              _pushUndo();
                              _elements.add(_CanvasElement(id: _genId(), type: _ElementType.text, x: _textInsertPos!.dx, y: _textInsertPos!.dy, text: val, color: _strokeColor, strokeWidth: 1, fontSize: _fontSize));
                            }
                            setState(() { _showTextInput = false; _textCtrl.clear(); });
                          },
                        ),
                      ),
                      const SizedBox(width: 6),
                      GestureDetector(
                        onTap: () {
                          final val = _textCtrl.text;
                          if (val.isNotEmpty && _textInsertPos != null) {
                            _pushUndo();
                            _elements.add(_CanvasElement(id: _genId(), type: _ElementType.text, x: _textInsertPos!.dx, y: _textInsertPos!.dy, text: val, color: _strokeColor, strokeWidth: 1, fontSize: _fontSize));
                          }
                          setState(() { _showTextInput = false; _textCtrl.clear(); });
                        },
                        child: Container(width: 32, height: 32, decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(6)), child: const Icon(LucideIcons.check, size: 16, color: Colors.white)),
                      ),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () => setState(() { _showTextInput = false; _textCtrl.clear(); }),
                        child: Container(width: 32, height: 32, decoration: BoxDecoration(border: Border.all(color: const Color(0xFFe2e8f0)), borderRadius: BorderRadius.circular(6)), child: const Icon(LucideIcons.x, size: 16)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
          ),
        ),
        ),
      ],
    ),
    );
  }

  Widget _modeTab(String label, _PlanMode mode, IconData icon) {
    final isActive = _mode == mode;
    return GestureDetector(
      onTap: () => _switchMode(mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: isActive ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)] : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: isActive ? AppColors.primary : const Color(0xFF64748b)),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isActive ? AppColors.primary : const Color(0xFF64748b))),
          ],
        ),
      ),
    );
  }

  Widget _buildToolbar() {
    final sep = Container(width: 1, height: 28, color: const Color(0xFFe2e8f0));
    return Container(
      decoration: const BoxDecoration(color: Colors.white, border: Border(
        top: BorderSide(color: Color(0xFFe2e8f0)),
        bottom: BorderSide(color: Color(0xFFe2e8f0)),
      )),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          children: [
            // ── Navigation tools ─────────────────────────────────────────
            _toolButton(_DrawTool.select, LucideIcons.mousePointer2, 'Auswählen'),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.pan, LucideIcons.hand, 'Verschieben'),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Drawing tools ─────────────────────────────────────────────
            _toolButton(_DrawTool.freehand, LucideIcons.pencil, 'Freihand'),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.line, LucideIcons.minus, 'Linie'),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.rect, LucideIcons.square, 'Rechteck'),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.circle, LucideIcons.circle, 'Ellipse'),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.text, LucideIcons.type, 'Text'),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Architecture tools ────────────────────────────────────────
            _toolButton(_DrawTool.wall, LucideIcons.minus, 'Wand', color: const Color(0xFF334155)),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.door, LucideIcons.doorOpen, 'Tür', color: const Color(0xFFF59E0B)),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.window, LucideIcons.layoutGrid, 'Fenster', color: const Color(0xFF3B82F6)),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.terraceDoor, LucideIcons.slidersHorizontal, 'Terrassentür', color: const Color(0xFF10B981)),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.terrace, LucideIcons.maximize2, 'Terrasse', color: const Color(0xFF6366F1)),
            const SizedBox(width: 4),
            _toolButton(_DrawTool.dimension, LucideIcons.ruler, 'Maßlinie', color: const Color(0xFFEF4444)),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Eraser ───────────────────────────────────────────────────
            _toolButton(_DrawTool.eraser, LucideIcons.eraser, 'Löschen', color: const Color(0xFFEF4444)),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Undo / Redo ──────────────────────────────────────────────
            _iconBtn(LucideIcons.undo2, _undoStack.isEmpty ? null : _undo, 'Rückgängig'),
            const SizedBox(width: 4),
            _iconBtn(LucideIcons.redo2, _redoStack.isEmpty ? null : _redo, 'Wiederherstellen'),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Grid + Snap ──────────────────────────────────────────────
            _toggleBtn(LucideIcons.grid, _showGrid, () => setState(() => _showGrid = !_showGrid), 'Raster'),
            const SizedBox(width: 4),
            _toggleBtn(LucideIcons.magnet, _snapToGrid, () => setState(() => _snapToGrid = !_snapToGrid), 'Einrasten'),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Center view ─────────────────────────────────────────────
            _iconBtn(LucideIcons.crosshair, () => setState(() { _scale = 1.0; _offset = Offset.zero; }), 'Zentrieren'),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Text size ────────────────────────────────────────────────
            Tooltip(
              message: 'Textgröße',
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _fontSize = (_fontSize - 2).clamp(8, 72)),
                    child: Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFe2e8f0))),
                      child: const Icon(LucideIcons.minus, size: 12, color: Color(0xFF334155)),
                    ),
                  ),
                  Container(
                    width: 36, height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: const Color(0xFFF8FAFC), border: Border.symmetric(horizontal: BorderSide(color: const Color(0xFFe2e8f0)))),
                    child: Text('${_fontSize.round()}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _fontSize = (_fontSize + 2).clamp(8, 72)),
                    child: Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFe2e8f0))),
                      child: const Icon(LucideIcons.plus, size: 12, color: Color(0xFF334155)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8), sep, const SizedBox(width: 8),
            // ── Color picker ─────────────────────────────────────────────
            GestureDetector(
              onTap: _showColorPicker,
              child: Tooltip(
                message: 'Farbe',
                child: Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(color: _strokeColor, shape: BoxShape.circle, border: Border.all(color: const Color(0xFFe2e8f0), width: 2)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }  Widget _iconBtn(IconData icon, VoidCallback? onTap, String tooltip) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: onTap == null ? const Color(0xFFF1F5F9) : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFe2e8f0)),
          ),
          child: Icon(icon, size: 16, color: onTap == null ? const Color(0xFFcbd5e1) : const Color(0xFF334155)),
        ),
      ),
    );
  }

  Widget _toggleBtn(IconData icon, bool active, VoidCallback onTap, String tooltip) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            color: active ? AppColors.primary.withValues(alpha: 0.1) : Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? AppColors.primary : const Color(0xFFe2e8f0)),
          ),
          child: Icon(icon, size: 16, color: active ? AppColors.primary : const Color(0xFF334155)),
        ),
      ),
    );
  }

  Widget _floatBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4)]),
        child: Icon(icon, size: 16, color: const Color(0xFF334155)),
      ),
    );
  }

  void _showColorPicker() {
    final colors = [
      const Color(0xFF1e293b), const Color(0xFF3B82F6), const Color(0xFFEF4444),
      const Color(0xFF22c55e), const Color(0xFFF59E0B), const Color(0xFF8B5CF6),
      const Color(0xFF64748b), Colors.white,
    ];
    showModalBottomSheet(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Farbe auswählen', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: colors.map((c) => GestureDetector(
                onTap: () { setState(() => _strokeColor = c); Navigator.pop(ctx); },
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: c, shape: BoxShape.circle,
                    border: Border.all(color: c == _strokeColor ? AppColors.primary : const Color(0xFFe2e8f0), width: c == _strokeColor ? 3 : 1),
                    boxShadow: c == Colors.white ? [const BoxShadow(color: Color(0xFFe2e8f0), blurRadius: 2)] : null,
                  ),
                ),
              )).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Main Objektplan Page ─────────────────────────────────────────────────────

class ProjectObjektplanPage extends StatefulWidget {
  final String projectId;
  const ProjectObjektplanPage({super.key, required this.projectId});

  @override
  State<ProjectObjektplanPage> createState() => _ProjectObjektplanPageState();
}

class _ProjectObjektplanPageState extends State<ProjectObjektplanPage> {
  final _client = Supabase.instance.client;

  bool _loading = true;
  List<_Staircase> _staircases = [];
  List<_Apartment> _standaloneApts = [];
  final Set<String> _expandedStaircases = {};
  final Set<String> _expandedFloors = {};
  final Set<String> _expandedApartments = {};

  // Canvas editor state
  _Apartment? _editorApt;
  _PlanMode? _editorMode;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final scRes = await _client.from('building_staircases').select('''
        id, name, "order",
        building_floors (
          id, name, level, staircase_id,
          building_apartments (
            id, name, floor_id, project_id, floor_plan_data, technical_plan_data,
            building_attachments ( id, name, url, type, size, uploaded_at )
          )
        )
      ''').eq('project_id', widget.projectId).order('order', ascending: true);

      final saRes = await _client.from('building_apartments').select('''
        id, name, floor_id, project_id, floor_plan_data, technical_plan_data,
        building_attachments ( id, name, url, type, size, uploaded_at )
      ''').eq('project_id', widget.projectId).isFilter('floor_id', null).order('name', ascending: true);

      if (mounted) {
        setState(() {
          _staircases = (scRes as List).map((m) => _Staircase.fromMap(m as Map<String, dynamic>)).toList();
          _standaloneApts = (saRes as List).map((m) => _Apartment.fromMap(m as Map<String, dynamic>)).toList();
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────

  Future<void> _createStaircase(String name) async {
    await _client.from('building_staircases').insert({'project_id': widget.projectId, 'name': name.trim(), 'order': _staircases.length});
    _load();
  }

  Future<void> _updateStaircase(String id, String name) async {
    await _client.from('building_staircases').update({'name': name.trim()}).eq('id', id);
    _load();
  }

  Future<void> _deleteStaircase(String id, String name) async {
    final ok = await _confirm('Objekt "$name" wirklich löschen?');
    if (!ok) return;
    await _client.from('building_staircases').delete().eq('id', id);
    _load();
  }

  Future<void> _createFloor(String staircaseId, String name, int level) async {
    await _client.from('building_floors').insert({'staircase_id': staircaseId, 'name': name.trim(), 'level': level});
    _load();
  }

  Future<void> _updateFloor(String id, String name, int level) async {
    await _client.from('building_floors').update({'name': name.trim(), 'level': level}).eq('id', id);
    _load();
  }

  Future<void> _deleteFloor(String id, String name) async {
    final ok = await _confirm('Stockwerk "$name" wirklich löschen?');
    if (!ok) return;
    await _client.from('building_floors').delete().eq('id', id);
    _load();
  }

  Future<void> _createApartment(String floorId, String name) async {
    await _client.from('building_apartments').insert({'floor_id': floorId, 'name': name.trim()});
    _load();
  }

  Future<void> _createStandaloneApartment(String name) async {
    await _client.from('building_apartments').insert({'project_id': widget.projectId, 'floor_id': null, 'name': name.trim()});
    _load();
  }

  Future<void> _updateApartment(String id, String name) async {
    await _client.from('building_apartments').update({'name': name.trim()}).eq('id', id);
    _load();
  }

  Future<void> _deleteApartment(_Apartment apt) async {
    final ok = await _confirm('Wohnung "${apt.name}" wirklich löschen?');
    if (!ok) return;
    await _client.from('building_apartments').delete().eq('id', apt.id);
    if (_editorApt?.id == apt.id) setState(() { _editorApt = null; _editorMode = null; });
    _load();
  }

  Future<void> _savePlan(_Apartment apt, _PlanMode mode, List<_CanvasElement> elements) async {
    final field = mode == _PlanMode.free ? 'floor_plan_data' : 'technical_plan_data';
    // Save as a raw list so Supabase stores it as JSONB (same as web app)
    final data = elements.map((e) => e.toMap()).toList();
    await _client.from('building_apartments').update({field: data}).eq('id', apt.id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Plan gespeichert'), backgroundColor: Color(0xFF22c55e)));
    }
    _load();
  }

  Future<void> _uploadAttachment(_Apartment apt) async {
    final result = await FilePicker.platform.pickFiles(type: FileType.any);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes ?? Uint8List(0);
    if (bytes.isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Datei konnte nicht gelesen werden')));
      return;
    }
    try {
      final ext = file.extension ?? 'bin';
      final path = 'building-plans/${widget.projectId}/${apt.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';
      await _client.storage.from('project-files').uploadBinary(path, bytes, fileOptions: FileOptions(upsert: true, contentType: file.extension));
      final url = _client.storage.from('project-files').getPublicUrl(path);
      await _client.from('building_attachments').insert({'apartment_id': apt.id, 'name': file.name, 'url': url, 'type': file.extension, 'size': file.size});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Anlage hochgeladen'), backgroundColor: Color(0xFF22c55e)));
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Fehler: $e')));
    }
  }

  Future<void> _deleteAttachment(_Attachment att) async {
    final ok = await _confirm('"${att.name}" wirklich löschen?');
    if (!ok) return;
    await _client.from('building_attachments').delete().eq('id', att.id);
    _load();
  }

  // ─── Dialogs ─────────────────────────────────────────────────────────────

  Future<bool> _confirm(String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Bestätigen'),
            content: Text(message),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Abbrechen')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), style: TextButton.styleFrom(foregroundColor: AppColors.danger), child: const Text('Löschen')),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _showStaircaseDialog({_Staircase? editing}) async {
    final ctrl = TextEditingController(text: editing?.name ?? '');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editing == null ? 'Neues Objekt' : 'Objekt bearbeiten'),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(labelText: 'Name *', hintText: 'z.B. Objekt A')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          FilledButton(
            onPressed: () async {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              if (editing == null) await _createStaircase(ctrl.text);
              else await _updateStaircase(editing.id, ctrl.text);
            },
            child: Text(editing == null ? 'Erstellen' : 'Speichern'),
          ),
        ],
      ),
    );
  }

  Future<void> _showFloorDialog(String staircaseId, {_Floor? editing}) async {
    final nameCtrl = TextEditingController(text: editing?.name ?? '');
    final levelCtrl = TextEditingController(text: editing?.level.toString() ?? '0');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editing == null ? 'Neues Stockwerk' : 'Stockwerk bearbeiten'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, autofocus: true, decoration: const InputDecoration(labelText: 'Name *', hintText: 'z.B. Erdgeschoss, 1. OG')),
            const SizedBox(height: 12),
            TextField(controller: levelCtrl, decoration: const InputDecoration(labelText: 'Etage (Zahl)', hintText: '0 = EG, 1 = 1.OG, -1 = Keller'), keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          FilledButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              final lvl = int.tryParse(levelCtrl.text) ?? 0;
              if (editing == null) await _createFloor(staircaseId, nameCtrl.text, lvl);
              else await _updateFloor(editing.id, nameCtrl.text, lvl);
            },
            child: Text(editing == null ? 'Erstellen' : 'Speichern'),
          ),
        ],
      ),
    );
  }

  Future<void> _showApartmentDialog(String floorId, {_Apartment? editing}) async {
    final ctrl = TextEditingController(text: editing?.name ?? '');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editing == null ? 'Neue Wohnung' : 'Wohnung bearbeiten'),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(labelText: 'Name *', hintText: 'z.B. Whg. 1.01, Penthouse')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          FilledButton(
            onPressed: () async {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              if (editing == null) await _createApartment(floorId, ctrl.text);
              else await _updateApartment(editing.id, ctrl.text);
            },
            child: Text(editing == null ? 'Erstellen' : 'Speichern'),
          ),
        ],
      ),
    );
  }

  Future<void> _showStandaloneAptDialog({_Apartment? editing}) async {
    final ctrl = TextEditingController(text: editing?.name ?? '');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editing == null ? 'Einzelne Wohnung erstellen' : 'Wohnung bearbeiten'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (editing == null) const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text('Erstellen Sie eine Wohnung ohne Objekt-Struktur.', style: TextStyle(fontSize: 13, color: Color(0xFF64748b))),
            ),
            TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(labelText: 'Name *', hintText: 'z.B. Whg. Musterstraße 12')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          FilledButton(
            onPressed: () async {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              if (editing == null) await _createStandaloneApartment(ctrl.text);
              else await _updateApartment(editing.id, ctrl.text);
            },
            child: Text(editing == null ? 'Erstellen' : 'Speichern'),
          ),
        ],
      ),
    );
  }

  // ─── Build helpers ────────────────────────────────────────────────────────

  Widget _buildApartmentCard(_Apartment apt) {
    final isExpanded = _expandedApartments.contains(apt.id);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFBFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Collapsible header
          GestureDetector(
            onTap: () => setState(() => isExpanded ? _expandedApartments.remove(apt.id) : _expandedApartments.add(apt.id)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isExpanded ? const Color(0xFFF3F0FF) : const Color(0xFFFAFBFC),
                borderRadius: isExpanded
                    ? const BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12))
                    : BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    isExpanded ? LucideIcons.chevronDown : LucideIcons.chevronRight,
                    size: 16, color: const Color(0xFF8B5CF6),
                  ),
                  const SizedBox(width: 6),
                  const Icon(LucideIcons.home, size: 16, color: Color(0xFF8B5CF6)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      apt.name,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1e293b)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (apt.floorPlanData != null || apt.technicalPlanData != null)
                    Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF22c55e), shape: BoxShape.circle)),
                  if (apt.attachments.isNotEmpty) ...[  
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFdcfce7), borderRadius: BorderRadius.circular(10)),
                      child: Text('${apt.attachments.length}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF166534))),
                    ),
                  ],
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => apt.floorId != null ? _showApartmentDialog(apt.floorId!, editing: apt) : _showStandaloneAptDialog(editing: apt),
                    child: const Padding(padding: EdgeInsets.all(4), child: Icon(LucideIcons.edit2, size: 14, color: Color(0xFF64748b))),
                  ),
                  GestureDetector(
                    onTap: () => _deleteApartment(apt),
                    child: Padding(padding: const EdgeInsets.all(4), child: Icon(LucideIcons.trash2, size: 14, color: AppColors.danger)),
                  ),
                ],
              ),
            ),
          ),
          // Expanded content
          if (isExpanded) ...[  
            Container(
              height: 1,
              color: const Color(0xFFE2E8F0),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _planButtonFull(icon: LucideIcons.pencil, color: AppColors.primary, title: 'Freies Zeichnen', subtitle: 'Unbegrenzte Leinwand', hasData: apt.floorPlanData != null, onTap: () => _openEditor(apt, _PlanMode.free)),
                  const SizedBox(height: 8),
                  _planButtonFull(icon: LucideIcons.ruler, color: const Color(0xFFF59E0B), title: 'Technischer Grundriss', subtitle: 'Wände, Türen, Fenster', hasData: apt.technicalPlanData != null, onTap: () => _openEditor(apt, _PlanMode.technical)),
                  const SizedBox(height: 8),
                  _planButtonFull(icon: LucideIcons.upload, color: const Color(0xFF22c55e), title: 'Plan hochladen', subtitle: 'PDF, Bild, CAD anhängen', badge: apt.attachments.isNotEmpty ? '${apt.attachments.length}' : null, onTap: () => _uploadAttachment(apt)),
                ],
              ),
            ),
            if (apt.attachments.isNotEmpty) ...[    
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: apt.attachments.map((att) => _attachmentRow(att)).toList(),
              ),
            ),
          ],
          ],
        ],
      ),
    );
  }

  Widget _planButtonFull({required IconData icon, required Color color, required String title, required String subtitle, bool hasData = false, String? badge, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFe2e8f0)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1e293b))),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF94a3b8))),
                ],
              ),
            ),
            if (hasData)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFdcfce7), borderRadius: BorderRadius.circular(8)),
                child: const Text('Gespeichert', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF166534))),
              ),
            if (badge != null && !hasData)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFdcfce7), borderRadius: BorderRadius.circular(8)),
                child: Text(badge, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF166534))),
              ),
            const SizedBox(width: 8),
            Icon(LucideIcons.chevronRight, size: 16, color: color.withValues(alpha: 0.7)),
          ],
        ),
      ),
    );
  }  Widget _attachmentRow(_Attachment att) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Row(
        children: [
          const Icon(LucideIcons.fileImage, size: 14, color: Color(0xFF64748b)),
          const SizedBox(width: 8),
          Expanded(child: Text(att.name, style: const TextStyle(fontSize: 12, color: Color(0xFF334155)), overflow: TextOverflow.ellipsis)),
          Text('${(att.size / 1024).toStringAsFixed(0)} KB', style: const TextStyle(fontSize: 11, color: Color(0xFF94a3b8))),
          const SizedBox(width: 8),
          IconButton(
            onPressed: () => launchUrl(Uri.parse(att.url), mode: LaunchMode.externalApplication),
            icon: const Icon(LucideIcons.download, size: 14),
            style: IconButton.styleFrom(foregroundColor: AppColors.primary),
          ),
          IconButton(
            onPressed: () => _deleteAttachment(att),
            icon: const Icon(LucideIcons.trash2, size: 14),
            style: IconButton.styleFrom(foregroundColor: AppColors.danger),
          ),
        ],
      ),
    );
  }

  void _openEditor(_Apartment apt, _PlanMode mode) {
    setState(() { _editorApt = apt; _editorMode = mode; });
  }

  @override
  Widget build(BuildContext context) {
    // Full-screen editor
    if (_editorApt != null && _editorMode != null) {
      return _CanvasEditorPage(
        apartment: _editorApt!,
        mode: _editorMode!,
        onClose: () { setState(() { _editorApt = null; _editorMode = null; }); _load(); },
        onSave: (elements) => _savePlan(_editorApt!, _editorMode!, elements),
      );
    }

    final hasContent = _staircases.isNotEmpty || _standaloneApts.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: burgerMenuLeading(context),
        title: const Text('Objektplan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0f172a))),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'fab_wohnung',
            onPressed: () => _showStandaloneAptDialog(),
            backgroundColor: Colors.white,
            foregroundColor: AppColors.primary,
            elevation: 2,
            icon: const Icon(LucideIcons.home, size: 18),
            label: const Text('Wohnung', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 12),
          FloatingActionButton.extended(
            heroTag: 'fab_objekt',
            onPressed: () => _showStaircaseDialog(),
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 3,
            icon: const Icon(LucideIcons.plus, size: 18),
            label: const Text('Objekt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: _loading
          ? const LottieLoader()
          : !hasContent
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    children: [
                      // Standalone apartments
                      if (_standaloneApts.isNotEmpty) _buildStandaloneSection(),
                      // Staircases
                      ..._staircases.map((sc) => _buildStaircaseCard(sc)),
                    ],
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.building2, size: 64, color: Color(0xFFcbd5e1)),
            const SizedBox(height: 16),
            const Text('Noch kein Gebäudeplan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
            const SizedBox(height: 8),
            const Text(
              'Erstellen Sie ein Objekt mit Stockwerken und Wohnungen, oder fügen Sie direkt eine einzelne Wohnung hinzu.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFF94a3b8)),
            ),
            const SizedBox(height: 24),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              OutlinedButton.icon(
                onPressed: _showStandaloneAptDialog,
                icon: const Icon(LucideIcons.plus, size: 14),
                label: const Text('Einzelne Wohnung'),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _showStaircaseDialog,
                icon: const Icon(LucideIcons.plus, size: 14),
                label: const Text('Objekt'),
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _buildStandaloneSection() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(color: Color(0xFFFAF5FF), borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16))),
            child: Row(
              children: [
                const Icon(LucideIcons.home, size: 18, color: Color(0xFF8B5CF6)),
                const SizedBox(width: 8),
                Expanded(
                  child: Row(
                    children: [
                      const Text('Einzelne Wohnungen', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0f172a))),
                      const SizedBox(width: 8),
                      _badge('${_standaloneApts.length}', bgColor: const Color(0xFFf3e8ff), textColor: const Color(0xFF7c3aed)),
                    ],
                  ),
                ),
                _smallBtn('Wohnung', LucideIcons.plus, () => _showStandaloneAptDialog()),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: _standaloneApts.map(_buildApartmentCard).toList()),
          ),
        ],
      ),
    );
  }

  Widget _buildStaircaseCard(_Staircase sc) {
    final isExpanded = _expandedStaircases.contains(sc.id);
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: [
          // Header
          GestureDetector(
            onTap: () => setState(() => isExpanded ? _expandedStaircases.remove(sc.id) : _expandedStaircases.add(sc.id)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: const BoxDecoration(color: Color(0xFFF8FAFC), borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(isExpanded ? LucideIcons.chevronDown : LucideIcons.chevronRight, size: 18, color: const Color(0xFF64748b)),
                      const SizedBox(width: 6),
                      const Icon(LucideIcons.building2, size: 18, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          sc.name,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0f172a)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _badge('${sc.floors.length}'),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const SizedBox(width: 24),
                      _smallBtn('Stockwerk', LucideIcons.plus, () => _showFloorDialog(sc.id)),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => _showStaircaseDialog(editing: sc),
                        child: const Padding(padding: EdgeInsets.all(4), child: Icon(LucideIcons.edit2, size: 16, color: Color(0xFF64748b))),
                      ),
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: () => _deleteStaircase(sc.id, sc.name),
                        child: Padding(padding: const EdgeInsets.all(4), child: Icon(LucideIcons.trash2, size: 16, color: AppColors.danger)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // Floors
          if (isExpanded) ...sc.floors.map((fl) => _buildFloorSection(fl, sc)),
        ],
      ),
    );
  }

  Widget _buildFloorSection(_Floor fl, _Staircase sc) {
    final isExpanded = _expandedFloors.contains(fl.id);
    return Column(
      children: [
        const Divider(height: 1, color: Color(0xFFF1F5F9)),
        GestureDetector(
          onTap: () => setState(() => isExpanded ? _expandedFloors.remove(fl.id) : _expandedFloors.add(fl.id)),
          child: Container(
            padding: const EdgeInsets.only(left: 12, right: 12, top: 8, bottom: 8),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SizedBox(width: 24),
                    Icon(isExpanded ? LucideIcons.chevronDown : LucideIcons.chevronRight, size: 16, color: const Color(0xFF64748b)),
                    const SizedBox(width: 6),
                    const Icon(LucideIcons.layers, size: 16, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        fl.name,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF1e293b)),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    _badge('${fl.apartments.length}', bgColor: const Color(0xFFFEF3C7), textColor: const Color(0xFF92400E)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const SizedBox(width: 54),
                    _smallBtn('Wohnung', LucideIcons.plus, () => _showApartmentDialog(fl.id)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => _showFloorDialog(sc.id, editing: fl),
                      child: const Padding(padding: EdgeInsets.all(4), child: Icon(LucideIcons.edit2, size: 14, color: Color(0xFF64748b))),
                    ),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () => _deleteFloor(fl.id, fl.name),
                      child: Padding(padding: const EdgeInsets.all(4), child: Icon(LucideIcons.trash2, size: 14, color: AppColors.danger)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (isExpanded)
          Padding(
            padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
            child: Column(children: fl.apartments.map(_buildApartmentCard).toList()),
          ),
      ],
    );
  }

  Widget _badge(String label, {Color bgColor = const Color(0xFFEFF6FF), Color textColor = const Color(0xFF1d4ed8)}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: textColor)),
    );
  }

  Widget _smallBtn(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(6)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: const Color(0xFF1d4ed8)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1d4ed8))),
        ]),
      ),
    );
  }
}
