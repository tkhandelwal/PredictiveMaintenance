import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MaintenanceStatus } from '../../../models/equipment.model';

@Component({
  selector: 'app-status-indicator',
  standalone: true, // Convert to standalone component
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="status-indicator" [ngClass]="statusClass">
      <mat-icon [matTooltip]="tooltip">{{ icon }}</mat-icon>
      <span *ngIf="showLabel">{{ status }}</span>
    </div>
  `,
  styles: [`
    .status-indicator {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 16px;
      color: white;
    }
    
    .operational {
      background-color: #4CAF50;
    }
    
    .warning {
      background-color: #FF9800;
    }
    
    .critical {
      background-color: #F44336;
    }
    
    .under-maintenance {
      background-color: #2196F3;
    }
    
    mat-icon {
      margin-right: 4px;
    }
  `]
})
export class StatusIndicatorComponent implements OnChanges {
  @Input() status!: MaintenanceStatus; // Use non-null assertion operator
  @Input() showLabel: boolean = true;

  statusClass: string = ''; // Initialize with empty string
  icon: string = ''; // Initialize with empty string
  tooltip: string = ''; // Initialize with empty string

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status']) {
      this.updateStatusDisplay();
    }
  }

  private updateStatusDisplay(): void {
    switch (this.status) {
      case MaintenanceStatus.Operational:
        this.statusClass = 'operational';
        this.icon = 'check_circle';
        this.tooltip = 'Equipment is operational';
        break;
      case MaintenanceStatus.Warning:
        this.statusClass = 'warning';
        this.icon = 'warning';
        this.tooltip = 'Equipment requires attention';
        break;
      case MaintenanceStatus.Critical:
        this.statusClass = 'critical';
        this.icon = 'error';
        this.tooltip = 'Equipment is in critical condition';
        break;
      case MaintenanceStatus.UnderMaintenance:
        this.statusClass = 'under-maintenance';
        this.icon = 'build';
        this.tooltip = 'Equipment is under maintenance';
        break;
      default:
        this.statusClass = '';
        this.icon = 'help';
        this.tooltip = 'Unknown status';
    }
  }
}
