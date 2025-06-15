// src/app/components/dashboard/realtime-alerts/realtime-alerts.component.ts
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { interval, Subscription } from 'rxjs';

interface Alert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  equipment?: string;
  location?: string;
  priority: number;
}

@Component({
  selector: 'app-realtime-alerts',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule
  ],
  animations: [
    trigger('listAnimation', [
      transition('* <=> *', [
        query(':enter',
          [
            style({ opacity: 0, transform: 'translateY(-15px)' }),
            stagger('50ms',
              animate('300ms cubic-bezier(0.4, 0, 0.2, 1)',
                style({ opacity: 1, transform: 'translateY(0)' }))
            )
          ],
          { optional: true }
        ),
        query(':leave',
          animate('200ms', style({ opacity: 0 })),
          { optional: true }
        )
      ])
    ]),
    trigger('pulseAnimation', [
      transition('* => *', [
        animate('1s cubic-bezier(0.4, 0, 0.6, 1)', style({ transform: 'scale(1.05)' })),
        animate('1s cubic-bezier(0.4, 0, 0.6, 1)', style({ transform: 'scale(1)' }))
      ])
    ])
  ],
  template: `
    <div class="alerts-container">
      <div class="alerts-header" *ngIf="alerts.length > 0">
        <span class="alert-count">{{ unacknowledgedCount }} new</span>
        <button mat-button (click)="acknowledgeAll()">
          <mat-icon>done_all</mat-icon>
          Acknowledge All
        </button>
      </div>

      <mat-list class="alerts-list" [@listAnimation]="alerts.length">
        <mat-list-item *ngFor="let alert of sortedAlerts" 
                       class="alert-item"
                       [class]="'alert-' + alert.type"
                       [class.acknowledged]="alert.acknowledged"
                       [@pulseAnimation]="alert.type === 'critical' && !alert.acknowledged">
          
          <div matListItemIcon class="alert-icon">
            <mat-icon [class.pulse]="alert.type === 'critical' && !alert.acknowledged">
              {{ getAlertIcon(alert.type) }}
            </mat-icon>
          </div>

          <div matListItemTitle class="alert-title">
            {{ alert.title }}
            <mat-icon *ngIf="!alert.acknowledged" class="new-indicator">fiber_new</mat-icon>
          </div>

          <div matListItemLine class="alert-description">
            {{ alert.description }}
          </div>

          <div matListItemLine class="alert-meta">
            <span *ngIf="alert.equipment" class="meta-item">
              <mat-icon>precision_manufacturing</mat-icon>
              {{ alert.equipment }}
            </span>
            <span *ngIf="alert.location" class="meta-item">
              <mat-icon>location_on</mat-icon>
              {{ alert.location }}
            </span>
            <span class="meta-item">
              <mat-icon>schedule</mat-icon>
              {{ getRelativeTime(alert.timestamp) }}
            </span>
          </div>

          <div matListItemMeta class="alert-actions">
            <button mat-icon-button 
                    *ngIf="!alert.acknowledged"
                    (click)="acknowledgeAlert(alert)"
                    matTooltip="Acknowledge">
              <mat-icon>check</mat-icon>
            </button>
            
            <button mat-icon-button [matMenuTriggerFor]="alertMenu">
              <mat-icon>more_vert</mat-icon>
            </button>
            
            <mat-menu #alertMenu="matMenu">
              <button mat-menu-item (click)="viewDetails(alert)">
                <mat-icon>visibility</mat-icon>
                <span>View Details</span>
              </button>
              <button mat-menu-item (click)="createWorkOrder(alert)">
                <mat-icon>assignment</mat-icon>
                <span>Create Work Order</span>
              </button>
              <button mat-menu-item (click)="dismissAlert(alert)">
                <mat-icon>close</mat-icon>
                <span>Dismiss</span>
              </button>
            </mat-menu>
          </div>
        </mat-list-item>
      </mat-list>

      <div class="empty-state" *ngIf="alerts.length === 0">
        <mat-icon>check_circle_outline</mat-icon>
        <p>No active alerts</p>
        <span>All systems operating normally</span>
      </div>
    </div>
  `,
  styles: [`
    .alerts-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .alerts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);

      .alert-count {
        font-weight: 600;
        color: #ef4444;
      }
    }

    .alerts-list {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .alert-item {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      min-height: 80px;
      transition: all 0.3s ease;
      cursor: pointer;

      &:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }

      &.acknowledged {
        opacity: 0.6;
      }

      &.alert-critical {
        border-left: 4px solid #ef4444;
        background-color: rgba(239, 68, 68, 0.05);

        .alert-icon {
          color: #ef4444;
        }
      }

      &.alert-warning {
        border-left: 4px solid #f59e0b;
        background-color: rgba(245, 158, 11, 0.05);

        .alert-icon {
          color: #f59e0b;
        }
      }

      &.alert-info {
        border-left: 4px solid #3b82f6;
        background-color: rgba(59, 130, 246, 0.05);

        .alert-icon {
          color: #3b82f6;
        }
      }
    }

    .alert-icon {
      margin-right: 16px;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;

        &.pulse {
          animation: pulse 2s infinite;
        }
      }
    }

    .alert-title {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;

      .new-indicator {
        font-size: 16px;
        color: #ef4444;
      }
    }

    .alert-description {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .alert-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #94a3b8;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }
    }

    .alert-actions {
      display: flex;
      gap: 4px;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      padding: 32px;
      text-align: center;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #10b981;
        margin-bottom: 16px;
      }

      p {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
      }

      span {
        font-size: 14px;
      }
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.8;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Dark theme */
    :host-context(.dark-theme) {
      .alerts-container {
        background: #1e293b;
      }

      .alert-item {
        border-bottom-color: rgba(255, 255, 255, 0.05);

        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
      }

      .alert-description {
        color: #94a3b8;
      }

      .alert-meta {
        color: #64748b;
      }
    }
  `]
})
export class RealtimeAlertsComponent implements OnInit, OnDestroy {
  @Input() alerts: Alert[] = [];

  sortedAlerts: Alert[] = [];
  unacknowledgedCount = 0;

  private timeUpdateSubscription?: Subscription;

  ngOnInit(): void {
    this.updateAlerts();

    // Update relative times every minute
    this.timeUpdateSubscription = interval(60000).subscribe(() => {
      this.updateAlerts();
    });
  }

  ngOnDestroy(): void {
    if (this.timeUpdateSubscription) {
      this.timeUpdateSubscription.unsubscribe();
    }
  }

  ngOnChanges(): void {
    this.updateAlerts();
  }

  private updateAlerts(): void {
    // Sort by priority and timestamp
    this.sortedAlerts = [...this.alerts].sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) {
        return a.acknowledged ? 1 : -1;
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    this.unacknowledgedCount = this.alerts.filter(a => !a.acknowledged).length;
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'notification_important';
    }
  }

  getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  acknowledgeAlert(alert: Alert): void {
    alert.acknowledged = true;
    this.updateAlerts();
    // Emit event to parent component
  }

  acknowledgeAll(): void {
    this.alerts.forEach(alert => {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
      }
    });
    this.updateAlerts();
  }

  viewDetails(alert: Alert): void {
    console.log('View details:', alert);
  }

  createWorkOrder(alert: Alert): void {
    console.log('Create work order:', alert);
  }

  dismissAlert(alert: Alert): void {
    const index = this.alerts.indexOf(alert);
    if (index > -1) {
      this.alerts.splice(index, 1);
      this.updateAlerts();
    }
  }
}
