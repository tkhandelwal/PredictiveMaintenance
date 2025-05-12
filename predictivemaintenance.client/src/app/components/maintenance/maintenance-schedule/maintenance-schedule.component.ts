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

import { MaintenanceEvent, MaintenancePriority, MaintenanceType } from '../../../models/maintenance-event.model';
import { Equipment } from '../../../models/equipment.model';
import { EquipmentService } from '../../../services/equipment.service';
import { MaintenanceService } from '../../../services/maintenance.service';
import { LoadingService } from '../../../services/loading.service';
import { Subscription, BehaviorSubject, finalize } from 'rxjs';

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
    MatProgressSpinnerModule
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
      
      <div class="loading-container" *ngIf="isLoading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading maintenance schedule...</p>
      </div>
      
      <div class="table-container" *ngIf="!isLoading">
        <table mat-table [dataSource]="dataSource" matSort (matSortChange)="sortData($event)" class="mat-elevation-z4">
          <!-- Scheduled Date Column -->
          <ng-container matColumnDef="scheduledDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Scheduled Date</th>
            <td mat-cell *matCellDef="let event">{{ event.scheduledDate | date }}</td>
          </ng-container>
          
          <!-- Equipment Column -->
          <ng-container matColumnDef="equipment">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Equipment</th>
            <td mat-cell *matCellDef="let event">{{ getEquipmentName(event.equipmentId) }}</td>
          </ng-container>
          
          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Type</th>
            <td mat-cell *matCellDef="let event" [class]="getTypeClass(event.type)">
              {{ getTypeDisplayName(event.type) }}
            </td>
          </ng-container>
          
          <!-- Priority Column -->
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Priority</th>
            <td mat-cell *matCellDef="let event" [class]="getPriorityClass(event.priority)">
              {{ getPriorityDisplayName(event.priority) }}
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
          
          <!-- Row shown when there is no matching data -->
          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell" colspan="6">No maintenance events found</td>
          </tr>
        </table>
        
        <mat-paginator 
          [pageSize]="pageSize" 
          [pageSizeOptions]="[5, 10, 25, 100]"
          [length]="totalEvents"
          (page)="pageChanged($event)"
          aria-label="Select page of maintenance events">
        </mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
      position: relative;
      min-height: 400px;
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
    
    .priority-low {
      color: #4CAF50;
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
    
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    
    .loading-container p {
      margin-top: 16px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    @media (max-width: 768px) {
      .filter-card mat-form-field {
        width: 100%;
        margin-right: 0;
        margin-bottom: 16px;
      }
      
      .mat-column-description {
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `]
})
export class MaintenanceScheduleComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['scheduledDate', 'equipment', 'type', 'priority', 'description', 'completed'];
  dataSource = new MatTableDataSource<MaintenanceEvent>([]);

  // Pagination properties
  pageSize = 10;
  pageIndex = 0;
  totalEvents = 0;

  // Data properties
  equipmentList: Equipment[] = [];
  allMaintenanceEvents: MaintenanceEvent[] = [];
  filteredEvents: MaintenanceEvent[] = [];
  isLoading = false;

  // Filters
  selectedEquipmentId: number = 0;
  selectedPriority: string = '';
  selectedType: string = '';

  // Enum values for select options - Use string representation for UI
  priorityList = ['Low', 'Medium', 'High', 'Critical'];
  typeList = ['Preventive', 'Predictive', 'Corrective', 'Emergency'];

  // Enum mappings to help with numeric/string conversions
  private typeMappings = {
    0: 'Preventive',
    1: 'Predictive',
    2: 'Corrective',
    3: 'Emergency',
    'Preventive': 0,
    'Predictive': 1,
    'Corrective': 2,
    'Emergency': 3
  };

  private priorityMappings = {
    0: 'Low',
    1: 'Medium',
    2: 'High',
    3: 'Critical',
    'Low': 0,
    'Medium': 1,
    'High': 2,
    'Critical': 3
  };

  // Subscriptions
  private subscriptions = new Subscription();
  private loadingSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private equipmentService: EquipmentService,
    private maintenanceService: MaintenanceService,
    private loadingService: LoadingService
  ) { }

  ngOnInit(): void {
    // Subscribe to loading subject
    this.subscriptions.add(
      this.loadingSubject.subscribe(isLoading => {
        this.isLoading = isLoading;
      })
    );

    // Start loading
    this.loadingSubject.next(true);

    // Load equipment first
    this.loadEquipment();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Load equipment data
   */
  loadEquipment(): void {
    this.subscriptions.add(
      this.equipmentService.getAllEquipment()
        .pipe(finalize(() => {
          // Move to loading maintenance after equipment is loaded
          this.loadMaintenanceData();
        }))
        .subscribe({
          next: (equipment) => {
            this.equipmentList = equipment;
          },
          error: (error) => {
            console.error('Error loading equipment:', error);
            this.loadingSubject.next(false);
          }
        })
    );
  }

  /**
   * Load maintenance data
   */
  loadMaintenanceData(): void {
    this.subscriptions.add(
      this.maintenanceService.getAllMaintenanceEvents()
        .pipe(finalize(() => {
          this.loadingSubject.next(false);
        }))
        .subscribe({
          next: (events) => {
            this.allMaintenanceEvents = events;
            this.filterEvents();
          },
          error: (error) => {
            console.error('Error loading maintenance events:', error);
            this.loadingSubject.next(false);
          }
        })
    );
  }

  /**
   * Apply filters to maintenance events
   */
  filterEvents(): void {
    // Apply filters
    this.filteredEvents = this.allMaintenanceEvents.filter(event => {
      // Filter by equipment
      if (this.selectedEquipmentId !== 0 && event.equipmentId !== this.selectedEquipmentId) {
        return false;
      }

      // Filter by priority
      if (this.selectedPriority &&
        this.getPriorityDisplayName(event.priority) !== this.selectedPriority) {
        return false;
      }

      // Filter by type
      if (this.selectedType &&
        this.getTypeDisplayName(event.type) !== this.selectedType) {
        return false;
      }

      return true;
    });

    // Update total count
    this.totalEvents = this.filteredEvents.length;

    // Apply pagination
    this.updateDisplayedData();
  }

  /**
   * Handle page change event
   */
  pageChanged(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updateDisplayedData();
  }

  /**
   * Handle sort change event
   */
  sortData(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      return;
    }

    this.filteredEvents = this.filteredEvents.slice().sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'scheduledDate':
          return this.compare(new Date(a.scheduledDate).getTime(), new Date(b.scheduledDate).getTime(), isAsc);
        case 'equipment':
          const nameA = this.getEquipmentName(a.equipmentId);
          const nameB = this.getEquipmentName(b.equipmentId);
          return this.compare(nameA, nameB, isAsc);
        case 'type':
          const typeA = this.getTypeDisplayName(a.type);
          const typeB = this.getTypeDisplayName(b.type);
          return this.compare(typeA, typeB, isAsc);
        case 'priority':
          const priorityA = this.getPriorityValue(a.priority);
          const priorityB = this.getPriorityValue(b.priority);
          return this.compare(priorityA, priorityB, isAsc);
        default: return 0;
      }
    });

    this.updateDisplayedData();
  }

  /**
   * Compare function for sorting
   */
  private compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  /**
   * Update displayed data based on pagination
   */
  private updateDisplayedData(): void {
    const startIndex = this.pageIndex * this.pageSize;
    const paginatedData = this.filteredEvents.slice(startIndex, startIndex + this.pageSize);
    this.dataSource.data = paginatedData;
  }

  /**
   * Get equipment name by ID
   */
  getEquipmentName(equipmentId: number): string {
    const equipment = this.equipmentList.find(e => e.id === equipmentId);
    return equipment ? equipment.name : `Unknown (${equipmentId})`;
  }

  /**
   * Get display name for maintenance type
   */
  getTypeDisplayName(type: MaintenanceType | any): string {
    if (type === null || type === undefined) {
      return 'Unknown';
    }

    if (typeof type === 'number') {
      return this.typeMappings[type] || 'Unknown';
    }

    return type.toString();
  }

  /**
   * Get display name for maintenance priority
   */
  getPriorityDisplayName(priority: MaintenancePriority | any): string {
    if (priority === null || priority === undefined) {
      return 'Unknown';
    }

    if (typeof priority === 'number') {
      return this.priorityMappings[priority] || 'Unknown';
    }

    return priority.toString();
  }

  /**
   * Get priority CSS class
   */
  getPriorityClass(priority: MaintenancePriority | any): string {
    if (priority === null || priority === undefined) {
      return 'priority-unknown';
    }

    if (typeof priority === 'number') {
      // Handle numeric enum values
      switch (priority) {
        case 0: return 'priority-low';
        case 1: return 'priority-medium';
        case 2: return 'priority-high';
        case 3: return 'priority-critical';
        default: return 'priority-unknown';
      }
    }

    // Try to convert to string for string-based enums
    try {
      return `priority-${priority.toString().toLowerCase()}`;
    } catch (e) {
      console.error('Error processing priority class:', e);
      return 'priority-unknown';
    }
  }

  /**
   * Get type CSS class
   */
  getTypeClass(type: MaintenanceType | any): string {
    if (type === null || type === undefined) {
      return 'type-unknown';
    }

    if (typeof type === 'number') {
      // Handle numeric enum values
      switch (type) {
        case 0: return 'type-preventive';
        case 1: return 'type-predictive';
        case 2: return 'type-corrective';
        case 3: return 'type-emergency';
        default: return 'type-unknown';
      }
    }

    // Try to convert to string for string-based enums
    try {
      return `type-${type.toString().toLowerCase()}`;
    } catch (e) {
      console.error('Error processing type class:', e);
      return 'type-unknown';
    }
  }

  /**
   * Get numeric value for priority for sorting
   */
  private getPriorityValue(priority: MaintenancePriority | any): number {
    if (typeof priority === 'number') {
      return priority;
    }

    // Try to convert string to number
    if (typeof priority === 'string') {
      return this.priorityMappings[priority] || 0;
    }

    return 0;
  }
}
