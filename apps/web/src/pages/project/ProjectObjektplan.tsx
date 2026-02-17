import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { Card, Button, Input } from '@docstruc/ui';
import { colors } from '@docstruc/theme';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ToastProvider';
import { ModernModal } from '../../components/ModernModal';
import { useProjectPermissionContext } from '../../components/PermissionGuard';
import { useContentVisibility } from '../../hooks/useContentVisibility';
import {
  Building2, Layers, Home, Plus, ChevronRight, ChevronDown, Edit2, Trash2,
  Upload, X, Maximize2, Minimize2, Move, Square, Circle, Type, Minus,
  RotateCcw, RotateCw, ZoomIn, ZoomOut, Download, Pencil, DoorOpen,
  Ruler, Grid3X3, Eye, EyeOff, MousePointer, Hand, Eraser, Save,
  FileImage, PanelLeftClose, PanelLeftOpen, ArrowLeft, Copy, MoreVertical,
  Magnet, Crosshair
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Staircase {
  id: string;
  name: string;
  order: number;
  floors: Floor[];
}

interface Floor {
  id: string;
  name: string;
  level: number;
  staircase_id: string;
  apartments: Apartment[];
}

interface Apartment {
  id: string;
  name: string;
  floor_id: string | null;
  project_id?: string;
  floor_plan_data?: string;
  technical_plan_data?: string;
  attachments: Attachment[];
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

interface CanvasElement {
  id: string;
  type: 'line' | 'rect' | 'circle' | 'text' | 'freehand' | 'wall' | 'door' | 'window' | 'terrace' | 'patio_door' | 'dimension';
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  points?: { x: number; y: number }[];
  rotation?: number;
  text?: string;
  fontSize?: number;
  color: string;
  strokeWidth: number;
  fill?: string;
  length?: number;
  displayUnit?: 'cm' | 'm';
  wallThickness?: number;
  label?: string;
}

type CanvasTool = 'select' | 'pan' | 'freehand' | 'line' | 'rect' | 'circle' | 'text' | 'wall' | 'door' | 'window' | 'terrace' | 'patio_door' | 'dimension' | 'eraser';
type PlanMode = 'free' | 'technical';
type DragMode = 'none' | 'move' | 'resize-start' | 'resize-end' | 'resize-br';

// ─── Helper Functions ────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substring(2, 12);

const formatLength = (cm: number, unit: 'cm' | 'm'): string => {
  if (unit === 'm') return `${(cm / 100).toFixed(2)} m`;
  return `${Math.round(cm)} cm`;
};

const HANDLE_SIZE = 10;

const snapToAngle = (start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const snapAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4];
  const len = Math.sqrt(dx * dx + dy * dy);
  let closest = snapAngles[0];
  let minDiff = Math.abs(angle - snapAngles[0]);
  for (const sa of snapAngles) {
    const diff = Math.abs(angle - sa);
    if (diff < minDiff) { minDiff = diff; closest = sa; }
  }
  if (minDiff < Math.PI / 16) {
    return { x: start.x + Math.cos(closest) * len, y: start.y + Math.sin(closest) * len };
  }
  return end;
};

// ─── Dimension Label Drawing ─────────────────────────────────────────────────

function drawDimensionLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, labelColor: string, scale: number, bold?: boolean) {
  ctx.save();
  // Font size scales with zoom but maintains readability (16-24px range in canvas units)
  const fontSize = Math.max(16, Math.min(24, 20 / Math.sqrt(scale)));
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  const px = 10, py = 5, rr = 6;
  const bh = fontSize * 1.1;
  const bx = x - tw / 2 - px;
  const by = y - bh / 2 - py;
  const bw = tw + px * 2;
  const bhh = bh + py * 2;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(bx + rr, by);
  ctx.lineTo(bx + bw - rr, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rr);
  ctx.lineTo(bx + bw, by + bhh - rr);
  ctx.quadraticCurveTo(bx + bw, by + bhh, bx + bw - rr, by + bhh);
  ctx.lineTo(bx + rr, by + bhh);
  ctx.quadraticCurveTo(bx, by + bhh, bx, by + bhh - rr);
  ctx.lineTo(bx, by + rr);
  ctx.quadraticCurveTo(bx, by, bx + rr, by);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = labelColor;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = labelColor;
  ctx.fillText(text, x, y + fontSize * 0.35);
  ctx.restore();
}

// ─── Canvas Component ────────────────────────────────────────────────────────

interface FloorPlanCanvasProps {
  mode: PlanMode;
  elements: CanvasElement[];
  onElementsChange: (elements: CanvasElement[]) => void;
  onSave: () => void;
}

