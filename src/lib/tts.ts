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
  chimeStyle?: 'classic' | 'bell' | 'dingdong' | 'melodic'
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export type ChimeStyle = 'classic' | 'bell' | 'dingdong' | 'melodic';

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

      if (style === 'bell') {
        // High Crystal Bell
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now); // C6
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.8);

        const oscH = ctx.createOscillator();
        const gainH = ctx.createGain();
        oscH.type = 'sine';
        oscH.frequency.setValueAtTime(1567.98, now); // G6
        gainH.gain.setValueAtTime(0, now);
        gainH.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gainH.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        oscH.connect(gainH);
        gainH.connect(ctx.destination);
        oscH.start(now);
        oscH.stop(now + 0.5);

        setTimeout(() => resolve(), 850);

      } else if (style === 'dingdong') {
        // Ding Dong Doorbell
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now); // C5 (Ding)
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(392.00, now + 0.3); // G4 (Dong)
        gain2.gain.setValueAtTime(0, now + 0.3);
        gain2.gain.linearRampToValueAtTime(0.25, now + 0.35);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.85);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.5);
        osc2.start(now + 0.3);
        osc2.stop(now + 0.9);

        setTimeout(() => resolve(), 950);

      } else if (style === 'melodic') {
        // Cascading melody chord C-E-G-C
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startOffset = idx * 0.1;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + startOffset);
          gain.gain.setValueAtTime(0, now + startOffset);
          gain.gain.linearRampToValueAtTime(0.2, now + startOffset + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.005, now + startOffset + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + startOffset);
          osc.stop(now + startOffset + 0.5);
        });

        setTimeout(() => resolve(), 1000);

      } else {
        // Classic (E5 -> G5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.17);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.5);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.65);

        setTimeout(() => resolve(), 750);
      }
    } catch (e) {
      console.error('Chime error:', e);
      resolve();
    }
  });
};

// ── TTS (Speech) ───────────────────────────────────────────────────────────
export const speakQueue = async (options: TTSOptions): Promise<void> => {
  if (!window.speechSynthesis) {
    return Promise.reject(new Error('Speech synthesis not supported'))
  }

  let voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    voices = await loadVoices()
  }

  if (options.playChime !== false) {
    await playChime(options.chimeStyle || 'classic').catch(err => console.error("Chime Error:", err))
  }

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel()

    const { language, queueNumbers, prefix, names, showName, phrase, voiceGender = 'female', useEndingWord = true, endingWord = 'ค่ะ' } = options
    const isThai = language === 'th'

    let text = ''
    const p = prefix ? `${prefix}` : ''
    const callPhrase = phrase || (isThai ? 'ขอเชิญหมายเลข' : 'Please welcome number')

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
    utterance.rate = 0.90
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const getVoiceScore = (v: SpeechSynthesisVoice) => {
      let score = 0
      const lang = v.lang.toLowerCase()
      if (isThai && lang.startsWith('th')) score += 10
      if (!isThai && lang.startsWith('en')) score += 10
      if (v.default) score += 2

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
      setTimeout(handleVoices, 1000)
    }
  })
}
