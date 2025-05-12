import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { Equipment, MaintenanceStatus } from '../../models/equipment.model';
import { EquipmentService } from '../../services/equipment.service';
import { MaintenanceService } from '../../services/maintenance.service';
import { LoadingService } from '../../services/loading.service';
import { StatusIndicatorComponent } from '../shared/status-indicator/status-indicator.component';
import { LoadingSpinnerComponent } from '../shared/loading-spinner/loading-spinner.component';

declare const Plotly: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    StatusIndicatorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  equipmentList: Equipment[] = [];
  upcomingMaintenance: any[] = [];
  recentAnomalies: any[] = [];
  isLoading = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService,
    private loadingService: LoadingService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.subscribeToLoading();
    this.loadEquipment();
    this.loadMockData();
    setTimeout(() => this.initHealthChart(), 500);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToLoading(): void {
    this.subscriptions.push(
      this.loadingService.loading$.subscribe(loading => {
        this.isLoading = loading;
      })
    );
  }

  private loadEquipment(): void {
    this.subscriptions.push(
      this.equipmentService.getAllEquipment().subscribe({
        next: equipment => {
          this.equipmentList = equipment;
        },
        error: error => {
          console.error('Error loading equipment:', error);
        }
      })
    );
  }

  private loadMockData(): void {
    // Mock data for upcoming maintenance
    this.upcomingMaintenance = [
      { date: new Date(2025, 4, 15), equipment: 'Pump 1', type: 'Preventive', priority: 'Medium' },
      { date: new Date(2025, 4, 18), equipment: 'Motor 1', type: 'Predictive', priority: 'High' },
      { date: new Date(2025, 4, 22), equipment: 'Compressor 1', type: 'Corrective', priority: 'Critical' },
    ];

    // Mock data for recent anomalies
    this.recentAnomalies = [
      { equipment: 'Compressor 1', sensor: 'Temperature', value: 95, unit: '°C', time: new Date(2025, 4, 10, 14, 32), severity: 'High' },
      { equipment: 'Fan 1', sensor: 'Vibration', value: 28, unit: 'mm/s', time: new Date(2025, 4, 10, 12, 15), severity: 'Medium' },
      { equipment: 'Pump 1', sensor: 'Flow', value: 42, unit: 'L/min', time: new Date(2025, 4, 10, 10, 45), severity: 'Low' },
    ];
  }

  getStatusCount(status: string): number {
    return this.equipmentList.filter(e => e.status === status).length;
  }

  navigateToEquipment(id: number): void {
    this.router.navigate(['/equipment', id]);
  }

  filterByStatus(status: string): void {
    this.router.navigate(['/equipment'], { queryParams: { status } });
  }

  getEquipmentIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'pump':
      case 'centrifugal pump': return 'water_pump';
      case 'motor':
      case 'electric motor': return 'power';
      case 'compressor':
      case 'air compressor': return 'compress';
      case 'fan':
      case 'industrial fan': return 'air';
      default: return 'settings';
    }
  }

  getStatusClass(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.Operational:
        return 'operational';
      case MaintenanceStatus.Warning:
        return 'warning';
      case MaintenanceStatus.Critical:
        return 'critical';
      case MaintenanceStatus.UnderMaintenance:
        return 'under-maintenance';
      default:
        return '';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'help';
    }
  }

  private initHealthChart(): void {
    // Get status counts for the chart
    const statuses = ['Operational', 'Warning', 'Critical', 'UnderMaintenance'];
    const counts = statuses.map(status => this.getStatusCount(status));

    // Check if Plotly is available
    if (typeof Plotly !== 'undefined') {
      // Create a pie chart with Plotly - using type assertion to fix TypeScript error
      const data: any[] = [{
        values: counts,
        labels: statuses,
        type: 'pie',
        hole: 0.4,
        marker: {
          colors: ['#4CAF50', '#FF9800', '#F44336', '#2196F3']
        },
        textinfo: 'label+percent',
        insidetextorientation: 'radial'
      }];

      // Use type assertion for layout as well
      const layout: any = {
        showlegend: true,
        legend: { orientation: 'h', y: -0.2 },
        margin: { l: 0, r: 0, t: 40, b: 0 },
        height: 350,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
      };

      const config: any = {
        responsive: true,
        displayModeBar: false
      };

      // Check if chart element exists before creating chart
      const chartElement = document.getElementById('healthChart');
      if (chartElement) {
        Plotly.newPlot('healthChart', data, layout, config);
      }
    }
  }
}
