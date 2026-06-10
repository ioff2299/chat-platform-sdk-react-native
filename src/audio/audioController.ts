import AudioModule, {
  onAudioState,
  type AudioStateEvent,
} from '../native/NativeChatSdkAudioPlayer'

export interface AudioPlaybackState {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  positionMillis: number
  durationMillis: number
}

type Listener = (state: AudioPlaybackState) => void

const IDLE: AudioPlaybackState = { state: 'idle', positionMillis: 0, durationMillis: 0 }

class AudioController {
  private listeners = new Map<string, Set<Listener>>()
  private states = new Map<string, AudioPlaybackState>()
  private activeKey: string | null = null
  private subscribed = false

  get isAvailable(): boolean {
    return !!AudioModule
  }

  private ensureSubscribed() {
    if (this.subscribed || !AudioModule) return
    this.subscribed = true
    onAudioState((event) => this.handleEvent(event))
  }

  private handleEvent(event: AudioStateEvent) {
    const prev = this.getState(event.key)
    let next: AudioPlaybackState

    switch (event.state) {
      case 'loading':
        next = { state: 'loading', positionMillis: 0, durationMillis: event.durationMillis }
        break
      case 'playing':
        next = {
          state: 'playing',
          positionMillis: event.positionMillis,
          durationMillis: event.durationMillis || prev.durationMillis,
        }
        break
      case 'paused':
        next = {
          state: 'paused',
          positionMillis: event.positionMillis,
          durationMillis: event.durationMillis || prev.durationMillis,
        }
        break
      case 'ended':
      case 'stopped':
        next = { state: 'idle', positionMillis: 0, durationMillis: event.durationMillis || prev.durationMillis }
        if (this.activeKey === event.key) this.activeKey = null
        break
      case 'error':
      default:
        next = { state: 'error', positionMillis: 0, durationMillis: 0 }
        if (this.activeKey === event.key) this.activeKey = null
        break
    }

    this.setState(event.key, next)
  }

  private setState(key: string, state: AudioPlaybackState) {
    this.states.set(key, state)
    this.listeners.get(key)?.forEach((listener) => listener(state))
  }

  getState(key: string): AudioPlaybackState {
    return this.states.get(key) ?? IDLE
  }

  subscribe(key: string, listener: Listener): () => void {
    this.ensureSubscribed()
    let set = this.listeners.get(key)
    if (!set) {
      set = new Set()
      this.listeners.set(key, set)
    }
    set.add(listener)
    listener(this.getState(key))
    return () => {
      set!.delete(listener)
      if (set!.size === 0) this.listeners.delete(key)
    }
  }

  async play(key: string, url: string, headers: Record<string, string> = {}): Promise<void> {
    if (!AudioModule) return
    this.ensureSubscribed()

    if (this.activeKey && this.activeKey !== key) {
      const prevKey = this.activeKey
      const prev = this.getState(prevKey)
      this.setState(prevKey, { state: 'idle', positionMillis: 0, durationMillis: prev.durationMillis })
    }
    this.activeKey = key

    const current = this.getState(key)
    if (current.state === 'idle' || current.state === 'error') {
      this.setState(key, { ...current, state: 'loading', positionMillis: 0 })
    }

    try {
      await AudioModule.play(key, url, headers)
    } catch {
      this.setState(key, { state: 'error', positionMillis: 0, durationMillis: 0 })
    }
  }

  async pause(key: string): Promise<void> {
    if (!AudioModule) return
    try {
      await AudioModule.pause(key)
    } catch {
    
    }
  }

  async seek(key: string, positionMillis: number): Promise<void> {
    if (!AudioModule) return
    try {
      await AudioModule.seek(key, positionMillis)
    } catch {
        
    }
  }

  async stop(key: string): Promise<void> {
    if (!AudioModule) return
    try {
      await AudioModule.stop(key)
    } catch {

    }
  }
}

export const audioController = new AudioController()