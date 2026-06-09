import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import type { SurveyConfig, ChatStrings } from '../types'
import type { ChatTheme } from '../theme'

interface Props {
  config: SurveyConfig
  theme: ChatTheme
  strings?: Pick<ChatStrings, 'surveyTitle' | 'surveySubmit' | 'surveySkip' | 'surveyClose' | 'sendingText'>
  onSubmit: (rating: number, comment?: string) => Promise<void>
  onDismiss: () => void
}

type Step = 'rating' | 'comment' | 'result' | 'exit_confirm'

function buildRange(from: number, to: number): number[] {
  if (from > to) return []
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

export function SurveyOverlay({ config, theme, strings, onSubmit, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('rating')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const [sending, setSending] = useState(false)

  const backdropAnim = useRef(new Animated.Value(0)).current
  const cardAnim    = useRef(new Animated.Value(0.88)).current
  const stepAnim    = useRef(new Animated.Value(1)).current

  const fullRange = buildRange(config.range[0], config.range[1])
  const badRange  = buildRange(config.badRange[0], config.badRange[1])

  const isBadRating   = config.badRangeEnabled && badRange.includes(rating)
  const needsComment  = config.commentEnabled && (config.badRangeEnabled ? isBadRating : rating > 0)

  const label = {
    title:   strings?.surveyTitle ?? config.title,
    submit:  strings?.surveySubmit  ?? 'Отправить',
    skip:    strings?.surveySkip    ?? 'Пропустить',
    close:   strings?.surveyClose   ?? 'Закрыть',
    sending: strings?.sendingText   ?? 'Отправка…',
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(cardAnim, {
        toValue:   1,
        damping:   18,
        stiffness: 260,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const animateStep = useCallback((fn: () => void) => {
    Animated.timing(stepAnim, {
      toValue:  0,
      duration: 160,
      easing:   Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      fn()
      Animated.timing(stepAnim, {
        toValue:  1,
        duration: 200,
        easing:   Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start()
    })
  }, [stepAnim])

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardAnim,     { toValue: 0.88, duration: 180, useNativeDriver: true }),
    ]).start(() => onDismiss())
  }, [backdropAnim, cardAnim, onDismiss])

  const handleStarPress = useCallback((score: number) => {
    setRating(score)
    const isBad = config.badRangeEnabled && badRange.includes(score)
    const msg   = isBad ? config.badMessage : config.goodMessage

    if (config.commentEnabled && (config.badRangeEnabled ? isBad : true)) {
      animateStep(() => {
        setResultMessage(msg)
        setStep('comment')
      })
    } else {
      animateStep(() => {
        setResultMessage(msg)
        setStep('result')
      })
      void handleAutoSubmit(score)
    }
  }, [config, badRange, animateStep])

  const handleAutoSubmit = async (score: number) => {
    try { await onSubmit(score) } catch {}
  }

  const handleSendComment = useCallback(async () => {
    if (config.commentRequired && !comment.trim()) return
    setSending(true)
    try {
      await onSubmit(rating, comment.trim() || undefined)
    } catch {}
    setSending(false)
    animateStep(() => {
      setResultMessage(config.afterCommentMessage)
      setStep('result')
    })
  }, [rating, comment, config, onSubmit, animateStep])

  const handleCloseAttempt = useCallback(() => {
    if (step === 'result') { dismiss(); return }
    if (rating > 0) { setStep('exit_confirm') } else { dismiss() }
  }, [step, rating, dismiss])

  const starCount = fullRange.length
  const starSize  = starCount <= 5 ? 44 : starCount <= 7 ? 36 : 28
  const starGap   = starCount <= 5 ? 10 : starCount <= 7 ? 7  : 5

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
      <TouchableWithoutFeedback onPress={handleCloseAttempt}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.card,
            { borderTopColor: theme.primaryColor },
            {
              opacity:   cardAnim,
              transform: [
                { scale:      cardAnim.interpolate({ inputRange: [0.88, 1], outputRange: [0.88, 1] }) },
                { translateY: cardAnim.interpolate({ inputRange: [0.88, 1], outputRange: [24, 0]   }) },
              ],
            },
          ]}
        >
          {/* Кнопка закрытия */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleCloseAttempt} hitSlop={12}>
            <Text style={[styles.closeBtnText, { color: theme.systemText }]}>✕</Text>
          </TouchableOpacity>

          {/* Заголовок */}
          <Text style={[styles.title, { color: theme.inboundText }]}>{label.title}</Text>
          {!!config.description && (
            <Text style={[styles.description, { color: theme.systemText }]}>{config.description}</Text>
          )}

          {/* Звёзды */}
          <View style={[styles.starsRow, { gap: starGap }]}>
            {fullRange.map((score) => {
              const filled = score <= rating
              return (
                <TouchableOpacity
                  key={score}
                  onPress={() => step === 'rating' && handleStarPress(score)}
                  activeOpacity={0.75}
                  disabled={step !== 'rating'}
                >
                  <StarIcon size={starSize} filled={filled} color={theme.primaryColor} />
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Анимированное содержимое шага */}
          <Animated.View
            style={{
              opacity:   stepAnim,
              transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            {step === 'rating' && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={dismiss}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipText, { color: theme.systemText }]}>{label.skip}</Text>
              </TouchableOpacity>
            )}

            {step === 'comment' && (
              <View style={styles.commentSection}>
                {!!resultMessage && (
                  <Text style={[styles.resultMsg, { color: theme.primaryColor }]}>{resultMessage}</Text>
                )}

                <TextInput
                  style={[
                    styles.commentInput,
                    {
                      borderColor:     theme.inputBorder,
                      color:           theme.inputText,
                      backgroundColor: theme.inputBg,
                    },
                  ]}
                  placeholder="Ваш комментарий..."
                  placeholderTextColor={theme.systemText}
                  multiline
                  numberOfLines={3}
                  value={comment}
                  onChangeText={setComment}
                  editable={!sending}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primaryColor },
                    (config.commentRequired && !comment.trim() || sending) && styles.btnDisabled,
                  ]}
                  onPress={handleSendComment}
                  disabled={config.commentRequired && !comment.trim() || sending}
                  activeOpacity={0.82}
                >
                  <Text style={styles.primaryBtnText}>
                    {sending ? label.sending : label.submit}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'result' && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultMsg, { color: theme.primaryColor }]}>{resultMessage}</Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.primaryColor }]}
                  onPress={dismiss}
                  activeOpacity={0.82}
                >
                  <Text style={styles.primaryBtnText}>{label.close}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Подтверждение выхода */}
          {step === 'exit_confirm' && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmBox}>
                <Text style={[styles.confirmText, { color: theme.inboundText }]}>
                  Вы хотите прекратить сбор обратной связи? Введённая оценка не будет отправлена.
                </Text>
                <View style={styles.confirmBtns}>
                  <TouchableOpacity
                    style={[styles.confirmSecondary, { borderColor: theme.primaryColor }]}
                    onPress={() => setStep(rating > 0 ? (needsComment ? 'comment' : 'result') : 'rating')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.confirmSecondaryText, { color: theme.primaryColor }]}>Продолжить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.primaryColor, flex: 1 }]}
                    onPress={dismiss}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.primaryBtnText}>Выйти</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  )
}

