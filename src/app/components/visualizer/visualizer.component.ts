import { Component, ElementRef, ViewChild, AfterViewInit, effect, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AudioService } from '../../services/audio.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-visualizer',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './visualizer.component.html',
    styleUrl: './visualizer.component.scss'
})
export class VisualizerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
    private canvasCtx!: CanvasRenderingContext2D;
    private animationId: number = 0;
    private isBrowser: boolean;

    constructor(
        public audioService: AudioService,
        @Inject(PLATFORM_ID) platformId: Object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);

        // React to playing state
        effect(() => {
            // Just triggering dependency tracking if needed, 
            // but the loop is self-sustaining via requestAnimationFrame
            this.audioService.isPlaying();
        });
    }

    ngAfterViewInit() {
        if (this.isBrowser) {
            this.canvasCtx = this.canvasRef.nativeElement.getContext('2d')!;
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.draw();
        }
    }

    ngOnDestroy() {
        if (this.isBrowser) {
            cancelAnimationFrame(this.animationId);
            window.removeEventListener('resize', () => this.resizeCanvas());
        }
    }

    resizeCanvas() {
        if (!this.canvasRef) return;
        const canvas = this.canvasRef.nativeElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.audioService.loadFile(file);
        }
    }

    togglePlay() {
        if (this.audioService.isPlaying()) {
            this.audioService.pause();
        } else {
            this.audioService.play();
        }
    }

    draw() {
        if (!this.isBrowser || !this.canvasCtx) return;

        this.animationId = requestAnimationFrame(() => this.draw());

        const canvas = this.canvasRef.nativeElement;
        const ctx = this.canvasCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Fade effect for trails
        ctx.fillStyle = 'rgba(10, 10, 18, 0.3)';
        ctx.fillRect(0, 0, width, height);

        const analyser = this.audioService.getAnalyser();

        // Draw grid/background elements if no audio just to look cool?
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeArray = new Uint8Array(bufferLength);

        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeArray);

        // --- 1. Spectrum / Frequency / Harmonics (Bar Graph) ---
        // We only take the lower half likely as it's mirrored or higher freqs are empty often, 
        // but default 2048 fftSize gives 1024 bins.
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 1.5; // Scale up
            // Color based on frequency
            const r = barHeight + (25 * (i / bufferLength));
            const g = 250 * (i / bufferLength);
            const b = 50;

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }

        // --- 2. Waveform / Amplitude (Line) ---
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00ffcc'; // Cyan
        ctx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let xWave = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = timeArray[i] / 128.0; // 128 is zero crossing
            const y = v * (height / 2); // Centered vertically? No, v goes form 0 to 2.
            // 1 -> center.
            // y = height/2 + (v-1)*height/2?
            // v=1 -> height/2. v=0 -> 0. v=2 -> height. 
            // Actually directly: y = v * height/2 is top half only if v is 0..2? 
            // v=1 is silent. We want to center it.
            const yCentered = (v * height / 2) + height / 4; // Quick hack or proper math?
            // Let's do: y = (v * height) / 2 is wrong scale.
            // v is 0..255 normalized to 0..2 approx.
            // Let's map 0..255 to -1..1 -> (val - 128) / 128
            const normalized = (timeArray[i] - 128) / 128.0;
            const yPos = (height / 2) + (normalized * (height / 3));

            if (i === 0) {
                ctx.moveTo(xWave, yPos);
            } else {
                ctx.lineTo(xWave, yPos);
            }
            xWave += sliceWidth;
        }
        ctx.stroke();

        // --- 3. Phase / Polar Plot (Circular) ---
        // Visualizing the signal in a polar coordinate system
        ctx.save();
        ctx.translate(width / 2, height / 2); // Center of screen

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 0, 191, 0.8)'; // Magenta
        ctx.beginPath();

        const radius = Math.min(width, height) / 3.5;

        for (let i = 0; i < bufferLength; i++) {
            // Map index to angle
            const angle = (i / bufferLength) * 2 * Math.PI;
            // Map amplitude to radius offset
            const amplitude = (timeArray[i] - 128) / 128.0;
            const r = radius + (amplitude * 100); // 100px variation

            const xCirc = r * Math.cos(angle);
            const yCirc = r * Math.sin(angle);

            if (i === 0) {
                ctx.moveTo(xCirc, yCirc);
            } else {
                ctx.lineTo(xCirc, yCirc);
            }
        }
        // Close loop
        ctx.closePath();
        ctx.stroke();

        // Add a center glow based on average volume
        const average = dataArray.reduce((prev, curr) => prev + curr, 0) / bufferLength;
        ctx.beginPath();
        ctx.arc(0, 0, average * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${average / 255})`;
        ctx.fill();

        ctx.restore();
    }
}
