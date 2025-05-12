import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../../services/signalr.service';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-anomaly-notification',
  standalone: true,
  imports: [CommonModule, MatBadgeModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <button mat-icon-button 
            [matBadge]="anomalyCount" 
            matBadgeColor="warn"
            [matBadgeHidden]="anomalyCount === 0"
            matTooltip="Anomalies detected"
            (click)="showLatestAnomalies()">
      <mat-icon>warning</mat-icon>
    </button>
  `,
  styles: [`
    .mat-badge-content {
      font-weight: bold;
    }
  `]
})
export class AnomalyNotificationComponent implements OnInit, OnDestroy {
  anomalyCount = 0;
  recentAnomalies: any[] = [];
  private subscription: Subscription = new Subscription(); // Initialize the subscription

  constructor(
    private signalRService: SignalRService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.subscription = this.signalRService.getAnomalyAlerts().subscribe(anomaly => {
      if (anomaly) {
        this.anomalyCount++;
        this.recentAnomalies.push(anomaly);

        // Keep only the 10 most recent anomalies
        if (this.recentAnomalies.length > 10) {
          this.recentAnomalies.shift();
        }

        // Show notification
        const message = `Anomaly detected in ${anomaly.sensorType} for equipment ${anomaly.equipmentId}`;
        this.snackBar.open(message, 'View', {
          duration: 5000,
          panelClass: ['anomaly-snackbar']
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  showLatestAnomalies(): void {
    if (this.recentAnomalies.length === 0) {
      this.snackBar.open('No anomalies detected recently', 'Close', { duration: 3000 });
      return;
    }

    // Here you could open a dialog showing all recent anomalies
    // For simplicity, we'll just show the latest one
    const latest = this.recentAnomalies[this.recentAnomalies.length - 1];
    const message = `${latest.sensorType}: ${latest.value} at ${new Date(latest.timestamp).toLocaleTimeString()}`;
    this.snackBar.open(message, 'Clear', {
      duration: 5000,
      panelClass: ['anomaly-detail-snackbar']
    }).afterDismissed().subscribe(() => {
      this.anomalyCount = 0;
    });
  }
}
