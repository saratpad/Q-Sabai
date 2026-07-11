/**
 * Thai Text-to-Speech for queue announcements
 * Uses Web Speech API
 */

export interface TTSOptions {
  language: 'th' | 'en'
  queueNumbers: number[]
  prefix?: string
  names?: string[]
  showName?: boolean
  phrase?: string
  voiceGender?: 'female' | 'male'
  useEndingWord?: boolean
  endingWord?: string
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export const speakQueue = async (options: TTSOptions): Promise<void> => {
  if (!window.speechSynthesis) {
    return Promise.reject(new Error('Speech synthesis not supported'))
  }

  // Ensure voices are fully loaded before proceeding
  let voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    voices = await loadVoices()
  }

  return new Promise((resolve, reject) => {

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const { language, queueNumbers, prefix, names, showName, phrase, voiceGender = 'female', useEndingWord = true, endingWord = 'ค่ะ' } = options
    const isThai = language === 'th'

    let text = ''
    const p = prefix ? `${prefix}` : ''
    const callPhrase = phrase || (isThai ? 'ขอเชิญหมายเลข' : 'Please welcome number')
    
    // Fallback for ending word based on gender if none provided
    const defaultEnding = voiceGender === 'male' ? 'ครับ' : 'ค่ะ'
    const finalEnding = useEndingWord ? (endingWord || defaultEnding) : ''
    const endingText = finalEnding ? ` ${finalEnding}` : ''

    if (isThai) {
      if (queueNumbers.length === 1) {
        text = `${callPhrase} ${p}${queueNumbers[0]}`
        if (showName && names && names[0]) {
          text += ` คุณ ${names[0]}`
        }
        text += endingText
      } else {
        const numsText = queueNumbers.map(n => `${p}${n}`).join(', ')
        text = `${callPhrase} ${numsText}${endingText}`
      }
    } else {
      if (queueNumbers.length === 1) {
        text = `${callPhrase} ${p}${queueNumbers[0]}`
        if (showName && names && names[0]) {
          text += `, ${names[0]}`
        }
        text += '. Please proceed.'
      } else {
        const numsText = queueNumbers.map(n => `${p}${n}`).join(', ')
        text = `${callPhrase}s ${numsText}. Please proceed.`
      }
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = isThai ? 'th-TH' : 'en-US'
    utterance.rate = 0.85
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Helper to score voices
    const getVoiceScore = (v: SpeechSynthesisVoice) => {
      let score = 0
      const lang = v.lang.toLowerCase()
      if (isThai && lang.startsWith('th')) score += 10
      if (!isThai && lang.startsWith('en')) score += 10
      if (v.default) score += 2 // Prefer default system voices if no other clues

      // Search both name and voiceURI for gender hints
      const name = (v.name + ' ' + v.voiceURI).toLowerCase()
      const isFemaleName = name.includes('female') || name.includes('woman') || name.includes('girl') || name.includes('premwadee') || name.includes('kanya') || name.includes('narisa') || name.includes('samantha') || name.includes('-f')
      const isMaleName = (name.includes('male') && !name.includes('female')) || name.includes('man') || name.includes('boy') || name.includes('pattara') || name.includes('niwat') || name.includes('-m')
      
      if (voiceGender === 'male') {
        if (isMaleName) score += 5
        if (isFemaleName) score -= 5
      } else {
        if (isFemaleName) score += 5
        if (isMaleName) score -= 5
      }
      
      return score
    }

    const bestVoice = [...voices].sort((a, b) => getVoiceScore(b) - getVoiceScore(a))[0]
    
    if (bestVoice && getVoiceScore(bestVoice) > 0) {
      utterance.voice = bestVoice
    }

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)

    currentUtterance = utterance
    window.speechSynthesis.speak(utterance)
  })
}

export const stopSpeech = () => {
  window.speechSynthesis.cancel()
  currentUtterance = null
}

// Preload voices (required in some browsers)
export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      resolve(voices)
    } else {
      let resolved = false
      const handleVoices = () => {
        if (!resolved) {
          resolved = true
          resolve(window.speechSynthesis.getVoices())
        }
      }
      window.speechSynthesis.onvoiceschanged = handleVoices
      // Fallback timeout to resolve anyway
      setTimeout(handleVoices, 1000)
    }
  })
}
