import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AudioService {
    private audioContext: AudioContext | null = null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private analyser: AnalyserNode | null = null;
    private gainNode: GainNode | null = null;
    private audioBuffer: AudioBuffer | null = null;
    private startTime: number = 0;
    private pauseTime: number = 0;
    private isPlayingState = false;

    readonly isPlaying = signal<boolean>(false);
    readonly isLoading = signal<boolean>(false);
    readonly currentFile = signal<string | null>(null);
    readonly errorMessage = signal<string | null>(null);

    constructor() {
        this.initAudioContext();
    }

    private initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioContext!.createAnalyser();
            this.gainNode = this.audioContext!.createGain();

            // Connect analyser to destination (source -> analyser -> gain -> destination)
            // We will connect source later when playing
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.85;

            this.gainNode.connect(this.audioContext!.destination);
            this.analyser.connect(this.gainNode);
        }
    }

    async loadFile(file: File) {
        this.stop();
        this.currentFile.set(file.name);
        this.errorMessage.set(null);
        this.isLoading.set(true);

        // Resume context if suspended (browser requirements)
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (this.audioContext) {
                    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    this.play();
                }
            } catch (error) {
                console.error('Error decoding audio data', error);
                this.errorMessage.set('Failed to decode audio file.');
            } finally {
                this.isLoading.set(false);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    play() {
        if (!this.audioContext || !this.audioBuffer) return;

        // If already playing, don't do anything or restart? 
        // For simplicity, if paused, resume. If stopped, start.

        if (this.isPlayingState) return;

        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        this.sourceNode.connect(this.analyser!);

        const offset = this.pauseTime % this.audioBuffer.duration;
        this.sourceNode.start(0, offset);
        this.sourceNode.onended = () => {
            // Only set playing to false if it wasn't manually stopped/paused (simple check)
            // Ideally checking a flag or time
        };

        this.startTime = this.audioContext.currentTime - offset;
        this.isPlayingState = true;
        this.isPlaying.set(true);
    }

    pause() {
        if (!this.sourceNode || !this.isPlayingState) return;

        if (this.audioContext) {
            this.pauseTime = this.audioContext.currentTime - this.startTime;
        }

        this.sourceNode.stop();
        this.sourceNode = null;
        this.isPlayingState = false;
        this.isPlaying.set(false);
    }

    stop() {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch (e) { /* ignore if already stopped */ }
            this.sourceNode = null;
        }
        this.pauseTime = 0;
        this.isPlayingState = false;
        this.isPlaying.set(false);
    }

    getAnalyser(): AnalyserNode | null {
        return this.analyser;
    }
}
