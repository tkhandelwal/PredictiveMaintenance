// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/providers';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
