/**
 * Founding User Model
 * 
 * Represents users who subscribed during the founding period.
 * These users receive special recognition and price lock messaging.
 * 
 * APP STORE COMPLIANCE NOTE:
 * ─────────────────────────────────────────────────────────────────
 * - Founding badge is COSMETIC and INFORMATIONAL only
 * - Price lock is a MESSAGING GUARANTEE, not StoreKit manipulation
 * - Actual subscription pricing is handled entirely by Apple
 * - This feature does not alter, bypass, or manipulate IAP pricing
 * - Subscription terms remain transparent and unchanged
 * ─────────────────────────────────────────────────────────────────
 */

export interface FoundingUser {
  /** Whether the user has founding member status */
  isFoundingUser: boolean;
  
  /** ISO date string of when the user first subscribed */
  subscribedAt: string;
  
  /** Whether the user's original price is locked (messaging only) */
  priceLocked: boolean;
  
  /** The original subscription price at time of founding signup */
  originalPrice: number;
  
  /** Currency code (e.g., 'USD') */
  currency?: string;
}

/** Default state for non-founding users */
export const DEFAULT_FOUNDING_STATUS: FoundingUser = {
  isFoundingUser: false,
  subscribedAt: '',
  priceLocked: false,
  originalPrice: 0
};
