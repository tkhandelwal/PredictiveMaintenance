// src/app/components/shared/anomaly-notification/anomaly-notification.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../../services/signalr.service';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
// Add these imports for dialog elements
import { MatDialogContent, MatDialogActions, MatDialogTitle, MatDialogClose } from '@angular/material/dialog';

@Component({
  selector: 'app-anomaly-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatListModule,
    MatCardModule,
    MatIconModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogTitle,
    MatDialogClose
  ],
  template: `
    <h2 mat-dialog-title>Anomaly Notifications ({{ anomalies.length }})</h2>
    <div mat-dialog-content>
      <mat-list>
        <mat-list-item *ngFor="let anomaly of anomalies" class="anomaly-item">
          <mat-icon mat-list-icon class="anomaly-icon">warning</mat-icon>
          <div mat-line><strong>{{ anomaly.equipmentName || 'Equipment ' + anomaly.equipmentId }}</strong></div>
          <div mat-line>{{ anomaly.sensorType }}: {{ anomaly.value }}</div>
          <div mat-line class="anomaly-time">{{ anomaly.timestamp | date:'medium' }}</div>
          <div mat-line *ngIf="anomaly.recommendedAction" class="anomaly-action">
            <mat-icon class="small-icon">build</mat-icon> {{ anomaly.recommendedAction }}
          </div>
        </mat-list-item>
      </mat-list>
      
      <mat-card *ngIf="anomalies.length === 0" class="empty-state">
        <mat-card-content>
          <mat-icon>check_circle</mat-icon>
          <p>No anomalies detected</p>
        </mat-card-content>
      </mat-card>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-raised-button color="primary" (click)="clearAll()" [disabled]="anomalies.length === 0">
        Clear All
      </button>
    </div>
  `,
  styles: [`
    .anomaly-item {
      margin-bottom: 8px;
      border-left: 4px solid #f44336;
      background-color: rgba(244, 67, 54, 0.05);
    }
    
    .anomaly-icon {
      color: #f44336;
    }
    
    .anomaly-time {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }
    
    .anomaly-action {
      color: #3f51b5;
      font-weight: 500;
      display: flex;
      align-items: center;
    }
    
    .small-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
      margin-right: 4px;
    }
    
    .empty-state {
      text-align: center;
      padding: 32px;
      
      mat-icon {
        font-size: 48px;
        height: 48px;
        width: 48px;
        color: #4caf50;
        margin-bottom: 16px;
      }
      
      p {
        font-size: 18px;
        color: rgba(0, 0, 0, 0.6);
      }
    }
  `]
})
export class AnomalyDialogComponent {
  anomalies: any[] = [];

  constructor() { }

  clearAll(): void {
    this.anomalies = [];
  }
}

@Component({
  selector: 'app-anomaly-notification',
  standalone: true,
  imports: [
    CommonModule,
    MatBadgeModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <button mat-icon-button 
            [matBadge]="anomalyCount" 
            matBadgeColor="warn"
            [matBadgeHidden]="anomalyCount === 0"
            [matTooltip]="anomalyCount > 0 ? anomalyCount + ' anomalies detected' : 'No anomalies'"
            (click)="showAnomalies()"
            class="anomaly-button"
            [class.pulse-animation]="anomalyCount > 0">
      <mat-icon>warning</mat-icon>
    </button>
  `,
  styles: [`
    .mat-badge-content {
      font-weight: bold;
    }
    
    .anomaly-button {
      position: relative;
    }
    
    .pulse-animation {
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
      }
    }
  `]
})
export class AnomalyNotificationComponent implements OnInit, OnDestroy {
  // Rest of the code remains the same
  anomalyCount = 0;
  recentAnomalies: any[] = [];
  private subscription: Subscription = new Subscription();
  private audioContext: AudioContext | null = null;
  private hasPlayedSound = false;

  constructor(
    private signalRService: SignalRService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    // Try to create AudioContext for more reliable sound
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported, falling back to Audio API');
    }

    this.subscription = this.signalRService.getAnomalyAlerts().subscribe(anomaly => {
      if (anomaly) {
        this.anomalyCount++;

        // Add timestamp if not present
        if (!anomaly.timestamp) {
          anomaly.timestamp = new Date();
        }

        this.recentAnomalies.unshift(anomaly);

        // Keep only the 20 most recent anomalies
        if (this.recentAnomalies.length > 20) {
          this.recentAnomalies.pop();
        }

        // Show notification
        const equipmentName = anomaly.equipmentName || `Equipment #${anomaly.equipmentId}`;
        const message = `Anomaly detected: ${anomaly.sensorType} = ${anomaly.value} for ${equipmentName}`;

        this.snackBar.open(message, 'View', {
          duration: 8000,
          panelClass: ['anomaly-snackbar', 'anomaly-pulse'],
          horizontalPosition: 'right',
          verticalPosition: 'top'
        }).onAction().subscribe(() => {
          this.showAnomalies();
        });

        // Play sound if not already playing
        if (!this.hasPlayedSound) {
          this.playAlertSound();
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    // Clean up audio context
    if (this.audioContext) {
      this.audioContext.close().catch(err => console.error('Error closing AudioContext:', err));
    }
  }

  showAnomalies(): void {
    const dialogRef = this.dialog.open(AnomalyDialogComponent, {
      width: '600px',
      maxHeight: '80vh'
    });

    // Pass the anomalies to the dialog
    const instance = dialogRef.componentInstance;
    instance.anomalies = [...this.recentAnomalies];

    // Listen for dialog close
    dialogRef.afterClosed().subscribe(result => {
      if (instance.anomalies.length === 0) {
        // If all anomalies were cleared
        this.recentAnomalies = [];
        this.anomalyCount = 0;
      }
    });
  }

  private playAlertSound(): void {
    this.hasPlayedSound = true;

    if (this.audioContext) {
      // Create oscillator for better browser support
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 880; // A5
      gainNode.gain.value = 0.3;

      oscillator.start();

      // Fade out
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);

      // Stop after 1 second
      setTimeout(() => {
        oscillator.stop();
        this.hasPlayedSound = false;
      }, 1000);
    } else {
      // Fallback to Audio API
      try {
        const audio = new Audio('assets/sounds/anomaly-alert.mp3');
        audio.volume = 0.5;
        audio.play().then(() => {
          setTimeout(() => {
            this.hasPlayedSound = false;
          }, 1000);
        }).catch(err => {
          console.error('Error playing sound:', err);
          this.hasPlayedSound = false;
        });
      } catch (e) {
        console.error('Error playing alert sound:', e);
        this.hasPlayedSound = false;
      }
    }
  }
}
