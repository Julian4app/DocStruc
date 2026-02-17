import React from 'react';
import { ActivityIndicator } from 'react-native';
import { colors } from '@docstruc/theme';

interface LoadMoreButtonProps {
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
  loadedCount: number;
  totalCount: number | null;
  label?: string;
}

export function LoadMoreButton({ onLoadMore, loading, hasMore, loadedCount, totalCount, label }: LoadMoreButtonProps) {
  if (!hasMore && loadedCount === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
      {hasMore ? (
        <button
          onClick={onLoadMore}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 24px',
            backgroundColor: loading ? '#F1F5F9' : '#ffffff',
            color: loading ? '#94a3b8' : colors.primary,
            border: `1px solid ${loading ? '#E2E8F0' : colors.primary}`,
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#EFF6FF';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }
          }}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#94a3b8" />
              Laden...
            </>
          ) : (
            label || 'Mehr laden'
          )}
        </button>
      ) : null}
      {totalCount !== null && totalCount > 0 && (
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
          {loadedCount} von {totalCount}{!hasMore ? ' — Alle geladen' : ''}
        </span>
      )}
    </div>
  );
}
