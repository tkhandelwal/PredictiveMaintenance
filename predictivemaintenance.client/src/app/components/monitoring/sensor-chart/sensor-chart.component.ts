import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SensorReading } from '../../../models/sensor-reading.model';
import { SignalRService } from '../../../services/signalr.service';
import { ThemeService } from '../../../services/theme.service';
import { Subscription, Subject, fromEvent, config } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// Declare Plotly as any to avoid TypeScript errors
declare const Plotly: any;

// Define the TimeWindowKey type
type TimeWindowKey = '1m' | '5m' | '10m' | '30m' | '1h' | '4h' | '1d';

@Component({
  selector: 'app-sensor-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
  <div class="chart-container">
    <div class="chart-controls-toolbar">
      <!-- Time window selection -->
      <mat-button-toggle-group [(ngModel)]="selectedTimeWindow" (change)="onTimeWindowChange()">
        <mat-button-toggle value="1m">1m</mat-button-toggle>
        <mat-button-toggle value="5m">5m</mat-button-toggle>
        <mat-button-toggle value="10m">10m</mat-button-toggle>
        <mat-button-toggle value="30m">30m</mat-button-toggle>
        <mat-button-toggle value="1h">1h</mat-button-toggle>
        <mat-button-toggle value="4h">4h</mat-button-toggle>
        <mat-button-toggle value="1d">1d</mat-button-toggle>
      </mat-button-toggle-group>
      
      <!-- Date/time picker -->
      <div class="date-time-picker">
        <mat-form-field appearance="fill">
          <mat-label>Start date</mat-label>
          <input matInput [matDatepicker]="startPicker" [(ngModel)]="startDate">
          <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>
        
        <mat-form-field appearance="fill">
          <mat-label>End date</mat-label>
          <input matInput [matDatepicker]="endPicker" [(ngModel)]="endDate">
          <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>
        
        <button mat-raised-button color="primary" (click)="applyDateRange()">Apply</button>
      </div>
      
      <!-- Navigation controls -->
      <div class="chart-navigation">
        <button mat-icon-button (click)="moveTimePeriod(-1)" matTooltip="Previous time period">
          <mat-icon>navigate_before</mat-icon>
        </button>
        <button mat-icon-button (click)="moveTimePeriod(1)" matTooltip="Next time period">
          <mat-icon>navigate_next</mat-icon>
        </button>
        <button mat-icon-button (click)="resetToLiveData()" 
                matTooltip="Return to live data"
                [disabled]="isLiveData">
          <mat-icon>update</mat-icon>
        </button>
      </div>
    </div>

    <!-- Chart wrapper with proper positioning -->
    <div class="chart-wrapper">
      <div #chart class="chart"></div>
      
      <!-- Connection status indicator -->
      <div class="connection-status" [class.connected]="connected" [class.disconnected]="!connected">
        <span class="status-indicator"></span>
        {{ connected ? 'Real-time data active' : 'Waiting for connection...' }}
      </div>
      
      <!-- Chart controls (legend) -->
      <div class="chart-controls" *ngIf="chartInitialized && sensorTypes.length > 0">
        <div class="chart-legend">
          <ng-container *ngFor="let sensor of sensorTypes">
            <div class="legend-item">
              <span class="legend-color" [style.background-color]="getSensorColor(sensor, false)"></span>
              <span class="legend-label">{{sensor}}</span>
            </div>
          </ng-container>
        </div>
        
        <div class="anomaly-legend" *ngIf="anomalyCount > 0">
          <div class="anomaly-indicator"></div>
          <span>{{ anomalyCount }} Anomalies Detected</span>
        </div>
      </div>
    </div>
    
    <!-- Loading overlay -->
    <div *ngIf="!chartInitialized || isLoading" class="chart-loading">
      <mat-spinner diameter="40"></mat-spinner>
      <p>{{ isLoading ? 'Loading sensor data...' : 'Initializing chart...' }}</p>
    </div>
  </div>
`,
  styleUrls: ['./sensor-chart.component.scss']
})
export class SensorChartComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef;
  @Input() equipmentId!: number;
  @Input() readings: SensorReading[] = [];

  private chart: any;
  chartInitialized = false;
  isLoading = true;
  connected = false;
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();
  private resizeSubject = new Subject<void>();
  private readingsMap: Map<string, SensorReading[]> = new Map();
  sensorTypes: string[] = [];
  anomalyCount = 0;
  private plotlyAvailable = false;
  private updateInterval: any;
  private refreshTimer: any;
  private pollTimer: any;
  isDarkTheme = false;

  // Time navigation properties
  selectedTimeWindow: TimeWindowKey = '30m';
  startDate: Date = new Date(Date.now() - 30 * 60 * 1000);
  endDate: Date = new Date();
  isLiveData: boolean = true;

  // Time window definitions
  private readonly timeWindows: Record<TimeWindowKey, { minutes?: number, hours?: number, days?: number }> = {
    '1m': { minutes: 1 },
    '5m': { minutes: 5 },
    '10m': { minutes: 10 },
    '30m': { minutes: 30 },
    '1h': { hours: 1 },
    '4h': { hours: 4 },
    '1d': { days: 1 }
  };

  constructor(
    private signalRService: SignalRService,
    private themeService: ThemeService,
    private ngZone: NgZone
  ) {
    // Set up debounced resize handling
    this.resizeSubject.pipe(
      debounceTime(200),
      takeUntil(this.destroy$)
    ).subscribe(() => this.resizeChart());
  }

  ngOnInit(): void {
    console.log(`Initializing chart for equipment ${this.equipmentId}`);

    // Subscribe to theme changes
    this.subscriptions.push(
      this.themeService.isDarkTheme$().subscribe(isDark => {
        this.isDarkTheme = isDark;
        // Update chart if it's already initialized
        if (this.chartInitialized) {
          this.updateChartTheme();
        }
      })
    );

    // Check if Plotly is available
    this.checkPlotlyAvailability();

    // Organize readings by sensor type
    this.organizeReadings();

    // Subscribe to connection state
    this.subscriptions.push(
      this.signalRService.getConnectionState().subscribe(state => {
        this.connected = state === 'Connected';
        console.log(`SignalR connection state: ${state}`);

        // If we just reconnected, try to update the chart
        if (state === 'Connected' && this.chartInitialized) {
          this.updateChart();
        }
      })
    );

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

    // Subscribe to status changes for this equipment
    this.subscriptions.push(
      this.signalRService.getStatusChanges().subscribe(statusChange => {
        if (statusChange && statusChange.equipmentId === this.equipmentId) {
          console.log(`Status changed for equipment ${this.equipmentId}: ${statusChange.currentStatus}`);
        }
      })
    );

    // Subscribe to the equipment updates
    this.signalRService.subscribeToEquipment(this.equipmentId)
      .then(() => {
        console.log(`Successfully subscribed to equipment ${this.equipmentId}`);
      })
      .catch((err: Error) => {
        console.error(`Error subscribing to equipment ${this.equipmentId}:`, err);
      });

    // Set up a periodic refresh
    this.updateInterval = setInterval(() => {
      if (this.chartInitialized) {
        this.updateChart();
      }
    }, 10000); // Refresh every 10 seconds

    // Set up a polling fallback for when SignalR isn't working
    this.setupPollingFallback();

    // Listen for window resize events
    fromEvent(window, 'resize')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.resizeSubject.next());
  }

  ngAfterViewInit(): void {
    // Ensure chart is properly sized after view is fully initialized
    setTimeout(() => {
      if (this.chartInitialized && this.chartElement?.nativeElement) {
        this.resizeChart();
      } else if (this.chartElement?.nativeElement && !this.chartInitialized && this.readings.length > 0) {
        // If chart not initialized but we have data, try to initialize it
        this.initChart();
      }
    }, 300);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readings'] && !changes['readings'].firstChange) {
      console.log(`Readings changed: ${this.readings.length} readings available`);
      this.isLoading = false;
      this.organizeReadings();

      if (this.chartInitialized) {
        this.updateChart();
      } else if (this.readings.length > 0 && this.plotlyAvailable) {
        this.initChart();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.subscriptions.forEach(sub => sub.unsubscribe());

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Unsubscribe from SignalR
    this.signalRService.unsubscribeFromEquipment(this.equipmentId)
      .catch((err: Error) => {
        console.error(`Error unsubscribing from equipment ${this.equipmentId}:`, err);
      });

    // Clean up Plotly chart
    if (this.chart && this.chartInitialized) {
      try {
        Plotly.purge(this.chart);
      } catch (e) {
        console.error('Error cleaning up chart:', e);
      }
    }
  }

  // Time navigation methods
  onTimeWindowChange(): void {
    this.isLiveData = true;
    this.updateTimeRange();
    this.updateChart();
  }

  updateTimeRange(): void {
    const windowKey = this.selectedTimeWindow;
    const window = this.timeWindows[windowKey];

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

  moveTimePeriod(direction: number): void {
    // Calculate time difference between start and end
    const timeSpan = this.endDate.getTime() - this.startDate.getTime();

    // Move both dates by the timespan in the specified direction
    this.startDate = new Date(this.startDate.getTime() + (timeSpan * direction));
    this.endDate = new Date(this.endDate.getTime() + (timeSpan * direction));

    // If we move to current time, switch to live mode
    const now = new Date();
    if (Math.abs(this.endDate.getTime() - now.getTime()) < 10000) { // Within 10 seconds of now
      this.endDate = now;
      this.isLiveData = true;
    } else {
      this.isLiveData = false;
    }

    this.updateChart();
  }

  resetToLiveData(): void {
    this.isLiveData = true;
    this.updateTimeRange();
    this.updateChart();
  }

  private checkPlotlyAvailability(): void {
    if (typeof Plotly !== 'undefined') {
      this.plotlyAvailable = true;
      this.initChart();
    } else {
      console.log('Plotly not available, attempting to load dynamically');
      this.loadPlotlyScript().then(() => {
        this.plotlyAvailable = true;
        this.initChart();
      }).catch(error => {
        console.error('Failed to load Plotly:', error);
        this.isLoading = false;
        // Show a friendly message to the user
        const element = this.chartElement.nativeElement;
        if (element) {
          element.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
              <p style="color: #d32f2f; font-weight: bold;">Chart library could not be loaded</p>
              <p>Please refresh the page or check your internet connection</p>
            </div>
          `;
        }
      });
    }
  }

  private setupPollingFallback(): void {
    this.pollTimer = setInterval(() => {
      // Only use polling if SignalR is not connected
      if (!this.connected && this.equipmentId) {
        console.log('SignalR not connected, using polling fallback');
        // In a real app, you would implement an HTTP fallback here
      }
    }, 20000); // Poll every 20 seconds
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
      this.readingsMap.get(reading.sensorType)!.push({ ...reading }); // Clone reading

      // Count anomalies
      if (reading.isAnomaly) {
        this.anomalyCount++;
      }
    });

    // Sort each group by timestamp
    this.readingsMap.forEach((readings, sensorType) => {
      readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    // Update sensor types list for legend
    this.sensorTypes = Array.from(this.readingsMap.keys());
    console.log(`Initialized sensor types: ${this.sensorTypes.join(', ')}`);
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
    // Make sure chartElement exists
    if (!this.chartElement || !this.chartElement.nativeElement) {
      console.error('Chart element not found');
      return;
    }

    const element = this.chartElement.nativeElement;

    // Make sure Plotly is available
    if (!this.plotlyAvailable) {
      console.log('Plotly not available yet, deferring chart initialization');
      return;
    }

    console.log(`Initializing chart with ${this.readingsMap.size} sensor types`);

    try {
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
        // Create traces for each sensor type
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
                  color: this.isDarkTheme ? '#333' : 'white'
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

      // Basic layout - remove fixed height
      const layout: any = {
        autosize: true,
        margin: { l: 50, r: 50, b: 50, t: 50, pad: 0 },
        title: {
          text: 'Sensor Readings',
          font: { size: 18, color: this.isDarkTheme ? '#ffffff' : '#333333' }
        },
        paper_bgcolor: this.isDarkTheme ? '#2d2d2d' : 'rgba(0,0,0,0)',
        plot_bgcolor: this.isDarkTheme ? '#2d2d2d' : 'rgba(0,0,0,0)',
        xaxis: {
          title: 'Time',
          type: 'date',
          gridcolor: this.isDarkTheme ? '#414141' : '#eee',
          color: this.isDarkTheme ? '#ffffff' : '#333333',
          range: [this.startDate, this.endDate],
          autorange: false // Force the range to be respected
        },
        yaxis: {
          title: 'Value',
          gridcolor: this.isDarkTheme ? '#414141' : '#eee',
          color: this.isDarkTheme ? '#ffffff' : '#333333',
          autorange: true // Let y-axis scale automatically based on data
        },
        showlegend: false, // Using our own legend
        hovermode: 'closest',
        height: 350, // Explicit height
        // Add explicit font configuration
        font: {
          family: 'Roboto, Arial, sans-serif',
          size: 12,
          color: this.isDarkTheme ? '#ffffff' : '#333333'
        }
      };

      try {
        // Create the plot - run outside Angular zone to improve performance
        this.ngZone.runOutsideAngular(() => {
          Plotly.newPlot(element, traces, layout, config);
        });

        this.chart = element;
        this.chartInitialized = true;
        this.isLoading = false;
        console.log('Chart initialized successfully with', traces.length, 'traces');

        // Add click event for anomaly points
        element.on('plotly_click', (data: any) => {
          if (!data || !data.points || data.points.length === 0) return;

          const point = data.points[0];
          const traceName = point.data.name;

          if (traceName && traceName.includes('Anomalies')) {
            const timestamp = new Date(point.x).toLocaleString();
            const message = `Anomaly detected: ${point.y} at ${timestamp}`;
            alert(message);
          }
        });

        // Call resize to ensure correct sizing
        setTimeout(() => this.resizeChart(), 100);
      } catch (e) {
        console.error('Error initializing chart:', e);
        this.isLoading = false;
        this.showErrorInElement(element, 'Error initializing chart. Please refresh the page.');
      }
    } catch (e) {
      console.error('Error preparing chart data:', e);
      this.isLoading = false;
      this.showErrorInElement(element, 'Error preparing chart data. Please refresh the page.');
    }
  }

  // sensor-chart.component.ts - Fix
  private resizeChart(): void {
    if (!this.chart || !this.chartInitialized) return;

    try {
      // Get element references
      const element = this.chartElement?.nativeElement;
      if (!element) return;

      // Calculate available space
      const parentNode = element.parentElement;
      if (!parentNode) return;

      const containerRect = parentNode.getBoundingClientRect();

      // Set explicit dimensions - use more precise calculations
      const width = Math.floor(containerRect.width * 0.98); // 98% of container width
      const height = Math.max(350, Math.floor(containerRect.height * 0.70)); // Minimum height of 350px

      // Update layout with precise dimensions
      this.ngZone.runOutsideAngular(() => {
        Plotly.relayout(this.chart, {
          width: width,
          height: height,
          'xaxis.automargin': true,
          'yaxis.automargin': true,
          margin: { l: 50, r: 20, b: 40, t: 40, pad: 0 }
        }).catch((e: Error) => {
          console.warn('Plotly relayout error:', e);
          // If relayout fails, try a more drastic approach with purge and recreate
          setTimeout(() => this.recreateChart(), 100);
        });
      });
    } catch (e) {
      console.error('Error resizing chart:', e);
    }
  }

  // Add a recreateChart method to fully rebuild the chart if needed
  private recreateChart(): void {
    if (!this.chartElement?.nativeElement) return;

    try {
      // Clean up existing chart
      Plotly.purge(this.chartElement.nativeElement);
      this.chartInitialized = false;

      // Reinitialize chart
      this.initChart();
    } catch (e) {
      console.error('Error recreating chart:', e);
    }
  }

  private updateChartTheme(): void {
    if (!this.chart || !this.chartInitialized) return;

    try {
      const layout = {
        title: {
          font: { color: this.isDarkTheme ? '#ffffff' : '#333333' }
        },
        paper_bgcolor: this.isDarkTheme ? '#2d2d2d' : 'rgba(0,0,0,0)',
        plot_bgcolor: this.isDarkTheme ? '#2d2d2d' : 'rgba(0,0,0,0)',
        xaxis: {
          gridcolor: this.isDarkTheme ? '#414141' : '#eee',
          color: this.isDarkTheme ? '#ffffff' : '#333333'
        },
        yaxis: {
          gridcolor: this.isDarkTheme ? '#414141' : '#eee',
          color: this.isDarkTheme ? '#ffffff' : '#333333'
        }
      };

      this.ngZone.runOutsideAngular(() => {
        Plotly.relayout(this.chart, layout);
      });
    } catch (e) {
      console.error('Error updating chart theme:', e);
    }
  }

  private showErrorInElement(element: HTMLElement, message: string): void {
    element.innerHTML = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
        <p style="color: #d32f2f; font-weight: bold;">${message}</p>
      </div>
    `;
  }

  private updateChart(): void {
    if (!this.chart || !this.chartInitialized) {
      this.initChart();
      return;
    }

    try {
      // Recreate traces
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
                color: this.isDarkTheme ? '#333' : 'white'
              }
            },
            hoverinfo: 'x+y+text',
            text: anomalyData.map(r => `ANOMALY: ${r.sensorType} ${r.value}`)
          });
        }
      });

      // Add anomaly traces
      allTraces.push(...anomalyTraces);

      // Update x-axis range to focus on selected time window
      const layout = {
        xaxis: {
          range: [this.startDate, this.endDate]
        }
      };

      // Update chart
      this.ngZone.runOutsideAngular(() => {
        Plotly.react(this.chart, allTraces, layout);
      });
      console.log('Chart updated successfully with', allTraces.length, 'traces');
    } catch (e) {
      console.error('Error updating chart:', e);
      // If update fails, try recreating the chart
      this.chartInitialized = false;
      this.initChart();
    }
  }

  private addReading(reading: SensorReading): void {
    if (!reading) return;

    console.log(`Adding reading to chart: ${reading.sensorType} = ${reading.value}`);

    // If chart is not initialized, initialize it
    if (!this.chartInitialized) {
      this.initChart();
      return;
    }

    // Add the reading to our local data
    if (!this.readingsMap.has(reading.sensorType)) {
      this.readingsMap.set(reading.sensorType, []);
      this.sensorTypes = Array.from(this.readingsMap.keys());
    }

    // Add to map and limit size
    const readings = this.readingsMap.get(reading.sensorType)!;
    readings.push({ ...reading }); // Clone reading

    // Limit to last 100 points per sensor
    while (readings.length > 100) {
      readings.shift(); // Remove oldest
    }

    // Only update if in live mode
    if (!this.isLiveData) return;

    // Update the chart
    this.updateChart();
  }

  getSensorColor(sensorType: string, isAnomaly: boolean | undefined): string {
    if (isAnomaly === true) {
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
