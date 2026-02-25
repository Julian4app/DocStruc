/**
 * xlsxBuilder.ts
 * Builds styled .xlsx reports for DocStruc using ExcelJS (dynamically imported).
 * Mirrors the Flutter XLSX design: navy cover rows, logo, column widths,
 * navy header row, alternating data rows, borders, frozen pane.
 */

import type ExcelJSType from 'exceljs';

// ─── Design constants ────────────────────────────────────────────────────────
const NAVY        = { argb: 'FF0E2A47' };
const LIGHT_BLUE  = { argb: 'FFE0EAF4' };
const WHITE       = { argb: 'FFFFFFFF' };
const ALT_ROW     = { argb: 'FFF1F5F9' };
const BORDER_CLR  = { argb: 'FFCBD5E1' };
const TEXT_COLOR  = { argb: 'FF0F172A' };

const THIN_BORDER = { style: 'thin' as const, color: BORDER_CLR };
const ALL_BORDERS = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
};

// ─── Per-report column definitions ───────────────────────────────────────────
interface ColDef { header: string; key: string; width: number }

const COLS: Record<string, ColDef[]> = {
  status: [
    { header: 'Kennzahl',   key: 'metric', width: 28 },
    { header: 'Wert',       key: 'value',  width: 18 },
  ],
  tasks: [
    { header: 'Titel',         key: 'title',    width: 38 },
    { header: 'Status',        key: 'status',   width: 18 },
    { header: 'Priorität',     key: 'priority', width: 16 },
    { header: 'Zugewiesen an', key: 'assignee', width: 26 },
    { header: 'Fällig am',     key: 'due',      width: 18 },
    { header: 'Erstellt am',   key: 'created',  width: 22 },
  ],
  defects: [
    { header: 'Titel',          key: 'title',    width: 38 },
    { header: 'Status',         key: 'status',   width: 18 },
    { header: 'Priorität',      key: 'priority', width: 16 },
    { header: 'Verantwortlich', key: 'assignee', width: 26 },
    { header: 'Erstellt am',    key: 'created',  width: 22 },
  ],
  diary: [
    { header: 'Datum',       key: 'date',     width: 18 },
    { header: 'Wetter',      key: 'weather',  width: 18 },
    { header: 'Mitarbeiter', key: 'workers',  width: 12 },
    { header: 'Arbeiten',    key: 'work',     width: 50 },
    { header: 'Fortschritt', key: 'progress', width: 36 },
    { header: 'Ereignisse',  key: 'events',   width: 36 },
    { header: 'Erstellt von',key: 'creator',  width: 24 },
  ],
  documentation: [
    { header: 'Datum',       key: 'date',    width: 22 },
    { header: 'Inhalt',      key: 'content', width: 70 },
    { header: 'Erstellt von',key: 'creator', width: 24 },
  ],
  participants: [
    { header: 'Name',    key: 'name',  width: 30 },
    { header: 'E-Mail',  key: 'email', width: 36 },
    { header: 'Telefon', key: 'phone', width: 20 },
    { header: 'Rolle',   key: 'role',  width: 20 },
  ],
  timeline: [
    { header: 'Meilenstein',  key: 'title',       width: 32 },
    { header: 'Beschreibung', key: 'description', width: 42 },
    { header: 'Start',        key: 'start',       width: 18 },
    { header: 'Ende',         key: 'end',         width: 18 },
    { header: 'Typ',          key: 'type',        width: 18 },
  ],
  complete: [
    { header: 'Bereich',      key: 'section', width: 22 },
    { header: 'Titel',        key: 'title',   width: 38 },
    { header: 'Status',       key: 'status',  width: 18 },
    { header: 'Details',      key: 'details', width: 50 },
    { header: 'Datum',        key: 'date',    width: 22 },
  ],
};

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtD(s: string | null | undefined): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDT(s: string | null | undefined): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function personName(p: any): string {
  if (!p) return '-';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || '-';
}
const statusLabel        = (s: string) => ({ done: 'Erledigt', in_progress: 'In Bearb.', blocked: 'Blockiert', open: 'Offen' }[s] || s || '-');
const defectStatusLabel  = (s: string) => ({ done: 'Behoben', in_progress: 'In Bearb.', open: 'Offen' }[s] || s || '-');
const priorityLabel      = (p: string) => ({ high: 'Hoch', medium: 'Mittel', low: 'Niedrig', critical: 'Kritisch' }[p] || p || '-');
const milestoneTypeLabel = (t: string) => ({ deadline: 'Deadline', meeting: 'Meeting', milestone: 'Meilenstein' }[t] || 'Meilenstein');

