import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { Equipment } from '../../../models/equipment.model';
import { SensorReading } from '../../../models/sensor-reading.model';
import { MaintenanceEvent } from '../../../models/maintenance-event.model';
import { EquipmentService } from '../../../services/equipment.service';
import { MaintenanceService } from '../../../services/maintenance.service';
import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { SensorChartComponent } from '../../monitoring/sensor-chart/sensor-chart.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatDividerModule,
    MatIconModule,
    MatButtonModule,
    StatusIndicatorComponent,
    SensorChartComponent
  ],
  template: `
    <div class="container" *ngIf="equipment">
      <div class="header">
        <h1>{{ equipment.name }}</h1>
        <app-status-indicator [status]="equipment.status"></app-status-indicator>
      </div>
      
      <mat-card>
        <mat-card-header>
          <mat-card-title>Equipment Details</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="details-grid">
            <div class="detail">
              <span class="label">Type:</span>
              <span class="value">{{ equipment.type }}</span>
            </div>
            <div class="detail">
              <span class="label">Installation Date:</span>
              <span class="value">{{ equipment.installationDate | date }}</span>
            </div>
            <div class="detail">
              <span class="label">Last Maintenance:</span>
              <span class="value">{{ equipment.lastMaintenanceDate | date }}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
      
      <mat-card class="chart-card">
        <mat-card-header>
          <mat-card-title>Sensor Readings</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <app-sensor-chart [equipmentId]="equipment.id" [readings]="sensorReadings"></app-sensor-chart>
        </mat-card-content>
      </mat-card>
      
      <mat-card *ngIf="maintenanceEvents.length > 0">
        <mat-card-header>
          <mat-card-title>Maintenance Schedule</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="maintenanceEvents" class="mat-elevation-z2">
            <ng-container matColumnDef="scheduledDate">
              <th mat-header-cell *matHeaderCellDef>Scheduled Date</th>
              <td mat-cell *matCellDef="let event">{{ event.scheduledDate | date }}</td>
            </ng-container>
            
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let event">{{ event.type }}</td>
            </ng-container>
            
            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef>Priority</th>
              <td mat-cell *matCellDef="let event">{{ event.priority }}</td>
            </ng-container>
            
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td mat-cell *matCellDef="let event">{{ event.description }}</td>
            </ng-container>
            
            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns';"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
    
    <div class="loading-container" *ngIf="!equipment">
      <mat-spinner></mat-spinner>
      <p>Loading equipment data...</p>
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
    }
    
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .header h1 {
      margin-right: 16px;
    }
    
    mat-card {
      margin-bottom: 16px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    
    .detail .label {
      font-weight: bold;
      margin-right: 8px;
    }
    
    .chart-card {
      height: 500px;
    }
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 400px;
    }
    
    .loading-container p {
      margin-top: 16px;
      font-size: 18px;
      color: rgba(0, 0, 0, 0.6);
    }
  `]
})
export class EquipmentDetailComponent implements OnInit {
  equipmentId!: number;
  equipment?: Equipment;
  sensorReadings: SensorReading[] = [];
  maintenanceEvents: MaintenanceEvent[] = [];
  displayedColumns: string[] = ['scheduledDate', 'type', 'priority', 'description'];

  constructor(
    private route: ActivatedRoute,
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.equipmentId = +idParam;
        this.loadEquipmentData();
      }
    });
  }

  private loadEquipmentData(): void {
    forkJoin({
      equipment: this.equipmentService.getEquipmentById(this.equipmentId),
      readings: this.equipmentService.getEquipmentReadings(this.equipmentId, 100),
      maintenance: this.maintenanceService.getMaintenanceSchedule(this.equipmentId)
    }).subscribe({
      next: (result) => {
        this.equipment = result.equipment;
        this.sensorReadings = result.readings;
        this.maintenanceEvents = result.maintenance;
      },
      error: (error) => {
        console.error('Error loading equipment data:', error);
        // You could add error handling UI here
      }
    });
  }
}
