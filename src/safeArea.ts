import { Platform, StatusBar } from 'react-native'

/** Верхний отступ под status bar (Android). На iOS используйте SafeAreaView. */
export function getAndroidStatusBarHeight(): number {
  return StatusBar.currentHeight ?? 24
}

export const INPUT_BOTTOM_PADDING = Platform.select({ ios: 0, android: 12, default: 12 }) ?? 12
