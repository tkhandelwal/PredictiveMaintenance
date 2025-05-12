import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

// Routes
import { routes } from './app.routes';

// Interceptors
import { errorInterceptor } from './interceptors/error.interceptor';
import { loadingInterceptor } from './interceptors/loading.interceptor';

// Services are automatically provided with the 'providedIn: root' in their @Injectable decorators

export const appConfig: ApplicationConfig = {
  providers: [
    // Core Angular providers
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([errorInterceptor, loadingInterceptor]),
      withFetch()
    ),
    provideAnimations(),

    // Note: With the standalone approach, you don't need to explicitly list services
    // that use `providedIn: 'root'` in their @Injectable decorator.
    // Angular's dependency injection system will handle these automatically.

    // If you have any services that DON'T use providedIn: 'root', you would list them here
  ]
};
