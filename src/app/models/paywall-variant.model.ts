/**
 * Paywall A/B Test Variants
 * 
 * COMPLIANCE NOTE: Both variants display identical:
 * - Pricing information
 * - Subscription terms
 * - Cancellation policy
 * 
 * Only copy and layout differ, which is App Store compliant.
 */

export type PaywallVariant = 'A' | 'B';

export interface PaywallExperimentConfig {
  variant: PaywallVariant;
  assignedAt: number;
}

// Variant A: Minimal, focus on unlimited access
export interface VariantAConfig {
  headline: string;
  subtext: string;
  cta: string;
}

// Variant B: Feature-focused, richer layout
export interface VariantBConfig {
  headline: string;
  subtext: string;
  cta: string;
  features: string[];
}

export const VARIANT_A_CONFIG: VariantAConfig = {
  headline: 'Unlock Unlimited Exploration',
  subtext: 'Explore Dallas with AI-powered AR',
  cta: 'Go Premium'
};

export const VARIANT_B_CONFIG: VariantBConfig = {
  headline: 'Explore Dallas Like a Local',
  subtext: 'Guided walking tours, offline access, unlimited landmarks',
  cta: 'Start Premium Access',
  features: [
    '🚶 Curated walking tours',
    '📴 Works offline anywhere',
    '🏛️ Unlimited landmark explanations',
    '🧠 AI that remembers your interests'
  ]
};
