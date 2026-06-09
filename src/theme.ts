import type { MobileConfig } from './types'

export interface ChatTheme {
  primaryColor: string
  primaryColorStart: string | null
  primaryColorEnd: string | null
  isGradient: boolean
  // Пузыри
  outboundBg: string
  inboundBg: string
  outboundText: string
  inboundText: string
  // UI
  background: string
  inputBg: string
  inputBorder: string
  inputText: string
  systemText: string
  headerBg: string
  headerText: string
  sendButtonBg: string
}

export function buildTheme(config: MobileConfig | null): ChatTheme {
  const primary = config?.themeColor ?? '#2d8ef0'
  const isGradient =
    config?.colorType === 'gradient' &&
    !!config?.colorStart &&
    !!config?.colorEnd

  return {
    primaryColor: primary,
    primaryColorStart: config?.colorStart ?? null,
    primaryColorEnd: config?.colorEnd ?? null,
    isGradient,
    outboundBg: primary,
    inboundBg: '#f0f0f5',
    outboundText: '#ffffff',
    inboundText: '#1a1a1a',
    background: '#ffffff',
    inputBg: '#f7f7f9',
    inputBorder: '#e0e0e8',
    inputText: '#1a1a1a',
    systemText: '#9999aa',
    headerBg: primary,
    headerText: '#ffffff',
    sendButtonBg: primary,
  }
}
