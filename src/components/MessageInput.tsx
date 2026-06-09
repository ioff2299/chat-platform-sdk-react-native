import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { INPUT_BOTTOM_PADDING } from '../safeArea'
import { pickFiles as defaultPickFiles } from '../filePicker'
import type { ChatTheme } from '../theme'
import type { AttachmentInput, ChatStrings } from '../types'

interface Props {
  theme: ChatTheme
  isSending: boolean
  onSend: (text: string, files: AttachmentInput[]) => void
  /** Переопределяет встроенный пикер (@react-native-documents/picker). */
  onPickFiles?: () => Promise<AttachmentInput[] | null>
  strings?: Pick<ChatStrings, 'inputPlaceholder' | 'sendingText'>
}

function docIcon(mime: string): string {
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎬'
  return '📎'
}

export function MessageInput({ theme, isSending, onSend, onPickFiles, strings }: Props) {
  const [text, setText]       = useState('')
  const [files, setFiles]     = useState<AttachmentInput[]>([])
  const [picking, setPicking] = useState(false)
  const inputRef              = useRef<TextInput>(null)

  const canSend     = (text.trim().length > 0 || files.length > 0) && !isSending
  const placeholder = strings?.inputPlaceholder ?? 'Сообщение…'
  const picker      = onPickFiles ?? defaultPickFiles

  const handlePickFiles = async () => {
    if (picking) return
    setPicking(true)
    try {
      const picked = await picker()
      if (picked && picked.length > 0) {
        setFiles((prev) => [...prev, ...picked])
      }
    } finally {
      setPicking(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = () => {
    if (!canSend) return
    const trimmed = text.trim()
    onSend(trimmed, files)
    setText('')
    setFiles([])
  }

  const inputBar = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderTopColor:  theme.inputBorder,
          paddingBottom:   INPUT_BOTTOM_PADDING,
        },
      ]}
    >
      {files.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filesStrip}
          contentContainerStyle={styles.filesStripContent}
        >
          {files.map((file, i) => (
            <View key={i} style={styles.filePreview}>
              {file.type.startsWith('image/') ? (
                <Image source={{ uri: file.uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewDoc, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <Text style={styles.previewDocIcon}>{docIcon(file.type)}</Text>
                  <Text style={[styles.previewDocName, { color: theme.inputText }]} numberOfLines={2}>
                    {file.name}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeFile(i)}
                hitSlop={6}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[styles.attachBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          onPress={handlePickFiles}
          disabled={picking || isSending}
          activeOpacity={0.7}
        >
          {picking ? (
            <ActivityIndicator color={theme.systemText} size="small" />
          ) : (
            <Svg
              width={20}
              height={20}
              viewBox="0 0 32 32"
              fill="none"
              stroke={theme.primaryColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M10 9 L10 24 C10 28 13 30 16 30 19 30 22 28 22 24 L22 6 C22 3 20 2 18 2 16 2 14 3 14 6 L14 23 C14 24 15 25 16 25 17 25 18 24 18 23 L18 9" />
            </Svg>
          )}
        </TouchableOpacity>

        <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.inputText }]}
            placeholder={placeholder}
            placeholderTextColor={theme.systemText}
            multiline
            maxLength={4000}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? theme.sendButtonBg : theme.inputBorder },
          ]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )

  if (Platform.OS === 'ios') {
    return (
      <SafeAreaView style={{ backgroundColor: theme.background }}>
        {inputBar}
      </SafeAreaView>
    )
  }

  return inputBar
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filesStrip: {
    maxHeight: 110,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  filesStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  filePreview: {
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  previewDoc: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  previewDocIcon: {
    fontSize: 24,
  },
  previewDocName: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    paddingHorizontal: 12,
    paddingTop:    10,
    paddingBottom: 0,
    gap:           8,
  },
  attachBtn: {
    width:        40,
    height:       40,
    borderRadius: 20,
    borderWidth:  1,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  inputWrap: {
    flex:             1,
    borderWidth:      1,
    borderRadius:     20,
    paddingHorizontal: 14,
    paddingVertical:  8,
    minHeight:        40,
    maxHeight:        120,
  },
  input: {
    fontSize:   15,
    lineHeight: 20,
    padding:    0,
  },
  sendBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  sendIcon: {
    color:      '#fff',
    fontSize:   18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
})
