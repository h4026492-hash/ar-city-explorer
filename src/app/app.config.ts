import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { GlobalErrorHandlerService } from './services/error-handler.service';

/**
 * App Configuration
 * 
 * Global error handler catches all unhandled errors and prevents crashes.
 * This protects user experience and ensures the app never shows
 * technical error messages to end users.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(),
    // Global error handler - catches all unhandled errors
    { provide: ErrorHandler, useClass: GlobalErrorHandlerService }
  ]
};
