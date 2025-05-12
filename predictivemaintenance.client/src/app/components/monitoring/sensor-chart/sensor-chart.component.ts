import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorReading } from '../../../models/sensor-reading.model';
import { SignalRService } from '../../../services/signalr.service';
import { Subscription } from 'rxjs';

// Declare Plotly as any to avoid TypeScript errors
declare const Plotly: any;

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <div #chart class="chart"></div>
    </div>
  `,
  styleUrls: ['./sensor-chart.component.scss']
})
export class SensorChartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef;
  @Input() equipmentId!: number;
  @Input() readings: SensorReading[] = [];

  private chart: any;
  private subscriptions: Subscription[] = [];

  constructor(private signalRService: SignalRService) { }

  ngOnInit(): void {
    // Ensure Plotly is loaded
    this.loadPlotlyScript().then(() => {
      this.initChart();

      // Subscribe to real-time sensor readings
      this.subscriptions.push(
        this.signalRService.getSensorReadings().subscribe(reading => {
          if (reading && reading.equipmentId === this.equipmentId) {
            this.addReading(reading);
          }
        })
      );

      // Subscribe to the equipment
      this.signalRService.subscribeToEquipment(this.equipmentId);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readings'] && this.chart) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.signalRService.unsubscribeFromEquipment(this.equipmentId);
  }

  private loadPlotlyScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Plotly is already loaded
      if (typeof Plotly !== 'undefined') {
        resolve();
        return;
      }

      // If not loaded, dynamically load the script
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Plotly.js'));
      document.head.appendChild(script);
    });
  }

  private initChart(): void {
    const element = this.chartElement.nativeElement;
    if (!element || this.readings.length === 0) return;

    // Group readings by sensor type
    const sensorTypes = [...new Set(this.readings.map(r => r.sensorType))];

    const traces = sensorTypes.map(sensorType => {
      const filteredReadings = this.readings.filter(r => r.sensorType === sensorType);

      return {
        type: 'scatter',
        mode: 'lines',
        name: sensorType,
        x: filteredReadings.map(r => new Date(r.timestamp)),
        y: filteredReadings.map(r => r.value),
        line: {
          shape: 'spline',
          width: 3,
          color: sensorType === 'temperature' ? '#FF5722' : '#2196F3'
        },
        marker: {
          size: 8,
          color: filteredReadings.map(r => r.isAnomaly ? '#F44336' :
            (sensorType === 'temperature' ? '#FF5722' : '#2196F3')),
          line: {
            width: 2,
            color: 'white'
          }
        }
      };
    });

    const layout = {
      title: {
        text: 'Sensor Readings',
        font: { size: 24, color: '#333' }
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Time',
        type: 'date',
        gridcolor: '#eee'
      },
      yaxis: {
        title: 'Value',
        gridcolor: '#eee'
      },
      margin: { l: 60, r: 40, b: 50, t: 80, pad: 0 },
      showlegend: true
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(element, traces, layout, config);
    this.chart = element;
  }

  private updateChart(): void {
    if (!this.chart || this.readings.length === 0) {
      return;
    }

    // Group readings by sensor type
    const sensorTypes = [...new Set(this.readings.map(r => r.sensorType))];

    const data = sensorTypes.map(sensorType => {
      const filteredReadings = this.readings.filter(r => r.sensorType === sensorType);

      return {
        x: filteredReadings.map(r => new Date(r.timestamp)),
        y: filteredReadings.map(r => r.value),
        marker: {
          color: filteredReadings.map(r => r.isAnomaly ? 'red' : 'blue')
        }
      };
    });

    Plotly.update(this.chart, data);
  }

  private addReading(reading: SensorReading): void {
    if (!this.chart) {
      return;
    }

    // Find the trace index for this sensor type
    const sensorTypes = [...new Set(this.readings.map(r => r.sensorType))];
    const traceIndex = sensorTypes.indexOf(reading.sensorType);

    if (traceIndex >= 0) {
      const update = {
        x: [[new Date(reading.timestamp)]],
        y: [[reading.value]],
        marker: { color: [[reading.isAnomaly ? 'red' : 'blue']] }
      };

      Plotly.extendTraces(this.chart, update, [traceIndex], 50);
    }

    // Add to readings array
    this.readings.push(reading);

    // Keep array size reasonable
    if (this.readings.length > 100) {
      this.readings.shift();
    }
  }
}
