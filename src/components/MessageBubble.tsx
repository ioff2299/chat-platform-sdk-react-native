import React from 'react'
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { attachmentDisplayName } from '../attachmentUtils'
import type { ChatAttachment, ChatButton, ChatMessage } from '../types'
import type { ChatTheme } from '../theme'

interface Props {
  message: ChatMessage
  theme: ChatTheme
  onButtonPress?: (callbackData: string, serverMessageId: number) => void
  onAttachmentPress?: (attachment: ChatAttachment) => void
}

export function MessageBubble({ message, theme, onButtonPress, onAttachmentPress }: Props) {
  if (message.type === 'system' || message.type === 'event') {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, { color: theme.systemText }]}>
          {message.text}
        </Text>
      </View>
    )
  }

  const isOutbound = message.type === 'contact'

  return (
    <View style={[styles.row, isOutbound ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isOutbound
            ? [styles.outbound, { backgroundColor: theme.outboundBg }]
            : [styles.inbound, { backgroundColor: theme.inboundBg }],
        ]}
      >
        {!isOutbound && message.sender?.name ? (
          <Text style={[styles.senderName, { color: theme.primaryColor }]}>
            {message.sender.name}
          </Text>
        ) : null}

        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map((att, i) => (
              <AttachmentView
                key={att.id !== 0 ? att.id : `temp-${i}`}
                attachment={att}
                isOutbound={isOutbound}
                theme={theme}
                onPress={att.id > 0 ? () => onAttachmentPress?.(att) : undefined}
              />
            ))}
          </View>
        )}

        {message.text ? (
          <Text
            style={[
              styles.text,
              { color: isOutbound ? theme.outboundText : theme.inboundText },
            ]}
          >
            {message.text}
          </Text>
        ) : null}

        {message.buttons && message.buttons.length > 0 && (
          <View style={styles.buttons}>
            {message.buttons.map((btn, i) => (
              <BotButton
                key={i}
                button={btn}
                theme={theme}
                onPress={() =>
                  onButtonPress?.(btn.callback_data, message.serverMessageId ?? 0)
                }
              />
            ))}
          </View>
        )}

        <Text
          style={[
            styles.time,
            { color: isOutbound ? 'rgba(255,255,255,0.65)' : theme.systemText },
          ]}
        >
          {message.time}
        </Text>
      </View>
    </View>
  )
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function AttachmentView({
  attachment,
  isOutbound,
  theme,
  onPress,
}: {
  attachment: ChatAttachment
  isOutbound: boolean
  theme: ChatTheme
  onPress?: () => void
}) {
  if (attachment.type === 'image') {
    return (
      <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
        <Image
          source={{ uri: attachment.url }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>
    )
  }

  const nameColor = isOutbound ? theme.outboundText : theme.inboundText
  const sizeColor = isOutbound ? 'rgba(255,255,255,0.65)' : theme.systemText
  const displayName = attachmentDisplayName(attachment)

  return (
    <TouchableOpacity
      style={styles.fileBlock}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.fileName, { color: nameColor }]} numberOfLines={2}>
        {displayName}
      </Text>
      {attachment.size > 0 && (
        <Text style={[styles.fileSize, { color: sizeColor }]}>
          {formatBytes(attachment.size)}
        </Text>
      )}
    </TouchableOpacity>
  )
}

function BotButton({
  button,
  theme,
  onPress,
}: {
  button: ChatButton
  theme: ChatTheme
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.botButton, { borderColor: theme.primaryColor }]}
      onPress={onPress}
    >
      <Text style={[styles.botButtonText, { color: theme.primaryColor }]}>
        {button.text}
      </Text>
    </TouchableOpacity>
  )
}

const BUBBLE_MAX_WIDTH = Dimensions.get('window').width * 0.78

const styles = StyleSheet.create({
  row:          { flexDirection: 'row', marginVertical: 3, paddingHorizontal: 16 },
  rowRight:     { justifyContent: 'flex-end' },
  rowLeft:      { justifyContent: 'flex-start' },
  bubble: {
    maxWidth:         BUBBLE_MAX_WIDTH,
    minWidth:         56,
    borderRadius:     16,
    paddingHorizontal: 14,
    paddingTop:       10,
    paddingBottom:    8,
  },
  outbound:     { borderBottomRightRadius: 4 },
  inbound:      { borderBottomLeftRadius: 4 },
  senderName:   { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  text:         { fontSize: 15, lineHeight: 21 },
  time:         { fontSize: 11, lineHeight: 14, alignSelf: 'flex-end', marginTop: 6 },
  systemRow:    { alignItems: 'center', marginVertical: 8, paddingHorizontal: 16 },
  systemText:   { fontSize: 12, textAlign: 'center' },
  attachments:  { gap: 6, marginBottom: 4 },
  image:        { width: 200, height: 150, borderRadius: 8 },
  fileBlock: {
    gap: 2,
    minWidth: 120,
  },
  fileName: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  fileSize: { fontSize: 11, lineHeight: 15 },
  buttons:    { gap: 6, marginTop: 8 },
  botButton: {
    borderWidth:    1.5,
    borderRadius:   8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems:     'center',
  },
  botButtonText: { fontSize: 14, fontWeight: '500' },
})
