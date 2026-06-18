import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native'
import { attachmentDisplayName, type AttachmentDownloadHandler } from '../attachmentUtils'
import type { GalleryAttachment } from '../types'
import type { ChatTheme } from '../theme'

const { width: SW, height: SH } = Dimensions.get('window')

const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 0.8
const PAGE_DISTANCE = SW / 4
const PAGE_VELOCITY = 0.3
const AXIS_LOCK = 6
const EDGE_RESISTANCE = 0.3

interface Props {
  attachments: GalleryAttachment[]
  initialIndex: number
  visible: boolean
  onClose: () => void
  downloadLabel?: string
  onDownloadAttachment: AttachmentDownloadHandler
  theme: ChatTheme
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function GallerySlide({ item, isVisible }: { item: GalleryAttachment; isVisible: boolean }) {
  const [loading, setLoading] = useState(true)
  const displayName = attachmentDisplayName(item)

  if (item.type === 'image') {
    return (
      <View style={slide.root}>
        {loading && isVisible && (
          <ActivityIndicator color="#fff" size="large" style={StyleSheet.absoluteFill} />
        )}
        <Image
          source={{ uri: item.url }}
          style={slide.image}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
      </View>
    )
  }

  return (
    <View style={[slide.root, slide.doc]}>
      <Text style={slide.docName} numberOfLines={6}>{displayName}</Text>
      {item.size > 0 && (
        <Text style={slide.docSize}>{formatBytes(item.size)}</Text>
      )}
    </View>
  )
}

export function AttachmentGallery({
  attachments,
  initialIndex,
  visible,
  onClose,
  downloadLabel = 'Скачать',
  onDownloadAttachment,
  theme,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isDownloading, setIsDownloading] = useState(false)

  const count = attachments.length
  const current = attachments[currentIndex]

  const translateX = useRef(new Animated.Value(-initialIndex * SW)).current
  const translateY = useRef(new Animated.Value(0)).current

  const indexRef = useRef(initialIndex)
  const startXRef = useRef(-initialIndex * SW)
  const axisRef = useRef<'x' | 'y' | null>(null)
  const countRef = useRef(count)
  countRef.current = count

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const backdropOpacity = translateY.interpolate({
    inputRange: [-SH, 0, SH],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  })
  const chromeOpacity = translateY.interpolate({
    inputRange: [-DISMISS_DISTANCE, 0, DISMISS_DISTANCE],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  })

  const goTo = useCallback(
    (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(index, countRef.current - 1))
      indexRef.current = clamped
      setCurrentIndex(clamped)
      const toValue = -clamped * SW
      if (animated) {
        Animated.timing(translateX, {
          toValue,
          duration: 200,
          useNativeDriver: false,
        }).start()
      } else {
        translateX.setValue(toValue)
      }
    },
    [translateX],
  )

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        axisRef.current = null
        startXRef.current = -indexRef.current * SW
        translateY.setValue(0)
      },
      onPanResponderMove: (_, g) => {
        if (!axisRef.current) {
          if (Math.abs(g.dx) < AXIS_LOCK && Math.abs(g.dy) < AXIS_LOCK) return
          axisRef.current = Math.abs(g.dy) > Math.abs(g.dx) ? 'y' : 'x'
        }
        if (axisRef.current === 'y') {
          translateY.setValue(g.dy)
          return
        }
        const minX = -(countRef.current - 1) * SW
        const maxX = 0
        let x = startXRef.current + g.dx
        if (x > maxX) x = maxX + (x - maxX) * EDGE_RESISTANCE
        else if (x < minX) x = minX + (x - minX) * EDGE_RESISTANCE
        translateX.setValue(x)
      },
      onPanResponderRelease: (_, g) => {
        const axis = axisRef.current
        axisRef.current = null

        if (axis === 'y') {
          const shouldClose =
            Math.abs(g.dy) > DISMISS_DISTANCE || Math.abs(g.vy) > DISMISS_VELOCITY
          if (shouldClose) {
            Animated.timing(translateY, {
              toValue: g.dy >= 0 ? SH : -SH,
              duration: 200,
              useNativeDriver: false,
            }).start(() => onCloseRef.current())
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: false,
              bounciness: 0,
            }).start()
          }
          return
        }

        if (axis === 'x') {
          let target = indexRef.current
          if (
            (g.dx < -PAGE_DISTANCE || g.vx < -PAGE_VELOCITY) &&
            indexRef.current < countRef.current - 1
          ) {
            target = indexRef.current + 1
          } else if (
            (g.dx > PAGE_DISTANCE || g.vx > PAGE_VELOCITY) &&
            indexRef.current > 0
          ) {
            target = indexRef.current - 1
          }
          goTo(target)
          return
        }

        translateY.setValue(0)
      },
      onPanResponderTerminate: () => {
        axisRef.current = null
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 0,
        }).start()
        Animated.timing(translateX, {
          toValue: -indexRef.current * SW,
          duration: 150,
          useNativeDriver: false,
        }).start()
      },
    }),
  ).current

  useEffect(() => {
    if (visible) {
      indexRef.current = initialIndex
      setCurrentIndex(initialIndex)
      translateX.setValue(-initialIndex * SW)
      translateY.setValue(0)
    }
  }, [visible, initialIndex, translateX, translateY])

  const handleDownload = async () => {
    if (!current || isDownloading) return

    setIsDownloading(true)
    try {
      await onDownloadAttachment(current)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось скачать файл'
      Alert.alert('Ошибка', message)
    } finally {
      setIsDownloading(false)
    }
  }

  const counterText = count > 1 ? `${currentIndex + 1} / ${count}` : ''

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {Platform.OS === 'android' && (
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        )}

        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="none"
        />

        <Animated.View style={[styles.chrome, { opacity: chromeOpacity }]}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.header}>
              <View style={styles.headerSide} />
              <Text style={styles.counter}>{counterText}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>

        <Animated.View
          style={[
            styles.strip,
            { width: SW * Math.max(count, 1), transform: [{ translateX }, { translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {attachments.map((item, index) => (
            <View key={String(item.id)} style={styles.page}>
              <GallerySlide item={item} isVisible={index === currentIndex} />
            </View>
          ))}
        </Animated.View>

        {count > 1 && currentIndex > 0 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navLeft]}
            onPress={() => goTo(currentIndex - 1)}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.navIcon}>‹</Text>
          </TouchableOpacity>
        )}
        {count > 1 && currentIndex < count - 1 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navRight]}
            onPress={() => goTo(currentIndex + 1)}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.navIcon}>›</Text>
          </TouchableOpacity>
        )}

        {current && (
          <Animated.View style={[styles.footerChrome, { opacity: chromeOpacity }]}>
          <SafeAreaView style={styles.footerSafe}>
            <View style={styles.footer}>
              <View style={styles.meta}>
                <Text style={styles.metaName} numberOfLines={1}>
                  {attachmentDisplayName(current)}
                </Text>
                <Text style={styles.metaInfo}>
                  {[formatBytes(current.size), current.messageTime].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.downloadBtn, { backgroundColor: theme.primaryColor }]}
                onPress={() => void handleDownload()}
                activeOpacity={0.85}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.downloadIcon}>↓</Text>
                    <Text style={styles.downloadText}>{downloadLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          </Animated.View>
        )}
      </View>
    </Modal>
  )
}

const slide = StyleSheet.create({
  root: {
    width: SW,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SW,
    height: '100%',
  },
  doc: {
    paddingHorizontal: 32,
    gap: 12,
  },
  docName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  docSize: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
  },
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  chrome: {
    zIndex: 2,
  },
  headerSafe: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerSide: {
    width: 40,
  },
  counter: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  strip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  page: {
    width: SW,
    height: '100%',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  navLeft: { left: 4 },
  navRight: { right: 4 },
  navIcon: {
    color: '#fff',
    fontSize: 40,
    lineHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  footerChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  footerSafe: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  metaName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  metaInfo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
    flexShrink: 0,
  },
  downloadIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  downloadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})