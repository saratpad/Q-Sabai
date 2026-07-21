/**
 * Thai Text-to-Speech for queue announcements
 * Uses Web Speech API + Web Audio API for chimes
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
  chimeStyle?: 'classic' | 'bell' | 'dingdong' | 'melodic' | 'alert' | 'elevator' | 'digital' | 'triple_bell'
}

let currentUtterance: SpeechSynthesisUtterance | null = null
let currentAudio: HTMLAudioElement | null = null

// Phonetic map for English letters to Thai spoken words
const ENGLISH_LETTER_TO_THAI: Record<string, string> = {
  'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี',
  'F': 'เอฟ', 'G': 'จี', 'H': 'เอช', 'I': 'ไอ', 'J': 'เจ',
  'K': 'เค', 'L': 'เอล', 'M': 'เอ็ม', 'N': 'เอ็น', 'O': 'โอ',
  'P': 'พี', 'Q': 'คิว', 'R': 'อาร์', 'S': 'เอส', 'T': 'ที',
  'U': 'ยู', 'V': 'วี', 'W': 'ดับเบิ้ลยู', 'X': 'เอ็กซ์', 'Y': 'วาย', 'Z': 'แซด'
}

/**
 * Convert prefix letters (e.g., "A", "B", "VIP") into clear Thai phonetic words
 */
export const formatPrefixPhonetic = (prefix: string): string => {
  if (!prefix) return ''
  let result = ''
  for (const char of prefix.toUpperCase()) {
    if (ENGLISH_LETTER_TO_THAI[char]) {
      result += `${ENGLISH_LETTER_TO_THAI[char]} `
    } else if (/[0-9]/.test(char)) {
      result += `${char} `
    }
  }
  return result.trim()
}

/**
 * Play text using Google Translate TTS Endpoint (High quality, free Thai TTS)
 */
