import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorReading } from '../../../models/sensor-reading.model';
import { SignalRService } from '../../../services/signalr.service';
import { Subscription } from 'rxjs';

// Fix plotly import to avoid TypeScript errors
declare const Plotly: any;

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [
    CommonModule
  ],
  template: `
    <div class="chart-container">
      <div #chart class="chart"></div>
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 400px;
    }
    
    .chart {
      width: 100%;
      height: 100%;
    }
  `]
})
export class SensorChartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef;
  @Input() equipmentId!: number;
  @Input() readings: SensorReading[] = [];

  private chart: any;
  private subscription?: Subscription;

  constructor(private signalRService: SignalRService) { }

  ngOnInit(): void {
    // Ensure Plotly is loaded
    this.loadPlotlyScript().then(() => {
      this.initChart();

      // Subscribe to real-time sensor readings
      this.subscription = this.signalRService.getSensorReadings().subscribe(reading => {
        if (reading && reading.equipmentId === this.equipmentId) {
          this.addReading(reading);
        }
      });

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
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

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
          color: filteredReadings.map(r => r.isAnomaly ? '#F44336' : sensorType === 'temperature' ? '#FF5722' : '#2196F3'),
          line: {
            width: 2,
            color: 'white'
          }
        },
        hoverinfo: 'all',
        hoverlabel: {
          bgcolor: '#333',
          bordercolor: '#333',
          font: { color: 'white' }
        }
      };
    });

    // Add anomaly annotations for better visibility
    const annotations = this.readings
      .filter(r => r.isAnomaly)
      .map(reading => ({
        x: new Date(reading.timestamp),
        y: reading.value,
        text: 'Anomaly',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: '#F44336',
        font: { color: 'white' },
        bgcolor: '#F44336',
        bordercolor: '#F44336'
      }));

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
        gridcolor: '#eee',
        linecolor: '#999',
        tickformat: '%H:%M:%S<br>%b %d'
      },
      yaxis: {
        title: 'Value',
        gridcolor: '#eee',
        linecolor: '#999'
      },
      margin: { l: 60, r: 40, b: 50, t: 80, pad: 0 },
      legend: {
        orientation: 'h',
        y: -0.2,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#ddd',
        borderwidth: 1
      },
      showlegend: true,
      hovermode: 'closest',
      annotations: annotations,
      shapes: [
        // Add threshold line
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          y0: 100, // Threshold value
          y1: 100,
          line: {
            color: 'rgba(255,0,0,0.5)',
            width: 2,
            dash: 'dash'
          }
        }
      ]
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
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
