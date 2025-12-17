/**
 * Founding User Service
 * 
 * Manages founding member status for early subscribers.
 * 
 * Qualification Rule:
 * - User subscribes before FOUNDING_CUTOFF_DATE
 * - Status is granted once and NEVER removed
 * - Price lock is a messaging feature, not StoreKit manipulation
 * 
 * APP STORE COMPLIANCE:
 * ─────────────────────────────────────────────────────────────────
 * This service provides cosmetic recognition for early adopters.
 * It does NOT:
 * - Alter Apple's subscription pricing
 * - Bypass or manipulate IAP
 * - Offer actual price changes outside of App Store
 * 
 * The "price lock" is a PROMISE that the app will not show
 * marketing for higher prices to founding users - it's a trust
 * and loyalty feature, not a billing feature.
 * ─────────────────────────────────────────────────────────────────
 */

import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FoundingUser, DEFAULT_FOUNDING_STATUS } from '../models/founding-user.model';
import { environment } from '../../environments/environment';

const FOUNDING_USER_KEY = 'ar_city_founding_user';

@Injectable({ providedIn: 'root' })
export class FoundingUserService {
  private platformId = inject(PLATFORM_ID);
  
  private _foundingStatus = signal<FoundingUser>(DEFAULT_FOUNDING_STATUS);
  
  // Public readonly signals
  readonly foundingStatus = this._foundingStatus.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.loadFoundingStatus();
  }

  // ─────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────

  /**
   * Check if user is a founding member
   */
  isFoundingUser(): boolean {
    return this._foundingStatus().isFoundingUser;
  }

  /**
   * Check if founding period is still active (before cutoff)
   */
  isFoundingPeriodActive(): boolean {
    const cutoff = this.getFoundingCutoffDate();
    return new Date() < cutoff;
  }

  /**
   * Get the founding cutoff date
   */
  getFoundingCutoffDate(): Date {
    // Use environment config or default to March 31, 2025
    const cutoffString = (environment as any).foundingCutoffDate || '2025-03-31T23:59:59Z';
    return new Date(cutoffString);
  }

  /**
   * Get founding user info
   */
  getFoundingInfo(): FoundingUser {
    return this._foundingStatus();
  }

  /**
   * Get days remaining in founding period
   */
  getDaysRemaining(): number {
    const cutoff = this.getFoundingCutoffDate();
    const now = new Date();
    const diff = cutoff.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Grant founding user status
   * Called when user subscribes during founding period
   * 
   * @param originalPrice - The price at time of subscription
   * @param currency - Currency code (e.g., 'USD')
   */
  grantFoundingStatus(originalPrice: number, currency: string = 'USD'): void {
    // Never override existing founding status
    if (this._foundingStatus().isFoundingUser) {
      return;
    }

    const status: FoundingUser = {
      isFoundingUser: true,
      subscribedAt: new Date().toISOString(),
      priceLocked: true,
      originalPrice,
      currency
    };

    this._foundingStatus.set(status);
    this.persistFoundingStatus(status);
  }

  /**
   * Lock price for founding user (messaging only)
   * This does NOT affect actual StoreKit pricing
   */
  lockPrice(originalPrice: number): void {
    const current = this._foundingStatus();
    if (!current.isFoundingUser) return;

    const updated: FoundingUser = {
      ...current,
      priceLocked: true,
      originalPrice
    };

    this._foundingStatus.set(updated);
    this.persistFoundingStatus(updated);
  }

  /**
   * Get the locked price for display
   * Returns null if not a founding user
   */
  getLockedPrice(): { price: number; currency: string } | null {
    const status = this._foundingStatus();
    if (!status.isFoundingUser || !status.priceLocked) {
      return null;
    }
    return {
      price: status.originalPrice,
      currency: status.currency || 'USD'
    };
  }

  /**
   * Format locked price for display
   */
  getFormattedLockedPrice(): string {
    const locked = this.getLockedPrice();
    if (!locked) return '';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: locked.currency
    }).format(locked.price);
  }

  // ─────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────

  private loadFoundingStatus(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(FOUNDING_USER_KEY);
      if (stored) {
        const status = JSON.parse(stored) as FoundingUser;
        // Validate structure
        if (status && typeof status.isFoundingUser === 'boolean') {
          this._foundingStatus.set(status);
        }
      }
    } catch (e) {
      console.warn('Failed to load founding status:', e);
    }
  }

  private persistFoundingStatus(status: FoundingUser): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(FOUNDING_USER_KEY, JSON.stringify(status));
    } catch (e) {
      console.warn('Failed to persist founding status:', e);
    }
  }
}
