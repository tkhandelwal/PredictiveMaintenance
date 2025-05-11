// src/app/providers.ts
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

// Import your services
import { EquipmentService } from './services/equipment.service';
import { MaintenanceService } from './services/maintenance.service';
import { SignalRService } from './services/signalr.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(), // This is crucial
    provideHttpClient(),

    // Your services
    EquipmentService,
    MaintenanceService,
    SignalRService
  ]
};
