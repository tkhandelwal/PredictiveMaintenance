// src/app/components/maintenance/maintenance-schedule/maintenance-schedule.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';

import { MaintenanceEvent, MaintenancePriority, MaintenanceType } from '../../../models/maintenance-event.model';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { MaintenanceService } from '../../../services/maintenance.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-maintenance-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatChipsModule
  ],
  template: `
    <div class="container">
      <h1>Maintenance Schedule</h1>
      
      <mat-card class="filter-card">
        <mat-card-content>
          <mat-form-field appearance="fill">
            <mat-label>Equipment</mat-label>
            <mat-select [(value)]="selectedEquipmentId" (selectionChange)="filterEvents()">
              <mat-option [value]="0">All Equipment</mat-option>
              <mat-option *ngFor="let equipment of equipmentList" [value]="equipment.id">
                {{ equipment.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          
          <mat-form-field appearance="fill">
            <mat-label>Priority</mat-label>
            <mat-select [(value)]="selectedPriority" (selectionChange)="filterEvents()">
              <mat-option [value]="">All Priorities</mat-option>
              <mat-option *ngFor="let priority of priorityList" [value]="priority">
                {{ priority }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          
          <mat-form-field appearance="fill">
            <mat-label>Type</mat-label>
            <mat-select [(value)]="selectedType" (selectionChange)="filterEvents()">
              <mat-option [value]="">All Types</mat-option>
              <mat-option *ngFor="let type of typeList" [value]="type">
                {{ type }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>
      
      <div class="table-container">
        <table mat-table [dataSource]="filteredEvents" class="mat-elevation-z4">
          <!-- Scheduled Date Column -->
          <ng-container matColumnDef="scheduledDate">
            <th mat-header-cell *matHeaderCellDef>Scheduled Date</th>
            <td mat-cell *matCellDef="let event">{{ event.scheduledDate | date }}</td>
          </ng-container>
          
          <!-- Equipment Column -->
          <ng-container matColumnDef="equipment">
            <th mat-header-cell *matHeaderCellDef>Equipment</th>
            <td mat-cell *matCellDef="let event">{{ getEquipmentName(event.equipmentId) }}</td>
          </ng-container>
          
          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let event" [class]="getTypeClass(event.type)">
              {{ event.type }}
            </td>
          </ng-container>
          
          <!-- Priority Column -->
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef>Priority</th>
            <td mat-cell *matCellDef="let event" [class]="getPriorityClass(event.priority)">
              {{ event.priority }}
            </td>
          </ng-container>
          
          <!-- Description Column -->
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let event">{{ event.description }}</td>
          </ng-container>
          
          <!-- Completed Column -->
          <ng-container matColumnDef="completed">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let event">
              <mat-chip [color]="event.completionDate ? 'primary' : 'warn'" selected>
                {{ event.completionDate ? 'Completed' : 'Pending' }}
              </mat-chip>
            </td>
          </ng-container>
          
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
    
    .filter-card {
      margin-bottom: 20px;
    }
    
    mat-form-field {
      margin-right: 16px;
    }
    
    .table-container {
      margin-top: 20px;
      overflow: auto;
    }
    
    table {
      width: 100%;
    }
    
    .priority-critical {
      font-weight: bold;
      color: #F44336;
    }
    
    .priority-high {
      color: #FF9800;
    }
    
    .priority-medium {
      color: #2196F3;
    }
    
    .type-emergency {
      font-weight: bold;
      color: #F44336;
    }
    
    .type-corrective {
      color: #FF9800;
    }
    
    .type-predictive {
      color: #2196F3;
    }
    
    .type-preventive {
      color: #4CAF50;
    }
  `]
})
export class MaintenanceScheduleComponent implements OnInit {
  displayedColumns: string[] = ['scheduledDate', 'equipment', 'type', 'priority', 'description', 'completed'];

  equipmentList: Equipment[] = [];
  allMaintenanceEvents: MaintenanceEvent[] = [];
  filteredEvents: MaintenanceEvent[] = [];

  selectedEquipmentId: number = 0;
  selectedPriority: string = '';
  selectedType: string = '';

  priorityList = Object.values(MaintenancePriority);
  typeList = Object.values(MaintenanceType);

  constructor(
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Get all equipment first
    this.equipmentService.getAllEquipment().subscribe(equipment => {
      this.equipmentList = equipment;

      // Now get maintenance events for each piece of equipment
      const maintenanceObservables = this.equipmentList.map(e =>
        this.maintenanceService.getMaintenanceSchedule(e.id)
      );

      forkJoin(maintenanceObservables).subscribe(results => {
        // Flatten the array of arrays
        this.allMaintenanceEvents = results.flat();
        this.filterEvents();
      });
    });
  }

  filterEvents(): void {
    this.filteredEvents = this.allMaintenanceEvents.filter(event => {
      // Filter by equipment
      if (this.selectedEquipmentId !== 0 && event.equipmentId !== this.selectedEquipmentId) {
        return false;
      }

      // Filter by priority
      if (this.selectedPriority && event.priority !== this.selectedPriority) {
        return false;
      }

      // Filter by type
      if (this.selectedType && event.type !== this.selectedType) {
        return false;
      }

      return true;
    });
  }

  getEquipmentName(equipmentId: number): string {
    const equipment = this.equipmentList.find(e => e.id === equipmentId);
    return equipment ? equipment.name : `Unknown (${equipmentId})`;
  }

  getPriorityClass(priority: MaintenancePriority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  getTypeClass(type: MaintenanceType): string {
    return `type-${type.toLowerCase()}`;
  }
}
