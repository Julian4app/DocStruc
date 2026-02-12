import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Pause, Mic } from 'lucide-react';
import { colors } from '@docstruc/theme';

// Generate stable random waveform heights so they don't flicker on re-render
function generateWaveformHeights(count: number): number[] {
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    heights.push(Math.random() * 60 + 40);
  }
  return heights;
}

interface VoicePlayerProps {
  audioUrl: string;
  duration?: number | null;
  isCompact?: boolean;
}

export function VoicePlayer({ audioUrl, duration, isCompact = false }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Memoize waveform heights so they stay stable across re-renders
  const barCount = isCompact ? 30 : 40;
  const waveformHeights = useMemo(() => generateWaveformHeights(barCount), [barCount]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    
    console.log('[VoicePlayer] Loading audio from URL:', audioUrl);

    // Store handler references for proper cleanup (prevents memory leaks)
    const onLoadedMetadata = () => {
      console.log('[VoicePlayer] Audio loaded successfully. Duration:', audio.duration);
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(Math.floor(audio.duration));
      }
      setLoadError(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = (e: ErrorEvent) => {
      console.error('[VoicePlayer] Audio load error for URL:', audioUrl);
      console.error('[VoicePlayer] Error details:', {
        error: audio.error,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src
      });
      setLoadError(true);
      setIsPlaying(false);
    };

    // For Supabase public URLs we may need crossOrigin
    if (!audioUrl.startsWith('blob:')) {
      audio.crossOrigin = 'anonymous';
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Set the source after attaching listeners
    audio.src = audioUrl;
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.src = ''; // Release the resource
    };
  }, [audioUrl]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Playback error:', err);
      setLoadError(true);
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <TouchableOpacity 
        style={[
          styles.playButton, 
          isCompact && styles.playButtonCompact,
          loadError && styles.errorButton,
        ]} 
        onPress={togglePlayPause}
        disabled={loadError}
      >
        {loadError ? (
          <Text style={{ fontSize: 14, color: '#DC2626' }}>!</Text>
        ) : isPlaying ? (
          <Pause size={isCompact ? 16 : 20} color={colors.primary} fill={colors.primary} />
        ) : (
          <Play size={isCompact ? 16 : 20} color={colors.primary} fill={colors.primary} />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        
        {/* Waveform visualization with stable heights */}
        <View style={styles.waveform}>
          {waveformHeights.map((height, index) => {
            const isPassed = (index / barCount) * 100 <= progress;
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  isCompact && styles.waveformBarCompact,
                  {
                    height: `${height}%`,
                    backgroundColor: isPassed ? colors.primary : '#CBD5E1',
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <Text style={[styles.duration, isCompact && styles.durationCompact]}>
        {loadError ? 'Fehler' : `${formatTime(currentTime)} / ${formatTime(totalDuration)}`}
      </Text>
    </View>
  );
}

interface VoiceRecorderProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ isRecording, onStart, onStop, disabled }: VoiceRecorderProps) {
  const [duration, setDuration] = useState(0);
  const animationRef = useRef<number>();

  // Stable waveform for non-recording state
  const idleHeights = useMemo(() => generateWaveformHeights(40), []);

  useEffect(() => {
    let startTime = Date.now();
    
    if (isRecording) {
      const updateDuration = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);
        animationRef.current = requestAnimationFrame(updateDuration);
      };
      animationRef.current = requestAnimationFrame(updateDuration);
    } else {
      setDuration(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.playButton, isRecording && styles.recordingButton]} 
        onPress={isRecording ? onStop : onStart}
        disabled={disabled}
      >
        {isRecording ? (
          <View style={styles.stopIcon} />
        ) : (
          <Mic size={20} color={isRecording ? '#fff' : colors.primary} />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {/* Waveform visualization during recording */}
        <View style={styles.waveform}>
          {idleHeights.map((idleHeight, index) => {
            // During recording, use a deterministic sine wave animation; when idle, use stable heights
            const height = isRecording ? (Math.sin(Date.now() / 200 + index) * 30 + 50) : idleHeight * 0.3;
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: `${Math.max(height, 10)}%`,
                    backgroundColor: isRecording ? colors.primary : '#CBD5E1',
                    opacity: isRecording ? 1 : 0.5,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <Text style={[styles.duration, isRecording && styles.recordingDuration]}>
        {formatTime(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 56,
  },
  containerCompact: {
    padding: 8,
    minHeight: 48,
    gap: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  recordingButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  errorButton: {
    borderColor: '#DC2626',
  },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  waveformContainer: {
    flex: 1,
    height: 40,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
    transform: [{ translateY: -1 }],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: '100%',
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
    transition: 'height 0.15s ease, background-color 0.2s ease',
  },
  waveformBarCompact: {
    minWidth: 1.5,
    gap: 1.5,
  },
  duration: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    minWidth: 70,
    textAlign: 'right',
    fontVariant: ['tabular-nums'] as any,
  },
  durationCompact: {
    fontSize: 12,
    minWidth: 60,
  },
  recordingDuration: {
    color: colors.primary,
    fontWeight: '600',
  },
});
