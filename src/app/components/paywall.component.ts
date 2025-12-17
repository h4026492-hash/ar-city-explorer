import { Component, inject, signal, output, input, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService } from '../services/subscription.service';
import { AnalyticsService } from '../services/analytics.service';
import { PaywallExperimentService } from '../services/paywall-experiment.service';
import { FoundingUserService } from '../services/founding-user.service';
import { PaywallVariant, VARIANT_A_CONFIG, VARIANT_B_CONFIG } from '../models/paywall-variant.model';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  savings?: string;
  popular?: boolean;
}

interface PaywallCopy {
  headline: string;
  subheadline: string;
  cta: string;
  features: string[];
}

// Tour context for contextual paywall copy
export interface TourPaywallContext {
  tourId: string;
  tourTitle: string;
  totalLandmarks: number;
  previewCount: number;
}

@Component({
  selector: 'app-paywall',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="paywall-overlay" (click)="dismiss()"></div>
    
    <div class="paywall-sheet">
      <button class="close-btn" (click)="dismiss()">✕</button>
      
      <!-- Header -->
      <div class="paywall-header">
        <span class="premium-icon">⭐</span>
        <h2>{{ copy().headline }}</h2>
        <p>{{ copy().subheadline }}</p>
      </div>
      
      <!-- Features -->
      <ul class="features-list">
        @for (feature of copy().features; track feature) {
          <li>
            <span class="check">✓</span>
            {{ feature }}
          </li>
        }
      </ul>
      
      <!-- Pricing Options -->
      <div class="pricing-options">
        @for (plan of displayedPlans(); track plan.id) {
          <button 
            class="plan-card"
            [class.selected]="selectedPlan() === plan.id"
            [class.popular]="plan.popular"
            (click)="selectPlan(plan.id)">
            @if (plan.popular) {
              <span class="popular-badge">Best Value</span>
            }
            <span class="plan-name">{{ plan.name }}</span>
            <span class="plan-price">{{ plan.price }}</span>
            <span class="plan-period">{{ plan.period }}</span>
            @if (plan.savings) {
              <span class="plan-savings">{{ plan.savings }}</span>
            }
          </button>
        }
      </div>
      
      <!-- CTA Button -->
      <button class="cta-button" (click)="subscribe()">
        {{ copy().cta }}
      </button>
      
      <!-- Trust Signals -->
      <div class="trust-signals">
        <span>🔒 Secure payment</span>
        <span>↩️ Cancel anytime</span>
        <span>💬 24/7 support</span>
      </div>
      
      <!-- Social Proof (variant) -->
      @if (showSocialProof()) {
        <p class="social-proof">
          Join 2,500+ Dallas explorers using Premium
        </p>
      }
      
      <!-- Scarcity (variant) -->
      @if (showScarcity()) {
        <p class="scarcity-badge">
          🎁 Limited: 40% off first year – ends soon!
        </p>
      }
      
      <!-- Founding Period Message -->
      @if (isFoundingPeriodActive()) {
        <div class="founding-promo">
          <span class="founding-icon">✦</span>
          <p>Founding members lock the lowest price forever</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .paywall-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 200;
    }
    
    .paywall-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, #1a1f2e 0%, #0f1218 100%);
      border-radius: 32px 32px 0 0;
      padding: 32px 24px 40px;
      max-height: 90vh;
      overflow-y: auto;
      z-index: 201;
      animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0.8; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    .close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 36px;
      height: 36px;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 18px;
      cursor: pointer;
    }
    
    .paywall-header {
      text-align: center;
      margin-bottom: 28px;
    }
    
    .premium-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
    }
    
    .paywall-header h2 {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 8px;
      background: linear-gradient(135deg, #F59E0B, #EF4444);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .paywall-header p {
      font-size: 15px;
      color: rgba(255,255,255,0.6);
      margin: 0;
    }
    
    .features-list {
      list-style: none;
      padding: 0;
      margin: 0 0 28px;
    }
    
    .features-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      font-size: 15px;
      color: rgba(255,255,255,0.85);
    }
    
    .check {
      width: 24px;
      height: 24px;
      background: rgba(52, 211, 153, 0.2);
      color: #34D399;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
    }
    
    .pricing-options {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .plan-card {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      
      &.selected {
        border-color: #3B82F6;
        background: rgba(59, 130, 246, 0.15);
      }
      
      &.popular {
        border-color: #F59E0B;
      }
    }
    
    .popular-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #F59E0B, #EF4444);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    
    .plan-name {
      display: block;
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 6px;
    }
    
    .plan-price {
      display: block;
      font-size: 28px;
      font-weight: 700;
      color: white;
    }
    
    .plan-period {
      display: block;
      font-size: 12px;
      color: rgba(255,255,255,0.4);
    }
    
    .plan-savings {
      display: block;
      font-size: 11px;
      color: #34D399;
      font-weight: 600;
      margin-top: 6px;
    }
    
    .cta-button {
      width: 100%;
      padding: 18px;
      font-size: 17px;
      font-weight: 600;
      color: white;
      background: linear-gradient(135deg, #3B82F6, #8B5CF6);
      border: none;
      border-radius: 14px;
      cursor: pointer;
      transition: transform 0.15s ease;
      
      &:active {
        transform: scale(0.98);
      }
    }
    
    .trust-signals {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 16px;
      font-size: 11px;
      color: rgba(255,255,255,0.4);
    }
    
    .social-proof {
      text-align: center;
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      margin-top: 16px;
    }
    
    .scarcity-badge {
      text-align: center;
      font-size: 13px;
      color: #F59E0B;
      margin-top: 16px;
      padding: 10px;
      background: rgba(245, 158, 11, 0.1);
      border-radius: 10px;
    }
    
    .founding-promo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1));
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      
      .founding-icon {
        color: #F59E0B;
        font-size: 14px;
      }
      
      p {
        margin: 0;
        font-size: 13px;
        color: #F59E0B;
        font-weight: 500;
      }
    }
  `]
})
export class PaywallComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private analyticsService = inject(AnalyticsService);
  private experimentService = inject(PaywallExperimentService);
  private foundingUserService = inject(FoundingUserService);
  
  // Optional tour context for contextual paywall messaging
  tourContext = input<TourPaywallContext | undefined>(undefined);
  
  dismissed = output<void>();
  subscribed = output<string>();
  
  selectedPlan = signal('yearly');
  
  // A/B Test variants - now using experiment service
  private experimentVariant = signal<PaywallVariant>('A');
  private copyVariant = signal('control');
  private pricingVariant = signal('yearly_first');

  /**
   * APP STORE COMPLIANCE NOTE:
   * Both variants A and B display identical:
   * - Pricing ($3.99/month, $29.99/year)
   * - Subscription terms (cancel anytime)
   * - Core functionality access (3 free taps daily)
   * Only marketing copy and layout differ.
   */

  // Pricing plans - YEARLY FIRST (higher conversion)
  // App Store compliant: same features, different presentation
  private plans: PricingPlan[] = [
    { 
      id: 'yearly', 
      name: 'Yearly', 
      price: '$29.99', 
      period: '/year', 
      savings: 'Save 40%', 
      popular: true 
    },
    { 
      id: 'monthly', 
      name: 'Monthly', 
      price: '$3.99', 
      period: '/month' 
    }
  ];

  // Value stack features - emphasize yearly value
  private valueStackFeatures = [
    '✓ Unlimited landmarks in all cities',
    '✓ All walking tours included',
    '✓ Offline packs for every city',
    '✓ AI memory across sessions',
    '✓ Priority access to new cities'
  ];

  // Copy variants for A/B testing
  private copyVariants: Record<string, PaywallCopy> = {
    // Variant A: Minimal, clean, focus on unlimited
    variant_a: {
      headline: VARIANT_A_CONFIG.headline,
      subheadline: VARIANT_A_CONFIG.subtext,
      cta: VARIANT_A_CONFIG.cta,
      features: [
        'Unlimited landmark explanations',
        'Offline mode – explore anywhere',
        'Detailed historical deep-dives',
        'Priority new city access'
      ]
    },
    // Variant B: Feature-rich, local angle
    variant_b: {
      headline: VARIANT_B_CONFIG.headline,
      subheadline: VARIANT_B_CONFIG.subtext,
      cta: VARIANT_B_CONFIG.cta,
      features: VARIANT_B_CONFIG.features
    },
    // Legacy control (fallback)
    control: {
      headline: 'Unlock Premium',
      subheadline: 'Get the full Dallas AR experience',
      cta: 'Start Free Trial',
      features: [
        'Unlimited landmark explanations',
        'Offline mode – explore anywhere',
        'Detailed historical deep-dives',
        'Priority new city access'
      ]
    },
    scarcity: {
      headline: 'Limited Time Offer',
      subheadline: 'Join before the price goes up',
      cta: 'Claim 40% Off Now',
      features: [
        'Unlimited landmark explanations',
        'Offline mode – explore anywhere',
        'Detailed historical deep-dives',
        'Founding member badge'
      ]
    },
    social_proof: {
      headline: 'Explorers Love Premium',
      subheadline: 'Rated 4.9★ by Dallas locals',
      cta: 'Join 2,500+ Explorers',
      features: [
        'Unlimited landmark explanations',
        'Offline mode – explore anywhere',
        '"Best city app I\'ve used" – Sarah M.',
        '"Makes Dallas fun again" – Jake T.'
      ]
    },
    local_pride: {
      headline: 'Made for Dallas',
      subheadline: 'By locals, for locals – and visitors too',
      cta: 'Explore Your City',
      features: [
        'Stories only Dallas natives know',
        'Hidden gems & local secrets',
        'Works offline at the rodeo 🤠',
        'Support a Dallas startup'
      ]
    }
  };

  // Computed copy that factors in tour context
  tourCopy = computed<PaywallCopy | null>(() => {
    const ctx = this.tourContext();
    if (!ctx) return null;
    
    const remainingLandmarks = ctx.totalLandmarks - ctx.previewCount;
    
    return {
      headline: `Complete "${ctx.tourTitle}"`,
      subheadline: `Unlock all ${remainingLandmarks} remaining landmarks`,
      cta: 'Unlock Full Tour',
      features: [
        `Full guided tour of ${ctx.totalLandmarks} landmarks`,
        'Step-by-step navigation',
        'Audio explanations at each stop',
        'Available offline – no data needed'
      ]
    };
  });

  ngOnInit() {
    // Get experiment variant (persisted, never changes)
    this.experimentVariant.set(this.experimentService.getVariant());
    
    // Use tour context variant if available, otherwise use experiment variant
    if (this.tourContext()) {
      this.copyVariant.set('tour_context');
    } else {
      // Map experiment variant to copy variant
      const expVariant = this.experimentVariant();
      this.copyVariant.set(expVariant === 'A' ? 'variant_a' : 'variant_b');
    }
    this.pricingVariant.set(this.analyticsService.getVariant('pricing_display'));
    
    // Track paywall view with experiment metadata
    const experimentMeta = this.experimentService.getExperimentMetadata();
    const trackData: Record<string, string | number | boolean> = {
      copy_variant: this.copyVariant(),
      pricing_variant: this.pricingVariant(),
      experiment_variant: experimentMeta.variant,
      experiment_id: experimentMeta.experiment_id
    };
    if (this.tourContext()?.tourId) {
      trackData['tour_id'] = this.tourContext()!.tourId;
    }
    this.analyticsService.track('paywall_view', trackData);
  }

  copy(): PaywallCopy {
    // Use tour-specific copy if available
    const tourSpecificCopy = this.tourCopy();
    if (tourSpecificCopy) {
      return tourSpecificCopy;
    }
    return this.copyVariants[this.copyVariant()] || this.copyVariants['variant_a'];
  }

  displayedPlans(): PricingPlan[] {
    const variant = this.pricingVariant();
    
    if (variant === 'monthly_first') {
      return [...this.plans].reverse();
    }
    
    if (variant === 'yearly_savings') {
      // Emphasize savings more
      return this.plans.map(p => ({
        ...p,
        savings: p.id === 'yearly' ? '🔥 Save $17.89/year!' : p.savings
      }));
    }
    
    return this.plans;
  }

  showSocialProof(): boolean {
    return this.copyVariant() === 'social_proof';
  }

  showScarcity(): boolean {
    return this.copyVariant() === 'scarcity';
  }

  isFoundingPeriodActive(): boolean {
    return this.foundingUserService.isFoundingPeriodActive();
  }

  selectPlan(planId: string) {
    this.selectedPlan.set(planId);
    this.analyticsService.track('purchase_start', { plan_id: planId });
  }

  subscribe() {
    const plan = this.selectedPlan();
    const experimentMeta = this.experimentService.getExperimentMetadata();
    
    // Track CTA click with experiment data
    this.analyticsService.track('purchase_start', {
      plan_id: plan,
      copy_variant: this.copyVariant(),
      pricing_variant: this.pricingVariant(),
      experiment_variant: experimentMeta.variant,
      experiment_id: experimentMeta.experiment_id
    });
    
    // TODO: Integrate with App Store / RevenueCat
    // For now, simulate purchase
    this.subscriptionService.setPremium(true);
    
    // Track successful purchase with experiment data for conversion analysis
    this.analyticsService.track('purchase_complete', {
      plan_id: plan,
      value: plan === 'yearly' ? 29.99 : 3.99,
      experiment_variant: experimentMeta.variant,
      experiment_id: experimentMeta.experiment_id
    });
    
    this.subscribed.emit(plan);
  }

  dismiss() {
    const experimentMeta = this.experimentService.getExperimentMetadata();
    this.analyticsService.track('paywall_dismiss', {
      copy_variant: this.copyVariant(),
      selected_plan: this.selectedPlan(),
      experiment_variant: experimentMeta.variant
    });
    this.dismissed.emit();
  }
}
