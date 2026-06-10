import { NativeEventEmitter, NativeModules, TurboModuleRegistry } from 'react-native'
import type { EventSubscription, TurboModule } from 'react-native'

export type NativeAudioState =
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'stopped'
  | 'error'

export interface AudioStateEvent {
  key: string
  positionMillis: number
  durationMillis: number
  state: NativeAudioState
}

export interface Spec extends TurboModule {
  play(key: string, url: string, headers: Record<string, string>): Promise<void>
  pause(key: string): Promise<void>
  seek(key: string, positionMillis: number): Promise<void>
  stop(key: string): Promise<void>
  addListener(eventName: string): void
  removeListeners(count: number): void
}

const MODULE_NAME = 'ChatSdkAudioPlayer'

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

export function onAudioState(
  handler: (event: AudioStateEvent) => void,
): EventSubscription | null {
  return getEmitter()?.addListener('ChatSdkAudioState', handler) ?? null
}