import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MaintenanceEvent, MaintenancePriority, MaintenanceType } from '../../../models/maintenance-event.model';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { MaintenanceService } from '../../../services/maintenance.service';
import { LoadingService } from '../../../services/loading.service';
import { Subscription, BehaviorSubject, finalize } from 'rxjs';

// Define an interface for the mappings to solve the TypeScript index signature issue
interface TypeMappings {
  [key: string | number]: string | number;
}

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
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="container">
      <h1>Maintenance Schedule</h1>
      
      <mat-card class="filter-card">
        <mat-card-content>
          <div class="filters">
            <mat-form-field appearance="outline">
              <mat-label>Equipment</mat-label>
              <mat-select [(value)]="selectedEquipmentId" (selectionChange)="applyFilters()">
                <mat-option value="">All Equipment</mat-option>
                <mat-option *ngFor="let equipment of equipmentList" [value]="equipment.id">
                  {{ equipment.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Priority</mat-label>
              <mat-select [(value)]="selectedPriority" (selectionChange)="applyFilters()">
                <mat-option value="">All Priorities</mat-option>
                <mat-option value="Critical">Critical</mat-option>
                <mat-option value="High">High</mat-option>
                <mat-option value="Medium">Medium</mat-option>
                <mat-option value="Low">Low</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select [(value)]="selectedType" (selectionChange)="applyFilters()">
                <mat-option value="">All Types</mat-option>
                <mat-option value="Preventive">Preventive</mat-option>
                <mat-option value="Corrective">Corrective</mat-option>
                <mat-option value="Predictive">Predictive</mat-option>
                <mat-option value="Emergency">Emergency</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-raised-button color="primary" (click)="refreshData()" 
                    [disabled]="isLoading$ | async">
              <mat-icon>refresh</mat-icon>
              Refresh
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card">
        <div class="table-container" *ngIf="!(isLoading$ | async); else loadingTemplate">
          <mat-table [dataSource]="dataSource" matSort (matSortChange)="sortData($event)">
            
            <!-- Equipment Column -->
            <ng-container matColumnDef="equipment">
              <mat-header-cell *matHeaderCellDef mat-sort-header>Equipment</mat-header-cell>
              <mat-cell *matCellDef="let element">{{ getEquipmentName(element.equipmentId) }}</mat-cell>
            </ng-container>

            <!-- Type Column -->
            <ng-container matColumnDef="type">
              <mat-header-cell *matHeaderCellDef mat-sort-header>Type</mat-header-cell>
              <mat-cell *matCellDef="let element">
                <mat-chip [color]="getTypeColor(element.type)" selected>
                  {{ element.type }}
                </mat-chip>
              </mat-cell>
            </ng-container>

            <!-- Priority Column -->
            <ng-container matColumnDef="priority">
              <mat-header-cell *matHeaderCellDef mat-sort-header>Priority</mat-header-cell>
              <mat-cell *matCellDef="let element">
                <mat-chip [color]="getPriorityColor(element.priority)" selected>
                  {{ element.priority }}
                </mat-chip>
              </mat-cell>
            </ng-container>

            <!-- Scheduled Date Column -->
            <ng-container matColumnDef="scheduledDate">
              <mat-header-cell *matHeaderCellDef mat-sort-header>Scheduled Date</mat-header-cell>
              <mat-cell *matCellDef="let element">{{ element.scheduledDate | date:'shortDate' }}</mat-cell>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <mat-header-cell *matHeaderCellDef mat-sort-header>Status</mat-header-cell>
              <mat-cell *matCellDef="let element">
                <mat-chip [color]="getStatusColor(element.status)" selected>
                  {{ element.status }}
                </mat-chip>
              </mat-cell>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <mat-header-cell *matHeaderCellDef>Actions</mat-header-cell>
              <mat-cell *matCellDef="let element">
                <button mat-icon-button color="primary" 
                        matTooltip="Complete Maintenance"
                        (click)="completeMaintenance(element)"
                        [disabled]="element.status === 'Completed'">
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button mat-icon-button color="accent" 
                        matTooltip="View Details"
                        (click)="viewDetails(element)">
                  <mat-icon>visibility</mat-icon>
                </button>
              </mat-cell>
            </ng-container>

            <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
            <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
          </mat-table>

          <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" 
                         [pageSize]="25" 
                         showFirstLastButtons
                         (page)="onPageChange($event)">
          </mat-paginator>
        </div>

        <ng-template #loadingTemplate>
          <div class="loading-container">
            <mat-spinner diameter="50"></mat-spinner>
            <p>Loading maintenance schedule...</p>
          </div>
        </ng-template>
      </mat-card>
    </div>
  `,
  styleUrls: ['./maintenance-schedule.component.scss']
})
export class MaintenanceScheduleComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['equipment', 'type', 'priority', 'scheduledDate', 'status', 'actions'];
  dataSource = new MatTableDataSource<MaintenanceEvent>();

  equipmentList: Equipment[] = [];
  maintenanceEvents: MaintenanceEvent[] = [];
  filteredEvents: MaintenanceEvent[] = [];

  selectedEquipmentId = '';
  selectedPriority = '';
  selectedType = '';

  isLoading$ = new BehaviorSubject<boolean>(false);

  private subscriptions = new Subscription();

  // Type mappings for chip colors
  private priorityColorMap: TypeMappings = {
    'Critical': 'warn',
    'High': 'accent',
    'Medium': 'primary',
    'Low': 'basic'
  };

  private typeColorMap: TypeMappings = {
    'Preventive': 'primary',
    'Corrective': 'accent',
    'Predictive': 'warn',
    'Emergency': 'warn'
  };

  private statusColorMap: TypeMappings = {
    'Pending': 'basic',
    'In Progress': 'accent',
    'Completed': 'primary',
    'Overdue': 'warn'
  };

  constructor(
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService,
    private loadingService: LoadingService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    this.isLoading$.next(true);

    const equipment$ = this.equipmentService.getAllEquipment();
    const maintenance$ = this.maintenanceService.getAllMaintenanceEvents();

    this.subscriptions.add(
      equipment$.subscribe({
        next: (equipment) => {
          this.equipmentList = equipment;
        },
        error: (error) => {
          console.error('Error loading equipment:', error);
        }
      })
    );

    this.subscriptions.add(
      maintenance$.pipe(
        finalize(() => this.isLoading$.next(false))
      ).subscribe({
        next: (events) => {
          this.maintenanceEvents = events;
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading maintenance events:', error);
        }
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.maintenanceEvents];

    if (this.selectedEquipmentId) {
      filtered = filtered.filter(event => event.equipmentId.toString() === this.selectedEquipmentId);
    }

    if (this.selectedPriority) {
      filtered = filtered.filter(event => event.priority === this.selectedPriority);
    }

    if (this.selectedType) {
      filtered = filtered.filter(event => event.type === this.selectedType);
    }

    this.filteredEvents = filtered;
    this.dataSource.data = this.filteredEvents;
  }

  sortData(sort: Sort): void {
    const data = [...this.filteredEvents];

    if (!sort.active || sort.direction === '') {
      this.dataSource.data = data;
      return;
    }

    this.dataSource.data = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';

      switch (sort.active) {
        case 'equipment':
          return this.compare(this.getEquipmentName(a.equipmentId), this.getEquipmentName(b.equipmentId), isAsc);
        case 'type':
          return this.compare(a.type, b.type, isAsc);
        case 'priority':
          return this.compare(a.priority, b.priority, isAsc);
        case 'scheduledDate':
          return this.compare(a.scheduledDate, b.scheduledDate, isAsc);
        case 'status':
          return this.compare(a.status, b.status, isAsc);
        default:
          return 0;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    // Handle page change if needed
  }

  refreshData(): void {
    this.loadData();
    this.maintenanceService.refreshCache();
  }

  completeMaintenance(event: MaintenanceEvent): void {
    this.subscriptions.add(
      this.maintenanceService.completeMaintenanceEvent(event.id).subscribe({
        next: () => {
          event.status = 'Completed';
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error completing maintenance:', error);
        }
      })
    );
  }

  viewDetails(event: MaintenanceEvent): void {
    // Navigate to details or open dialog
    console.log('View details for:', event);
  }

  getEquipmentName(equipmentId: number): string {
    const equipment = this.equipmentList.find(eq => eq.id === equipmentId);
    return equipment?.name || `Equipment ${equipmentId}`;
  }

  getPriorityColor(priority: string): string {
    return this.priorityColorMap[priority] as string || 'basic';
  }

  getTypeColor(type: string): string {
    return this.typeColorMap[type] as string || 'basic';
  }

  getStatusColor(status: string): string {
    return this.statusColorMap[status] as string || 'basic';
  }

  private compare(a: string | number | Date, b: string | number | Date, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }
}
