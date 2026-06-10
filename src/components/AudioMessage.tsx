import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { audioController, type AudioPlaybackState } from '../audio/audioController'
import type { ChatAttachment } from '../types'
import type { ChatTheme } from '../theme'

interface Props {
  attachment: ChatAttachment
  isOutbound: boolean
  theme: ChatTheme
}

function attachmentKey(attachment: ChatAttachment): string {
  return attachment.id > 0 ? `a${attachment.id}` : `t${attachment.url}`
}

function formatTime(millis: number): string {
  if (!Number.isFinite(millis) || millis <= 0) return '0:00'
  const totalSeconds = Math.floor(millis / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function AudioMessage({ attachment, isOutbound, theme }: Props) {
  const key = attachmentKey(attachment)
  const [pb, setPb] = useState<AudioPlaybackState>(() => audioController.getState(key))
  const [trackWidth, setTrackWidth] = useState(0)

  useEffect(() => audioController.subscribe(key, setPb), [key])

  const isPlaying = pb.state === 'playing'
  const isLoading = pb.state === 'loading'
  const isError = pb.state === 'error'
  const duration = pb.durationMillis
  const position = pb.positionMillis
  const progress = duration > 0 ? Math.min(1, position / duration) : 0

  const accent = isOutbound ? '#ffffff' : theme.primaryColor
  const trackBg = isOutbound ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.12)'
  const timeColor = isOutbound ? 'rgba(255,255,255,0.75)' : theme.systemText
  const iconColor = isOutbound ? theme.primaryColor : '#ffffff'

  const onToggle = () => {
    if (isPlaying) {
      void audioController.pause(key)
    } else {
      void audioController.play(key, attachment.url)
    }
  }

  const onSeek = (e: GestureResponderEvent) => {
    if (duration <= 0 || trackWidth <= 0) return
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth))
    void audioController.seek(key, ratio * duration)
  }

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width)
  }

  const timeLabel = duration > 0
    ? `${formatTime(position)} / ${formatTime(duration)}`
    : isError
      ? 'Не удалось воспроизвести'
      : formatTime(position)

  return (
    <View style={styles.root}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: accent }]}
        onPress={onToggle}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : isPlaying ? (
          <PauseIcon color={iconColor} />
        ) : (
          <PlayIcon color={iconColor} />
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onSeek}
          onLayout={onTrackLayout}
          style={styles.trackWrap}
        >
          <View style={[styles.track, { backgroundColor: trackBg }]}>
            <View
              style={[styles.trackFill, { backgroundColor: accent, width: `${progress * 100}%` }]}
            />
            <View
              style={[
                styles.thumb,
                { backgroundColor: accent, left: `${progress * 100}%` },
              ]}
            />
          </View>
        </TouchableOpacity>
        <Text style={[styles.time, { color: timeColor }]}>{timeLabel}</Text>
      </View>
    </View>
  )
}

function PlayIcon({ color }: { color: string }) {
  return <View style={[styles.playTriangle, { borderLeftColor: color }]} />
}

function PauseIcon({ color }: { color: string }) {
  return (
    <View style={styles.pauseWrap}>
      <View style={[styles.pauseBar, { backgroundColor: color }]} />
      <View style={[styles.pauseBar, { backgroundColor: color }]} />
    </View>
  )
}

const BUTTON_SIZE = 40

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    paddingVertical: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  trackWrap: {
    paddingVertical: 8,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
  },
  time: {
    fontSize: 11,
    lineHeight: 14,
  },
  playTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 1,
  },
})