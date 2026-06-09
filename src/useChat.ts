import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatSDK } from './ChatSDK'
import { isSurveyEventSeen, markSurveyEventSeen, deleteSurveyEvent } from './surveyCache'
import type {
  AttachmentInput,
  ChatAttachment,
  ChatMessage,
  SurveyConfig,
} from './types'

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  isSending: boolean
  connected: boolean
  error: string | null
  survey: SurveyConfig | null
  sendMessage: (text: string, files?: AttachmentInput[]) => Promise<void>
  sendCallback: (messageId: number, callbackData: string) => Promise<void>
  submitSurvey: (rating: number, comment?: string) => Promise<void>
  dismissSurvey: () => void
  retry: () => void
}

function filterVisible(all: ChatMessage[]): ChatMessage[] {
  return all.filter((m) => !(m.type === 'event' && m.text === 'status_changed'))
}

export function useChat(): UseChatReturn {
  const [messages, setMessages]   = useState<ChatMessage[]>(() => filterVisible(ChatSDK.getMessages()))
  const [isLoading, setIsLoading] = useState(ChatSDK.getMessages().length === 0)
  const [isSending, setIsSending] = useState(false)
  const [connected, setConnected] = useState(ChatSDK.isRealtimeConnected())
  const [error, setError]         = useState<string | null>(null)
  const [survey, setSurvey]       = useState<SurveyConfig | null>(null)

  const api = ChatSDK.getApi()
  const lastCloseEventRef = useRef<string | null>(null)

  const checkSurvey = useCallback(
    async (eventMessageId: string, closeEventCreatedAt?: number) => {
      const contactId = api.getContactId()
      if (!contactId) return
      if (isSurveyEventSeen(contactId, eventMessageId)) return

      markSurveyEventSeen(contactId, eventMessageId)

      try {
        const cfg = await api.getSurveyConfig(closeEventCreatedAt)
        if (cfg.visible) {
          setSurvey(cfg as SurveyConfig)
        }
      } catch {
        deleteSurveyEvent(contactId, eventMessageId)
      }
    },
    [api],
  )

  useEffect(() => {
    const unsubMessages = ChatSDK.on('messagesUpdated', ({ messages: all }) => {
      setMessages(filterVisible(all))
      setIsLoading(false)
      setError(null)

      const closeEvent = all.findLast(
        (m) => m.type === 'event' && m.text === 'status_changed',
      )
      if (closeEvent && closeEvent.id !== lastCloseEventRef.current) {
        lastCloseEventRef.current = closeEvent.id
        void checkSurvey(closeEvent.id, closeEvent.createdAt)
      }
    })

    const unsubConnected = ChatSDK.on('connectedChange', (value) => setConnected(value))

    return () => {
      unsubMessages()
      unsubConnected()
    }
  }, [checkSurvey])

  useEffect(() => {
    void (async () => {
      try {
        const user = ChatSDK.getUser()
        await api.startDialog({
          name:    user?.name,
          surname: user?.surname,
          email:   user?.email,
          phone:   user?.phone,
        })
      } catch (e) {
        console.warn('ChatSDK: startDialog failed (non-fatal):', e)
      }
      try {
        await ChatSDK.refreshMessages()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
        setIsLoading(false)
      }
    })()
  }, [api])

  const sendMessage = useCallback(
    async (text: string, files?: AttachmentInput[]) => {
      if (!text.trim() && (!files || files.length === 0)) return
      setIsSending(true)
      setError(null)

      const tempId = `temp-${Date.now()}`
      const tempAttachments: ChatAttachment[] = (files ?? []).map((f, i) => ({
        id:       -(i + 1),
        url:      f.uri,
        filename: f.name,
        mime:     f.type,
        size:     f.size ?? 0,
        type:     f.type.startsWith('image/') ? 'image'
                : f.type.startsWith('video/') ? 'video'
                : f.type.startsWith('audio/') ? 'audio'
                : 'document',
      }))

      const tempMsg: ChatMessage = {
        id:          tempId,
        type:        'contact',
        text:        text.trim() || null,
        time:        new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
        createdAt:   Date.now(),
        attachments: tempAttachments,
      }
      setMessages((prev) => [...prev, tempMsg])

      try {
        await api.sendMessage(text, files)
        await ChatSDK.refreshMessages()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка отправки')
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      } finally {
        setIsSending(false)
      }
    },
    [api],
  )

  const sendCallback = useCallback(
    async (messageId: number, callbackData: string) => {
      try {
        await api.sendCallback(messageId, callbackData)
        await ChatSDK.refreshMessages()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка отправки')
      }
    },
    [api],
  )

  const submitSurvey = useCallback(
    async (rating: number, comment?: string) => {
      await api.submitCsi(rating, comment)
    },
    [api],
  )

  const dismissSurvey = useCallback(() => setSurvey(null), [])

  const retry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    void ChatSDK.refreshMessages().catch((e) => {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      setIsLoading(false)
    })
  }, [])

  return {
    messages,
    isLoading,
    isSending,
    connected,
    error,
    survey,
    sendMessage,
    sendCallback,
    submitSurvey,
    dismissSurvey,
    retry,
  }
}
