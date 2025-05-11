// src/app/components/equipment/equipment-list/equipment-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    StatusIndicatorComponent
  ],
  template: `
    <div class="container">
      <h1>Equipment List</h1>
      
      <div class="table-container">
        <table mat-table [dataSource]="dataSource" class="equipment-table mat-elevation-z4">
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let equipment">{{ equipment.name }}</td>
          </ng-container>
          
          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let equipment">{{ equipment.type }}</td>
          </ng-container>
          
          <!-- Installation Date Column -->
          <ng-container matColumnDef="installationDate">
            <th mat-header-cell *matHeaderCellDef>Installation Date</th>
            <td mat-cell *matCellDef="let equipment">{{ equipment.installationDate | date }}</td>
          </ng-container>
          
          <!-- Last Maintenance Column -->
          <ng-container matColumnDef="lastMaintenanceDate">
            <th mat-header-cell *matHeaderCellDef>Last Maintenance</th>
            <td mat-cell *matCellDef="let equipment">
              {{ equipment.lastMaintenanceDate | date }}
            </td>
          </ng-container>
          
          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let equipment">
              <app-status-indicator [status]="equipment.status" [showLabel]="false"></app-status-indicator>
              {{ equipment.status }}
            </td>
          </ng-container>
          
          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let equipment">
              <button mat-icon-button color="primary" (click)="viewEquipment(equipment.id)" matTooltip="View Details">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>
          
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              [class]="getStatusClass(row.status)"
              (click)="viewEquipment(row.id)"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
    
    .table-container {
      margin-top: 20px;
      overflow: auto;
    }
    
    .equipment-table {
      width: 100%;
    }
    
    tr.mat-row {
      cursor: pointer;
    }
    
    tr.mat-row:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
    
    tr.operational {
      border-left: 4px solid #4CAF50;
    }
    
    tr.warning {
      border-left: 4px solid #FF9800;
    }
    
    tr.critical {
      border-left: 4px solid #F44336;
    }
    
    tr.under-maintenance {
      border-left: 4px solid #2196F3;
    }
  `]
})
export class EquipmentListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'type', 'installationDate', 'lastMaintenanceDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<Equipment>([]);

  constructor(
    private equipmentService: EquipmentService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadEquipment();
  }

  loadEquipment(): void {
    this.equipmentService.getAllEquipment().subscribe(equipment => {
      this.dataSource.data = equipment;
    });
  }

  viewEquipment(id: number): void {
    this.router.navigate(['/equipment', id]);
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s/g, '-');
  }
}
