// src/app/components/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

import { StatusIndicatorComponent } from '../shared/status-indicator/status-indicator.component';
import { Equipment } from '../../models/equipment.model';
import { EquipmentService } from '../../services/equipment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    StatusIndicatorComponent
  ],
  template: `
    <div class="dashboard-container">
      <h1>Equipment Monitoring Dashboard</h1>
      
      <div class="status-summary">
        <mat-card class="status-card operational">
          <mat-card-content>
            <div class="status-count">{{ getStatusCount('Operational') }}</div>
            <div class="status-label">Operational</div>
          </mat-card-content>
        </mat-card>
        
        <mat-card class="status-card warning">
          <mat-card-content>
            <div class="status-count">{{ getStatusCount('Warning') }}</div>
            <div class="status-label">Warning</div>
          </mat-card-content>
        </mat-card>
        
        <mat-card class="status-card critical">
          <mat-card-content>
            <div class="status-count">{{ getStatusCount('Critical') }}</div>
            <div class="status-label">Critical</div>
          </mat-card-content>
        </mat-card>
        
        <mat-card class="status-card maintenance">
          <mat-card-content>
            <div class="status-count">{{ getStatusCount('UnderMaintenance') }}</div>
            <div class="status-label">Under Maintenance</div>
          </mat-card-content>
        </mat-card>
      </div>
      
      <div class="equipment-grid">
        <mat-card *ngFor="let equipment of equipmentList" class="equipment-card" 
                 [class]="getStatusClass(equipment.status)"
                 (click)="navigateToEquipment(equipment.id)">
          <mat-card-header>
            <mat-card-title>{{ equipment.name }}</mat-card-title>
            <mat-card-subtitle>{{ equipment.type }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="equipment-status">
              <app-status-indicator [status]="equipment.status"></app-status-indicator>
            </div>
            <div class="equipment-info">
              <div>Installed: {{ equipment.installationDate | date:'shortDate' }}</div>
              <div *ngIf="equipment.lastMaintenanceDate">
                Last Maintenance: {{ equipment.lastMaintenanceDate | date:'shortDate' }}
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 16px;
    }
    
    .status-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .status-card {
      text-align: center;
      color: white;
    }
    
    .status-card.operational {
      background-color: #4CAF50;
    }
    
    .status-card.warning {
      background-color: #FF9800;
    }
    
    .status-card.critical {
      background-color: #F44336;
    }
    
    .status-card.maintenance {
      background-color: #2196F3;
    }
    
    .status-count {
      font-size: 48px;
      font-weight: bold;
    }
    
    .status-label {
      font-size: 18px;
    }
    
    .equipment-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    
    .equipment-card {
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .equipment-card:hover {
      transform: translateY(-4px);
    }
    
    .equipment-card.operational {
      border-left: 4px solid #4CAF50;
    }
    
    .equipment-card.warning {
      border-left: 4px solid #FF9800;
    }
    
    .equipment-card.critical {
      border-left: 4px solid #F44336;
    }
    
    .equipment-card.under-maintenance {
      border-left: 4px solid #2196F3;
    }
    
    .equipment-status {
      margin: 12px 0;
    }
    
    .equipment-info {
      margin-top: 8px;
      color: rgba(0, 0, 0, 0.6);
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
