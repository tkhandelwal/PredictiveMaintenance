// src/app/components/shared/navbar/navbar.component.ts
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

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
    MatDividerModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="toggleSidebar.emit()">
        <mat-icon>menu</mat-icon>
      </button>
      
      <span class="app-title">Predictive Maintenance System</span>
      
      <span class="spacer"></span>
      
      <button mat-icon-button matTooltip="Notifications">
        <mat-icon [matBadge]="notificationCount" matBadgeColor="warn" 
                 [matBadgeHidden]="notificationCount === 0">
          notifications
        </mat-icon>
      </button>
      
      <button mat-icon-button [matMenuTriggerFor]="userMenu" matTooltip="User Menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      
      <mat-menu #userMenu="matMenu">
        <button mat-menu-item>
          <mat-icon>person</mat-icon>
          <span>Profile</span>
        </button>
        <button mat-menu-item>
          <mat-icon>settings</mat-icon>
          <span>Settings</span>
        </button>
        <mat-divider></mat-divider>
        <button mat-menu-item>
          <mat-icon>exit_to_app</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .app-title {
      margin-left: 8px;
      font-size: 20px;
    }
    
    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class NavbarComponent {
  @Output() toggleSidebar = new EventEmitter<void>();
  notificationCount = 2;
}
