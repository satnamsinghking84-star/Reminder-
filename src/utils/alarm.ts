/**
 * Web Audio API alarm sound synthesizer and Device Vibration helper.
 * This runs completely client-side, requiring no external assets, and is highly reliable offline.
 */

let audioCtx: AudioContext | null = null;
let beepIntervalId: number | null = null;
let vibrationIntervalId: number | null = null;

/**
 * Initializes the AudioContext upon a user gesture to bypass browser autoplay restrictions.
 */
export function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Plays a single synthesized high-frequency beep.
 * @param frequency The frequency of the beep in Hz (default 900Hz for high-impact piercing alarm)
 * @param duration Duration of the beep in seconds
 */
export function playBeep(frequency = 950, duration = 0.25) {
  try {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'square'; // Square wave is more piercing and alarm-like
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    // Apply quick attack and decay envelope to avoid speaker clicks
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 0.02); // fast fade-in
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); // fast fade-out

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (error) {
    console.warn('Failed to synthesize beep:', error);
  }
}

/**
 * Starts a repeating alarm siren with both Web Audio beeps and Haptic Vibration.
 */
export function startAlarm() {
  // Ensure AudioContext is loaded and running
  initAudioContext();

  // Stop any existing running alarms first
  stopAlarm();

  // 1. Play repeating piercing dual-tone alert beeps
  let toggle = false;
  beepIntervalId = window.setInterval(() => {
    // Alternate frequencies for a dynamic emergency siren effect (950Hz <-> 750Hz)
    const frequency = toggle ? 950 : 750;
    playBeep(frequency, 0.3);
    toggle = !toggle;
  }, 500);

  // 2. Trigger hardware device vibration (if supported)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      // Prompt immediate vibration
      navigator.vibrate([400, 200, 400]);
      
      // Keep repeating vibration in sync with the audio beep
      vibrationIntervalId = window.setInterval(() => {
        navigator.vibrate([400, 200, 400]);
      }, 1200);
    } catch (error) {
      console.warn('Device vibration blocked or failed:', error);
    }
  }
}

/**
 * Stops the repeating alarm beep and haptic vibration.
 */
export function stopAlarm() {
  if (beepIntervalId) {
    clearInterval(beepIntervalId);
    beepIntervalId = null;
  }

  if (vibrationIntervalId) {
    clearInterval(vibrationIntervalId);
    vibrationIntervalId = null;
  }

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(0); // Instantly cancel any ongoing vibration
    } catch (e) {}
  }
}
