import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <app-navbar (toggleSidebar)="drawer.toggle()"></app-navbar>
      
      <mat-drawer-container class="sidenav-container">
        <mat-drawer #drawer mode="side" opened class="sidenav">
          <app-sidebar></app-sidebar>
        </mat-drawer>
        
        <mat-drawer-content class="content">
          <router-outlet></router-outlet>
        </mat-drawer-content>
      </mat-drawer-container>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }
    
    .sidenav-container {
      flex: 1;
    }
    
    .sidenav {
      width: 250px;
    }
    
    .content {
      padding: 0;
      overflow-x: hidden;
    }
  `]
})
export class AppComponent {
  title = 'Predictive Maintenance System';
}
