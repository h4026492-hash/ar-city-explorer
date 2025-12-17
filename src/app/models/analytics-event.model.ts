/**
 * Analytics Event Model
 * 
 * PRIVACY COMPLIANCE:
 * - No user identifiers (no userId, deviceId, IDFA, IDFV)
 * - No tracking across apps
 * - No fingerprinting data (no IP, user agent, screen size)
 * - No advertising identifiers
 * - Only anonymous usage statistics
 * 
 * APP STORE COMPLIANCE:
 * - Does NOT require App Tracking Transparency (ATT) prompt
 * - Complies with Apple's privacy guidelines
 * - No data shared with third parties
 */

// Single analytics event (raw, before aggregation)
export interface AnalyticsEvent {
  event: string;
  timestamp: string;  // ISO format, will be truncated to day for aggregation
  metadata?: Record<string, string | number | boolean>;
}

// Aggregated event count for a single day
export interface DailyAggregate {
  date: string;       // YYYY-MM-DD format only (no time)
  eventCounts: Record<string, number>;
}

// Stored analytics data structure
export interface StoredAnalytics {
  rawEvents: AnalyticsEvent[];      // Recent events (last 24h)
  dailyAggregates: DailyAggregate[]; // Older data (up to 30 days)
  lastAggregation: string;           // ISO timestamp of last compaction
}

// Analytics preferences
export interface AnalyticsPreferences {
  enabled: boolean;
  lastUpdated: string;
}

// Event name constants (type-safe)
export const ANALYTICS_EVENTS = {
  // App lifecycle
  APP_OPEN: 'app_open',
  APP_BACKGROUND: 'app_background',
  
  // AR mode
  AR_OPEN: 'ar_open',
  AR_CLOSE: 'ar_close',
  
  // Landmark interactions
  LANDMARK_VIEW: 'landmark_view',
  LANDMARK_TAP: 'landmark_tap',
  LANDMARK_LIST_OPEN: 'landmark_list_open',
  
  // Walk mode
  WALK_MODE_START: 'walk_mode_start',
  WALK_MODE_COMPLETE: 'walk_mode_complete',
  WALK_MODE_CANCEL: 'walk_mode_cancel',
  
  // Monetization
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',
  
  // Offline
  OFFLINE_PACK_DOWNLOADED: 'offline_pack_downloaded',
  OFFLINE_PACK_UPDATED: 'offline_pack_updated',
  
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  INTERESTS_SELECTED: 'interests_selected',
  
  // Share
  SHARE_INITIATED: 'share_initiated',
  SHARE_COMPLETED: 'share_completed',
  
  // Memory
  MEMORY_CLEARED: 'memory_cleared',
  
  // Founding Users
  FOUNDING_ELIGIBLE: 'founding_eligible',
  FOUNDING_GRANTED: 'founding_granted'
} as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