function StarIcon({ size, filled, color }: { size: number; filled: boolean; color: string }) {
  return (
    <View style={{ width: size, height: size }}>
      <Text
        style={{
          fontSize:  size * 0.88,
          lineHeight: size,
          textAlign: 'center',
          color:     filled ? color : '#d0d0dc',
        }}
      >
        ★
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          100,
    paddingHorizontal: 20,
  },
  kav: {
    width:      '100%',
    maxWidth:   480,
    alignItems: 'center',
  },
  card: {
    backgroundColor:  '#fff',
    borderRadius:     20,
    borderTopWidth:   5,
    paddingHorizontal: 24,
    paddingBottom:    28,
    paddingTop:       24,
    width:            '100%',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 10 },
    shadowOpacity:    0.18,
    shadowRadius:     24,
    elevation:        20,
  },
  closeBtn: {
    position: 'absolute',
    top:      14,
    right:    18,
    zIndex:   10,
    padding:  6,
  },
  closeBtnText: {
    fontSize:   18,
    fontWeight: '500',
  },
  title: {
    fontSize:     20,
    fontWeight:   '700',
    textAlign:    'center',
    marginBottom: 6,
    marginTop:    4,
    paddingRight: 28,
    lineHeight:   26,
  },
  description: {
    fontSize:     14,
    textAlign:    'center',
    marginBottom: 16,
    lineHeight:   20,
  },
  starsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    flexWrap:       'wrap',
    marginTop:      8,
    marginBottom:   4,
  },
  skipBtn: {
    alignSelf:  'center',
    marginTop:  16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize:   14,
    textDecorationLine: 'underline',
  },
  commentSection: {
    marginTop: 16,
    gap:       10,
  },
  resultSection: {
    marginTop:  16,
    alignItems: 'center',
    gap:        12,
  },
  resultMsg: {
    fontSize:   14,
    textAlign:  'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  commentInput: {
    borderWidth:  1.5,
    borderRadius: 12,
    padding:      12,
    fontSize:     15,
    minHeight:    88,
    lineHeight:   21,
  },
  primaryBtn: {
    borderRadius:    12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems:      'center',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.22,
    shadowRadius:    6,
    elevation:       4,
  },
  primaryBtnText: {
    color:         '#fff',
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity:      0.48,
    shadowOpacity: 0,
    elevation:    0,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius:    20,
    justifyContent:  'center',
    alignItems:      'center',
    zIndex:          20,
    padding:         24,
  },
  confirmBox: {
    backgroundColor: '#fff',
    borderRadius:    16,
    padding:         20,
    width:           '100%',
    maxWidth:        360,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.2,
    shadowRadius:    12,
    elevation:       10,
  },
  confirmText: {
    fontSize:     14,
    lineHeight:   20,
    textAlign:    'center',
    marginBottom: 16,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap:           10,
  },
  confirmSecondary: {
    flex:            1,
    borderWidth:     1.5,
    borderRadius:    12,
    paddingVertical: 12,
    alignItems:      'center',
  },
  confirmSecondaryText: {
    fontSize:   14,
    fontWeight: '600',
  },
})
