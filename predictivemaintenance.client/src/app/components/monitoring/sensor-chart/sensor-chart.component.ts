import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorReading } from '../../../models/sensor-reading.model';
import { SignalRService } from '../../../services/signalr.service';
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Declare Plotly as any to avoid TypeScript errors
declare const Plotly: any;

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="chart-container">
      <div #chart class="chart"></div>
      <div *ngIf="!chartInitialized || isLoading" class="chart-loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>{{ isLoading ? 'Loading sensor data...' : 'Initializing chart...' }}</p>
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      height: 400px;
      position: relative;
    }
    
    .chart {
      width: 100%;
      height: 100%;
    }
    
    .chart-loading {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: rgba(255,255,255,0.8);
      font-size: 16px;
      color: #666;
    }
    
    .chart-loading p {
      margin-top: 16px;
    }
  `]
})
export class SensorChartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef;
  @Input() equipmentId!: number;
  @Input() readings: SensorReading[] = [];

  private chart: any;
  chartInitialized = false;
  isLoading = true;
  private subscriptions: Subscription[] = [];
  private readingsMap: Map<string, SensorReading[]> = new Map();
  private anomalyCount = 0;

  constructor(private signalRService: SignalRService) { }

  ngOnInit(): void {
    console.log(`Initializing chart for equipment ${this.equipmentId}`);

    // Organize readings by sensor type
    this.organizeReadings();

    // Initialize the chart
    if (typeof Plotly !== 'undefined') {
      this.initChart();
    } else {
      console.error('Plotly is not available! Loading dynamically...');
      this.loadPlotlyScript().then(() => {
        this.initChart();
      });
    }

    // Subscribe to real-time sensor readings
    this.subscriptions.push(
      this.signalRService.getSensorReadings().subscribe(reading => {
        if (reading && reading.equipmentId === this.equipmentId) {
          console.log(`Received real-time reading: ${reading.sensorType} = ${reading.value}`);
          this.addReading(reading);

          if (reading.isAnomaly) {
            this.anomalyCount++;
            console.log(`Anomaly detected! Total anomalies: ${this.anomalyCount}`);
          }
        }
      })
    );

    // Subscribe to the equipment updates
    this.signalRService.subscribeToEquipment(this.equipmentId).then(() => {
      console.log(`Successfully subscribed to equipment ${this.equipmentId}`);
    }).catch(err => {
      console.error(`Error subscribing to equipment ${this.equipmentId}:`, err);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readings'] && !changes['readings'].firstChange) {
      console.log(`Readings changed: ${this.readings.length} readings available`);
      this.isLoading = false;
      this.organizeReadings();

      if (this.chartInitialized) {
        this.updateChart();
      } else if (this.readings.length > 0) {
        this.initChart();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.signalRService.unsubscribeFromEquipment(this.equipmentId).catch(err => {
      console.error(`Error unsubscribing from equipment ${this.equipmentId}:`, err);
    });
  }

  private organizeReadings(): void {
    // Clear the map
    this.readingsMap.clear();

    // Group readings by sensor type
    this.readings.forEach(reading => {
      if (!this.readingsMap.has(reading.sensorType)) {
        this.readingsMap.set(reading.sensorType, []);
      }
      this.readingsMap.get(reading.sensorType)!.push(reading);
    });

    // Sort each group by timestamp
    this.readingsMap.forEach((readings, sensorType) => {
      readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
  }

  private loadPlotlyScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Loading Plotly script dynamically');
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
      script.async = true;
      script.onload = () => {
        console.log('Plotly loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load Plotly');
        reject(new Error('Failed to load Plotly.js'));
      };
      document.head.appendChild(script);
    });
  }

  private initChart(): void {
    const element = this.chartElement.nativeElement;
    if (!element) {
      console.error('Chart element not found');
      return;
    }

    console.log('Initializing chart');

    // Create traces for each sensor type
    const traces: any[] = [];

    if (this.readingsMap.size === 0) {
      // Create empty traces if no data
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: 'No Data',
        x: [new Date(), new Date(new Date().getTime() + 60000)],
        y: [0, 0],
        line: { dash: 'dash', color: '#cccccc' }
      });
    } else {
      // Create traces for each sensor type
      this.readingsMap.forEach((readings, sensorType) => {
        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          name: sensorType,
          x: readings.map(r => new Date(r.timestamp)),
          y: readings.map(r => r.value),
          line: {
            shape: 'spline',
            width: 3,
            color: this.getSensorColor(sensorType, false)
          },
          marker: {
            size: readings.map(r => r.isAnomaly ? 10 : 6),
            color: readings.map(r => this.getSensorColor(sensorType, r.isAnomaly)),
            line: {
              width: readings.map(r => r.isAnomaly ? 2 : 0),
              color: 'white'
            }
          }
        });
      });
    }

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
      showlegend: true,
      legend: { orientation: 'h', y: -0.2 }
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    try {
      Plotly.newPlot(element, traces, layout, config);
      this.chart = element;
      this.chartInitialized = true;
      this.isLoading = false;
      console.log('Chart initialized successfully with', traces.length, 'traces');
    } catch (e) {
      console.error('Error initializing chart:', e);
      this.isLoading = false;
    }
  }

  private updateChart(): void {
    if (!this.chart || !this.chartInitialized) {
      this.initChart();
      return;
    }

    try {
      // Update each trace
      const traces = Array.from(this.readingsMap.entries()).map(([sensorType, readings]) => {
        return {
          x: readings.map(r => new Date(r.timestamp)),
          y: readings.map(r => r.value),
          marker: {
            size: readings.map(r => r.isAnomaly ? 10 : 6),
            color: readings.map(r => this.getSensorColor(sensorType, r.isAnomaly)),
            line: {
              width: readings.map(r => r.isAnomaly ? 2 : 0),
              color: 'white'
            }
          }
        };
      });

      Plotly.update(this.chart, traces);
      console.log('Chart updated successfully');
    } catch (e) {
      console.error('Error updating chart:', e);
      // If update fails, try recreating the chart
      this.chartInitialized = false;
      this.initChart();
    }
  }

  private addReading(reading: SensorReading): void {
    console.log(`Adding reading to chart: ${reading.sensorType} = ${reading.value}`);

    // If chart is not initialized, initialize it
    if (!this.chartInitialized) {
      this.initChart();
      return;
    }

    // Add the reading to our local data
    if (!this.readingsMap.has(reading.sensorType)) {
      this.readingsMap.set(reading.sensorType, []);
    }

    // Add to map and limit size
    const readings = this.readingsMap.get(reading.sensorType)!;
    readings.push(reading);
    if (readings.length > 50) {
      readings.shift(); // Remove oldest
    }

    // Find the trace index for this sensor type
    const sensorTypes = Array.from(this.readingsMap.keys());
    const traceIndex = sensorTypes.indexOf(reading.sensorType);

    if (traceIndex < 0) {
      // New sensor type, recreate the chart
      console.log('New sensor type detected, reinitializing chart');
      this.initChart();
      return;
    }

    try {
      // Define color and size based on anomaly status
      const color = this.getSensorColor(reading.sensorType, reading.isAnomaly);
      const size = reading.isAnomaly === true ? 10 : 6;
      const lineWidth = reading.isAnomaly === true ? 2 : 0;

      // Add just this reading to the chart
      Plotly.extendTraces(this.chart, {
        x: [[new Date(reading.timestamp)]],
        y: [[reading.value]],
        marker: {
          color: [[color]],
          size: [[size]],
          line: { width: [[lineWidth]] }
        }
      }, [traceIndex], 50);

      console.log(`Chart updated with new ${reading.sensorType} reading: ${reading.value}`);
    } catch (e) {
      console.error('Error extending chart trace:', e);
      // If extending fails, try updating the whole chart
      this.updateChart();
    }
  }

  private getSensorColor(sensorType: string, isAnomaly: boolean | undefined): string {
    if (isAnomaly === true) {  // Check explicitly for true
      return '#F44336'; // Red for all anomalies
    }

    switch (sensorType.toLowerCase()) {
      case 'temperature': return '#FF5722';
      case 'vibration': return '#FFC107';
      case 'pressure': return '#9C27B0';
      case 'flow': return '#4CAF50';
      case 'rpm': return '#3F51B5';
      default: return '#2196F3';
    }
  }
}
