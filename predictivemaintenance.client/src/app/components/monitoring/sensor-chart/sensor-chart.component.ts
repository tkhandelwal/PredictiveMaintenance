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
      <div class="anomaly-legend" *ngIf="anomalyCount > 0">
        <div class="anomaly-indicator"></div>
        <span>{{ anomalyCount }} Anomalies Detected</span>
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
    
    .anomaly-legend {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.5);
      border-radius: 4px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      color: #d32f2f;
      font-weight: 500;
      z-index: 10;
    }
    
    .anomaly-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #d32f2f;
      margin-right: 8px;
      box-shadow: 0 0 8px #d32f2f;
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
  anomalyCount = 0;
  private updateInterval: any;

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
            // Play audio alert for anomalies
            this.playAnomalyAlert();
            console.log(`Anomaly detected! Total anomalies: ${this.anomalyCount}`);
          }
        }
      })
    );

    // Subscribe to status changes for this equipment
    this.subscriptions.push(
      this.signalRService.getStatusChanges().subscribe(statusChange => {
        if (statusChange && statusChange.equipmentId === this.equipmentId) {
          console.log(`Status changed for equipment ${this.equipmentId}: ${statusChange.currentStatus}`);
          // You could update UI elements based on status change
        }
      })
    );

    // Subscribe to the equipment updates - FIX: Promise handling
    Promise.resolve(this.signalRService.subscribeToEquipment(this.equipmentId))
      .then(() => {
        console.log(`Successfully subscribed to equipment ${this.equipmentId}`);
      })
      .catch((err: Error) => {
        console.error(`Error subscribing to equipment ${this.equipmentId}:`, err);
      });

    // Set up a periodic refresh to ensure chart is updated
    this.updateInterval = setInterval(() => {
      if (this.chartInitialized) {
        this.updateChart();
      }
    }, 10000); // Refresh every 10 seconds as a backup
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

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // FIX: Promise handling
    Promise.resolve(this.signalRService.unsubscribeFromEquipment(this.equipmentId))
      .catch((err: Error) => {
        console.error(`Error unsubscribing from equipment ${this.equipmentId}:`, err);
      });
  }

  private playAnomalyAlert(): void {
    try {
      const audio = new Audio('assets/sounds/anomaly-alert.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.error('Error playing alert sound:', e);
    }
  }

  private organizeReadings(): void {
    // Clear the map
    this.readingsMap.clear();

    // Count anomalies
    this.anomalyCount = 0;

    // Group readings by sensor type
    this.readings.forEach(reading => {
      if (!this.readingsMap.has(reading.sensorType)) {
        this.readingsMap.set(reading.sensorType, []);
      }
      this.readingsMap.get(reading.sensorType)!.push(reading);

      // Count anomalies
      if (reading.isAnomaly) {
        this.anomalyCount++;
      }
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
    const anomalyTraces: any[] = [];

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
      // Create traces for each sensor type - split normal and anomaly data
      this.readingsMap.forEach((readings, sensorType) => {
        // Normal data trace
        const normalData = readings.filter(r => !r.isAnomaly);

        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: sensorType,
          x: normalData.map(r => new Date(r.timestamp)),
          y: normalData.map(r => r.value),
          line: {
            shape: 'spline',
            width: 3,
            color: this.getSensorColor(sensorType, false)
          }
        });

        // Anomaly data separate trace for better visibility
        const anomalyData = readings.filter(r => r.isAnomaly);

        if (anomalyData.length > 0) {
          anomalyTraces.push({
            type: 'scatter',
            mode: 'markers',
            name: `${sensorType} Anomalies`,
            x: anomalyData.map(r => new Date(r.timestamp)),
            y: anomalyData.map(r => r.value),
            marker: {
              size: 12,
              symbol: 'circle',
              color: '#F44336',
              line: {
                width: 2,
                color: 'white'
              }
            },
            hoverinfo: 'x+y+text',
            text: anomalyData.map(r => `ANOMALY: ${r.sensorType} ${r.value}`)
          });
        }
      });

      // Add anomaly traces after regular traces
      traces.push(...anomalyTraces);
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
      legend: { orientation: 'h', y: -0.2 },
      hovermode: 'closest',
      annotations: this.anomalyCount > 0 ? [
        {
          x: 0.5,
          y: 1.12,
          xref: 'paper',
          yref: 'paper',
          text: `⚠️ ${this.anomalyCount} Anomalies Detected`,
          showarrow: false,
          font: {
            family: 'Arial',
            size: 16,
            color: '#F44336',
            weight: 'bold'
          },
        }
      ] : []
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `equipment-${this.equipmentId}-readings`,
      }
    };

    try {
      Plotly.newPlot(element, traces, layout, config);
      this.chart = element;
      this.chartInitialized = true;
      this.isLoading = false;
      console.log('Chart initialized successfully with', traces.length, 'traces');

      // Add click event for anomaly points
      element.on('plotly_click', (data: any) => {
        const point = data.points[0];
        const traceName = point.data.name;

        if (traceName && traceName.includes('Anomalies')) {
          const timestamp = new Date(point.x).toLocaleString();
          const message = `Anomaly detected: ${point.y} at ${timestamp}`;
          alert(message);
        }
      });
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
      // Recreate traces - separate normal and anomaly data
      const allTraces: any[] = [];
      const anomalyTraces: any[] = [];

      this.readingsMap.forEach((readings, sensorType) => {
        // Normal data trace
        const normalData = readings.filter(r => !r.isAnomaly);

        allTraces.push({
          type: 'scatter',
          mode: 'lines',
          name: sensorType,
          x: normalData.map(r => new Date(r.timestamp)),
          y: normalData.map(r => r.value),
          line: {
            shape: 'spline',
            width: 3,
            color: this.getSensorColor(sensorType, false)
          }
        });

        // Anomaly data separate trace for better visibility
        const anomalyData = readings.filter(r => r.isAnomaly);

        if (anomalyData.length > 0) {
          anomalyTraces.push({
            type: 'scatter',
            mode: 'markers',
            name: `${sensorType} Anomalies`,
            x: anomalyData.map(r => new Date(r.timestamp)),
            y: anomalyData.map(r => r.value),
            marker: {
              size: 12,
              symbol: 'circle',
              color: '#F44336',
              line: {
                width: 2,
                color: 'white'
              }
            },
            hoverinfo: 'x+y+text',
            text: anomalyData.map(r => `ANOMALY: ${r.sensorType} ${r.value}`)
          });
        }
      });

      // Add anomaly traces
      allTraces.push(...anomalyTraces);

      // Update full chart data
      Plotly.react(this.chart, allTraces);

      // Update anomaly annotation
      Plotly.relayout(this.chart, {
        annotations: this.anomalyCount > 0 ? [
          {
            x: 0.5,
            y: 1.12,
            xref: 'paper',
            yref: 'paper',
            text: `⚠️ ${this.anomalyCount} Anomalies Detected`,
            showarrow: false,
            font: {
              family: 'Arial',
              size: 16,
              color: '#F44336',
              weight: 'bold'
            },
          }
        ] : []
      });

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
    if (readings.length > 100) {
      readings.shift(); // Remove oldest
    }

    // Use Plotly.react instead of extend to ensure complete refresh
    this.updateChart();
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
