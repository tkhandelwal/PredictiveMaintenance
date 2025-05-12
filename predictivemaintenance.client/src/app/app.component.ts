import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterModule } from '@angular/router';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/shared/navbar/navbar.component';
import { SidebarComponent } from './components/shared/sidebar/sidebar.component';
import { ThemeService } from './services/theme.service';
import { Subscription } from 'rxjs';

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
export class AppComponent implements OnInit, OnDestroy {
  title = 'Predictive Maintenance System';
  isMobile = false;
  isDarkTheme = false;
  private subscriptions: Subscription[] = [];

  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    // Check screen size on init
    this.checkScreenSize();

    // Subscribe to theme changes
    this.subscriptions.push(
      this.themeService.isDarkTheme$().subscribe(isDark => {
        this.isDarkTheme = isDark;
      })
    );

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

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
