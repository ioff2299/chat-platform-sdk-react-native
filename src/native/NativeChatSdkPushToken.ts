import { NativeModules, Platform, TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

export interface Spec extends TurboModule {
  getToken(): Promise<string>
}

const MODULE_NAME = 'ChatSdkPushToken'

function loadModule(): Spec | null {
  try {
    return TurboModuleRegistry.get<Spec>(MODULE_NAME)
  } catch {
    return (NativeModules[MODULE_NAME] as Spec | undefined) ?? null
  }
}

const moduleRef = loadModule()

export default moduleRef

export type PushPlatform = 'fcm' | 'apns'

/** Платформа доставки пушей для текущей ОС. */
export function nativePushPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? 'apns' : 'fcm'
}

/**
 * @react-native-firebase/messaging на стороне приложения.
 */
export async function getNativeDeviceToken(): Promise<string> {
  if (!moduleRef) {
    throw new Error(
      'ChatSdkPushToken: нативный модуль недоступен. Пересоберите приложение ' +
        '(на Android нужен google-services.json, на iOS — capability Push Notifications), ' +
        'либо передайте токен в registerPushToken(token, platform) вручную.',
    )
  }
  return moduleRef.getToken()
}