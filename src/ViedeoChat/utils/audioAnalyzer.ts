export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private onAudioLevel: ((level: number) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  startAnalyzing(stream: MediaStream, callback: (level: number) => void): boolean {
    if (!this.audioContext) {
      console.warn('AudioContext not supported');
      return false;
    }

    if (stream.getAudioTracks().length === 0) {
      return false;
    }

    this.stopAnalyzing();
    this.onAudioLevel = callback;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);

    try {
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
    } catch (error) {
      this.stopAnalyzing();
      console.warn('Failed to start audio analysis:', error);
      return false;
    }

    this.detectAudioLevel();
    return true;
  }

  private detectAudioLevel() {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }

    const average = sum / this.dataArray.length;
    const normalizedLevel = average / 255;

    this.onAudioLevel?.(normalizedLevel);
    this.animationId = requestAnimationFrame(() => this.detectAudioLevel());
  }

  stopAnalyzing() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.dataArray = null;
    this.onAudioLevel = null;
  }

  dispose() {
    this.stopAnalyzing();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
