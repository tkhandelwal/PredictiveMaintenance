import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MaintenanceStatus } from '../../../models/equipment.model';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="status-indicator" [class]="statusClass">
      <mat-icon [matTooltip]="tooltip">{{ icon }}</mat-icon>
      <span *ngIf="showLabel">{{ status }}</span>
    </div>
  `,
  styleUrls: ['./status-indicator.component.scss']
})
export class StatusIndicatorComponent implements OnChanges {
  @Input() status!: MaintenanceStatus;
  @Input() showLabel: boolean = true;

  statusClass: string = '';
  icon: string = '';
  tooltip: string = '';

  ngOnChanges(): void {
    this.updateStatusDisplay();
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
