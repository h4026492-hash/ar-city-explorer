/**
 * Discovery Digest Service
 * 
 * Generates personalized weekly recommendations to bring users back.
 * 
 * Features:
 * - "3 places you haven't explored yet"
 * - Personalized by: visited landmarks, interests, city
 * - In-app only (no email needed)
 * - Shows on home screen once per week
 */

import { Injectable, signal, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LandmarkService } from './landmark.service';
import { InterestService } from './interest.service';
import { AiMemoryService } from './ai-memory.service';
import { Landmark } from '../models/landmark.model';

export interface DiscoveryDigest {
  generatedAt: string;
  cityId: string;
  recommendations: DigestRecommendation[];
  expiresAt: string;
}

export interface DigestRecommendation {
  landmark: Landmark;
  reason: string;  // Why we're recommending this
  matchedInterest?: string;
}

const DIGEST_KEY = 'weekly_discovery_digest';
const DIGEST_VALIDITY_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class DiscoveryDigestService {
  private platformId = inject(PLATFORM_ID);
  private landmarkService = inject(LandmarkService);
  private interestService = inject(InterestService);
  private memoryService = inject(AiMemoryService);
  
  private _currentDigest = signal<DiscoveryDigest | null>(null);
  private _dismissed = signal(false);
  
  // Public readonly signals
  readonly currentDigest = this._currentDigest.asReadonly();
  readonly dismissed = this._dismissed.asReadonly();
  
  // Computed: should we show the digest card?
  readonly shouldShowDigest = computed(() => {
    if (this._dismissed()) return false;
    
    const digest = this._currentDigest();
    if (!digest) return false;
    
    // Check if expired
    if (new Date(digest.expiresAt) < new Date()) return false;
    
    return digest.recommendations.length > 0;
  });

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.loadDigest();
  }

  // ─────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────

  /**
   * Generate or refresh the weekly digest
   */
  generateDigest(cityId: string): DiscoveryDigest {
    const landmarks = this.landmarkService.getLandmarks();
    const interests = this.interestService.getInterests();
    const visitedIds = this.getVisitedLandmarkIds();
    
    // Filter to unvisited landmarks
    const unvisited = landmarks.filter(l => !visitedIds.has(l.id));
    
    // Score and sort by relevance to interests
    const scored = unvisited.map(landmark => ({
      landmark,
      score: this.calculateRelevanceScore(landmark, interests),
      matchedInterest: this.getMatchedInterest(landmark, interests)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    // Take top 3
    const recommendations: DigestRecommendation[] = scored
      .slice(0, 3)
      .map(item => ({
        landmark: item.landmark,
        reason: this.generateReason(item.landmark, item.matchedInterest),
        matchedInterest: item.matchedInterest
      }));
    
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + DIGEST_VALIDITY_DAYS);
    
    const digest: DiscoveryDigest = {
      generatedAt: now.toISOString(),
      cityId,
      recommendations,
      expiresAt: expiresAt.toISOString()
    };
    
    this._currentDigest.set(digest);
    this._dismissed.set(false);
    this.saveDigest(digest);
    
    return digest;
  }

  /**
   * Check if digest needs refresh
   */
  needsRefresh(cityId: string): boolean {
    const digest = this._currentDigest();
    
    if (!digest) return true;
    if (digest.cityId !== cityId) return true;
    if (new Date(digest.expiresAt) < new Date()) return true;
    
    return false;
  }

  /**
   * Dismiss the digest card for this session
   */
  dismissDigest(): void {
    this._dismissed.set(true);
  }

  /**
   * Get recommendation count
   */
  getRecommendationCount(): number {
    return this._currentDigest()?.recommendations.length || 0;
  }

  // ─────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────

  private getVisitedLandmarkIds(): Set<string> {
    const memories = this.memoryService.getAllMemories();
    return new Set(memories.map(m => m.landmarkId));
  }

  private calculateRelevanceScore(landmark: Landmark, interests: string[]): number {
    let score = 0;
    
    // Base score
    score += 1;
    
    // Bonus for matching interests
    const tags = landmark.tags || [];
    for (const interest of interests) {
      if (tags.includes(interest)) {
        score += 2;
      }
    }
    
    // Bonus for "hidden" tag (users love secrets)
    if (tags.includes('hidden')) {
      score += 1;
    }
    
    return score;
  }

  private getMatchedInterest(landmark: Landmark, interests: string[]): string | undefined {
    const tags = landmark.tags || [];
    return interests.find(i => tags.includes(i));
  }

  private generateReason(landmark: Landmark, matchedInterest?: string): string {
    if (matchedInterest) {
      const reasons: Record<string, string> = {
        history: 'Perfect for history lovers',
        architecture: 'Stunning architectural details',
        food: 'Great food nearby',
        hidden: 'A hidden gem most miss'
      };
      return reasons[matchedInterest] || 'Matches your interests';
    }
    
    // Default reasons based on tags
    const tags = landmark.tags || [];
    if (tags.includes('hidden')) return 'A local secret';
    if (tags.includes('history')) return 'Rich in history';
    if (tags.includes('architecture')) return 'Architecturally unique';
    
    return 'Worth exploring';
  }

  // ─────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────

  private loadDigest(): void {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem(DIGEST_KEY);
      if (stored) {
        const digest = JSON.parse(stored) as DiscoveryDigest;
        
        // Validate not expired
        if (new Date(digest.expiresAt) > new Date()) {
          this._currentDigest.set(digest);
        }
      }
    } catch (e) {
      console.warn('Failed to load digest:', e);
    }
  }

  private saveDigest(digest: DiscoveryDigest): void {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(DIGEST_KEY, JSON.stringify(digest));
    } catch (e) {
      console.warn('Failed to save digest:', e);
    }
  }
}
