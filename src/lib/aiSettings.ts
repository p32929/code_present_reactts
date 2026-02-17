export type TTSMode = 'none' | 'gemini'

export interface AISettings {
  textGenBaseUrl: string
  textGenApiKey: string
  textGenModel: string
  ttsApiKeys: string
  ttsModel: string
  ttsVoice: string
}

const PREFIX = 'ai-settings-'

const DEFAULTS: AISettings = {
  textGenBaseUrl: '',
  textGenApiKey: '',
  textGenModel: '',
  ttsApiKeys: '',
  ttsModel: '',
  ttsVoice: '',
}

export function getAISettings(): AISettings {
  return {
    textGenBaseUrl: localStorage.getItem(`${PREFIX}textGenBaseUrl`) || DEFAULTS.textGenBaseUrl,
    textGenApiKey: localStorage.getItem(`${PREFIX}textGenApiKey`) || DEFAULTS.textGenApiKey,
    textGenModel: localStorage.getItem(`${PREFIX}textGenModel`) || DEFAULTS.textGenModel,
    ttsApiKeys: localStorage.getItem(`${PREFIX}ttsApiKeys`) || DEFAULTS.ttsApiKeys,
    ttsModel: localStorage.getItem(`${PREFIX}ttsModel`) || DEFAULTS.ttsModel,
    ttsVoice: localStorage.getItem(`${PREFIX}ttsVoice`) || DEFAULTS.ttsVoice,
  }
}

export function saveAISettings(settings: Partial<AISettings>): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      localStorage.setItem(`${PREFIX}${key}`, value)
    }
  }
}

export function hasRequiredTextGenSettings(): boolean {
  const s = getAISettings()
  return !!(s.textGenBaseUrl && s.textGenApiKey)
}

export function getTTSApiKeys(): string[] {
  const s = getAISettings()
  return s.ttsApiKeys
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
}

export function hasRequiredTTSSettings(): boolean {
  const keys = getTTSApiKeys()
  const s = getAISettings()
  return keys.length > 0 && !!s.ttsModel && !!s.ttsVoice
}
