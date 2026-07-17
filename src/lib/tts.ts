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
  playChime?: boolean
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export const playChime = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        resolve();
        return;
      }
      const ctx = new AudioContextClass();
      
      // Chime note 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Chime note 2: G5 (delayed by 120ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
      gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.65);
      
      setTimeout(() => {
        ctx.close();
        resolve();
      }, 700);
    } catch (e) {
      console.error('AudioContext error:', e);
      resolve();
    }
  });
};

export const speakQueue = async (options: TTSOptions): Promise<void> => {
  if (!window.speechSynthesis) {
    return Promise.reject(new Error('Speech synthesis not supported'))
  }

  // Ensure voices are fully loaded before proceeding
  let voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    voices = await loadVoices()
  }

  // Play chime if enabled
  if (options.playChime !== false) {
    await playChime().catch(err => console.error("Chime Error:", err))
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
    // 0.90 is clearer and more natural than 0.85
    utterance.rate = 0.90
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
