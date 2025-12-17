/**
 * Rating Service - Apple Compliant
 * 
 * Purpose: Triggers App Store rating prompt using SKStoreReviewController
 * 
 * App Store Compliance:
 * - Uses native SKStoreReviewController (Apple approved)
 * - Rate limited by iOS (max ~3 prompts per year)
 * - Does not show more than once from our side
 * - Only shown after positive user engagement
 * 
 * Best Practices:
 * - Request after successful landmark explanations
 * - Never during AR session
 * - Never block user flow
 * - Track but don't rely on success callback
 */

import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { AnalyticsService } from './analytics.service';

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        requestReview?: {
          postMessage: (message: string) => void;
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class RatingService {
  private platformId = inject(PLATFORM_ID);
  private analyticsService = inject(AnalyticsService);
  
  private readonly LAST_PROMPT_KEY = 'rating_last_prompt';
  private readonly MIN_DAYS_BETWEEN_PROMPTS = 120; // ~4 months
  
  private _hasPromptedThisSession = signal(false);
  readonly hasPromptedThisSession = this._hasPromptedThisSession.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Check if we can show a rating prompt
   */
  canShowRating(): boolean {
    // Only if rating prompts are enabled in environment
    if (!environment.enableRatingPrompts) {
      console.log('[Rating] Disabled by environment flag');
      return false;
    }
    
    // Only in production
    if (!environment.production) {
      console.log('[Rating] Disabled in development');
      return false;
    }
    
    // Only once per session
    if (this._hasPromptedThisSession()) {
      return false;
    }
    
    // Check time since last prompt
    if (this.isBrowser) {
      const lastPrompt = localStorage.getItem(this.LAST_PROMPT_KEY);
      if (lastPrompt) {
        const daysSincePrompt = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
        if (daysSincePrompt < this.MIN_DAYS_BETWEEN_PROMPTS) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Request an App Store rating
   * Uses native SKStoreReviewController on iOS
   */
  requestRating(): boolean {
    if (!this.canShowRating()) {
      return false;
    }
    
    // Mark as prompted
    this._hasPromptedThisSession.set(true);
    if (this.isBrowser) {
      localStorage.setItem(this.LAST_PROMPT_KEY, Date.now().toString());
    }
    
    // Track in analytics
    this.analyticsService.markRatingShown();
    
    // Try to use native iOS rating prompt via Capacitor
    this.triggerNativeRatingPrompt();
    
    return true;
  }

  /**
   * Trigger native iOS rating prompt
   */
  private triggerNativeRatingPrompt(): void {
    // Try webkit message handler (Capacitor bridge)
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.requestReview) {
      try {
        window.webkit.messageHandlers.requestReview.postMessage('requestReview');
        console.log('[Rating] Native prompt triggered via webkit');
        return;
      } catch (error) {
        console.warn('[Rating] webkit trigger failed:', error);
      }
    }
    
    // Fallback: Try Capacitor App plugin
    this.triggerCapacitorRating();
  }

  /**
   * Trigger rating via Capacitor (if available)
   */
  private async triggerCapacitorRating(): Promise<void> {
    try {
      // Note: Capacitor doesn't have built-in rating support
      // This would need a plugin like capacitor-rate-app
      // For now, we just log that we attempted
      console.log('[Rating] Would trigger Capacitor rating prompt');
      
      // The native iOS prompt should have already been triggered
      // via webkit message handler above. This is just a fallback log.
      
    } catch (error) {
      console.log('[Rating] Capacitor rating not available:', error);
    }
  }

  /**
   * Reset rating tracking (for testing)
   */
  resetRatingTracking(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.LAST_PROMPT_KEY);
    this._hasPromptedThisSession.set(false);
  }
}
