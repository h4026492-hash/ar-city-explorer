import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Global error capture: surface full error objects and promise rejections so we can
// see the original exception instead of opaque `{}` in the production build.
window.addEventListener('error', (event) => {
  // eslint-disable-next-line no-console
  console.error('Global error caught:', event.error ?? event.message, event);
});

window.addEventListener('unhandledrejection', (event) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', event.reason, event);
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error('bootstrapApplication error:', err));
