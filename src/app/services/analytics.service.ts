/**
 * Privacy-Safe Analytics Service
 * 
 * ═══════════════════════════════════════════════════════════════════
 * APP STORE COMPLIANCE CERTIFICATION
 * ═══════════════════════════════════════════════════════════════════
 * 
 * ✓ NO tracking across apps or websites
 * ✓ NO device fingerprinting
 * ✓ NO advertising identifiers (IDFA)
 * ✓ NO user identifiers or account linking
 * ✓ NO IP address collection
 * ✓ NO personal data collection
 * ✓ NO third-party data sharing
 * 
 * This implementation:
 * - Tracks EVENTS, not USERS
 * - Stores data locally on-device only
 * - Aggregates to daily counts (no precise timestamps)
 * - Respects user opt-out preference
 * - Clears all data on opt-out
 * 
 * Does NOT require App Tracking Transparency (ATT) prompt.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { 
  AnalyticsEvent as AnalyticsEventModel, 
  DailyAggregate, 
  StoredAnalytics, 
  AnalyticsPreferences,
  ANALYTICS_EVENTS 
} from '../models/analytics-event.model';
import { environment } from '../../environments/environment';

// Re-export for usage throughout app
export { ANALYTICS_EVENTS };

// A/B Test configurations
export const AB_TESTS = {
  paywall_copy: {
    id: 'paywall_copy_v1',
    variants: ['control', 'scarcity', 'social_proof', 'local_pride']
  },
  pricing_display: {
    id: 'pricing_display_v1',
    variants: ['monthly_first', 'yearly_first', 'yearly_savings']
  },
  onboarding_flow: {
    id: 'onboarding_v1',
    variants: ['quick', 'detailed', 'ar_first']
  }
} as const;

export interface ABTestVariant {
  testId: string;
  variantId: string;
  startedAt: string;
}

// Legacy event type for backward compatibility with existing code
export type AnalyticsEvent = 
  | 'app_open'
  | 'ar_session_start'
  | 'ar_session_end'
  | 'landmark_tap'
  | 'landmark_list_view'
  | 'landmark_list_open'
  | 'explanation_view'
  | 'paywall_view'
  | 'paywall_dismiss'
  | 'purchase_start'
  | 'purchase_complete'
  | 'purchase_cancel'
  | 'share_tap'
  | 'share_complete'
  | 'offline_download'
  | 'offline_update'
  | 'notification_enable'
  | 'referral_sent'
  | 'referral_signup'
  | 'onboarding_complete'
  | 'memory_cleared'
  // Tour events
  | 'tour_viewed'
  | 'tour_started'
  | 'tour_preview_completed'
  | 'tour_purchase_prompted'
  | 'tour_completed'
  | 'tour_ended'
  // City events
  | 'city_selected'
  | 'city_blocked_premium'
  | 'city_list_view'
  // Landmark of the Day
  | 'landmark_of_day_viewed'
  // Rating events
  | 'rating_prompt_triggered'
  | 'rating_prompt_shown';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private platformId = inject(PLATFORM_ID);
  
  // Storage keys
  private readonly ANALYTICS_KEY = 'privacy_safe_analytics';
  private readonly PREFS_KEY = 'analytics_preferences';
  private readonly AB_TESTS_KEY = 'ab_test_variants';
  
  // Limits
  private readonly MAX_RAW_EVENTS = 500;
  private readonly MAX_DAYS_STORED = 30;
  private readonly AGGREGATION_THRESHOLD_HOURS = 24;
  
  // In-memory buffer for batching
  private eventBuffer: AnalyticsEventModel[] = [];
  private flushTimeout: any = null;
  private activeTests: Record<string, ABTestVariant> = {};
  
  // Signals
  private _isEnabled = signal(true);
  readonly isEnabled = this._isEnabled.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    if (this.isBrowser) {
      this.loadPreferences();
      this.loadActiveTests();
      this.runAggregationIfNeeded();
    }
  }

  // ─────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────

  /**
   * Track an analytics event
   * PRIVACY: No user identifiers are attached
   */
  track(event: AnalyticsEvent | string, metadata?: Record<string, string | number | boolean>): void {
    if (!this.isBrowser || !this._isEnabled()) return;
    
    // Skip analytics in demo mode (don't pollute real data)
    if (environment.demoMode) return;

    // Sanitize metadata - remove any potentially identifying info
    const safeMetadata = this.sanitizeMetadata(metadata);

    const analyticsEvent: AnalyticsEventModel = {
      event,
      timestamp: new Date().toISOString(),
      metadata: safeMetadata
    };

    // Add to buffer
    this.eventBuffer.push(analyticsEvent);

    // Schedule flush
    this.scheduleFlush();

    // Debug logging (dev only)
    if (this.isDebugMode()) {
      console.log('📊 [Analytics]', event, safeMetadata);
    }
  }

  /**
   * Manually flush buffered events to storage
   */
  flush(): void {
    if (!this.isBrowser || this.eventBuffer.length === 0) return;

    const stored = this.getStoredAnalytics();
    stored.rawEvents.push(...this.eventBuffer);

    // Enforce limit on raw events
    if (stored.rawEvents.length > this.MAX_RAW_EVENTS) {
      stored.rawEvents = stored.rawEvents.slice(-this.MAX_RAW_EVENTS);
    }

    this.saveStoredAnalytics(stored);
    this.eventBuffer = [];

    // Check if aggregation is needed
    this.runAggregationIfNeeded();
  }

  /**
   * Enable analytics tracking
   */
  enable(): void {
    this._isEnabled.set(true);
    this.savePreferences({ enabled: true, lastUpdated: new Date().toISOString() });
  }

  /**
   * Disable analytics tracking and clear all data
   * PRIVACY: Complete data removal on opt-out
   */
  disable(): void {
    this._isEnabled.set(false);
    this.clearAllData();
    this.savePreferences({ enabled: false, lastUpdated: new Date().toISOString() });
  }

  /**
   * Toggle analytics enabled state
   */
  toggle(): void {
    if (this._isEnabled()) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Clear all analytics data
   * PRIVACY: User-initiated complete removal
   */
  clearAllData(): void {
    if (!this.isBrowser) return;
    this.eventBuffer = [];
    localStorage.removeItem(this.ANALYTICS_KEY);
  }

  // ─────────────────────────────────────────────────────
  // AGGREGATION (Privacy-Enhancing)
  // ─────────────────────────────────────────────────────

  /**
   * Run aggregation to compact old events into daily counts
   * PRIVACY: This reduces granularity and enhances privacy
   */
  private runAggregationIfNeeded(): void {
    if (!this.isBrowser) return;

    const stored = this.getStoredAnalytics();
    const lastAgg = stored.lastAggregation ? new Date(stored.lastAggregation) : null;
    const now = new Date();

    // Only aggregate if 24+ hours since last aggregation
    if (lastAgg) {
      const hoursSinceLastAgg = (now.getTime() - lastAgg.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAgg < this.AGGREGATION_THRESHOLD_HOURS) return;
    }

    this.aggregateOldEvents(stored);
    stored.lastAggregation = now.toISOString();
    this.saveStoredAnalytics(stored);
  }

  /**
   * Aggregate events older than 24 hours into daily counts
   */
  private aggregateOldEvents(stored: StoredAnalytics): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.AGGREGATION_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Separate old and recent events
    const oldEvents: AnalyticsEventModel[] = [];
    const recentEvents: AnalyticsEventModel[] = [];

    for (const event of stored.rawEvents) {
      const eventDate = new Date(event.timestamp);
      if (eventDate < cutoff) {
        oldEvents.push(event);
      } else {
        recentEvents.push(event);
      }
    }

    // Aggregate old events by day
    const aggregates = new Map<string, Record<string, number>>();
    
    for (const event of oldEvents) {
      const dateKey = event.timestamp.split('T')[0]; // YYYY-MM-DD only
      
      if (!aggregates.has(dateKey)) {
        aggregates.set(dateKey, {});
      }
      
      const counts = aggregates.get(dateKey)!;
      counts[event.event] = (counts[event.event] || 0) + 1;
    }

    // Merge with existing aggregates
    for (const [date, eventCounts] of aggregates) {
      const existing = stored.dailyAggregates.find(a => a.date === date);
      
      if (existing) {
        // Merge counts
        for (const [eventName, count] of Object.entries(eventCounts)) {
          existing.eventCounts[eventName] = (existing.eventCounts[eventName] || 0) + count;
        }
      } else {
        stored.dailyAggregates.push({ date, eventCounts });
      }
    }

    // Sort aggregates by date and limit to MAX_DAYS_STORED
    stored.dailyAggregates.sort((a, b) => b.date.localeCompare(a.date));
    stored.dailyAggregates = stored.dailyAggregates.slice(0, this.MAX_DAYS_STORED);

    // Keep only recent events
    stored.rawEvents = recentEvents;
  }

  // ─────────────────────────────────────────────────────
  // OPTIONAL BACKEND UPLOAD (Privacy-Safe)
  // ─────────────────────────────────────────────────────

  /**
   * Upload aggregated analytics to backend
   * PRIVACY:
   * - Only uploads daily counts, not raw events
   * - No timestamps finer than day
   * - No device identifiers
   * - No personal data
   */
  async uploadAnalytics(): Promise<boolean> {
    if (!this.isBrowser || !this._isEnabled()) return false;
    if (!navigator.onLine) return false;

    const stored = this.getStoredAnalytics();
    
    // Only upload aggregated data (not raw events)
    const payload = {
      dailyAggregates: stored.dailyAggregates,
      // PRIVACY: No device ID, no user ID, no timestamps finer than day
    };

    try {
      // TODO: Replace with your actual analytics endpoint
      // const response = await fetch('https://your-api.com/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });
      // return response.ok;
      
      console.log('📤 [Analytics Upload]', payload);
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────
  // DEBUG & DEVELOPMENT
  // ─────────────────────────────────────────────────────

  /**
   * Get analytics summary for debug view
   * DEV ONLY: Not exposed in production UI
   */
  getDebugSummary(): { 
    enabled: boolean;
    rawEventCount: number;
    aggregateDays: number;
    recentEvents: AnalyticsEventModel[];
    aggregates: DailyAggregate[];
  } {
    const stored = this.getStoredAnalytics();
    return {
      enabled: this._isEnabled(),
      rawEventCount: stored.rawEvents.length,
      aggregateDays: stored.dailyAggregates.length,
      recentEvents: stored.rawEvents.slice(-20), // Last 20 events
      aggregates: stored.dailyAggregates
    };
  }

  /**
   * Get aggregated event counts across all days
   */
  getTotalEventCounts(): Record<string, number> {
    const stored = this.getStoredAnalytics();
    const totals: Record<string, number> = {};

    // Count from aggregates
    for (const agg of stored.dailyAggregates) {
      for (const [event, count] of Object.entries(agg.eventCounts)) {
        totals[event] = (totals[event] || 0) + count;
      }
    }

    // Count from raw events
    for (const event of stored.rawEvents) {
      totals[event.event] = (totals[event.event] || 0) + 1;
    }

    return totals;
  }

  // ─────────────────────────────────────────────────────
  // STORAGE HELPERS
  // ─────────────────────────────────────────────────────

  private getStoredAnalytics(): StoredAnalytics {
    if (!this.isBrowser) {
      return { rawEvents: [], dailyAggregates: [], lastAggregation: '' };
    }

    try {
      const stored = localStorage.getItem(this.ANALYTICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Corrupted data, start fresh
    }

    return { rawEvents: [], dailyAggregates: [], lastAggregation: '' };
  }

  private saveStoredAnalytics(analytics: StoredAnalytics): void {
    if (!this.isBrowser) return;
    
    try {
      localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(analytics));
    } catch {
      // Storage full - clear old data
      analytics.dailyAggregates = analytics.dailyAggregates.slice(0, 7);
      analytics.rawEvents = analytics.rawEvents.slice(-100);
      try {
        localStorage.setItem(this.ANALYTICS_KEY, JSON.stringify(analytics));
      } catch {
        // Still failing, give up
      }
    }
  }

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.PREFS_KEY);
      if (stored) {
        const prefs: AnalyticsPreferences = JSON.parse(stored);
        this._isEnabled.set(prefs.enabled);
      }
    } catch {
      // Default to enabled
      this._isEnabled.set(true);
    }
  }

  private savePreferences(prefs: AnalyticsPreferences): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(prefs));
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;
    
    // Flush after 5 seconds of inactivity
    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
    }, 5000);
  }

  /**
   * Sanitize metadata to remove any potentially identifying information
   * PRIVACY: Ensures no PII leaks into analytics
   */
  private sanitizeMetadata(metadata?: Record<string, string | number | boolean>): Record<string, string | number | boolean> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, string | number | boolean> = {};
    
    // Whitelist of allowed metadata keys
    const allowedKeys = [
      'landmark_id', 'landmark_name', 'city_id', 'is_premium', 'source', 'mode',
      'distance', 'matched_interest', 'success', 'count', 'city', 'version',
      'variant', 'is_follow_up', 'landmarks', 'session_duration_seconds'
    ];

    for (const [key, value] of Object.entries(metadata)) {
      // Skip any userId or device-related keys
      if (key.toLowerCase().includes('user') || 
          key.toLowerCase().includes('device')) {
        continue;
      }

      // Round distances to reduce precision
      if (key === 'distance' && typeof value === 'number') {
        sanitized[key] = Math.round(value / 10) * 10; // Round to nearest 10m
        continue;
      }

      if (allowedKeys.includes(key)) {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private isDebugMode(): boolean {
    return typeof window !== 'undefined' && 
           ((window as any).DEBUG_ANALYTICS === true || 
            (window as any).location?.hostname === 'localhost');
  }

  // ─────────────────────────────────────────────────────
  // SESSION TRACKING (No User ID)
  // ─────────────────────────────────────────────────────

  private sessionStart: Date | null = null;

  startSession(): void {
    this.sessionStart = new Date();
    this.track('app_open');
  }

  endSession(): void {
    if (this.sessionStart) {
      const duration = Math.floor((Date.now() - this.sessionStart.getTime()) / 1000);
      this.track('ar_session_end', { session_duration_seconds: duration });
      this.flush(); // Ensure events are persisted
    }
  }

  // ─────────────────────────────────────────────────────
  // A/B TESTING (Privacy-Safe)
  // ─────────────────────────────────────────────────────

  /**
   * A/B Testing: Get or assign a variant
   * PRIVACY: Variants are stored locally, not tied to user identity
   */
  getVariant(testKey: keyof typeof AB_TESTS): string {
    const test = AB_TESTS[testKey];
    
    // Check if already assigned
    if (this.activeTests[test.id]) {
      return this.activeTests[test.id].variantId;
    }

    // Assign a variant randomly
    const variantIndex = Math.floor(Math.random() * test.variants.length);
    const variant: ABTestVariant = {
      testId: test.id,
      variantId: test.variants[variantIndex],
      startedAt: new Date().toISOString()
    };

    this.activeTests[test.id] = variant;
    this.saveActiveTests();

    return variant.variantId;
  }

  private loadActiveTests(): void {
    if (!this.isBrowser) return;
    
    try {
      const stored = localStorage.getItem(this.AB_TESTS_KEY);
      if (stored) {
        this.activeTests = JSON.parse(stored);
      }
    } catch {
      this.activeTests = {};
    }
  }

  private saveActiveTests(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.AB_TESTS_KEY, JSON.stringify(this.activeTests));
  }

  // ─────────────────────────────────────────────────────
  // RATING PROMPT TRIGGER
  // ─────────────────────────────────────────────────────

  private readonly RATING_SESSIONS_KEY = 'rating_sessions';
  private readonly RATING_SHOWN_KEY = 'rating_shown';
  private readonly SESSIONS_BEFORE_RATING = 3;

  /**
   * Record a successful explanation view
   * After 3 sessions with successful explanations, trigger rating
   */
  recordSuccessfulExplanation(): boolean {
    if (!this.isBrowser) return false;
    
    // Check if rating already shown
    if (localStorage.getItem(this.RATING_SHOWN_KEY) === 'true') {
      return false;
    }
    
    const currentSession = sessionStorage.getItem('session_id');
    const storedSessions = localStorage.getItem(this.RATING_SESSIONS_KEY);
    const sessions: string[] = storedSessions ? JSON.parse(storedSessions) : [];
    
    // Only count unique sessions
    if (currentSession && !sessions.includes(currentSession)) {
      sessions.push(currentSession);
      localStorage.setItem(this.RATING_SESSIONS_KEY, JSON.stringify(sessions));
    }
    
    // Check if we've hit the threshold
    if (sessions.length >= this.SESSIONS_BEFORE_RATING) {
      this.track('rating_prompt_triggered');
      return true; // Signal to show rating prompt
    }
    
    return false;
  }

  /**
   * Mark rating as shown (prevents future prompts)
   */
  markRatingShown(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.RATING_SHOWN_KEY, 'true');
    this.track('rating_prompt_shown');
  }

  /**
   * Check if rating prompt should be shown
   */
  shouldShowRating(): boolean {
    if (!this.isBrowser) return false;
    if (localStorage.getItem(this.RATING_SHOWN_KEY) === 'true') return false;
    
    const storedSessions = localStorage.getItem(this.RATING_SESSIONS_KEY);
    const sessions: string[] = storedSessions ? JSON.parse(storedSessions) : [];
    
    return sessions.length >= this.SESSIONS_BEFORE_RATING;
  }
}
