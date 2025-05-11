// src/app/components/shared/sidebar/sidebar.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <mat-nav-list>
      <h2 matSubheader>Main Navigation</h2>
      
      <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
        <mat-icon matListItemIcon>dashboard</mat-icon>
        <span matListItemTitle>Dashboard</span>
      </a>
      
      <a mat-list-item routerLink="/equipment" routerLinkActive="active">
        <mat-icon matListItemIcon>precision_manufacturing</mat-icon>
        <span matListItemTitle>Equipment</span>
      </a>
      
      <a mat-list-item routerLink="/maintenance" routerLinkActive="active">
        <mat-icon matListItemIcon>build</mat-icon>
        <span matListItemTitle>Maintenance</span>
      </a>
      
      <mat-divider></mat-divider>
      
      <h2 matSubheader>Analytics</h2>
      
      <a mat-list-item routerLink="/analytics" routerLinkActive="active">
        <mat-icon matListItemIcon>insights</mat-icon>
        <span matListItemTitle>Performance</span>
      </a>
      
      <a mat-list-item routerLink="/reports" routerLinkActive="active">
        <mat-icon matListItemIcon>assessment</mat-icon>
        <span matListItemTitle>Reports</span>
      </a>
    </mat-nav-list>
  `,
  styles: [`
    .active {
      background-color: rgba(0, 0, 0, 0.04);
      color: #3f51b5;
      font-weight: 500;
    }
  `]
})
export class SidebarComponent { }
