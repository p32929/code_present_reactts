export interface AISettings {
  textGenBaseUrl: string
  textGenApiKey: string
  textGenModel: string
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
}

const PREFIX = 'ai-settings-'

const DEFAULTS: AISettings = {
  textGenBaseUrl: '',
  textGenApiKey: '',
  textGenModel: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
}

export function getAISettings(): AISettings {
  return {
    textGenBaseUrl: localStorage.getItem(`${PREFIX}textGenBaseUrl`) || DEFAULTS.textGenBaseUrl,
    textGenApiKey: localStorage.getItem(`${PREFIX}textGenApiKey`) || DEFAULTS.textGenApiKey,
    textGenModel: localStorage.getItem(`${PREFIX}textGenModel`) || DEFAULTS.textGenModel,
    elevenLabsApiKey: localStorage.getItem(`${PREFIX}elevenLabsApiKey`) || DEFAULTS.elevenLabsApiKey,
    elevenLabsVoiceId: localStorage.getItem(`${PREFIX}elevenLabsVoiceId`) || DEFAULTS.elevenLabsVoiceId,
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

export function hasRequiredTTSSettings(): boolean {
  const s = getAISettings()
  return !!s.elevenLabsApiKey
}
