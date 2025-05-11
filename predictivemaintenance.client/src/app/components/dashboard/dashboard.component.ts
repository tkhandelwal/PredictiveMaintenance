// src/app/components/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

//import { StatusIndicatorComponent } from '../shared/status-indicator/status-indicator.component';
import { Equipment } from '../../models/equipment.model';
import { EquipmentService } from '../../services/equipment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
  ],
  // src/app/components/dashboard/dashboard.component.ts
  template: `
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1>Equipment Monitoring Dashboard</h1>
      <p class="subtitle">Real-time predictive maintenance insights</p>
    </div>
    
    <div class="status-summary">
      <mat-card class="status-card operational animate-in">
        <mat-card-content>
          <div class="status-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="status-count">{{ getStatusCount('Operational') }}</div>
          <div class="status-label">Operational</div>
        </mat-card-content>
      </mat-card>
      
      <!-- Similar cards for Warning, Critical, and UnderMaintenance -->
    </div>
    
    <div class="dashboard-grid">
      <div class="grid-item large">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Equipment Health Overview</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="health-chart">
              <!-- Doughnut/Pie visualization showing equipment health breakdown -->
            </div>
          </mat-card-content>
        </mat-card>
      </div>
      
      <div class="grid-item">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Upcoming Maintenance</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <!-- Next 3 scheduled maintenance events -->
          </mat-card-content>
        </mat-card>
      </div>
      
      <div class="grid-item">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Recent Anomalies</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <!-- List of recent anomalies detected -->
          </mat-card-content>
        </mat-card>
      </div>
      
      <!-- Equipment grid below -->
      <div class="equipment-grid">
        <!-- Your existing equipment cards with enhanced styling -->
      </div>
    </div>
  </div>
`,
  styles: [`
  .dashboard-container {
    padding: 24px;
    max-width: 1800px;
    margin: 0 auto;
  }
  
  .dashboard-header {
    margin-bottom: 24px;
    text-align: left;
  }
  
  .subtitle {
    color: rgba(0, 0, 0, 0.6);
    margin-top: -16px;
  }
  
  .status-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
    margin-bottom: 32px;
  }
  
  .status-card {
    text-align: center;
    color: white;
    border-radius: 12px !important;
    overflow: hidden;
  }
  
  .status-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .status-count {
    font-size: 56px;
    font-weight: 500;
    line-height: 1;
  }
  
  .status-label {
    font-size: 18px;
    opacity: 0.9;
    margin-top: 8px;
  }
  
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 24px;
  }
  
  .grid-item.large {
    grid-column: span 2;
  }
  
  .health-chart {
    height: 300px;
  }
  
  .equipment-grid {
    margin-top: 32px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
  }
  
  .animate-in {
    animation: fadeSlideUp 0.5s ease-out;
  }
  
  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`]
})
export class DashboardComponent implements OnInit {
  equipmentList: Equipment[] = [];

  constructor(
    private equipmentService: EquipmentService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadEquipment();
  }

  private loadEquipment(): void {
    this.equipmentService.getAllEquipment().subscribe(equipment => {
      this.equipmentList = equipment;
    });
  }

  getStatusCount(status: string): number {
    return this.equipmentList.filter(e => e.status === status).length;
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s/g, '-');
  }

  navigateToEquipment(id: number): void {
    this.router.navigate(['/equipment', id]);
  }
}
