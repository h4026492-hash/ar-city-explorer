/**
 * Development Environment Configuration
 * 
 * These flags control app behavior in development mode.
 * Debug features are enabled for easier testing and debugging.
 */

export const environment = {
  // Environment identifier
  production: false,
  
  // Feature flags
  enableAnalytics: true,       // Track analytics in dev (for testing)
  enableDebugLogs: true,       // Show debug console logs
  enableErrorReporting: true,  // Log errors to console
  
  // Development helpers
  mockAPIResponses: true,      // Use local mock data instead of real API
  showDebugPanel: true,        // Show analytics debug panel toggle
  
  // AI Quality Debug
  // When enabled, logs prompt text, response length, and retry count
  aiQualityDebug: true,
  
  // Investor Demo Mode
  // When true: auto-selects Dallas, unlocks premium, skips onboarding
  // Use for investor demos, App Store screenshots, and trade shows
  demoMode: false,
  
  // API configuration (not used yet - for future backend)
  apiBaseUrl: 'http://localhost:3000',
  
  // Feature toggles
  enableARFeatures: true,
  enableOfflineMode: true,
  enablePushNotifications: false, // Disabled in dev
  enableRatingPrompts: false,     // DISABLED in development
  
  // Performance
  enablePerformanceLogging: true,
  
  // Founding User Program
  // Users who subscribe before this date get "Founding Member" status
  foundingCutoffDate: '2025-03-31T23:59:59Z'
};
