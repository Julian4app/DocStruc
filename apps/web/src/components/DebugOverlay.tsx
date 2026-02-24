import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * TEMPORARY debug overlay — shows real-time state of every loading flag
 * in the app. Appears as a small floating panel in the bottom-right corner.
 *
 * DELETE THIS FILE once the loading bug is identified and fixed.
 */

interface DebugEntry {
  time: string;
  event: string;
}

// Global log that any component can push to
const debugLog: DebugEntry[] = [];
const MAX_LOG = 50;

export function debugPush(event: string) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  debugLog.unshift({ time, event });
  if (debugLog.length > MAX_LOG) debugLog.pop();
  // Trigger re-render of overlay
  window.dispatchEvent(new CustomEvent('debug-overlay-update'));
}

// Attach to window for easy access from other modules
(window as any).__debugPush = debugPush;

function getDOMSnapshot() {
  const root = document.getElementById('root');
  if (!root) return 'no #root';
  const h = root.offsetHeight;
  const w = root.offsetWidth;
  const children = root.children.length;
  const childInfo: string[] = [];
  for (let i = 0; i < Math.min(children, 3); i++) {
    const c = root.children[i] as HTMLElement;
    childInfo.push(`${c.tagName}(${c.offsetWidth}x${c.offsetHeight})`);
  }
  return `root:${w}x${h} ch=${children} [${childInfo.join(',')}]`;
}

export function DebugOverlay() {
  const { userId, loading: authLoading, profile } = useAuth();
  const [visibility, setVisibility] = useState(document.visibilityState);
  const [, forceUpdate] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const renderCount = useRef(0);
  renderCount.current++;

  // Listen for visibility changes
  useEffect(() => {
    const h = () => {
      setVisibility(document.visibilityState);
      debugPush(`visibility → ${document.visibilityState}`);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // Listen for debug log updates
  useEffect(() => {
    const h = () => forceUpdate(c => c + 1);
    window.addEventListener('debug-overlay-update', h);
    return () => window.removeEventListener('debug-overlay-update', h);
  }, []);

  // Periodic refresh to show elapsed time etc.
  useEffect(() => {
    const id = setInterval(() => forceUpdate(c => c + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const dot = (ok: boolean) => ok ? '🟢' : '🔴';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.92)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: collapsed ? 6 : 12,
        borderRadius: 8,
        maxWidth: collapsed ? 'auto' : 460,
        maxHeight: collapsed ? 'auto' : '70vh',
        overflowY: 'auto',
        pointerEvents: 'auto',
        lineHeight: 1.6,
        border: '1px solid #333',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 6, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
        <span style={{ fontWeight: 'bold', color: '#ff0' }}>🐛 DEBUG</span>
        <span style={{ color: '#888', marginLeft: 8 }}>{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ borderBottom: '1px solid #333', paddingBottom: 6, marginBottom: 6 }}>
            <div>{dot(!authLoading)} authLoading: <b>{String(authLoading)}</b></div>
            <div>{dot(!!userId)} userId: <b>{userId ? userId.slice(0, 8) + '…' : 'null'}</b></div>
            <div>{dot(!!profile)} profile: <b>{profile ? (profile.email || 'loaded') : 'null'}</b></div>
            <div>👁 visibility: <b>{visibility}</b></div>
            <div>🔄 renders: <b>{renderCount.current}</b></div>
            <div>📐 DOM: <b>{getDOMSnapshot()}</b></div>
          </div>

          <div style={{ borderBottom: '1px solid #333', paddingBottom: 6, marginBottom: 6 }}>
            <div style={{ color: '#ff0', marginBottom: 2 }}>
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => {
                e.stopPropagation();
                debugPush('MANUAL SNAPSHOT: ' + getDOMSnapshot());
                const url = window.location.href;
                debugPush('URL: ' + url);
                // Check if any spinner/loader is visible
                const loaders = document.querySelectorAll('[class*="lottie"], [class*="Lottie"], svg[class*="loading"]');
                debugPush('Lottie/loader elements: ' + loaders.length);
                // Check for "Kein Zugriff" text
                const body = document.body.innerText;
                if (body.includes('Kein Zugriff')) debugPush('⚠ "Kein Zugriff" text found!');
                if (body.includes('Something went wrong')) debugPush('⚠ ErrorBoundary triggered!');
                if (body.includes('login')) debugPush('⚠ Login page visible!');
                forceUpdate(c => c + 1);
              }}>📸 Take Snapshot</span>
            </div>
          </div>

          <div style={{ color: '#aaa', fontSize: 10 }}>
            <div style={{ color: '#ff0', marginBottom: 2 }}>Event Log ({debugLog.length}):</div>
            {debugLog.map((entry, i) => (
              <div key={i} style={{ color: entry.event.includes('ERROR') || entry.event.includes('COLLAPSE') || entry.event.includes('IGNORING') ? '#f66' : entry.event.includes('recovery') ? '#6af' : '#8f8' }}>
                <span style={{ color: '#666' }}>{entry.time}</span> {entry.event}
              </div>
            ))}
            {debugLog.length === 0 && <div style={{ color: '#666' }}>No events yet</div>}
          </div>
        </>
      )}
    </div>
  );
}
