// src/app/app.routes.ts
import { Routes } from '@angular/router';

// Lazy loading imports for better performance
const DashboardComponent = () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent);
const EquipmentListComponent = () => import('./components/equipment/equipment-list/equipment-list.component').then(m => m.EquipmentListComponent);
const EquipmentDetailComponent = () => import('./components/equipment/equipment-detail/equipment-detail.component').then(m => m.EquipmentDetailComponent);
const MaintenanceScheduleComponent = () => import('./components/maintenance/maintenance-schedule/maintenance-schedule.component').then(m => m.MaintenanceScheduleComponent);
const SimulationControlComponent = () => import('./components/admin/simulation-control/simulation-control.component').then(m => m.SimulationControlComponent);

// Guards (you'll need to create these)
// import { AuthGuard } from './guards/auth.guard';
// import { AdminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Root redirect
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // Dashboard
  {
    path: 'dashboard',
    loadComponent: DashboardComponent,
    data: {
      title: 'Dashboard',
      breadcrumb: 'Dashboard',
      description: 'System overview and key metrics'
    }
  },

  // Equipment routes
  {
    path: 'equipment',
    loadComponent: EquipmentListComponent,
    data: {
      title: 'Equipment',
      breadcrumb: 'Equipment',
      description: 'Equipment inventory and status'
    }
  },
  {
    path: 'equipment/:id',
    loadComponent: EquipmentDetailComponent,
    data: {
      title: 'Equipment Details',
      breadcrumb: 'Details',
      description: 'Detailed equipment information and analytics'
    }
  },

  // Maintenance routes
  {
    path: 'maintenance',
    loadComponent: MaintenanceScheduleComponent,
    data: {
      title: 'Maintenance Schedule',
      breadcrumb: 'Maintenance',
      description: 'Scheduled and completed maintenance activities'
    }
  },

  // Monitoring routes (new feature grouping)
  {
    path: 'monitoring',
    children: [
      {
        path: '',
        redirectTo: 'sensors',
        pathMatch: 'full'
      },
      {
        path: 'sensors',
        loadComponent: () => import('./components/monitoring/sensor-overview/sensor-overview.component').then(m => m.SensorOverviewComponent),
        data: {
          title: 'Sensor Monitoring',
          breadcrumb: 'Sensors',
          description: 'Real-time sensor data and analytics'
        }
      },
      {
        path: 'alerts',
        loadComponent: () => import('./components/monitoring/alert-center/alert-center.component').then(m => m.AlertCenterComponent),
        data: {
          title: 'Alert Center',
          breadcrumb: 'Alerts',
          description: 'System alerts and notifications'
        }
      },
      {
        path: 'analytics',
        loadComponent: () => import('./components/monitoring/analytics-dashboard/analytics-dashboard.component').then(m => m.AnalyticsDashboardComponent),
        data: {
          title: 'Analytics',
          breadcrumb: 'Analytics',
          description: 'Advanced analytics and predictions'
        }
      }
    ]
  },

  // Reports routes (new feature grouping)
  {
    path: 'reports',
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
      },
      {
        path: 'overview',
        loadComponent: () => import('./components/reports/reports-overview/reports-overview.component').then(m => m.ReportsOverviewComponent),
        data: {
          title: 'Reports Overview',
          breadcrumb: 'Reports',
          description: 'System reports and documentation'
        }
      },
      {
        path: 'maintenance',
        loadComponent: () => import('./components/reports/maintenance-report/maintenance-report.component').then(m => m.MaintenanceReportComponent),
        data: {
          title: 'Maintenance Reports',
          breadcrumb: 'Maintenance',
          description: 'Maintenance activity reports'
        }
      },
      {
        path: 'performance',
        loadComponent: () => import('./components/reports/performance-report/performance-report.component').then(m => m.PerformanceReportComponent),
        data: {
          title: 'Performance Reports',
          breadcrumb: 'Performance',
          description: 'Equipment performance analytics'
        }
      }
    ]
  },

  // Admin routes with guard protection
  {
    path: 'admin',
    // canActivate: [AdminGuard], // Uncomment when you create the guard
    children: [
      {
        path: '',
        redirectTo: 'simulation',
        pathMatch: 'full'
      },
      {
        path: 'simulation',
        loadComponent: SimulationControlComponent,
        data: {
          title: 'Simulation Control',
          breadcrumb: 'Simulation',
          description: 'System simulation and testing controls',
          roles: ['admin', 'operator']
        }
      },
      {
        path: 'users',
        loadComponent: () => import('./components/admin/user-management/user-management.component').then(m => m.UserManagementComponent),
        data: {
          title: 'User Management',
          breadcrumb: 'Users',
          description: 'System user administration',
          roles: ['admin']
        }
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/admin/system-settings/system-settings.component').then(m => m.SystemSettingsComponent),
        data: {
          title: 'System Settings',
          breadcrumb: 'Settings',
          description: 'System configuration and preferences',
          roles: ['admin']
        }
      },
      {
        path: 'logs',
        loadComponent: () => import('./components/admin/system-logs/system-logs.component').then(m => m.SystemLogsComponent),
        data: {
          title: 'System Logs',
          breadcrumb: 'Logs',
          description: 'System activity and error logs',
          roles: ['admin']
        }
      }
    ]
  },

  // Settings routes (user-level settings)
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/user-settings/user-settings.component').then(m => m.UserSettingsComponent),
    data: {
      title: 'User Settings',
      breadcrumb: 'Settings',
      description: 'Personal preferences and configuration'
    }
  },

  // Help and documentation
  {
    path: 'help',
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full'
      },
      {
        path: 'overview',
        loadComponent: () => import('./components/help/help-overview/help-overview.component').then(m => m.HelpOverviewComponent),
        data: {
          title: 'Help Center',
          breadcrumb: 'Help',
          description: 'Documentation and support resources'
        }
      },
      {
        path: 'docs/:section',
        loadComponent: () => import('./components/help/documentation/documentation.component').then(m => m.DocumentationComponent),
        data: {
          title: 'Documentation',
          breadcrumb: 'Docs',
          description: 'System documentation'
        }
      }
    ]
  },

  // Error handling routes
  {
    path: 'error',
    children: [
      {
        path: '404',
        loadComponent: () => import('./components/shared/not-found/not-found.component').then(m => m.NotFoundComponent),
        data: {
          title: 'Page Not Found',
          hideNavigation: true
        }
      },
      {
        path: '403',
        loadComponent: () => import('./components/shared/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
        data: {
          title: 'Access Denied',
          hideNavigation: true
        }
      },
      {
        path: '500',
        loadComponent: () => import('./components/shared/server-error/server-error.component').then(m => m.ServerErrorComponent),
        data: {
          title: 'Server Error',
          hideNavigation: true
        }
      }
    ]
  },

  // Wildcard route - MUST be last!
  {
    path: '**',
    redirectTo: '/error/404'
  }
];
