import FFT from 'fft.js';

// Configuration
export const SAMPLING_RATE = 512; // Hz
export const ONE_MINUTE_SAMPLES = SAMPLING_RATE * 2;
export const LOW_BETA_THRESHOLD = 0.34;
export const TRACKING_WINDOW_SECONDS = 300; // 5 minutes
export const ALERT_THRESHOLD_PERCENT = 80;

// In-memory user beta tracking (for demo, not persistent)
const userBetaReadings: Record<string, Array<{ t: number; beta: number }>> = {};

// 1. PSD Computation (Welch method, simplified)
export function computePSD(eegData: number[], fs: number): { freqs: number[]; psd: number[] } {
  // Welch: split into overlapping segments, average periodograms
  // Here: just use one segment for simplicity
  const fftSize = Math.pow(2, Math.ceil(Math.log2(eegData.length)));
  const fft = new FFT(fftSize);
  const input = new Array(fftSize).fill(0);
  eegData.forEach((v, i) => (input[i] = v));
  const out = fft.createComplexArray();
  fft.realTransform(out, input);
  fft.completeSpectrum(out);
  // Compute power spectrum
  const psd: number[] = [];
  for (let i = 0; i < fftSize / 2; i++) {
    const re = out[2 * i];
    const im = out[2 * i + 1];
    psd.push((re * re + im * im) / fftSize);
  }
  // Frequency bins
  const freqs = Array.from({ length: fftSize / 2 }, (_, i) => (i * fs) / fftSize);
  return { freqs, psd };
}

// 2. Compute Beta Power (12-30 Hz)
export function computeBetaPower(freqs: number[], psd: number[]): number {
  const betaIdx = freqs.map((f, i) => (f >= 12 && f <= 30 ? i : -1)).filter(i => i !== -1);
  if (betaIdx.length > 0) {
    const betaVals = betaIdx.map(i => psd[i]);
    return betaVals.reduce((a, b) => a + b, 0) / betaVals.length;
  }
  return 0;
}

// 3. Low Beta Persistence Checking
export function checkLowBetaPersistence(userId: string, betaPower: number): boolean {
  const now = Date.now() / 1000;
  if (!userBetaReadings[userId]) userBetaReadings[userId] = [];
  userBetaReadings[userId].push({ t: now, beta: betaPower });
  // Remove old
  userBetaReadings[userId] = userBetaReadings[userId].filter(r => r.t >= now - TRACKING_WINDOW_SECONDS);
  if (userBetaReadings[userId].length < (SAMPLING_RATE * 60) / ONE_MINUTE_SAMPLES) return false;
  const lowReadings = userBetaReadings[userId].filter(r => r.beta < LOW_BETA_THRESHOLD).length;
  const percentLow = (lowReadings / userBetaReadings[userId].length) * 100;
  return percentLow >= ALERT_THRESHOLD_PERCENT;
}

// 4. Focus Level Calculation
export function calculateFocusLevel(betaPower: number): number {
  const MIN_BETA = 0.1;
  const MAX_BETA = 1.0;
  const clamped = Math.max(MIN_BETA, Math.min(MAX_BETA, betaPower));
  return Math.round(((clamped - MIN_BETA) / (MAX_BETA - MIN_BETA)) * 1000) / 10;
}

// 5. Main Processing Function
export function processEegData(userId: string, eegSamples: number[]): any {
  try {
    if (!Array.isArray(eegSamples)) throw new Error('eegSamples must be an array');
    if (eegSamples.length < SAMPLING_RATE * 2) {
      return { error: 'Insufficient data for processing. Need at least 2 seconds of data.' };
    }
    const { freqs, psd } = computePSD(eegSamples, SAMPLING_RATE);
    const betaPower = computeBetaPower(freqs, psd);
    const lowBetaWarning = checkLowBetaPersistence(userId, betaPower);
    const focusLevel = calculateFocusLevel(betaPower);
    return {
      user_id: userId,
      eeg_data: {
        raw_samples: eegSamples,
        frequencies: freqs,
        psd,
        focus_level: focusLevel,
        processing_timestamp: Date.now() / 1000,
      },
      beta_power: betaPower,
      low_beta_warning: lowBetaWarning,
      focus_level: focusLevel,
    };
  } catch (e: any) {
    return { error: `Error processing EEG data: ${e.message}` };
  }
} 