function FloorPlanCanvas({ mode, elements, onElementsChange, onSave }: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<CanvasTool>(mode === 'free' ? 'freehand' : 'wall');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [wallThickness, setWallThickness] = useState(15);
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [displayUnit, setDisplayUnit] = useState<'cm' | 'm'>('cm');
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragElementSnapshot, setDragElementSnapshot] = useState<CanvasElement | null>(null);
  const [textFontSize, setTextFontSize] = useState(20);
  const [showStrokeWidthMenu, setShowStrokeWidthMenu] = useState(false);
  const [showWallThicknessMenu, setShowWallThicknessMenu] = useState(false);
  const [showTextSizeMenu, setShowTextSizeMenu] = useState(false);
  const animFrameRef = useRef<number>(0);

  // ─── Element bounding ────────────────────────────────────────────────────
  const getElementBounds = (el: CanvasElement): { x: number; y: number; w: number; h: number } => {
    if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') {
      const x1 = el.x, y1 = el.y, x2 = el.x2 ?? el.x, y2 = el.y2 ?? el.y;
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    }
    if (el.type === 'freehand' && el.points && el.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of el.points) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return { x: el.x, y: el.y, w: el.width ?? 60, h: el.height ?? 20 };
  };

  // ─── Hit-test handles ────────────────────────────────────────────────────
  const hitTestHandles = (pos: { x: number; y: number }, el: CanvasElement): DragMode => {
    const hs = HANDLE_SIZE / scale;
    if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') {
      if (Math.abs(pos.x - el.x) < hs && Math.abs(pos.y - el.y) < hs) return 'resize-start';
      if (Math.abs(pos.x - (el.x2 ?? el.x)) < hs && Math.abs(pos.y - (el.y2 ?? el.y)) < hs) return 'resize-end';
    } else if (el.type === 'rect' || el.type === 'circle' || el.type === 'terrace') {
      const bx = el.x + (el.width ?? 0), by = el.y + (el.height ?? 0);
      if (Math.abs(pos.x - bx) < hs && Math.abs(pos.y - by) < hs) return 'resize-br';
    } else if (el.type === 'door' || el.type === 'window' || el.type === 'patio_door') {
      const bx = el.x + (el.width ?? 60);
      if (Math.abs(pos.x - bx) < hs && Math.abs(pos.y - el.y) < hs) return 'resize-end';
    }
    return 'none';
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Grid — darker, with major lines
    if (showGrid) {
      const gridSize = mode === 'technical' ? 20 : 40;
      const startX = Math.floor(-offset.x / scale / gridSize) * gridSize - gridSize;
      const startY = Math.floor(-offset.y / scale / gridSize) * gridSize - gridSize;
      const endX = startX + (rect.width / scale) + gridSize * 2;
      const endY = startY + (rect.height / scale) + gridSize * 2;
      // minor
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      for (let x = startX; x < endX; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
      }
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
      }
      // major every 5
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      for (let x = startX; x < endX; x += gridSize * 5) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
      }
      for (let y = startY; y < endY; y += gridSize * 5) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
      }
    }

    // Elements
    elements.forEach(el => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const isSelected = selectedElement === el.id;
      if (isSelected) { ctx.shadowColor = colors.primary; ctx.shadowBlur = 6; }

      switch (el.type) {
        case 'freehand':
          if (el.points && el.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
            ctx.stroke();
          }
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x2 ?? el.x, el.y2 ?? el.y);
          ctx.stroke();
          if (showDimensions && el.length) {
            const mx = (el.x + (el.x2 ?? el.x)) / 2, my = (el.y + (el.y2 ?? el.y)) / 2;
            drawDimensionLabel(ctx, mx, my - 20, formatLength(el.length, displayUnit), el.color, scale);
          }
          break;
        case 'rect':
          if (el.fill) { ctx.fillStyle = el.fill; ctx.fillRect(el.x, el.y, el.width ?? 0, el.height ?? 0); }
          ctx.strokeRect(el.x, el.y, el.width ?? 0, el.height ?? 0);
          break;
        case 'circle': {
          const rx = (el.width ?? 0) / 2, ry = (el.height ?? 0) / 2;
          ctx.beginPath();
          ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
          if (el.fill) { ctx.fillStyle = el.fill; ctx.fill(); }
          ctx.stroke();
          break;
        }
        case 'text':
          ctx.font = `${el.fontSize ?? 20}px Inter, sans-serif`;
          ctx.fillStyle = el.color;
          ctx.fillText(el.text ?? '', el.x, el.y);
          break;
        case 'wall': {
          const dx = (el.x2 ?? el.x) - el.x, dy = (el.y2 ?? el.y) - el.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) break;
          const thick = el.wallThickness ?? 15;
          const nx = -dy / len * thick / 2, ny = dx / len * thick / 2;
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(el.x + nx, el.y + ny);
          ctx.lineTo(el.x - nx, el.y - ny);
          ctx.lineTo((el.x2 ?? el.x) - nx, (el.y2 ?? el.y) - ny);
          ctx.lineTo((el.x2 ?? el.x) + nx, (el.y2 ?? el.y) + ny);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
          if (isSelected) {
            const mx2 = (el.x + (el.x2 ?? el.x)) / 2, my2 = (el.y + (el.y2 ?? el.y)) / 2;
            ctx.save();
            ctx.font = 'bold 13px Inter, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.fillText(`${thick} cm`, mx2 + nx * 3, my2 + ny * 3);
            ctx.restore();
          }
          if (showDimensions && el.length) {
            const mx = (el.x + (el.x2 ?? el.x)) / 2, my = (el.y + (el.y2 ?? el.y)) / 2;
            drawDimensionLabel(ctx, mx, my - Math.abs(ny) * 2 - 25, formatLength(el.length, displayUnit), '#3B82F6', scale);
          }
          break;
        }
        case 'door': {
          ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2;
          const dw = el.width ?? 60;
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + dw, el.y); ctx.stroke();
          ctx.beginPath(); ctx.setLineDash([4, 4]);
          ctx.arc(el.x, el.y, dw, 0, -Math.PI / 2, true);
          ctx.stroke(); ctx.setLineDash([]);
          if (showDimensions && el.length) drawDimensionLabel(ctx, el.x + dw / 2, el.y - 25, formatLength(el.length, displayUnit), '#F59E0B', scale);
          break;
        }
        case 'window': {
          ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 3;
          const ww = el.width ?? 80;
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + ww, el.y); ctx.stroke();
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(el.x + 4, el.y - 4); ctx.lineTo(el.x + ww - 4, el.y - 4);
          ctx.moveTo(el.x + 4, el.y + 4); ctx.lineTo(el.x + ww - 4, el.y + 4);
          ctx.stroke();
          if (showDimensions && el.length) drawDimensionLabel(ctx, el.x + ww / 2, el.y - 28, formatLength(el.length, displayUnit), '#3B82F6', scale);
          break;
        }
        case 'terrace': {
          const tw2 = el.width ?? 200, th = el.height ?? 120;
          ctx.fillStyle = '#f0fdf4'; ctx.fillRect(el.x, el.y, tw2, th);
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
          ctx.strokeRect(el.x, el.y, tw2, th); ctx.setLineDash([]);
          ctx.font = 'bold 16px Inter, sans-serif'; ctx.fillStyle = '#16a34a';
          ctx.textAlign = 'center'; ctx.fillText('Terrasse', el.x + tw2 / 2, el.y + th / 2 + 6);
          ctx.textAlign = 'start';
          break;
        }
        case 'patio_door': {
          ctx.strokeStyle = '#8B5CF6'; ctx.lineWidth = 3;
          const pdw = el.width ?? 120;
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x + pdw, el.y); ctx.stroke();
          ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(el.x + pdw * 0.25, el.y - 6); ctx.lineTo(el.x + pdw * 0.75, el.y - 6); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(el.x + pdw * 0.4, el.y - 9); ctx.lineTo(el.x + pdw * 0.6, el.y - 9); ctx.stroke();
          if (showDimensions && el.length) drawDimensionLabel(ctx, el.x + pdw / 2, el.y - 30, formatLength(el.length, displayUnit), '#8B5CF6', scale);
          break;
        }
        case 'dimension': {
          ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x2 ?? el.x, el.y2 ?? el.y); ctx.stroke();
          const ddx = (el.x2 ?? el.x) - el.x, ddy = (el.y2 ?? el.y) - el.y;
          const dl = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dl > 0) {
            const dnx = -ddy / dl * 8, dny = ddx / dl * 8;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(el.x + dnx, el.y + dny); ctx.lineTo(el.x - dnx, el.y - dny);
            ctx.moveTo((el.x2 ?? el.x) + dnx, (el.y2 ?? el.y) + dny); ctx.lineTo((el.x2 ?? el.x) - dnx, (el.y2 ?? el.y) - dny);
            ctx.stroke();
          }
          if (el.length) {
            const dmx = (el.x + (el.x2 ?? el.x)) / 2, dmy = (el.y + (el.y2 ?? el.y)) / 2;
            drawDimensionLabel(ctx, dmx, dmy - 22, formatLength(el.length, displayUnit), '#EF4444', scale, true);
          }
          break;
        }
      }

      // ─── Resize handles for selected ──────────────────────────────────
      if (isSelected && tool === 'select') {
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        const hs = HANDLE_SIZE;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = colors.primary; ctx.lineWidth = 2;
        if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') {
          ctx.beginPath(); ctx.arc(el.x, el.y, hs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(el.x2 ?? el.x, el.y2 ?? el.y, hs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (el.type === 'rect' || el.type === 'circle' || el.type === 'terrace') {
          const bx = el.x + (el.width ?? 0), by = el.y + (el.height ?? 0);
          ctx.fillRect(el.x - hs / 2, el.y - hs / 2, hs, hs); ctx.strokeRect(el.x - hs / 2, el.y - hs / 2, hs, hs);
          ctx.fillRect(bx - hs / 2, by - hs / 2, hs, hs); ctx.strokeRect(bx - hs / 2, by - hs / 2, hs, hs);
        } else if (el.type === 'door' || el.type === 'window' || el.type === 'patio_door') {
          ctx.beginPath(); ctx.arc(el.x, el.y, hs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          const ex = el.x + (el.width ?? 60);
          ctx.beginPath(); ctx.arc(ex, el.y, hs / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Drawing preview
    if (isDrawing && currentPoints.length > 0 && tool === 'freehand') {
      ctx.beginPath(); ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round';
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }, [elements, offset, scale, showGrid, showDimensions, displayUnit, mode, selectedElement, isDrawing, currentPoints, tool, strokeColor, strokeWidth]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [renderCanvas]);

  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - offset.x) / scale, y: (e.clientY - r.top - offset.y) / scale };
  };

  const pushUndo = () => {
    setUndoStack(prev => [...prev, elements.map(e => ({ ...e, points: e.points ? [...e.points] : undefined }))]);
    setRedoStack([]);
  };
  const undo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(r => [...r, elements.map(e => ({ ...e }))]);
    onElementsChange(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(u => [...u, elements.map(e => ({ ...e }))]);
    onElementsChange(redoStack[redoStack.length - 1]);
    setRedoStack(r => r.slice(0, -1));
  };

  // ─── Center view ─────────────────────────────────────────────────────────
  const centerView = () => {
    if (elements.length === 0) { setOffset({ x: 0, y: 0 }); setScale(1); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const b = getElementBounds(el);
      if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w; if (b.y + b.h > maxY) maxY = b.y + b.h;
    });
    const cw = maxX - minX, ch = maxY - minY;
    if (cw === 0 && ch === 0) return;
    const pad = 80;
    const ns = Math.min((cr.width - pad * 2) / cw, (cr.height - pad * 2) / ch, 2);
    setScale(ns);
    setOffset({ x: cr.width / 2 - ((minX + maxX) / 2) * ns, y: cr.height / 2 - ((minY + maxY) / 2) * ns });
  };

  // ─── Mouse handlers ──────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    if (tool === 'select') {
      // Check resize handles first
      if (selectedElement) {
        const selEl = elements.find(el => el.id === selectedElement);
        if (selEl) {
          const hh = hitTestHandles(pos, selEl);
          if (hh !== 'none') {
            pushUndo(); setDragMode(hh); setDragStart(pos);
            setDragElementSnapshot({ ...selEl, points: selEl.points ? selEl.points.map(p => ({ ...p })) : undefined });
            return;
          }
        }
      }
      // Find element to select / move
      const clicked = [...elements].reverse().find(el => {
        if (el.type === 'freehand' && el.points) return el.points.some(p => Math.abs(p.x - pos.x) < 10 && Math.abs(p.y - pos.y) < 10);
        if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') return distPointToLine(pos, { x: el.x, y: el.y }, { x: el.x2 ?? el.x, y: el.y2 ?? el.y }) < 12;
        if (el.type === 'text') return pos.x >= el.x - 5 && pos.x <= el.x + 150 && pos.y >= el.y - (el.fontSize ?? 20) && pos.y <= el.y + 5;
        const w = el.width ?? 60, h = el.height ?? 20;
        return pos.x >= el.x && pos.x <= el.x + w && pos.y >= el.y && pos.y <= el.y + h;
      });
      if (clicked) {
        setSelectedElement(clicked.id);
        pushUndo(); setDragMode('move'); setDragStart(pos);
        setDragElementSnapshot({ ...clicked, points: clicked.points ? clicked.points.map(p => ({ ...p })) : undefined });
      } else {
        setSelectedElement(null);
      }
      return;
    }
    if (tool === 'eraser') {
      pushUndo();
      const toRemove = [...elements].reverse().find(el => {
        if (el.type === 'freehand' && el.points) return el.points.some(p => Math.abs(p.x - pos.x) < 15 && Math.abs(p.y - pos.y) < 15);
        if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') return distPointToLine(pos, { x: el.x, y: el.y }, { x: el.x2 ?? el.x, y: el.y2 ?? el.y }) < 15;
        const w = el.width ?? 60, h = el.height ?? 20;
        return pos.x >= el.x - 5 && pos.x <= el.x + w + 5 && pos.y >= el.y - 5 && pos.y <= el.y + h + 5;
      });
      if (toRemove) onElementsChange(elements.filter(el => el.id !== toRemove.id));
      return;
    }
    if (tool === 'text') { setTextPosition(pos); return; }
    setIsDrawing(true); setDrawStart(pos);
    if (tool === 'freehand') setCurrentPoints([pos]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) { setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }
    if (dragMode !== 'none' && dragStart && dragElementSnapshot && selectedElement) {
      const pos = getCanvasPos(e);
      const dx = pos.x - dragStart.x, dy = pos.y - dragStart.y;
      const updated = elements.map(el => {
        if (el.id !== selectedElement) return el;
        const snap = dragElementSnapshot;
        if (dragMode === 'move') {
          const n: CanvasElement = { ...el, x: snap.x + dx, y: snap.y + dy };
          if (snap.x2 !== undefined) n.x2 = snap.x2 + dx;
          if (snap.y2 !== undefined) n.y2 = snap.y2 + dy;
          if (snap.points) n.points = snap.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
          return n;
        }
        if (dragMode === 'resize-start') {
          let nx = snap.x + dx, ny = snap.y + dy;
          if (snapEnabled) { const s = snapToAngle({ x: snap.x2 ?? snap.x, y: snap.y2 ?? snap.y }, { x: nx, y: ny }); nx = s.x; ny = s.y; }
          const n: CanvasElement = { ...el, x: nx, y: ny };
          if (el.type === 'wall' || el.type === 'dimension' || el.type === 'line') {
            const ldx = (n.x2 ?? n.x) - n.x, ldy = (n.y2 ?? n.y) - n.y;
            n.length = Math.round(Math.sqrt(ldx * ldx + ldy * ldy) * 2);
          }
          return n;
        }
        if (dragMode === 'resize-end') {
          if (el.type === 'line' || el.type === 'wall' || el.type === 'dimension') {
            let nx2 = (snap.x2 ?? snap.x) + dx, ny2 = (snap.y2 ?? snap.y) + dy;
            if (snapEnabled) { const s = snapToAngle({ x: snap.x, y: snap.y }, { x: nx2, y: ny2 }); nx2 = s.x; ny2 = s.y; }
            const n: CanvasElement = { ...el, x2: nx2, y2: ny2 };
            const ldx = nx2 - n.x, ldy = ny2 - n.y;
            n.length = Math.round(Math.sqrt(ldx * ldx + ldy * ldy) * 2);
            return n;
          }
          const nw = Math.max(20, (snap.width ?? 60) + dx);
          return { ...el, width: nw, length: Math.round(nw * 2) };
        }
        if (dragMode === 'resize-br') {
          return { ...el, width: Math.max(10, (snap.width ?? 0) + dx), height: Math.max(10, (snap.height ?? 0) + dy) };
        }
        return el;
      });
      onElementsChange(updated);
      return;
    }
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    if (tool === 'freehand') setCurrentPoints(prev => [...prev, pos]);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) { setIsPanning(false); return; }
    if (dragMode !== 'none') { setDragMode('none'); setDragStart(null); setDragElementSnapshot(null); return; }
    if (!isDrawing || !drawStart) { setIsDrawing(false); return; }
    let pos = getCanvasPos(e);
    if (snapEnabled && drawStart) pos = snapToAngle(drawStart, pos);
    pushUndo();

    if (tool === 'freehand' && currentPoints.length > 1) {
      onElementsChange([...elements, { id: generateId(), type: 'freehand', x: currentPoints[0].x, y: currentPoints[0].y, points: [...currentPoints], color: strokeColor, strokeWidth }]);
    } else if (tool === 'line') {
      const dx = pos.x - drawStart.x, dy = pos.y - drawStart.y;
      onElementsChange([...elements, { id: generateId(), type: 'line', x: drawStart.x, y: drawStart.y, x2: pos.x, y2: pos.y, color: strokeColor, strokeWidth, length: Math.round(Math.sqrt(dx * dx + dy * dy) * 2), displayUnit }]);
    } else if (tool === 'rect') {
      onElementsChange([...elements, { id: generateId(), type: 'rect', x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y), width: Math.abs(pos.x - drawStart.x), height: Math.abs(pos.y - drawStart.y), color: strokeColor, strokeWidth }]);
    } else if (tool === 'circle') {
      onElementsChange([...elements, { id: generateId(), type: 'circle', x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y), width: Math.abs(pos.x - drawStart.x), height: Math.abs(pos.y - drawStart.y), color: strokeColor, strokeWidth }]);
    } else if (tool === 'wall') {
      const dx = pos.x - drawStart.x, dy = pos.y - drawStart.y;
      onElementsChange([...elements, { id: generateId(), type: 'wall', x: drawStart.x, y: drawStart.y, x2: pos.x, y2: pos.y, color: '#334155', strokeWidth: 1, wallThickness, length: Math.round(Math.sqrt(dx * dx + dy * dy) * 2), displayUnit }]);
    } else if (tool === 'door') {
      const w = Math.abs(pos.x - drawStart.x) || 60;
      onElementsChange([...elements, { id: generateId(), type: 'door', x: drawStart.x, y: drawStart.y, width: w, color: '#F59E0B', strokeWidth: 2, length: Math.round(w * 2), displayUnit }]);
    } else if (tool === 'window') {
      const w = Math.abs(pos.x - drawStart.x) || 80;
      onElementsChange([...elements, { id: generateId(), type: 'window', x: drawStart.x, y: drawStart.y, width: w, color: '#3B82F6', strokeWidth: 3, length: Math.round(w * 2), displayUnit }]);
    } else if (tool === 'terrace') {
      onElementsChange([...elements, { id: generateId(), type: 'terrace', x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y), width: Math.abs(pos.x - drawStart.x) || 200, height: Math.abs(pos.y - drawStart.y) || 120, color: '#22c55e', strokeWidth: 2 }]);
    } else if (tool === 'patio_door') {
      const w = Math.abs(pos.x - drawStart.x) || 120;
      onElementsChange([...elements, { id: generateId(), type: 'patio_door', x: drawStart.x, y: drawStart.y, width: w, color: '#8B5CF6', strokeWidth: 3, length: Math.round(w * 2), displayUnit }]);
    } else if (tool === 'dimension') {
      const dx = pos.x - drawStart.x, dy = pos.y - drawStart.y;
      onElementsChange([...elements, { id: generateId(), type: 'dimension', x: drawStart.x, y: drawStart.y, x2: pos.x, y2: pos.y, color: '#EF4444', strokeWidth: 1, length: Math.round(Math.sqrt(dx * dx + dy * dy) * 2), displayUnit }]);
    }
    setIsDrawing(false); setDrawStart(null); setCurrentPoints([]);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.1, Math.min(5, s * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const addTextElement = () => {
    if (!textPosition || !textInput.trim()) return;
    pushUndo();
    onElementsChange([...elements, { id: generateId(), type: 'text', x: textPosition.x, y: textPosition.y, text: textInput, fontSize: textFontSize, color: strokeColor, strokeWidth: 1 }]);
    setTextInput(''); setTextPosition(null);
  };

  const deleteSelected = () => {
    if (!selectedElement) return;
    pushUndo();
    onElementsChange(elements.filter(el => el.id !== selectedElement));
    setSelectedElement(null);
  };

  const changeSelectedWallThickness = (v: number) => {
    if (!selectedElement) return;
    const el = elements.find(e => e.id === selectedElement);
    if (!el || el.type !== 'wall') return;
    pushUndo();
    onElementsChange(elements.map(e => e.id === selectedElement ? { ...e, wallThickness: v } : e));
  };

  const updateSelectedElementSize = (newWidth: number) => {
    if (!selectedElement) return;
    pushUndo();
    onElementsChange(elements.map(el => {
      if (el.id !== selectedElement) return el;
      const updated = { ...el, width: newWidth };
      if (el.type === 'door' || el.type === 'window' || el.type === 'patio_door') {
        updated.length = Math.round(newWidth * 2);
      }
      return updated;
    }));
  };

  const freeTools: { tool: CanvasTool; icon: any; label: string }[] = [
    { tool: 'select', icon: MousePointer, label: 'Auswählen / Verschieben' },
    { tool: 'pan', icon: Hand, label: 'Ansicht verschieben' },
    { tool: 'freehand', icon: Pencil, label: 'Freihand' },
    { tool: 'line', icon: Minus, label: 'Linie' },
    { tool: 'rect', icon: Square, label: 'Rechteck' },
    { tool: 'circle', icon: Circle, label: 'Kreis' },
    { tool: 'text', icon: Type, label: 'Text' },
    { tool: 'eraser', icon: Eraser, label: 'Radierer' },
  ];
  const technicalTools: { tool: CanvasTool; icon: any; label: string }[] = [
    { tool: 'select', icon: MousePointer, label: 'Auswählen / Verschieben' },
    { tool: 'pan', icon: Hand, label: 'Ansicht verschieben' },
    { tool: 'wall', icon: Square, label: 'Wand' },
    { tool: 'door', icon: DoorOpen, label: 'Tür' },
    { tool: 'window', icon: Grid3X3, label: 'Fenster' },
    { tool: 'patio_door', icon: Maximize2, label: 'Terrassentür' },
    { tool: 'terrace', icon: Home, label: 'Terrasse' },
    { tool: 'dimension', icon: Ruler, label: 'Maß' },
    { tool: 'freehand', icon: Pencil, label: 'Freihand' },
    { tool: 'text', icon: Type, label: 'Text' },
    { tool: 'line', icon: Minus, label: 'Linie' },
    { tool: 'eraser', icon: Eraser, label: 'Radierer' },
  ];
  const activeTools = mode === 'free' ? freeTools : technicalTools;
  const colorOptions = ['#1e293b', '#EF4444', '#3B82F6', '#22c55e', '#F59E0B', '#8B5CF6', '#EC4899', '#64748b'];
  const getCursor = () => {
    if (tool === 'pan' || isPanning) return 'grab';
    if (tool === 'select') { if (dragMode === 'move') return 'grabbing'; if (dragMode !== 'none') return 'nwse-resize'; return 'default'; }
    return 'crosshair';
  };
  const selectedEl = selectedElement ? elements.find(e => e.id === selectedElement) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexWrap: 'wrap' }}>
        {activeTools.map(t => (
          <button key={t.tool} onClick={() => setTool(t.tool)} title={t.label}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: 'none',
              backgroundColor: tool === t.tool ? colors.primary : '#fff', color: tool === t.tool ? '#fff' : '#334155',
              cursor: 'pointer', boxShadow: tool === t.tool ? '0 2px 6px rgba(59,130,246,0.3)' : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}>
            <t.icon size={16} />
          </button>
        ))}
        <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        {/* Snap */}
        <button onClick={() => setSnapEnabled(v => !v)} title="Magnetisches Einrasten (gerade Linien 0°/45°/90°)"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8,
            border: snapEnabled ? `2px solid ${colors.primary}` : '1px solid #e2e8f0',
            backgroundColor: snapEnabled ? '#eff6ff' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: snapEnabled ? colors.primary : '#64748b' }}>
          <Magnet size={14} /> Einrasten
        </button>
        <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        {colorOptions.map(c => (
          <button key={c} onClick={() => setStrokeColor(c)}
            style={{ width: 22, height: 22, borderRadius: 6, border: strokeColor === c ? `2px solid ${colors.primary}` : '2px solid #e2e8f0', backgroundColor: c, cursor: 'pointer', padding: 0 }} />
        ))}
        {tool === 'text' && (
          <>
            <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
            <div style={{ position: 'relative', zIndex: showTextSizeMenu ? 9999 : 1 }}>
              <button onClick={() => { setShowTextSizeMenu(!showTextSizeMenu); setShowStrokeWidthMenu(false); setShowWallThicknessMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', minWidth: 80, justifyContent: 'space-between' }}>
                <span>{textFontSize}px</span><ChevronDown size={12} color="#94a3b8" />
              </button>
              {showTextSizeMenu && (
                <><div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setShowTextSizeMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: 4, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: 100, maxHeight: 300, overflowY: 'auto' }}>
                  {[9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 50].map(s => (
                    <button key={s} onClick={() => { setTextFontSize(s); setShowTextSizeMenu(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: textFontSize === s ? '#eff6ff' : 'transparent', color: textFontSize === s ? colors.primary : '#334155', fontSize: 13, textAlign: 'left', cursor: 'pointer', fontWeight: textFontSize === s ? 600 : 400 }}>
                      {s}px
                    </button>
                  ))}
                </div></>
              )}
            </div>
          </>
        )}
        <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        <div style={{ position: 'relative', zIndex: showStrokeWidthMenu ? 9999 : 1 }}>
          <button onClick={() => { setShowStrokeWidthMenu(!showStrokeWidthMenu); setShowWallThicknessMenu(false); setShowTextSizeMenu(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', minWidth: 70, justifyContent: 'space-between' }}>
            <span>{strokeWidth}px</span><ChevronDown size={12} color="#94a3b8" />
          </button>
          {showStrokeWidthMenu && (
            <><div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setShowStrokeWidthMenu(false)} />
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: 4, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: 90, maxHeight: 200, overflowY: 'auto' }}>
              {[1, 2, 3, 5, 8].map(w => (
                <button key={w} onClick={() => { setStrokeWidth(w); setShowStrokeWidthMenu(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: strokeWidth === w ? '#eff6ff' : 'transparent', color: strokeWidth === w ? colors.primary : '#334155', fontSize: 13, textAlign: 'left', cursor: 'pointer', fontWeight: strokeWidth === w ? 600 : 400 }}>
                  {w}px
                </button>
              ))}
            </div></>
          )}
        </div>
        {mode === 'technical' && (
          <>
            <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
            <div style={{ position: 'relative', zIndex: showWallThicknessMenu ? 9999 : 1 }}>
              <button onClick={() => { setShowWallThicknessMenu(!showWallThicknessMenu); setShowStrokeWidthMenu(false); setShowTextSizeMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', minWidth: 110, justifyContent: 'space-between' }}>
                <span>Wand {selectedEl?.type === 'wall' ? (selectedEl.wallThickness ?? wallThickness) : wallThickness}cm</span><ChevronDown size={12} color="#94a3b8" />
              </button>
              {showWallThicknessMenu && (
                <><div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} onClick={() => setShowWallThicknessMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 9999, marginTop: 4, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: 130, maxHeight: 280, overflowY: 'auto' }}>
                  {[6, 8, 10, 12, 15, 17.5, 20, 24, 30, 36.5, 40].map(w => (
                    <button key={w} onClick={() => { setWallThickness(w); if (selectedEl?.type === 'wall') changeSelectedWallThickness(w); setShowWallThicknessMenu(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: (selectedEl?.type === 'wall' ? (selectedEl.wallThickness ?? wallThickness) : wallThickness) === w ? '#eff6ff' : 'transparent', color: (selectedEl?.type === 'wall' ? (selectedEl.wallThickness ?? wallThickness) : wallThickness) === w ? colors.primary : '#334155', fontSize: 13, textAlign: 'left', cursor: 'pointer', fontWeight: (selectedEl?.type === 'wall' ? (selectedEl.wallThickness ?? wallThickness) : wallThickness) === w ? 600 : 400 }}>
                      Wand {w}cm
                    </button>
                  ))}
                </div></>
              )}
            </div>
            <button onClick={() => setDisplayUnit(u => u === 'cm' ? 'm' : 'cm')}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {displayUnit}
            </button>
          </>
        )}
        <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        <button onClick={() => setShowGrid(v => !v)} title="Raster"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
            backgroundColor: showGrid ? '#eff6ff' : '#fff', fontSize: 12, cursor: 'pointer', color: showGrid ? colors.primary : '#64748b' }}>
          {showGrid ? <Eye size={14} /> : <EyeOff size={14} />} Raster
        </button>
        {mode === 'technical' && (
          <button onClick={() => setShowDimensions(v => !v)} title="Maße"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
              backgroundColor: showDimensions ? '#eff6ff' : '#fff', fontSize: 12, cursor: 'pointer', color: showDimensions ? colors.primary : '#64748b' }}>
            {showDimensions ? <Eye size={14} /> : <EyeOff size={14} />} Maße
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={undo} disabled={undoStack.length === 0} title="Rückgängig" style={{ ...iconBtnStyle, opacity: undoStack.length === 0 ? 0.3 : 1 }}><RotateCcw size={16} /></button>
        <button onClick={redo} disabled={redoStack.length === 0} title="Wiederherstellen" style={{ ...iconBtnStyle, opacity: redoStack.length === 0 ? 0.3 : 1 }}><RotateCw size={16} /></button>
        <button onClick={() => setScale(s => Math.min(5, s * 1.2))} title="Hineinzoomen" style={iconBtnStyle}><ZoomIn size={16} /></button>
        <button onClick={() => setScale(s => Math.max(0.1, s * 0.8))} title="Herauszoomen" style={iconBtnStyle}><ZoomOut size={16} /></button>
        <button onClick={centerView} title="Zeichnung zentrieren" style={iconBtnStyle}><Crosshair size={16} /></button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} title="Ansicht zurücksetzen" style={iconBtnStyle}><Maximize2 size={16} /></button>
        {selectedElement && <button onClick={deleteSelected} title="Löschen" style={{ ...iconBtnStyle, color: '#EF4444' }}><Trash2 size={16} /></button>}
        <div style={{ width: 1, height: 28, backgroundColor: '#e2e8f0', margin: '0 4px' }} />
        <button onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Save size={14} /> Speichern
        </button>
      </div>
      {/* Hint bar */}
      {tool === 'select' && !selectedEl && (
        <div style={{ padding: '4px 16px', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Move size={12} /> <strong>Auswahl-Modus:</strong> Klicken = Auswählen, Ziehen = Verschieben. Anfasspunkte (●/□) ziehen = Größe ändern.
        </div>
      )}
      {/* Properties panel for selected element */}
      {selectedEl && (selectedEl.type === 'door' || selectedEl.type === 'window' || selectedEl.type === 'patio_door' || selectedEl.type === 'terrace' || selectedEl.type === 'rect' || selectedEl.type === 'circle') && (
        <div style={{ padding: '8px 16px', backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd', fontSize: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: colors.primary }}>
            <Edit2 size={14} /> Eigenschaften:
          </div>
          {(selectedEl.type === 'door' || selectedEl.type === 'window' || selectedEl.type === 'patio_door') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#64748b' }}>Breite:</span>
              <input type="number" value={Math.round((selectedEl.width ?? 60) * 2)} onChange={e => updateSelectedElementSize(Number(e.target.value) / 2)}
                style={{ width: 70, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none' }} />
              <span style={{ color: '#64748b', fontSize: 11 }}>cm</span>
            </div>
          )}
          {(selectedEl.type === 'terrace' || selectedEl.type === 'rect' || selectedEl.type === 'circle') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#64748b' }}>Breite:</span>
                <input type="number" value={Math.round((selectedEl.width ?? 200) * 2)} onChange={e => { pushUndo(); onElementsChange(elements.map(el => el.id === selectedEl.id ? { ...el, width: Number(e.target.value) / 2 } : el)); }}
                  style={{ width: 70, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none' }} />
                <span style={{ color: '#64748b', fontSize: 11 }}>cm</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#64748b' }}>Höhe:</span>
                <input type="number" value={Math.round((selectedEl.height ?? 120) * 2)} onChange={e => { pushUndo(); onElementsChange(elements.map(el => el.id === selectedEl.id ? { ...el, height: Number(e.target.value) / 2 } : el)); }}
                  style={{ width: 70, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none' }} />
                <span style={{ color: '#64748b', fontSize: 11 }}>cm</span>
              </div>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={deleteSelected} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 size={12} /> Löschen
            </button>
          </div>
        </div>
      )}
      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: getCursor() }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (dragMode !== 'none') { setDragMode('none'); setDragStart(null); setDragElementSnapshot(null); } }}
          onWheel={handleWheel} onContextMenu={e => e.preventDefault()} />
        {textPosition && (
          <div style={{ position: 'absolute', left: textPosition.x * scale + offset.x, top: textPosition.y * scale + offset.y, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 4, backgroundColor: '#fff', padding: 4, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <input autoFocus value={textInput} onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTextElement(); if (e.key === 'Escape') setTextPosition(null); }}
                placeholder="Text eingeben..." style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, width: 200, outline: 'none' }} />
              <button onClick={addTextElement} style={{ ...iconBtnStyle, backgroundColor: colors.primary, color: '#fff' }}>✓</button>
              <button onClick={() => setTextPosition(null)} style={iconBtnStyle}>✕</button>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', fontWeight: 600 }}>
          {Math.round(scale * 100)}%
        </div>
        {snapEnabled && (
          <div style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: 6, fontSize: 11, color: colors.primary, boxShadow: '0 1px 4px rgba(0,0,0,0.1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Magnet size={12} /> Einrasten aktiv
          </div>
        )}
      </div>
    </div>
  );
}

function distPointToLine(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2);
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 6, border: '1px solid #e2e8f0',
  backgroundColor: '#fff', cursor: 'pointer', color: '#334155',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProjectObjektplan() {
  const { id: projectId } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const ctx = useProjectPermissionContext();
  const pCanCreate = ctx?.isProjectOwner || ctx?.canCreate?.('documentation') || false;
  const pCanEdit = ctx?.isProjectOwner || ctx?.canEdit?.('documentation') || false;
  const pCanDelete = ctx?.isProjectOwner || ctx?.canDelete?.('documentation') || false;
  const [loading, setLoading] = useState(true);
  const [staircases, setStaircases] = useState<Staircase[]>([]);
  const [standaloneApartments, setStandaloneApartments] = useState<Apartment[]>([]);
  const [expandedStaircases, setExpandedStaircases] = useState<Set<string>>(new Set());
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [planMode, setPlanMode] = useState<PlanMode | null>(null);
  const [planElements, setPlanElements] = useState<CanvasElement[]>([]);

  const [isStaircaseModalOpen, setIsStaircaseModalOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isApartmentModalOpen, setIsApartmentModalOpen] = useState(false);
  const [isStandaloneAptModalOpen, setIsStandaloneAptModalOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [editingStaircase, setEditingStaircase] = useState<Staircase | null>(null);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [editingStandaloneApt, setEditingStandaloneApt] = useState<Apartment | null>(null);
  const [parentStaircaseId, setParentStaircaseId] = useState<string | null>(null);
  const [parentFloorId, setParentFloorId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLevel, setFormLevel] = useState('0');

  const { defaultVisibility, filterVisibleItems } = useContentVisibility(projectId, 'objektplan');

  useEffect(() => { if (projectId) loadData(); }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: scData, error: scError } = await supabase.from('building_staircases').select('*').eq('project_id', projectId).order('order', { ascending: true });
      if (scError) throw scError;
      const staircasesWithFloors: Staircase[] = [];
      for (const sc of (scData || [])) {
        const { data: flData } = await supabase.from('building_floors').select('*').eq('staircase_id', sc.id).order('level', { ascending: true });
        const floorsWithApts: Floor[] = [];
        for (const fl of (flData || [])) {
          const { data: aptData } = await supabase.from('building_apartments').select('*').eq('floor_id', fl.id).order('name', { ascending: true });
          const apartments: Apartment[] = [];
          for (const apt of (aptData || [])) {
            const { data: attData } = await supabase.from('building_attachments').select('*').eq('apartment_id', apt.id).order('uploaded_at', { ascending: false });
            apartments.push({ ...apt, attachments: attData || [] });
          }
          floorsWithApts.push({ ...fl, apartments });
        }
        staircasesWithFloors.push({ ...sc, floors: floorsWithApts });
      }
      setStaircases(staircasesWithFloors);

      // Standalone apartments
      const { data: saData } = await supabase.from('building_apartments').select('*').eq('project_id', projectId).is('floor_id', null).order('name', { ascending: true });
      const standaloneApts: Apartment[] = [];
      for (const apt of (saData || [])) {
        const { data: attData } = await supabase.from('building_attachments').select('*').eq('apartment_id', apt.id).order('uploaded_at', { ascending: false });
        standaloneApts.push({ ...apt, attachments: attData || [] });
      }
      setStandaloneApartments(standaloneApts);
    } catch (error) { console.error('Error loading building data:', error); } finally { setLoading(false); }
  };

  const handleSaveStaircase = async () => {
    if (!formName.trim() || !projectId) return;
    try {
      if (editingStaircase) { await supabase.from('building_staircases').update({ name: formName.trim() }).eq('id', editingStaircase.id); showToast('Treppenhaus aktualisiert', 'success'); }
      else { await supabase.from('building_staircases').insert({ project_id: projectId, name: formName.trim(), order: staircases.length }); showToast('Treppenhaus erstellt', 'success'); }
      setIsStaircaseModalOpen(false); setEditingStaircase(null); setFormName(''); loadData();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };

  const handleSaveFloor = async () => {
    if (!formName.trim() || !parentStaircaseId) return;
    try {
      if (editingFloor) { await supabase.from('building_floors').update({ name: formName.trim(), level: parseInt(formLevel) }).eq('id', editingFloor.id); showToast('Stockwerk aktualisiert', 'success'); }
      else { await supabase.from('building_floors').insert({ staircase_id: parentStaircaseId, name: formName.trim(), level: parseInt(formLevel) }); showToast('Stockwerk erstellt', 'success'); }
      setIsFloorModalOpen(false); setEditingFloor(null); setFormName(''); setFormLevel('0'); loadData();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };

  const handleSaveApartment = async () => {
    if (!formName.trim() || !parentFloorId) return;
    try {
      if (editingApartment) { await supabase.from('building_apartments').update({ name: formName.trim() }).eq('id', editingApartment.id); showToast('Wohnung aktualisiert', 'success'); }
      else { await supabase.from('building_apartments').insert({ floor_id: parentFloorId, name: formName.trim() }); showToast('Wohnung erstellt', 'success'); }
      setIsApartmentModalOpen(false); setEditingApartment(null); setFormName(''); loadData();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };

  const handleSaveStandaloneApartment = async () => {
    if (!formName.trim() || !projectId) return;
    try {
      if (editingStandaloneApt) { await supabase.from('building_apartments').update({ name: formName.trim() }).eq('id', editingStandaloneApt.id); showToast('Wohnung aktualisiert', 'success'); }
      else { await supabase.from('building_apartments').insert({ project_id: projectId, floor_id: null, name: formName.trim() }); showToast('Einzelne Wohnung erstellt', 'success'); }
      setIsStandaloneAptModalOpen(false); setEditingStandaloneApt(null); setFormName(''); loadData();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };

  const handleDeleteStaircase = async (sc: Staircase) => {
    if (!window.confirm(`Treppenhaus "${sc.name}" wirklich löschen?`)) return;
    try { await supabase.from('building_staircases').delete().eq('id', sc.id); showToast('Treppenhaus gelöscht', 'success'); loadData(); } catch { showToast('Fehler beim Löschen', 'error'); }
  };
  const handleDeleteFloor = async (fl: Floor) => {
    if (!window.confirm(`Stockwerk "${fl.name}" wirklich löschen?`)) return;
    try { await supabase.from('building_floors').delete().eq('id', fl.id); showToast('Stockwerk gelöscht', 'success'); loadData(); } catch { showToast('Fehler beim Löschen', 'error'); }
  };
  const handleDeleteApartment = async (apt: Apartment) => {
    if (!window.confirm(`Wohnung "${apt.name}" wirklich löschen?`)) return;
    try { await supabase.from('building_apartments').delete().eq('id', apt.id); showToast('Wohnung gelöscht', 'success'); if (selectedApartment?.id === apt.id) { setSelectedApartment(null); setPlanMode(null); } loadData(); } catch { showToast('Fehler beim Löschen', 'error'); }
  };

  const openPlan = (apt: Apartment, m: PlanMode) => {
    setSelectedApartment(apt); setPlanMode(m);
    const data = m === 'free' ? apt.floor_plan_data : apt.technical_plan_data;
    setPlanElements(data ? JSON.parse(data) : []);
  };
  const savePlan = async () => {
    if (!selectedApartment || !planMode) return;
    try {
      const field = planMode === 'free' ? 'floor_plan_data' : 'technical_plan_data';
      const { error } = await supabase.from('building_apartments').update({ [field]: JSON.stringify(planElements) }).eq('id', selectedApartment.id);
      if (error) throw error;
      showToast('Plan gespeichert', 'success'); loadData();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };
  const closePlan = () => { setSelectedApartment(null); setPlanMode(null); setPlanElements([]); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedApartment || !projectId) return;
    const file = e.target.files[0];
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `building-plans/${projectId}/${selectedApartment.id}/${generateId()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
      await supabase.from('building_attachments').insert({ apartment_id: selectedApartment.id, name: file.name, url: urlData.publicUrl, type: file.type, size: file.size });
      showToast('Anlage hochgeladen', 'success'); setIsAttachmentModalOpen(false); loadData();
    } catch { showToast('Fehler beim Hochladen', 'error'); }
  };
  const handleDeleteAttachment = async (att: Attachment) => {
    if (!window.confirm(`"${att.name}" wirklich löschen?`)) return;
    try { await supabase.from('building_attachments').delete().eq('id', att.id); showToast('Anlage gelöscht', 'success'); loadData(); } catch { showToast('Fehler beim Löschen', 'error'); }
  };

  const toggleStaircase = (id: string) => { setExpandedStaircases(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleFloor = (id: string) => { setExpandedFloors(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  // Reusable apartment card
  const renderApartmentCard = (apt: Apartment) => (
    <View key={apt.id} style={pageStyles.apartmentCard}>
      <View style={pageStyles.apartmentHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Home size={16} color="#8B5CF6" />
          <Text style={pageStyles.apartmentName}>{apt.name}</Text>
        </View>
        <View style={pageStyles.actionRow}>
          {pCanEdit && (
            <TouchableOpacity onPress={() => { if (apt.floor_id) { setEditingApartment(apt); setParentFloorId(apt.floor_id); setFormName(apt.name); setIsApartmentModalOpen(true); } else { setEditingStandaloneApt(apt); setFormName(apt.name); setIsStandaloneAptModalOpen(true); } }}>
              <Edit2 size={14} color="#64748b" />
            </TouchableOpacity>
          )}
          {pCanDelete && <TouchableOpacity onPress={() => handleDeleteApartment(apt)}><Trash2 size={14} color="#EF4444" /></TouchableOpacity>}
        </View>
      </View>
      <View style={pageStyles.planActions}>
        <TouchableOpacity style={pageStyles.planButton} onPress={() => openPlan(apt, 'free')}>
          <Pencil size={16} color={colors.primary} />
          <View><Text style={pageStyles.planButtonTitle}>Freies Zeichnen</Text><Text style={pageStyles.planButtonDesc}>Unbegrenzte Leinwand</Text></View>
          {apt.floor_plan_data && <View style={pageStyles.dataDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={pageStyles.planButton} onPress={() => openPlan(apt, 'technical')}>
          <Ruler size={16} color="#F59E0B" />
          <View><Text style={pageStyles.planButtonTitle}>Technischer Grundriss</Text><Text style={pageStyles.planButtonDesc}>Wände, Türen, Fenster mit Maßen</Text></View>
          {apt.technical_plan_data && <View style={pageStyles.dataDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={pageStyles.planButton} onPress={() => { setSelectedApartment(apt); setIsAttachmentModalOpen(true); }}>
          <Upload size={16} color="#22c55e" />
          <View><Text style={pageStyles.planButtonTitle}>Plan hochladen</Text><Text style={pageStyles.planButtonDesc}>PDF, Bild oder CAD anhängen</Text></View>
          {apt.attachments.length > 0 && <View style={[pageStyles.badge, { backgroundColor: '#dcfce7' }]}><Text style={[pageStyles.badgeText, { color: '#166534' }]}>{apt.attachments.length}</Text></View>}
        </TouchableOpacity>
      </View>
      {apt.attachments.length > 0 && (
        <View style={pageStyles.attachmentsList}>
          {apt.attachments.map(att => (
            <View key={att.id} style={pageStyles.attachmentItem}>
              <FileImage size={14} color="#64748b" />
              <Text style={pageStyles.attachmentName} numberOfLines={1}>{att.name}</Text>
              <Text style={pageStyles.attachmentSize}>{(att.size / 1024).toFixed(0)} KB</Text>
              <TouchableOpacity onPress={() => window.open(att.url, '_blank')}><Download size={14} color={colors.primary} /></TouchableOpacity>
              {pCanDelete && <TouchableOpacity onPress={() => handleDeleteAttachment(att)}><Trash2 size={14} color="#EF4444" /></TouchableOpacity>}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) return <View style={pageStyles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;

  // Plan view
  if (planMode && selectedApartment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000, backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <button onClick={closePlan} style={{ ...iconBtnStyle, border: 'none' }}><ArrowLeft size={20} /></button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{selectedApartment.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{planMode === 'free' ? 'Freies Zeichnen — Unbegrenzte Leinwand' : 'Technischer Grundriss — Wände, Türen, Fenster'}</div>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => setPlanMode(planMode === 'free' ? 'technical' : 'free')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            {planMode === 'free' ? <Ruler size={14} /> : <Pencil size={14} />}
            {planMode === 'free' ? 'Technischer Modus' : 'Freies Zeichnen'}
          </button>
        </div>
        <FloorPlanCanvas mode={planMode} elements={planElements} onElementsChange={setPlanElements} onSave={savePlan} />
      </div>
    );
  }

  // Main view
  const hasContent = staircases.length > 0 || standaloneApartments.length > 0;

  return (
    <View style={pageStyles.container}>
      <View style={pageStyles.header}>
        <View>
          <Text style={pageStyles.pageTitle}>Objektplan</Text>
          <Text style={pageStyles.pageSubtitle}>Treppenhäuser, Stockwerke, Wohnungen & Grundrisse</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {pCanCreate && (
            <>
              <Button variant="outline" onClick={() => { setFormName(''); setEditingStandaloneApt(null); setIsStandaloneAptModalOpen(true); }}>
                <Plus size={16} /> Einzelne Wohnung
              </Button>
              <Button onClick={() => { setFormName(''); setEditingStaircase(null); setIsStaircaseModalOpen(true); }}>
                <Plus size={16} /> Treppenhaus
              </Button>
            </>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {!hasContent ? (
          <Card style={pageStyles.emptyCard}>
            <View style={pageStyles.emptyState}>
              <Building2 size={48} color="#cbd5e1" />
              <Text style={pageStyles.emptyTitle}>Noch kein Gebäudeplan</Text>
              <Text style={pageStyles.emptyText}>Erstellen Sie ein Treppenhaus mit Stockwerken und Wohnungen, oder fügen Sie direkt eine einzelne Wohnung hinzu.</Text>
              {pCanCreate && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button variant="outline" onClick={() => { setFormName(''); setEditingStandaloneApt(null); setIsStandaloneAptModalOpen(true); }}><Plus size={16} /> Einzelne Wohnung</Button>
                <Button onClick={() => { setFormName(''); setEditingStaircase(null); setIsStaircaseModalOpen(true); }}><Plus size={16} /> Treppenhaus</Button>
              </View>
              )}
            </View>
          </Card>
        ) : (
          <>
            {standaloneApartments.length > 0 && (
              <Card style={pageStyles.staircaseCard}>
                <View style={[pageStyles.staircaseHeader, { backgroundColor: '#faf5ff' }]}>
                  <View style={pageStyles.staircaseHeaderLeft}>
                    <Home size={20} color="#8B5CF6" />
                    <Text style={pageStyles.staircaseName}>Einzelne Wohnungen</Text>
                    <View style={[pageStyles.badge, { backgroundColor: '#f3e8ff' }]}><Text style={[pageStyles.badgeText, { color: '#7c3aed' }]}>{standaloneApartments.length}</Text></View>
                  </View>
                  {pCanCreate && (
                  <TouchableOpacity style={pageStyles.smallBtn} onPress={() => { setFormName(''); setEditingStandaloneApt(null); setIsStandaloneAptModalOpen(true); }}>
                    <Plus size={14} color={colors.primary} /><Text style={pageStyles.smallBtnText}>Wohnung</Text>
                  </TouchableOpacity>
                  )}
                </View>
                <View style={{ padding: 12 }}>{standaloneApartments.map(apt => renderApartmentCard(apt))}</View>
              </Card>
            )}
            {staircases.map(sc => (
              <Card key={sc.id} style={pageStyles.staircaseCard}>
                <TouchableOpacity style={pageStyles.staircaseHeader} onPress={() => toggleStaircase(sc.id)}>
                  <View style={pageStyles.staircaseHeaderLeft}>
                    {expandedStaircases.has(sc.id) ? <ChevronDown size={20} color="#64748b" /> : <ChevronRight size={20} color="#64748b" />}
                    <Building2 size={20} color={colors.primary} />
                    <Text style={pageStyles.staircaseName}>{sc.name}</Text>
                    <View style={pageStyles.badge}><Text style={pageStyles.badgeText}>{sc.floors.length} Stockwerke</Text></View>
                  </View>
                  <View style={pageStyles.actionRow}>
                    {pCanCreate && (
                      <TouchableOpacity style={pageStyles.smallBtn} onPress={() => { setParentStaircaseId(sc.id); setFormName(''); setFormLevel('0'); setEditingFloor(null); setIsFloorModalOpen(true); }}>
                        <Plus size={14} color={colors.primary} /><Text style={pageStyles.smallBtnText}>Stockwerk</Text>
                      </TouchableOpacity>
                    )}
                    {pCanEdit && <TouchableOpacity onPress={() => { setEditingStaircase(sc); setFormName(sc.name); setIsStaircaseModalOpen(true); }}><Edit2 size={16} color="#64748b" /></TouchableOpacity>}
                    {pCanDelete && <TouchableOpacity onPress={() => handleDeleteStaircase(sc)}><Trash2 size={16} color="#EF4444" /></TouchableOpacity>}
                  </View>
                </TouchableOpacity>
                {expandedStaircases.has(sc.id) && sc.floors.map(fl => (
                  <View key={fl.id} style={pageStyles.floorSection}>
                    <TouchableOpacity style={pageStyles.floorHeader} onPress={() => toggleFloor(fl.id)}>
                      <View style={pageStyles.staircaseHeaderLeft}>
                        {expandedFloors.has(fl.id) ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                        <Layers size={18} color="#F59E0B" />
                        <Text style={pageStyles.floorName}>{fl.name}</Text>
                        <View style={[pageStyles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={[pageStyles.badgeText, { color: '#92400E' }]}>{fl.apartments.length} Wohnungen</Text></View>
                      </View>
                      <View style={pageStyles.actionRow}>
                        {pCanCreate && (
                          <TouchableOpacity style={pageStyles.smallBtn} onPress={() => { setParentFloorId(fl.id); setFormName(''); setEditingApartment(null); setIsApartmentModalOpen(true); }}>
                            <Plus size={14} color={colors.primary} /><Text style={pageStyles.smallBtnText}>Wohnung</Text>
                          </TouchableOpacity>
                        )}
                        {pCanEdit && <TouchableOpacity onPress={() => { setEditingFloor(fl); setParentStaircaseId(fl.staircase_id); setFormName(fl.name); setFormLevel(fl.level.toString()); setIsFloorModalOpen(true); }}><Edit2 size={14} color="#64748b" /></TouchableOpacity>}
                        {pCanDelete && <TouchableOpacity onPress={() => handleDeleteFloor(fl)}><Trash2 size={14} color="#EF4444" /></TouchableOpacity>}
                      </View>
                    </TouchableOpacity>
                    {expandedFloors.has(fl.id) && fl.apartments.map(apt => renderApartmentCard(apt))}
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modals */}
      <ModernModal visible={isStaircaseModalOpen} onClose={() => { setIsStaircaseModalOpen(false); setEditingStaircase(null); }} title={editingStaircase ? 'Treppenhaus bearbeiten' : 'Neues Treppenhaus'}>
        <View style={pageStyles.modalBody}>
          <Input label="Name *" value={formName} onChangeText={setFormName} placeholder="z.B. Treppenhaus A" />
          <View style={pageStyles.modalActions}>
            <Button variant="outline" onClick={() => { setIsStaircaseModalOpen(false); setEditingStaircase(null); }} style={{ flex: 1 }}>Abbrechen</Button>
            <Button onClick={handleSaveStaircase} style={{ flex: 1 }}>{editingStaircase ? 'Speichern' : 'Erstellen'}</Button>
          </View>
        </View>
      </ModernModal>

      <ModernModal visible={isFloorModalOpen} onClose={() => { setIsFloorModalOpen(false); setEditingFloor(null); }} title={editingFloor ? 'Stockwerk bearbeiten' : 'Neues Stockwerk'}>
        <View style={pageStyles.modalBody}>
          <Input label="Name *" value={formName} onChangeText={setFormName} placeholder="z.B. Erdgeschoss, 1. OG" />
          <Input label="Etage (Zahl)" value={formLevel} onChangeText={setFormLevel} placeholder="0 = EG, 1 = 1. OG, -1 = Keller" />
          <View style={pageStyles.modalActions}>
            <Button variant="outline" onClick={() => { setIsFloorModalOpen(false); setEditingFloor(null); }} style={{ flex: 1 }}>Abbrechen</Button>
            <Button onClick={handleSaveFloor} style={{ flex: 1 }}>{editingFloor ? 'Speichern' : 'Erstellen'}</Button>
          </View>
        </View>
      </ModernModal>

      <ModernModal visible={isApartmentModalOpen} onClose={() => { setIsApartmentModalOpen(false); setEditingApartment(null); }} title={editingApartment ? 'Wohnung bearbeiten' : 'Neue Wohnung'}>
        <View style={pageStyles.modalBody}>
          <Input label="Name *" value={formName} onChangeText={setFormName} placeholder="z.B. Whg. 1.01, Penthouse" />
          <View style={pageStyles.modalActions}>
            <Button variant="outline" onClick={() => { setIsApartmentModalOpen(false); setEditingApartment(null); }} style={{ flex: 1 }}>Abbrechen</Button>
            <Button onClick={handleSaveApartment} style={{ flex: 1 }}>{editingApartment ? 'Speichern' : 'Erstellen'}</Button>
          </View>
        </View>
      </ModernModal>

      <ModernModal visible={isStandaloneAptModalOpen} onClose={() => { setIsStandaloneAptModalOpen(false); setEditingStandaloneApt(null); }} title={editingStandaloneApt ? 'Wohnung bearbeiten' : 'Einzelne Wohnung erstellen'}>
        <View style={pageStyles.modalBody}>
          <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Erstellen Sie eine Wohnung ohne Treppenhaus-Struktur — ideal wenn Sie nur an einer einzelnen Wohnung arbeiten.</Text>
          <Input label="Name *" value={formName} onChangeText={setFormName} placeholder="z.B. Whg. Musterstraße 12" />
          <View style={pageStyles.modalActions}>
            <Button variant="outline" onClick={() => { setIsStandaloneAptModalOpen(false); setEditingStandaloneApt(null); }} style={{ flex: 1 }}>Abbrechen</Button>
            <Button onClick={handleSaveStandaloneApartment} style={{ flex: 1 }}>{editingStandaloneApt ? 'Speichern' : 'Erstellen'}</Button>
          </View>
        </View>
      </ModernModal>

      <ModernModal visible={isAttachmentModalOpen} onClose={() => setIsAttachmentModalOpen(false)} title="Plan hochladen">
        <View style={pageStyles.modalBody}>
          <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Laden Sie einen fertigen Plan als PDF, Bild oder CAD-Datei hoch.</Text>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, border: '2px dashed #e2e8f0', borderRadius: 12, cursor: 'pointer', backgroundColor: '#f8fafc' }}>
            <Upload size={32} color="#94a3b8" />
            <span style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>Datei auswählen oder hierher ziehen</span>
            <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>PDF, PNG, JPG, DWG, DXF</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          {selectedApartment && selectedApartment.attachments.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 }}>Vorhandene Anlagen</Text>
              {selectedApartment.attachments.map(att => (
                <View key={att.id} style={pageStyles.attachmentItem}>
                  <FileImage size={14} color="#64748b" />
                  <Text style={pageStyles.attachmentName} numberOfLines={1}>{att.name}</Text>
                  {pCanDelete && <TouchableOpacity onPress={() => handleDeleteAttachment(att)}><Trash2 size={14} color="#EF4444" /></TouchableOpacity>}
                </View>
              ))}
            </View>
          )}
        </View>
      </ModernModal>
    </View>
  );
}

const pageStyles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
  emptyCard: { padding: 48 },
  emptyState: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155' },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', maxWidth: 400 },
  staircaseCard: { marginBottom: 16, padding: 0, overflow: 'hidden' },
  staircaseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  staircaseHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  staircaseName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  badge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#1d4ed8' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#EFF6FF' },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  floorSection: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  floorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, paddingLeft: 40, backgroundColor: '#fff' },
  floorName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  apartmentCard: { marginLeft: 16, marginRight: 16, marginBottom: 12, padding: 14, backgroundColor: '#fafbfc', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  apartmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  apartmentName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  planActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  planButton: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  planButtonTitle: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  planButtonDesc: { fontSize: 11, color: '#94a3b8' },
  dataDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', position: 'absolute', top: 8, right: 8 },
  attachmentsList: { marginTop: 10, gap: 4 },
  attachmentItem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  attachmentName: { flex: 1, fontSize: 13, color: '#334155' },
  attachmentSize: { fontSize: 11, color: '#94a3b8' },
  modalBody: { gap: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
