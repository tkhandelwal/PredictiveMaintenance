// src/app/components/monitoring/sensor-chart/sensor-chart.component.ts
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { SensorReading } from '../../../models/sensor-reading.model';
import { SignalRService } from '../../../services/signalr.service';
import { ThemeService } from '../../../services/theme.service';
import { Subscription, Subject, fromEvent } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

declare const Plotly: any;

type TimeWindowKey = '1m' | '5m' | '10m' | '30m' | '1h' | '4h' | '12h' | '1d' | '1w';
type ChartType = '2d' | '3d' | 'heatmap' | 'contour' | 'scatter3d';

interface ChartConfiguration {
  type: ChartType;
  showGrid: boolean;
  showLegend: boolean;
  showAnomalies: boolean;
  interpolation: 'linear' | 'spline' | 'step';
  colorScheme: 'default' | 'viridis' | 'plasma' | 'inferno' | 'turbo';
}

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './sensor-chart.component.html',
  styleUrls: ['./sensor-chart.component.scss']
})
export class SensorChartComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef;
  @ViewChild('chart3d', { static: false }) chart3dElement!: ElementRef;

  @Input() equipmentId!: number;
  @Input() readings: SensorReading[] = [];
  @Input() height: number = 500;

  // Chart configuration
  chartConfig: ChartConfiguration = {
    type: '2d',
    showGrid: true,
    showLegend: true,
    showAnomalies: true,
    interpolation: 'spline',
    colorScheme: 'default'
  };

  // Data management
  private chart: any;
  chartInitialized = false;
  isLoading = true;
  connected = false;
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();
  private resizeSubject = new Subject<void>();
  private readingsMap: Map<string, SensorReading[]> = new Map();

  // UI state
  sensorTypes: string[] = [];
  selectedSensors: string[] = [];
  anomalyCount = 0;
  isDarkTheme = false;

  // Time navigation
  selectedTimeWindow: TimeWindowKey = '1h';
  startDate: Date = new Date(Date.now() - 3600000);
  endDate: Date = new Date();
  isLiveData: boolean = true;

  // Statistical data
  statistics: Map<string, any> = new Map();
  correlationData: any = null;

  // Export options
  exportFormats = ['PNG', 'SVG', 'PDF', 'CSV', 'JSON'];

  private readonly timeWindows: Record<TimeWindowKey, { minutes?: number, hours?: number, days?: number }> = {
    '1m': { minutes: 1 },
    '5m': { minutes: 5 },
    '10m': { minutes: 10 },
    '30m': { minutes: 30 },
    '1h': { hours: 1 },
    '4h': { hours: 4 },
    '12h': { hours: 12 },
    '1d': { days: 1 },
    '1w': { days: 7 }
  };

  private colorPalettes = {
    default: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
    viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
    plasma: ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26'],
    inferno: ['#000004', '#1b0c41', '#4a0c4e', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d03c'],
    turbo: ['#30123b', '#4454c4', '#4290fe', '#28bbec', '#1ac7c1', '#1ddfa3', '#52f667', '#adfc2a', '#feca2e']
  };

  constructor(
    private signalRService: SignalRService,
    private themeService: ThemeService,
    private ngZone: NgZone
  ) {
    this.resizeSubject.pipe(
      debounceTime(200),
      takeUntil(this.destroy$)
    ).subscribe(() => this.resizeChart());
  }

  ngOnInit(): void {
    console.log(`Initializing advanced chart for equipment ${this.equipmentId}`);

    this.subscriptions.push(
      this.themeService.isDarkTheme$().subscribe(isDark => {
        this.isDarkTheme = isDark;
        if (this.chartInitialized) {
          this.updateChartTheme();
        }
      })
    );

    this.organizeReadings();
    this.calculateStatistics();

    this.subscriptions.push(
      this.signalRService.getConnectionState().subscribe(state => {
        this.connected = state === 'Connected';
      })
    );

    this.subscriptions.push(
      this.signalRService.getSensorReadings().subscribe(reading => {
        if (reading && reading.equipmentId === this.equipmentId) {
          this.addReading(reading);
        }
      })
    );

    this.signalRService.subscribeToEquipment(this.equipmentId);

    fromEvent(window, 'resize')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.resizeSubject.next());
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (!this.chartInitialized && this.readings.length > 0) {
        this.initChart();
      }
    }, 300);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readings'] && !changes['readings'].firstChange) {
      this.isLoading = false;
      this.organizeReadings();
      this.calculateStatistics();

      if (this.chartInitialized) {
        this.updateChart();
      } else if (this.readings.length > 0) {
        this.initChart();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());

    this.signalRService.unsubscribeFromEquipment(this.equipmentId);

    if (this.chart && this.chartInitialized) {
      try {
        Plotly.purge(this.chart);
      } catch (e) {
        console.error('Error cleaning up chart:', e);
      }
    }
  }

  onChartTypeChange(type: ChartType): void {
    this.chartConfig.type = type;
    this.initChart();
  }

  onTimeWindowChange(): void {
    this.isLiveData = true;
    this.updateTimeRange();
    this.updateChart();
  }

  updateTimeRange(): void {
    const window = this.timeWindows[this.selectedTimeWindow];
    this.endDate = new Date();
    this.startDate = new Date(this.endDate);

    if (window.minutes) {
      this.startDate.setMinutes(this.startDate.getMinutes() - window.minutes);
    } else if (window.hours) {
      this.startDate.setHours(this.startDate.getHours() - window.hours);
    } else if (window.days) {
      this.startDate.setDate(this.startDate.getDate() - window.days);
    }
  }

  applyDateRange(): void {
    if (this.startDate && this.endDate) {
      this.isLiveData = false;
      this.updateChart();
    }
  }

  toggleSensor(sensor: string): void {
    const index = this.selectedSensors.indexOf(sensor);
    if (index > -1) {
      this.selectedSensors.splice(index, 1);
    } else {
      this.selectedSensors.push(sensor);
    }
    this.updateChart();
  }

  exportChart(format: string): void {
    if (!this.chart) return;

    switch (format) {
      case 'PNG':
        Plotly.downloadImage(this.chart, { format: 'png', width: 1920, height: 1080 });
        break;
      case 'SVG':
        Plotly.downloadImage(this.chart, { format: 'svg' });
        break;
      case 'CSV':
        this.exportCSV();
        break;
      case 'JSON':
        this.exportJSON();
        break;
    }
  }

  private exportCSV(): void {
    let csv = 'Timestamp,Equipment,Sensor,Value,Unit,Anomaly\n';

    this.readingsMap.forEach((readings, sensorType) => {
      readings.forEach(reading => {
        csv += `${reading.timestamp},${this.equipmentId},${sensorType},${reading.value},unit,${reading.isAnomaly}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensor_data_${this.equipmentId}_${new Date().toISOString()}.csv`;
    a.click();
  }

  private exportJSON(): void {
    const data = {
      equipmentId: this.equipmentId,
      exportDate: new Date(),
      timeRange: { start: this.startDate, end: this.endDate },
      sensors: Array.from(this.readingsMap.entries()).map(([sensor, readings]) => ({
        sensor,
        readings: readings.map(r => ({
          timestamp: r.timestamp,
          value: r.value,
          isAnomaly: r.isAnomaly
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensor_data_${this.equipmentId}_${new Date().toISOString()}.json`;
    a.click();
  }

  private organizeReadings(): void {
    this.readingsMap.clear();
    this.anomalyCount = 0;

    this.readings.forEach(reading => {
      if (!this.readingsMap.has(reading.sensorType)) {
        this.readingsMap.set(reading.sensorType, []);
      }
      this.readingsMap.get(reading.sensorType)!.push({ ...reading });

      if (reading.isAnomaly) {
        this.anomalyCount++;
      }
    });

    this.readingsMap.forEach((readings, sensorType) => {
      readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    this.sensorTypes = Array.from(this.readingsMap.keys());
    this.selectedSensors = [...this.sensorTypes];
  }

  private calculateStatistics(): void {
    this.statistics.clear();

    this.readingsMap.forEach((readings, sensorType) => {
      const values = readings.map(r => r.value);
      if (values.length === 0) return;

      const stats = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        stdDev: 0,
        variance: 0,
        anomalyRate: readings.filter(r => r.isAnomaly).length / readings.length * 100
      };

      // Calculate variance and standard deviation
      const squaredDiffs = values.map(v => Math.pow(v - stats.mean, 2));
      stats.variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
      stats.stdDev = Math.sqrt(stats.variance);

      this.statistics.set(sensorType, stats);
    });

    // Calculate correlations
    this.calculateCorrelations();
  }

  private calculateCorrelations(): void {
    if (this.sensorTypes.length < 2) return;

    const correlationMatrix: number[][] = [];

    for (let i = 0; i < this.sensorTypes.length; i++) {
      correlationMatrix[i] = [];
      for (let j = 0; j < this.sensorTypes.length; j++) {
        if (i === j) {
          correlationMatrix[i][j] = 1;
        } else {
          correlationMatrix[i][j] = this.calculatePearsonCorrelation(
            this.sensorTypes[i],
            this.sensorTypes[j]
          );
        }
      }
    }

    this.correlationData = {
      sensors: this.sensorTypes,
      matrix: correlationMatrix
    };
  }

  private calculatePearsonCorrelation(sensor1: string, sensor2: string): number {
    const readings1 = this.readingsMap.get(sensor1) || [];
    const readings2 = this.readingsMap.get(sensor2) || [];

    if (readings1.length < 2 || readings2.length < 2) return 0;

    // Align timestamps
    const timestamps = new Set<string>();
    readings1.forEach(r => timestamps.add(new Date(r.timestamp).toISOString()));
    readings2.forEach(r => timestamps.add(new Date(r.timestamp).toISOString()));

    const alignedData: { x: number[], y: number[] } = { x: [], y: [] };

    timestamps.forEach(timestamp => {
      const r1 = readings1.find(r => new Date(r.timestamp).toISOString() === timestamp);
      const r2 = readings2.find(r => new Date(r.timestamp).toISOString() === timestamp);

      if (r1 && r2) {
        alignedData.x.push(r1.value);
        alignedData.y.push(r2.value);
      }
    });

    if (alignedData.x.length < 2) return 0;

    // Calculate Pearson correlation
    const n = alignedData.x.length;
    const sumX = alignedData.x.reduce((a, b) => a + b, 0);
    const sumY = alignedData.y.reduce((a, b) => a + b, 0);
    const sumXY = alignedData.x.reduce((sum, x, i) => sum + x * alignedData.y[i], 0);
    const sumX2 = alignedData.x.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = alignedData.y.reduce((sum, y) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private initChart(): void {
    if (!this.chartElement?.nativeElement) return;

    const element = this.chartElement.nativeElement;

    try {
      switch (this.chartConfig.type) {
        case '3d':
          this.init3DChart();
          break;
        case 'heatmap':
          this.initHeatmapChart();
          break;
        case 'contour':
          this.initContourChart();
          break;
        case 'scatter3d':
          this.initScatter3DChart();
          break;
        default:
          this.init2DChart();
      }
    } catch (e) {
      console.error('Error initializing chart:', e);
      this.isLoading = false;
    }
  }

  private init2DChart(): void {
    const traces: any[] = [];
    const anomalyTraces: any[] = [];

    const visibleSensors = this.selectedSensors.length > 0 ?
      this.selectedSensors : this.sensorTypes;

    visibleSensors.forEach((sensorType, index) => {
      const readings = this.readingsMap.get(sensorType) || [];
      const normalData = readings.filter(r => !r.isAnomaly);
      const anomalyData = readings.filter(r => r.isAnomaly);

      const color = this.getColorForIndex(index);

      // Normal data trace
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: sensorType,
        x: normalData.map(r => new Date(r.timestamp)),
        y: normalData.map(r => r.value),
        line: {
          shape: this.chartConfig.interpolation,
          width: 2,
          color: color
        },
        marker: {
          size: 4,
          color: color
        },
        hovertemplate: '%{y:.2f}<br>%{x}<extra>%{fullData.name}</extra>'
      });

      // Anomaly trace
      if (this.chartConfig.showAnomalies && anomalyData.length > 0) {
        anomalyTraces.push({
          type: 'scatter',
          mode: 'markers',
          name: `${sensorType} Anomalies`,
          x: anomalyData.map(r => new Date(r.timestamp)),
          y: anomalyData.map(r => r.value),
          marker: {
            size: 10,
            symbol: 'x',
            color: '#ff0000',
            line: {
              width: 2,
              color: '#800000'
            }
          },
          hovertemplate: 'ANOMALY<br>%{y:.2f}<br>%{x}<extra>%{fullData.name}</extra>'
        });
      }
    });

    // Add statistics overlay if enabled
    if (this.statistics.size > 0) {
      visibleSensors.forEach((sensorType, index) => {
        const stats = this.statistics.get(sensorType);
        if (stats) {
          // Add mean line
          traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `${sensorType} Mean`,
            x: [this.startDate, this.endDate],
            y: [stats.mean, stats.mean],
            line: {
              dash: 'dash',
              width: 1,
              color: this.getColorForIndex(index)
            },
            showlegend: false,
            hoverinfo: 'skip'
          });
        }
      });
    }

    const allTraces = [...traces, ...anomalyTraces];

    const layout = this.create2DLayout();

    this.ngZone.runOutsideAngular(() => {
      Plotly.newPlot(this.chartElement.nativeElement, allTraces, layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
          format: 'png',
          filename: `sensor_chart_${this.equipmentId}`,
          height: 1080,
          width: 1920,
          scale: 2
        }
      });
    });

    this.chart = this.chartElement.nativeElement;
    this.chartInitialized = true;
    this.isLoading = false;
  }

  private init3DChart(): void {
    const traces: any[] = [];
    const visibleSensors = this.selectedSensors.length > 0 ?
      this.selectedSensors : this.sensorTypes;

    if (visibleSensors.length < 2) {
      // Fallback to 2D if not enough sensors
      this.init2DChart();
      return;
    }

    // Create 3D surface plot
    const xSensor = visibleSensors[0];
    const ySensor = visibleSensors[1];
    const xData = this.readingsMap.get(xSensor) || [];
    const yData = this.readingsMap.get(ySensor) || [];

    // Create grid for surface
    const gridSize = 50;
    const xMin = Math.min(...xData.map(r => r.value));
    const xMax = Math.max(...xData.map(r => r.value));
    const yMin = Math.min(...yData.map(r => r.value));
    const yMax = Math.max(...yData.map(r => r.value));

    const xGrid = [];
    const yGrid = [];
    const zGrid = [];

    for (let i = 0; i < gridSize; i++) {
      xGrid.push(xMin + (xMax - xMin) * i / (gridSize - 1));
      yGrid.push(yMin + (yMax - yMin) * i / (gridSize - 1));
      zGrid.push([]);

      for (let j = 0; j < gridSize; j++) {
        // Calculate z value based on correlation or time
        const correlation = this.correlationData?.matrix[0][1] || 0;
        zGrid[i].push(Math.sin(i / 10) * Math.cos(j / 10) * correlation);
      }
    }

    traces.push({
      type: 'surface',
      x: xGrid,
      y: yGrid,
      z: zGrid,
      colorscale: this.getColorScale(),
      showscale: true,
      name: `${xSensor} vs ${ySensor}`
    });

    // Add scatter points for actual readings
    if (xData.length > 0 && yData.length > 0) {
      const alignedData = this.alignSensorData(xSensor, ySensor);

      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: alignedData.x,
        y: alignedData.y,
        z: alignedData.timestamps.map((t, i) => i),
        marker: {
          size: 4,
          color: alignedData.anomalies.map(a => a ? '#ff0000' : '#0000ff'),
          line: {
            width: 1,
            color: '#000000'
          }
        },
        name: 'Actual Readings'
      });
    }

    const layout = this.create3DLayout();

    this.ngZone.runOutsideAngular(() => {
      Plotly.newPlot(this.chartElement.nativeElement, traces, layout, {
        responsive: true,
        displayModeBar: true
      });
    });

    this.chart = this.chartElement.nativeElement;
    this.chartInitialized = true;
    this.isLoading = false;
  }

  private initHeatmapChart(): void {
    // Create heatmap showing sensor correlations
    if (!this.correlationData) {
      this.init2DChart();
      return;
    }

    const trace = {
      type: 'heatmap',
      x: this.correlationData.sensors,
      y: this.correlationData.sensors,
      z: this.correlationData.matrix,
      colorscale: this.getColorScale(),
      showscale: true,
      hovertemplate: '%{x} vs %{y}<br>Correlation: %{z:.2f}<extra></extra>'
    };

    const layout = {
      title: 'Sensor Correlation Matrix',
      xaxis: { title: 'Sensors', tickangle: -45 },
      yaxis: { title: 'Sensors' },
      height: this.height,
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      plot_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      font: { color: this.isDarkTheme ? '#f1f5f9' : '#333' }
    };

    this.ngZone.runOutsideAngular(() => {
      Plotly.newPlot(this.chartElement.nativeElement, [trace], layout, {
        responsive: true
      });
    });

    this.chart = this.chartElement.nativeElement;
    this.chartInitialized = true;
    this.isLoading = false;
  }

  private initContourChart(): void {
    // Create contour plot for density visualization
    const visibleSensors = this.selectedSensors.length > 0 ?
      this.selectedSensors : this.sensorTypes;

    if (visibleSensors.length < 2) {
      this.init2DChart();
      return;
    }

    const xSensor = visibleSensors[0];
    const ySensor = visibleSensors[1];
    const alignedData = this.alignSensorData(xSensor, ySensor);

    const trace = {
      type: 'histogram2dcontour',
      x: alignedData.x,
      y: alignedData.y,
      colorscale: this.getColorScale(),
      showscale: true,
      contours: {
        showlabels: true,
        labelfont: {
          size: 12,
          color: this.isDarkTheme ? 'white' : 'black'
        }
      }
    };

    const layout = {
      title: `${xSensor} vs ${ySensor} Density`,
      xaxis: { title: xSensor },
      yaxis: { title: ySensor },
      height: this.height,
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      plot_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      font: { color: this.isDarkTheme ? '#f1f5f9' : '#333' }
    };

    this.ngZone.runOutsideAngular(() => {
      Plotly.newPlot(this.chartElement.nativeElement, [trace], layout, {
        responsive: true
      });
    });

    this.chart = this.chartElement.nativeElement;
    this.chartInitialized = true;
    this.isLoading = false;
  }

  private initScatter3DChart(): void {
    const visibleSensors = this.selectedSensors.length > 0 ?
      this.selectedSensors : this.sensorTypes;

    if (visibleSensors.length < 3) {
      this.init3DChart();
      return;
    }

    const traces: any[] = [];

    // Use first 3 sensors for x, y, z
    const xSensor = visibleSensors[0];
    const ySensor = visibleSensors[1];
    const zSensor = visibleSensors[2];

    const alignedData = this.align3SensorData(xSensor, ySensor, zSensor);

    // Normal points
    const normalIndices = alignedData.anomalies
      .map((a, i) => !a ? i : -1)
      .filter(i => i !== -1);

    if (normalIndices.length > 0) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'Normal',
        x: normalIndices.map(i => alignedData.x[i]),
        y: normalIndices.map(i => alignedData.y[i]),
        z: normalIndices.map(i => alignedData.z[i]),
        marker: {
          size: 4,
          color: '#0066cc',
          opacity: 0.8
        }
      });
    }

    // Anomaly points
    const anomalyIndices = alignedData.anomalies
      .map((a, i) => a ? i : -1)
      .filter(i => i !== -1);

    if (anomalyIndices.length > 0) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'Anomalies',
        x: anomalyIndices.map(i => alignedData.x[i]),
        y: anomalyIndices.map(i => alignedData.y[i]),
        z: anomalyIndices.map(i => alignedData.z[i]),
        marker: {
          size: 8,
          color: '#ff0000',
          symbol: 'x',
          line: {
            width: 2,
            color: '#800000'
          }
        }
      });
    }

    const layout = {
      title: '3D Sensor Analysis',
      scene: {
        xaxis: { title: xSensor },
        yaxis: { title: ySensor },
        zaxis: { title: zSensor },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
      },
      height: this.height,
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      font: { color: this.isDarkTheme ? '#f1f5f9' : '#333' }
    };

    this.ngZone.runOutsideAngular(() => {
      Plotly.newPlot(this.chartElement.nativeElement, traces, layout, {
        responsive: true
      });
    });

    this.chart = this.chartElement.nativeElement;
    this.chartInitialized = true;
    this.isLoading = false;
  }

  private alignSensorData(sensor1: string, sensor2: string): any {
    const readings1 = this.readingsMap.get(sensor1) || [];
    const readings2 = this.readingsMap.get(sensor2) || [];

    const alignedData = {
      x: [] as number[],
      y: [] as number[],
      timestamps: [] as Date[],
      anomalies: [] as boolean[]
    };

    // Find common timestamps
    const timestamps1 = new Map(readings1.map(r => [new Date(r.timestamp).getTime(), r]));
    const timestamps2 = new Map(readings2.map(r => [new Date(r.timestamp).getTime(), r]));

    timestamps1.forEach((r1, timestamp) => {
      const r2 = timestamps2.get(timestamp);
      if (r2) {
        alignedData.x.push(r1.value);
        alignedData.y.push(r2.value);
        alignedData.timestamps.push(new Date(timestamp));
        alignedData.anomalies.push(r1.isAnomaly || r2.isAnomaly);
      }
    });

    return alignedData;
  }

  private align3SensorData(sensor1: string, sensor2: string, sensor3: string): any {
    const readings1 = this.readingsMap.get(sensor1) || [];
    const readings2 = this.readingsMap.get(sensor2) || [];
    const readings3 = this.readingsMap.get(sensor3) || [];

    const alignedData = {
      x: [] as number[],
      y: [] as number[],
      z: [] as number[],
      timestamps: [] as Date[],
      anomalies: [] as boolean[]
    };

    // Find common timestamps
    const timestamps1 = new Map(readings1.map(r => [new Date(r.timestamp).getTime(), r]));
    const timestamps2 = new Map(readings2.map(r => [new Date(r.timestamp).getTime(), r]));
    const timestamps3 = new Map(readings3.map(r => [new Date(r.timestamp).getTime(), r]));

    timestamps1.forEach((r1, timestamp) => {
      const r2 = timestamps2.get(timestamp);
      const r3 = timestamps3.get(timestamp);
      if (r2 && r3) {
        alignedData.x.push(r1.value);
        alignedData.y.push(r2.value);
        alignedData.z.push(r3.value);
        alignedData.timestamps.push(new Date(timestamp));
        alignedData.anomalies.push(r1.isAnomaly || r2.isAnomaly || r3.isAnomaly);
      }
    });

    return alignedData;
  }

  private create2DLayout(): any {
    return {
      title: {
        text: 'Sensor Readings Analysis',
        font: { size: 18, color: this.isDarkTheme ? '#f1f5f9' : '#333' }
      },
      xaxis: {
        title: 'Time',
        type: 'date',
        gridcolor: this.isDarkTheme ? '#334155' : '#e0e0e0',
        color: this.isDarkTheme ? '#f1f5f9' : '#333',
        range: [this.startDate, this.endDate],
        showgrid: this.chartConfig.showGrid
      },
      yaxis: {
        title: 'Value',
        gridcolor: this.isDarkTheme ? '#334155' : '#e0e0e0',
        color: this.isDarkTheme ? '#f1f5f9' : '#333',
        showgrid: this.chartConfig.showGrid
      },
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      plot_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      showlegend: this.chartConfig.showLegend,
      legend: {
        orientation: 'h',
        y: -0.2,
        x: 0.5,
        xanchor: 'center'
      },
      height: this.height,
      margin: { l: 60, r: 60, t: 60, b: 60 },
      hovermode: 'closest',
      font: {
        family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: this.isDarkTheme ? '#f1f5f9' : '#333'
      }
    };
  }

  private create3DLayout(): any {
    return {
      title: {
        text: '3D Sensor Analysis',
        font: { size: 18, color: this.isDarkTheme ? '#f1f5f9' : '#333' }
      },
      scene: {
        xaxis: {
          title: this.selectedSensors[0] || 'X',
          gridcolor: this.isDarkTheme ? '#334155' : '#e0e0e0',
          color: this.isDarkTheme ? '#f1f5f9' : '#333'
        },
        yaxis: {
          title: this.selectedSensors[1] || 'Y',
          gridcolor: this.isDarkTheme ? '#334155' : '#e0e0e0',
          color: this.isDarkTheme ? '#f1f5f9' : '#333'
        },
        zaxis: {
          title: 'Time/Value',
          gridcolor: this.isDarkTheme ? '#334155' : '#e0e0e0',
          color: this.isDarkTheme ? '#f1f5f9' : '#333'
        },
        bgcolor: this.isDarkTheme ? '#1e293b' : 'white'
      },
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      height: this.height,
      font: {
        family: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: this.isDarkTheme ? '#f1f5f9' : '#333'
      }
    };
  }

  private getColorScale(): string {
    return this.chartConfig.colorScheme;
  }

  private getColorForIndex(index: number): string {
    const colors = this.colorPalettes[this.chartConfig.colorScheme] || this.colorPalettes.default;
    return colors[index % colors.length];
  }

  private updateChart(): void {
    if (!this.chart || !this.chartInitialized) {
      this.initChart();
      return;
    }

    // Reinitialize chart with new data
    this.chartInitialized = false;
    this.initChart();
  }

  private updateChartTheme(): void {
    if (!this.chart || !this.chartInitialized) return;

    const layout = {
      paper_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      plot_bgcolor: this.isDarkTheme ? '#1e293b' : 'white',
      font: { color: this.isDarkTheme ? '#f1f5f9' : '#333' }
    };

    this.ngZone.runOutsideAngular(() => {
      Plotly.relayout(this.chart, layout);
    });
  }

  private resizeChart(): void {
    if (!this.chart || !this.chartInitialized) return;

    try {
      this.ngZone.runOutsideAngular(() => {
        Plotly.Plots.resize(this.chart);
      });
    } catch (e) {
      console.error('Error resizing chart:', e);
    }
  }

  private addReading(reading: SensorReading): void {
    if (!reading) return;

    if (!this.readingsMap.has(reading.sensorType)) {
      this.readingsMap.set(reading.sensorType, []);
      this.sensorTypes = Array.from(this.readingsMap.keys());
    }

    const readings = this.readingsMap.get(reading.sensorType)!;
    readings.push({ ...reading });

    // Limit to last 1000 points
    while (readings.length > 1000) {
      readings.shift();
    }

    if (!this.isLiveData) return;

    this.updateChart();
  }

  getSensorColor(sensorType: string): string {
    const index = this.sensorTypes.indexOf(sensorType);
    return this.getColorForIndex(index);
  }
}
