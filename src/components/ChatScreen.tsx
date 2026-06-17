import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getAndroidStatusBarHeight } from '../safeArea'
import { ChatSDK } from '../ChatSDK'
import { buildTheme, type ChatTheme } from '../theme'
import { useChat } from '../useChat'
import { resolveAttachmentType, type AttachmentDownloadHandler } from '../attachmentUtils'
import { defaultAttachmentDownloader } from '../downloaders/defaultAttachmentDownloader'
import type { AttachmentInput, ChatAttachment, ChatMessage, ChatStrings, GalleryAttachment } from '../types'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { SurveyOverlay } from './SurveyOverlay'
import { AttachmentGallery } from './AttachmentGallery'

interface Props {
  onClose?: () => void
  theme?: Partial<ChatTheme>
  strings?: ChatStrings
  /** Переопределяет встроенный пикер файлов (react-native-document-picker). */
  onPickFiles?: () => Promise<AttachmentInput[] | null>
  /** Переопределяет встроенное скачивание вложений из галереи. */
  onDownloadAttachment?: AttachmentDownloadHandler
}

const DEFAULT_STRINGS: Required<ChatStrings> = {
  headerTitle:      'Чат',
  emptyStateText:   'Начните диалог — оператор ответит в ближайшее время',
  inputPlaceholder: 'Сообщение…',
  sendingText:      'Отправка…',
  errorRetry:       'Повторить',
  surveyTitle:      'Оцените качество поддержки',
  surveySubmit:     'Отправить',
  surveySkip:       'Пропустить',
  surveyClose:      'Закрыть',
  galleryDownload:  'Скачать',
}

export function ChatScreen({
  onClose,
  theme: themeOverride,
  strings,
  onPickFiles,
  onDownloadAttachment,
}: Props) {
  const config    = ChatSDK.getSDKConfig()
  const baseTheme = buildTheme(config)
  const theme     = themeOverride ? { ...baseTheme, ...themeOverride } : baseTheme
  const listRef   = useRef<FlatList<ChatMessage>>(null)

  const t = { ...DEFAULT_STRINGS, ...strings }

  const {
    messages,
    isLoading,
    isSending,
    error,
    survey,
    sendMessage,
    sendCallback,
    submitSurvey,
    dismissSurvey,
    retry,
  } = useChat()

  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryVisible, setGalleryVisible] = useState(false)

  const galleryAttachments = useMemo<GalleryAttachment[]>(
    () =>
      messages.flatMap((m) =>
        (m.attachments ?? [])
          .filter((a) => a.id > 0 && resolveAttachmentType(a) !== 'audio')
          .map((a): GalleryAttachment => ({ ...a, messageTime: m.time })),
      ),
    [messages],
  )

  const openGallery = (attachment: ChatAttachment) => {
    const idx = galleryAttachments.findIndex((a) => a.id === attachment.id)
    setGalleryIndex(Math.max(0, idx))
    setGalleryVisible(true)
  }

  const showInitialLoader = isLoading && messages.length === 0
  const title = strings?.headerTitle ?? config?.widgetTitle ?? DEFAULT_STRINGS.headerTitle

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const handleInputFocus = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 250)
  }

  const headerContent = (
    <>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={8}>
          <Text style={[styles.backIcon, { color: theme.headerText }]}>‹</Text>
        </TouchableOpacity>
      )}
      {config?.imageLogo ? (
        <Image source={{ uri: config.imageLogo }} style={styles.logo} />
      ) : null}
      <Text
        style={[styles.headerTitle, { color: theme.headerText }]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
    </>
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {Platform.OS === 'ios' ? (
          <SafeAreaView style={{ backgroundColor: theme.headerBg }}>
            <View style={styles.header}>{headerContent}</View>
          </SafeAreaView>
        ) : (
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.headerBg,
                paddingTop: getAndroidStatusBarHeight() + 8,
              },
            ]}
          >
            {headerContent}
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retry}>
              <Text style={[styles.retryText, { color: theme.primaryColor }]}>
                {t.errorRetry}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showInitialLoader ? (
          <View style={styles.loader}>
            <ActivityIndicator color={theme.primaryColor} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                theme={theme}
                onButtonPress={(cbData, serverId) => void sendCallback(serverId, cbData)}
                onAttachmentPress={openGallery}
              />
            )}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.messageListEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: theme.systemText }]}>
                  {t.emptyStateText}
                </Text>
              </View>
            }
          />
        )}

        <MessageInput
          theme={theme}
          isSending={isSending}
          onSend={(text, files) => void sendMessage(text, files)}
          onPickFiles={onPickFiles}
          onInputFocus={handleInputFocus}
          strings={t}
        />
      </KeyboardAvoidingView>

      {survey && (
        <SurveyOverlay
          config={survey}
          theme={theme}
          strings={t}
          onSubmit={submitSurvey}
          onDismiss={dismissSurvey}
        />
      )}

      {galleryAttachments.length > 0 && (
        <AttachmentGallery
          attachments={galleryAttachments}
          initialIndex={galleryIndex}
          visible={galleryVisible}
          onClose={() => setGalleryVisible(false)}
          downloadLabel={t.galleryDownload}
          onDownloadAttachment={onDownloadAttachment ?? defaultAttachmentDownloader}
          theme={theme}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root:             { flex: 1 },
  flex:             { flex: 1 },
  list:             { flex: 1 },
  header: {
    flexDirection:      'row',
    alignItems:         'center',
    paddingHorizontal:  16,
    paddingBottom:      14,
    gap:                10,
    elevation:          2,
    shadowColor:        '#000',
    shadowOffset:       { width: 0, height: 1 },
    shadowOpacity:      0.12,
    shadowRadius:       3,
  },
  backBtn:          { padding: 4, flexShrink: 0 },
  backIcon:         { fontSize: 28, lineHeight: 28, fontWeight: '300' },
  logo:             { width: 32, height: 32, borderRadius: 16, flexShrink: 0 },
  headerTitle:      { fontSize: 17, fontWeight: '600', flex: 1, flexShrink: 1, minWidth: 0 },
  messageList:      { paddingTop: 12, paddingBottom: 8, flexGrow: 1 },
  messageListEmpty: { justifyContent: 'center' },
  loader:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: {
    alignItems:         'center',
    justifyContent:     'center',
    paddingHorizontal:  32,
    paddingVertical:    60,
  },
  emptyText:        { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorBanner: {
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    backgroundColor:    '#fff3f3',
    paddingHorizontal:  16,
    paddingVertical:    8,
    gap:                8,
  },
  errorText:        { color: '#cc2222', fontSize: 13, flex: 1 },
  retryText:        { fontSize: 13, fontWeight: '500' },
})
