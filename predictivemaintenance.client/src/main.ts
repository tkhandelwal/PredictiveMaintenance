// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'; // Updated import path

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error('Error starting application:', err));
