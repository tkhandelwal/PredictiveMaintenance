import { Component, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
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

  /**
   * Toggles the sidebar open/closed
   */
  toggleSidebar(): void {
    if (this.drawer) {
      this.drawer.toggle();
    }
  }

  /**
   * Checks if the screen is mobile size
   */
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
