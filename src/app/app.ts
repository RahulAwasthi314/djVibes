import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VisualizerComponent } from './components/visualizer/visualizer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, VisualizerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
