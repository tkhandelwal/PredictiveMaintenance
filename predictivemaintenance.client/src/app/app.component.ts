import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/shared/navbar/navbar.component';
import { SidebarComponent } from './components/shared/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatSidenavModule,
    NavbarComponent,
    SidebarComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Predictive Maintenance System';
  isMobile = false;

  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(private router: Router) {
    // Check screen size on init
    this.checkScreenSize();

    // Listen for window resize events
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });

    // Close sidebar on navigation on mobile devices
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile && this.drawer?.opened) {
          this.drawer.close();
        }
      });
  }

  toggleSidebar(): void {
    if (this.drawer) {
      this.drawer.toggle();
    }
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;

    // Auto-close drawer on small screens
    if (this.isMobile && this.drawer?.opened) {
      this.drawer.close();
    }

    // Auto-open drawer on large screens
    if (!this.isMobile && this.drawer && !this.drawer.opened) {
      this.drawer.open();
    }
  }
}
