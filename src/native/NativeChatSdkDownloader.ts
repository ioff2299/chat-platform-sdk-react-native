import { NativeEventEmitter, NativeModules, TurboModuleRegistry } from 'react-native'
import type { EventSubscription, TurboModule } from 'react-native'

export interface DownloadRequest {
  url: string
  filename: string
  mime: string
  headers: Record<string, string>
}

export interface DownloadProgress {
  id: string
  bytesWritten: number
  totalBytes: number
}

export interface Spec extends TurboModule {
  download(request: DownloadRequest): Promise<{ id: string; uri: string }>
  addListener(eventName: string): void
  removeListeners(count: number): void
}

const MODULE_NAME = 'ChatSdkDownloader'

function loadModule(): Spec | null {
  try {
    return TurboModuleRegistry.get<Spec>(MODULE_NAME)
  } catch {
    return (NativeModules[MODULE_NAME] as Spec | undefined) ?? null
  }
}

const moduleRef = loadModule()

export default moduleRef

let emitter: NativeEventEmitter | null = null

function getEmitter(): NativeEventEmitter | null {
  if (!moduleRef) return null
  if (!emitter) emitter = new NativeEventEmitter(moduleRef as unknown as never)
  return emitter
}

export function onDownloadProgress(
  handler: (event: DownloadProgress) => void,
): EventSubscription | null {
  return getEmitter()?.addListener('ChatSdkDownloadProgress', handler) ?? null
}
