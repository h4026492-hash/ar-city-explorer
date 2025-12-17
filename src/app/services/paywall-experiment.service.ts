import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PaywallVariant, PaywallExperimentConfig } from '../models/paywall-variant.model';

const EXPERIMENT_KEY = 'paywall_experiment_v1';

/**
 * PaywallExperimentService
 * 
 * Manages A/B testing for paywall variants.
 * 
 * PRIVACY COMPLIANCE:
 * - No user identifiers collected
 * - Variant assignment is random, not based on user data
 * - Assignment persisted locally only
 * - No external analytics SDKs
 * 
 * APP STORE COMPLIANCE:
 * - Both variants show identical pricing
 * - Both variants show identical subscription terms
 * - Only copy and layout differ
 * - Core functionality is not completely gated
 */
@Injectable({
  providedIn: 'root'
})
export class PaywallExperimentService {
  private platformId = inject(PLATFORM_ID);
  
  private _variant = signal<PaywallVariant>('A');
  private _isInitialized = signal(false);

  readonly variant = this._variant.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the experiment on first launch.
   * Variant is assigned once and never changes.
   */
  private initialize(): void {
    if (!this.isBrowser) {
      this._variant.set('A');
      this._isInitialized.set(true);
      return;
    }

    try {
      const stored = localStorage.getItem(EXPERIMENT_KEY);
      
      if (stored) {
        // Use existing assignment
        const config: PaywallExperimentConfig = JSON.parse(stored);
        this._variant.set(config.variant);
      } else {
        // First launch - assign variant randomly (50/50 split)
        const newVariant = this.assignVariant();
        this.persistVariant(newVariant);
        this._variant.set(newVariant);
      }
      
      this._isInitialized.set(true);
    } catch (e) {
      // Default to A on error
      this._variant.set('A');
      this._isInitialized.set(true);
    }
  }

  /**
   * Get the assigned variant
   */
  getVariant(): PaywallVariant {
    return this._variant();
  }

  /**
   * Randomly assign a variant with 50/50 split
   */
  private assignVariant(): PaywallVariant {
    // Simple random assignment
    // Using Math.random() for true randomness (no user data involved)
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  /**
   * Persist variant assignment
   */
  private persistVariant(variant: PaywallVariant): void {
    if (!this.isBrowser) return;

    try {
      const config: PaywallExperimentConfig = {
        variant,
        assignedAt: Date.now()
      };
      localStorage.setItem(EXPERIMENT_KEY, JSON.stringify(config));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * FOR DEVELOPMENT ONLY: Force a specific variant
   * Remove this method before production release
   */
  _devForceVariant(variant: PaywallVariant): void {
    if (!this.isBrowser) return;
    
    this._variant.set(variant);
    this.persistVariant(variant);
  }

  /**
   * FOR DEVELOPMENT ONLY: Reset experiment assignment
   * Remove this method before production release
   */
  _devResetExperiment(): void {
    if (!this.isBrowser) return;

    try {
      localStorage.removeItem(EXPERIMENT_KEY);
      const newVariant = this.assignVariant();
      this.persistVariant(newVariant);
      this._variant.set(newVariant);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Get experiment metadata for analytics
   */
  getExperimentMetadata(): { variant: PaywallVariant; experiment_id: string } {
    return {
      variant: this._variant(),
      experiment_id: 'paywall_v1'
    };
  }
}
