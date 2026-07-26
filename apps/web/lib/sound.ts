let sharedContext: AudioContext | undefined;

function getAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return undefined;
  sharedContext ??= new Ctor();
  return sharedContext;
}

// Two-note ascending chime (C6 -> E6), synthesized rather than a shipped audio
// asset - no file to host, no licensing to track, and it matches the app's
// "earned signal" accent tone rather than a generic notification sound.
export function playSuccessChime(): void {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  const notes: Array<[frequency: number, startOffset: number]> = [
    [1046.5, 0],
    [1318.5, 0.09]
  ];

  for (const [frequency, startOffset] of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(context.destination);

    const startAt = context.currentTime + startOffset;
    const duration = 0.18;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.16, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }
}