export const speakWithGoogleTTS = (text: string, lang: 'th' | 'en' = 'th'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cleanText = text.replace(/\s+/g, ' ').trim()
    if (!cleanText) {
      resolve()
      return
    }
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`

    stopSpeech()

    const audio = new Audio(url)
    currentAudio = audio

    audio.onended = () => {
      currentAudio = null
      resolve()
    }

    audio.onerror = (e) => {
      currentAudio = null
      reject(e)
    }

    audio.play().catch((err) => {
      currentAudio = null
      reject(err)
    })
  })
}

export type ChimeStyle = 'classic' | 'bell' | 'dingdong' | 'melodic' | 'alert' | 'elevator' | 'digital' | 'triple_bell';

// ── Shared AudioContext singleton ──────────────────────────────────────────
// Creating a new AudioContext every call causes "suspended" state because
// the browser requires a user-gesture for EACH new context.
// By reusing one context we only need one unlock click.
let _sharedAudioCtx: AudioContext | null = null;

const getAudioContext = async (): Promise<AudioContext | null> => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new AudioContextClass();
    }
    if (_sharedAudioCtx.state === 'suspended') {
      await _sharedAudioCtx.resume();
    }
    return _sharedAudioCtx;
  } catch (e) {
    console.error('AudioContext error:', e);
    return null;
  }
};

/**
 * Call this once inside a click handler to unlock the shared AudioContext.
 * After this, playChime() will work without requiring another user gesture.
 */
export const unlockAudioContext = async (): Promise<void> => {
  const ctx = await getAudioContext();
  if (ctx) {
    // Play a silent 1-sample buffer to fully unlock audio on iOS/Chrome
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
};

// ── Chime sounds ───────────────────────────────────────────────────────────
export const playChime = async (style: ChimeStyle = 'classic'): Promise<void> => {
  const ctx = await getAudioContext();
  if (!ctx) return;

  return new Promise((resolve) => {
    try {
      const now = ctx.currentTime;

      // Create a feedback delay line to simulate premium hospital reverb/echo
      const delay = ctx.createDelay(1.0);
      const feedback = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      delay.delayTime.setValueAtTime(0.25, now); // 250ms echo
      feedback.gain.setValueAtTime(0.4, now); // moderate feedback
      filter.frequency.setValueAtTime(1500, now); // soften high freq echoes

      // Connect delay loop
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);

      // Connect delay to output
      delay.connect(ctx.destination);

      if (style === 'bell') {
        // Echoing Hospital Bell (F6 -> C6 -> A5)
        const notes = [1396.91, 1046.50, 880.00]; // F6, C6, A5
        notes.forEach((freq, idx) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator(); // detuned second oscillator for fat chime
          const gain = ctx.createGain();
          const start = now + idx * 0.15;

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(freq, start);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(freq + 4, start); // slightly detuned

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay); // send to echo chamber

          osc1.start(start);
          osc1.stop(start + 1.3);
          osc2.start(start);
          osc2.stop(start + 1.3);
        });

        setTimeout(() => resolve(), 1800);

      } else if (style === 'dingdong') {
        // Department Store/Hospital Ding Dong (F5 -> D5) with rich texture
        const freqs = [698.46, 587.33]; // F5, D5
        freqs.forEach((freq, idx) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.35;

          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, start);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(freq * 1.5, start); // perfect 5th overtone

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.2, start + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.5);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay);

          osc1.start(start);
          osc1.stop(start + 1.6);
          osc2.start(start);
          osc2.stop(start + 1.6);
        });

        setTimeout(() => resolve(), 2200);

      } else if (style === 'melodic') {
        // Echoing Melodic Arpeggio (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.12;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);

          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay);

          osc.start(start);
          osc.stop(start + 1.1);
        });

        setTimeout(() => resolve(), 1800);

      } else if (style === 'alert') {
        // High Alert/Attention Chime (G6 -> E6)
        const notes = [1567.98, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.15;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay);
          osc.start(start);
          osc.stop(start + 0.9);
        });
        setTimeout(() => resolve(), 1300);

      } else if (style === 'elevator') {
        // Soft Elevator/Hotel Ding (C5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0); // very long decay
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.connect(delay);
        osc.start(now);
        osc.stop(now + 2.1);
        setTimeout(() => resolve(), 1500);

      } else if (style === 'digital') {
        // Modern Digital Notification (B5 -> E6)
        const notes = [987.77, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.08; // very fast
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay);
          osc.start(start);
          osc.stop(start + 0.6);
        });
        setTimeout(() => resolve(), 1000);

      } else if (style === 'triple_bell') {
        // High Triple Bell Chime (C6 -> E6 -> G6)
        const notes = [1046.50, 1318.51, 1567.98];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.12;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.22, start + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay);
          osc.start(start);
          osc.stop(start + 1.1);
        });
        setTimeout(() => resolve(), 1600);

      } else {
        // Classic Hospital/Airport Chime (E5 -> G5 -> C6)
        const notes = [659.25, 783.99, 1046.50]; // E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.14;

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(freq, start);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(freq + 3, start); // rich detuning

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.22, start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          gain.connect(delay); // connect to echoing delay

          osc1.start(start);
          osc1.stop(start + 1.3);
          osc2.start(start);
          osc2.stop(start + 1.3);
        });

        setTimeout(() => resolve(), 1800);
      }
    } catch (e) {
      console.error('Chime error:', e);
      resolve();
    }
  });
};

// ── TTS (Speech) ───────────────────────────────────────────────────────────
export const speakQueue = async (options: TTSOptions): Promise<void> => {
  const { language, queueNumbers, prefix, names, showName, phrase, voiceGender = 'female', useEndingWord = true, endingWord = 'ค่ะ' } = options
  const isThai = language === 'th'

  if (options.playChime !== false) {
    await playChime(options.chimeStyle || 'classic').catch(err => console.error("Chime Error:", err))
  }

  let text = ''
  const callPhrase = phrase || (isThai ? 'ขอเชิญหมายเลข' : 'Please welcome number')
  const defaultEnding = voiceGender === 'male' ? 'ครับ' : 'ค่ะ'
  const finalEnding = useEndingWord ? (endingWord || defaultEnding) : ''
  const endingText = finalEnding ? ` ${finalEnding}` : ''

  if (isThai) {
    const formattedPrefix = prefix ? formatPrefixPhonetic(prefix) : ''
    const p = formattedPrefix ? `${formattedPrefix} ` : ''
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
    const p = prefix ? `${prefix}` : ''
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

  // 1. Try Google Translate TTS first (High quality natural Thai voice, free)
  try {
    await speakWithGoogleTTS(text, isThai ? 'th' : 'en')
    return
  } catch (err) {
    console.warn("Google TTS fallback to Web Speech API:", err)
  }

  // 2. Fallback to browser Web Speech API
  if (!window.speechSynthesis) {
    return Promise.reject(new Error('Speech synthesis not supported'))
  }

  let voices = window.speechSynthesis.getVoices()
  const hasMatchingLangVoice = voices.some(v => isThai ? v.lang.toLowerCase().startsWith('th') : v.lang.toLowerCase().startsWith('en'))
  if (voices.length === 0 || !hasMatchingLangVoice) {
    voices = await loadVoices()
  }

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = isThai ? 'th-TH' : 'en-US'
    utterance.rate = 0.90
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const getVoiceScore = (v: SpeechSynthesisVoice) => {
      let score = 0
      const lang = v.lang.toLowerCase()
      if (isThai && !lang.startsWith('th')) return -100
      if (!isThai && !lang.startsWith('en')) return -100

      score += 10
      if (v.default) score += 2

      const name = (v.name + ' ' + v.voiceURI).toLowerCase()
      if (name.includes('google')) score += 20 // Prioritize Google Voice in Web Speech API

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

    const matchingVoices = [...voices].filter(v => getVoiceScore(v) > 0)
    if (matchingVoices.length > 0) {
      matchingVoices.sort((a, b) => getVoiceScore(b) - getVoiceScore(a))
      utterance.voice = matchingVoices[0]
    }

    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)

    currentUtterance = utterance
    window.speechSynthesis.speak(utterance)
  })
}

export const stopSpeech = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  currentUtterance = null
}

export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      const hasThaiVoice = voices.some(v => v.lang.toLowerCase().startsWith('th'))
      if (voices.length > 0 && hasThaiVoice) {
        return voices
      }
      return null
    }

    const immediate = checkVoices()
    if (immediate) {
      resolve(immediate)
      return
    }

    let resolved = false
    const handleVoices = () => {
      if (!resolved) {
        resolved = true
        resolve(window.speechSynthesis.getVoices())
      }
    }

    window.speechSynthesis.onvoiceschanged = handleVoices
    setTimeout(handleVoices, 1000)
  })
}
