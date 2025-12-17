/**
 * Production Environment Configuration
 * 
 * CRITICAL: These flags control app behavior in production.
 * Debug features are DISABLED to protect user privacy and performance.
 * 
 * App Store Compliance:
 * - No debug logs exposed to users
 * - Analytics respect user privacy (no PII)
 * - Error reporting is silent (no technical messages shown)
 */

export const environment = {
  // Environment identifier
  production: true,
  
  // Feature flags - PRODUCTION SAFE
  enableAnalytics: true,       // Privacy-safe analytics only
  enableDebugLogs: false,      // DISABLED in production
  enableErrorReporting: true,  // Silent error tracking
  
  // Development helpers - ALL DISABLED
  mockAPIResponses: false,     // Use real API in production
  showDebugPanel: false,       // Hide debug panel completely
  
  // AI Quality Debug - DISABLED in production
  aiQualityDebug: false,
  
  // Investor Demo Mode - DISABLED in production
  // Enable temporarily for App Store review or trade show builds
  demoMode: false,
  
  // API configuration (for future backend)
  apiBaseUrl: 'https://api.ar-city-explorer.com',
  
  // Feature toggles
  enableARFeatures: true,
  enableOfflineMode: true,
  enablePushNotifications: true,
  enableRatingPrompts: true,      // App Store rating prompts ENABLED in production
  
  // Performance
  enablePerformanceLogging: false,  // Disabled for battery savings
  
  // Founding User Program
  // Users who subscribe before this date get "Founding Member" status
  // This is a COSMETIC feature - it does NOT alter Apple's subscription pricing
  foundingCutoffDate: '2025-03-31T23:59:59Z'
};
