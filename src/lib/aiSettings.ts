export interface AISettings {
  textGenBaseUrl: string
  textGenApiKey: string
  textGenModel: string
  imageGenBaseUrl: string
  imageGenApiKey: string
  imageGenModel: string
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
}

const PREFIX = 'ai-settings-'

const DEFAULTS: AISettings = {
  textGenBaseUrl: '',
  textGenApiKey: '',
  textGenModel: '',
  imageGenBaseUrl: '',
  imageGenApiKey: '',
  imageGenModel: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
}

export function getAISettings(): AISettings {
  return {
    textGenBaseUrl: localStorage.getItem(`${PREFIX}textGenBaseUrl`) || DEFAULTS.textGenBaseUrl,
    textGenApiKey: localStorage.getItem(`${PREFIX}textGenApiKey`) || DEFAULTS.textGenApiKey,
    textGenModel: localStorage.getItem(`${PREFIX}textGenModel`) || DEFAULTS.textGenModel,
    imageGenBaseUrl: localStorage.getItem(`${PREFIX}imageGenBaseUrl`) || DEFAULTS.imageGenBaseUrl,
    imageGenApiKey: localStorage.getItem(`${PREFIX}imageGenApiKey`) || DEFAULTS.imageGenApiKey,
    imageGenModel: localStorage.getItem(`${PREFIX}imageGenModel`) || DEFAULTS.imageGenModel,
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

export function hasRequiredImageGenSettings(): boolean {
  const s = getAISettings()
  return !!(s.imageGenBaseUrl && s.imageGenApiKey)
}

export function hasRequiredTTSSettings(): boolean {
  const s = getAISettings()
  return !!s.elevenLabsApiKey
}