// ─── Row data builders ────────────────────────────────────────────────────────
function buildRows(reportId: string, data: any): string[][] {
  switch (reportId) {
    case 'tasks':
      return (data.tasks || []).map((t: any) => [
        t.title || '',
        statusLabel(t.status),
        priorityLabel(t.priority),
        personName(t.profiles),
        t.due_date ? fmtD(t.due_date) : '-',
        fmtDT(t.created_at),
      ]);
    case 'defects':
      return (data.defects || []).map((t: any) => [
        t.title || '',
        defectStatusLabel(t.status),
        priorityLabel(t.priority),
        personName(t.profiles),
        fmtDT(t.created_at),
      ]);
    case 'diary':
      return (data.entries || []).map((e: any) => [
        fmtD(e.entry_date),
        e.weather || '',
        e.workers_present != null ? String(e.workers_present) : '',
        e.work_performed || '',
        e.progress_notes || '',
        e.special_events || '',
        personName(e.profiles),
      ]);
    case 'documentation':
      return (data.notes || []).map((n: any) => [
        fmtDT(n.created_at),
        (n.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        personName(n.profiles),
      ]);
    case 'participants':
      return (data.members || []).map((m: any) => [
        personName(m.profiles),
        m.profiles?.email || '-',
        m.profiles?.phone || '-',
        m.role || 'Mitglied',
      ]);
    case 'timeline':
      return (data.milestones || []).map((m: any) => [
        m.title || '',
        m.description || '-',
        m.start_date ? fmtD(m.start_date) : '',
        m.end_date   ? fmtD(m.end_date)   : '',
        milestoneTypeLabel(m.event_type),
      ]);
    case 'status': {
      const tasks    = data.tasks || [];
      const taskItems  = tasks.filter((t: any) => t.task_type !== 'defect');
      const defectItems = tasks.filter((t: any) => t.task_type === 'defect');
      const done = taskItems.filter((t: any) => t.status === 'done').length;
      const progress = taskItems.length > 0 ? Math.round((done / taskItems.length) * 100) : 0;
      return [
        ['Aufgaben gesamt',     String(taskItems.length)],
        ['Aufgaben erledigt',   String(done)],
        ['Fortschritt',         `${progress}%`],
        ['Mängel',              String(defectItems.length)],
        ['Teammitglieder',      String((data.members || []).length)],
        ['Bautagebuch-Einträge',String((data.diary || []).length)],
        ['Meilensteine',        String((data.milestones || []).length)],
      ];
    }
    case 'complete': {
      const rows: string[][] = [];
      const { tasks = [], members = [], diary = [], milestones = [] } = data;
      tasks.filter((t: any) => t.task_type !== 'defect').forEach((t: any) =>
        rows.push(['Aufgabe', t.title || '', statusLabel(t.status), priorityLabel(t.priority), fmtDT(t.created_at)]));
      tasks.filter((t: any) => t.task_type === 'defect').forEach((t: any) =>
        rows.push(['Mangel', t.title || '', defectStatusLabel(t.status), priorityLabel(t.priority), fmtDT(t.created_at)]));
      milestones.forEach((m: any) =>
        rows.push(['Meilenstein', m.title || '', milestoneTypeLabel(m.event_type), m.description || '', m.start_date ? fmtD(m.start_date) : '']));
      members.forEach((m: any) =>
        rows.push(['Team', personName(m.profiles), m.role || 'Mitglied', m.profiles?.email || '', '']));
      diary.forEach((e: any) =>
        rows.push(['Tagebuch', fmtD(e.entry_date), e.work_performed || '', personName(e.profiles), fmtDT(e.created_at)]));
      return rows;
    }
    default:
      return [];
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────
function applyNavyHeaderStyle(cell: ExcelJSType.Cell): void {
  cell.font   = { bold: true, color: WHITE, size: 11 };
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
}

function applyDataStyle(cell: ExcelJSType.Cell, altRow: boolean): void {
  cell.font   = { color: TEXT_COLOR, size: 10 };
  cell.fill   = altRow
    ? { type: 'pattern', pattern: 'solid', fgColor: ALT_ROW }
    : { type: 'pattern', pattern: 'none' };
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: 'top', wrapText: true };
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function buildXlsx(
  reportId:    string,
  data:        any,
  reportTitle: string,
  projectName: string,
): Promise<Blob> {
  // Dynamic import so ExcelJS is only loaded when the user actually exports XLSX
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = 'DocStruc';
  workbook.created  = new Date();
  workbook.modified = new Date();

  const cols    = COLS[reportId] || COLS['tasks'];
  const rows    = buildRows(reportId, data);
  const colCount = cols.length;
  const lastCol  = String.fromCharCode(64 + colCount); // e.g. "F" for 6 cols
  const exportDateStr = fmtDT(new Date().toISOString());

  const sheet = workbook.addWorksheet(reportTitle, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 5, xSplit: 0, topLeftCell: 'A6' }],
  });

  // ── Column widths ──
  sheet.columns = cols.map(c => ({ key: c.key, width: c.width }));

  // ── Cover row 1: Title (navy background) ──
  const titleRow = sheet.addRow([reportTitle]);
  titleRow.height = 32;
  titleRow.getCell(1).font      = { bold: true, color: WHITE, size: 16 };
  titleRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.mergeCells(`A1:${lastCol}1`);

  // ── Cover row 2: Project name (light-blue background) ──
  const projRow = sheet.addRow([projectName]);
  projRow.height = 22;
  projRow.getCell(1).font      = { bold: true, color: NAVY, size: 12 };
  projRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: LIGHT_BLUE };
  projRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.mergeCells(`A2:${lastCol}2`);

  // ── Cover row 3: Export date (navy background) ──
  const dateRow = sheet.addRow([`Exportiert am ${exportDateStr}  ·  DocStruc Baudokumentation`]);
  dateRow.height = 18;
  dateRow.getCell(1).font      = { color: { argb: 'FFCBD5E1' }, size: 10 };
  dateRow.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
  dateRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.mergeCells(`A3:${lastCol}3`);

  // ── Cover row 4: Spacer ──
  const spacerRow = sheet.addRow(['']);
  spacerRow.height = 6;
  spacerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: NAVY };
  sheet.mergeCells(`A4:${lastCol}4`);

  // ── Row 5: Header row ──
  const headerRow = sheet.addRow(cols.map(c => c.header));
  headerRow.height = 22;
  for (let c = 1; c <= colCount; c++) {
    applyNavyHeaderStyle(headerRow.getCell(c));
  }

  // ── Data rows ──
  rows.forEach((rowData, idx) => {
    const dataRow = sheet.addRow(rowData);
    dataRow.height = 18;
    const alt = idx % 2 === 1;
    for (let c = 1; c <= colCount; c++) {
      applyDataStyle(dataRow.getCell(c), alt);
    }
  });

  // ── Try to embed logo ──
  try {
    const response = await fetch('/Logo_plain_backg.png');
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
      sheet.addImage(imageId, {
        tl: { col: colCount - 1.95, row: 0 } as any,
        br: { col: colCount,        row: 1  } as any,
        editAs: 'oneCell',
      } as any);
    }
  } catch {
    // Logo embedding is optional — silently skip if unavailable
  }

  // ── Serialize to blob ──
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadXlsx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
