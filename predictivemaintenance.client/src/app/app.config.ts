// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

// Routes
import { routes } from './app.routes';

// Services
import { EquipmentService } from './services/equipment.service';
import { MaintenanceService } from './services/maintenance.service';
import { SignalRService } from './services/signalr.service';
import { ErrorHandlingService } from './services/error-handling.service';
import { CacheService } from './services/cache.service';
import { LoadingService } from './services/loading.service';
import { SimulationService } from './services/simulation.service';
import { ThemeService } from './services/theme.service';
import { GPUComputeService } from './services/gpu-compute.service';
import { NotificationService } from './services/notification.service';

// Interceptors
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoadingInterceptor } from './interceptors/loading.interceptor';
import { CacheInterceptor } from './interceptors/cache.interceptor';

import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

export const appConfig: ApplicationConfig = {
  providers: [
    // Router configuration
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    AuthGuard,
    AdminGuard,
    // Animations for Material components
    provideAnimations(),

    // HTTP client with interceptors and fetch API
    provideHttpClient(
      withInterceptorsFromDi(),
      withFetch()
    ),

    // HTTP Interceptors (order matters!)
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CacheInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    },

    // Material modules that need to be imported
    importProvidersFrom(
      MatSnackBarModule,
      MatDialogModule,
      MatDatepickerModule,
      MatNativeDateModule
    ),

    // Core services
    ErrorHandlingService,
    CacheService,
    LoadingService,
    NotificationService,
    ThemeService,

    // Business services
    EquipmentService,
    MaintenanceService,
    SimulationService,

    // Real-time services
    SignalRService,

    // GPU/Compute services
    GPUComputeService,

    // Service worker for caching (if using PWA)
    // importProvidersFrom(ServiceWorkerModule.register('ngsw-worker.js', {
    //   enabled: environment.production
    // }))
  ]
};
