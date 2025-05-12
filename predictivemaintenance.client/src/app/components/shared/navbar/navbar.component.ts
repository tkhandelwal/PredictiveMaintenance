// src/app/components/shared/navbar/navbar.component.ts
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AnomalyNotificationComponent } from '../anomaly-notification/anomaly-notification.component';
import { SignalRService } from '../../../services/signalr.service';
import { ThemeService } from '../../../services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    AnomalyNotificationComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();
  notificationCount = 2;
  connectionState = 'disconnected';
  isDarkTheme = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private signalRService: SignalRService,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    // Subscribe to connection state changes
    this.subscriptions.push(
      this.signalRService.getConnectionState().subscribe(state => {
        switch (state) {
          case 'Connected':
            this.connectionState = 'connected';
            break;
          case 'Reconnecting':
            this.connectionState = 'reconnecting';
            break;
          default:
            this.connectionState = 'disconnected';
        }
      })
    );

    // Subscribe to theme changes
    this.subscriptions.push(
      this.themeService.isDarkTheme$().subscribe(isDark => {
        this.isDarkTheme = isDark;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getConnectionLabel(): string {
    switch (this.connectionState) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      default:
        return 'Disconnected';
    }
  }

  toggleTheme(): void {
    this.themeService.toggleDarkTheme();
  }

  reconnect(): void {
    if (this.connectionState === 'disconnected') {
      this.signalRService.reconnect().catch(error => {
        console.error('Failed to reconnect', error);
      });
    }
  }
}
