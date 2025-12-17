/**
 * Paywall Trigger Service
 * 
 * Smart paywall timing based on user engagement.
 * Shows paywall AFTER user experiences value, not before.
 * 
 * Research shows users convert better after:
 * - Completing a tour preview
 * - Reading 2+ quality explanations
 * - Spending 3+ minutes in AR mode
 * 
 * This increases conversion by showing paywall at high-intent moments.
 */

import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type PaywallTriggerReason = 
  | 'daily_limit'           // Hit free tap limit
  | 'tour_preview_complete' // Finished tour preview
  | 'high_engagement'       // Read 2+ explanations
  | 'ar_session_extended'   // 3+ min in AR
  | 'manual';               // User tapped upgrade

export interface EngagementState {
  explanationsViewed: number;
  tourPreviewsCompleted: number;
  arSessionMinutes: number;
  lastPaywallShown: string | null;
}

const ENGAGEMENT_KEY = 'paywall_engagement_state';
const PAYWALL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between paywalls

@Injectable({ providedIn: 'root' })
export class PaywallTriggerService {
  private platformId = inject(PLATFORM_ID);
  
  private _engagement = signal<EngagementState>({
    explanationsViewed: 0,
    tourPreviewsCompleted: 0,
    arSessionMinutes: 0,
    lastPaywallShown: null
  });
  
  private _lastTriggerReason = signal<PaywallTriggerReason | null>(null);
  
  // Public readonly signals
  readonly engagement = this._engagement.asReadonly();
  readonly lastTriggerReason = this._lastTriggerReason.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.loadEngagement();
  }

  // ─────────────────────────────────────────────────────
  // ENGAGEMENT TRACKING
  // ─────────────────────────────────────────────────────

  /**
   * Track when user views an explanation
   */
  trackExplanationView(): void {
    const current = this._engagement();
    this._engagement.set({
      ...current,
      explanationsViewed: current.explanationsViewed + 1
    });
    this.saveEngagement();
  }

  /**
   * Track when user completes a tour preview
   */
  trackTourPreviewComplete(): void {
    const current = this._engagement();
    this._engagement.set({
      ...current,
      tourPreviewsCompleted: current.tourPreviewsCompleted + 1
    });
    this.saveEngagement();
  }

  /**
   * Track AR session time
   */
  trackARSessionTime(minutes: number): void {
    const current = this._engagement();
    this._engagement.set({
      ...current,
      arSessionMinutes: current.arSessionMinutes + minutes
    });
    this.saveEngagement();
  }

  // ─────────────────────────────────────────────────────
  // SMART TIMING LOGIC
  // ─────────────────────────────────────────────────────

  /**
   * Check if we should show paywall based on engagement
   * Returns the trigger reason if paywall should show, null otherwise
   */
  shouldShowPaywall(hitDailyLimit: boolean): PaywallTriggerReason | null {
    // Check cooldown first
    if (this.isOnCooldown()) {
      return null;
    }
    
    const state = this._engagement();
    
    // Priority 1: Tour preview complete (highest intent)
    if (state.tourPreviewsCompleted >= 1) {
      return 'tour_preview_complete';
    }
    
    // Priority 2: High engagement (read 2+ explanations)
    if (state.explanationsViewed >= 2) {
      return 'high_engagement';
    }
    
    // Priority 3: Extended AR session (3+ minutes)
    if (state.arSessionMinutes >= 3) {
      return 'ar_session_extended';
    }
    
    // Priority 4: Daily limit (fallback, still show but less optimal)
    if (hitDailyLimit && state.explanationsViewed >= 1) {
      // At least require 1 explanation viewed
      return 'daily_limit';
    }
    
    // Don't show paywall yet - user hasn't experienced enough value
    return null;
  }

  /**
   * Check if paywall trigger is optimal (high intent moment)
   */
  isOptimalTrigger(reason: PaywallTriggerReason): boolean {
    return reason === 'tour_preview_complete' || reason === 'high_engagement';
  }

  /**
   * Record that paywall was shown
   */
  recordPaywallShown(reason: PaywallTriggerReason): void {
    this._lastTriggerReason.set(reason);
    
    const current = this._engagement();
    this._engagement.set({
      ...current,
      lastPaywallShown: new Date().toISOString()
    });
    this.saveEngagement();
  }

  /**
   * Check if we're in paywall cooldown period
   */
  private isOnCooldown(): boolean {
    const lastShown = this._engagement().lastPaywallShown;
    if (!lastShown) return false;
    
    const lastShownTime = new Date(lastShown).getTime();
    const now = Date.now();
    
    return (now - lastShownTime) < PAYWALL_COOLDOWN_MS;
  }

  /**
   * Reset engagement for new session
   */
  resetSessionEngagement(): void {
    this._engagement.set({
      explanationsViewed: 0,
      tourPreviewsCompleted: 0,
      arSessionMinutes: 0,
      lastPaywallShown: this._engagement().lastPaywallShown // Keep cooldown
    });
    this.saveEngagement();
  }

  /**
   * Get engagement summary for analytics
   */
  getEngagementSummary(): Record<string, number | string> {
    const state = this._engagement();
    return {
      explanations_viewed: state.explanationsViewed,
      tour_previews: state.tourPreviewsCompleted,
      ar_minutes: state.arSessionMinutes,
      trigger_reason: this._lastTriggerReason() || 'none'
    };
  }

  // ─────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────

  private loadEngagement(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(ENGAGEMENT_KEY);
      if (stored) {
        const state = JSON.parse(stored) as EngagementState;
        this._engagement.set(state);
      }
    } catch (e) {
      console.warn('Failed to load engagement state:', e);
    }
  }

  private saveEngagement(): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(this._engagement()));
    } catch (e) {
      console.warn('Failed to save engagement state:', e);
    }
  }
}
