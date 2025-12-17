import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { InterestType } from '../models/interest.model';
import { environment } from '../../environments/environment';

/**
 * Interest Service
 * 
 * Manages user interest preferences for personalized content.
 * 
 * Demo Mode: When environment.demoMode is true:
 * - Returns true for hasCompletedOnboarding (skips onboarding)
 * - Uses curated demo interests for best showcase experience
 */
@Injectable({ providedIn: 'root' })
export class InterestService {
  private platformId = inject(PLATFORM_ID);
  
  private readonly STORAGE_KEY = 'user_interests';
  // Demo mode uses all interests for maximum content showcase
  private readonly DEMO_INTERESTS: InterestType[] = ['history', 'architecture', 'food', 'hidden'];
  private readonly DEFAULT_INTERESTS: InterestType[] = ['history'];
  
  private _interests = signal<InterestType[]>(
    environment.demoMode ? this.DEMO_INTERESTS : this.DEFAULT_INTERESTS
  );
  readonly interests = this._interests.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    // In demo mode, use curated interests without loading from storage
    if (environment.demoMode) {
      return;
    }
    
    if (this.isBrowser) {
      this.loadInterests();
    }
  }

  private loadInterests(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as InterestType[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._interests.set(parsed);
        }
      }
    } catch {
      // Keep defaults
    }
  }

  // Get all selected interests
  getInterests(): InterestType[] {
    return this._interests();
  }

  // Set interests (replaces all)
  setInterests(interests: InterestType[]): void {
    const valid = interests.filter(i => 
      ['history', 'architecture', 'food', 'hidden'].includes(i)
    );
    
    // Ensure at least one interest
    const toSave = valid.length > 0 ? valid : this.DEFAULT_INTERESTS;
    
    this._interests.set(toSave);
    
    if (this.isBrowser) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
    }
  }

  // Add a single interest
  addInterest(interest: InterestType): void {
    const current = this._interests();
    if (!current.includes(interest)) {
      this.setInterests([...current, interest]);
    }
  }

  // Remove a single interest
  removeInterest(interest: InterestType): void {
    const current = this._interests();
    const filtered = current.filter(i => i !== interest);
    this.setInterests(filtered);
  }

  // Toggle an interest
  toggleInterest(interest: InterestType): void {
    if (this.hasInterest(interest)) {
      this.removeInterest(interest);
    } else {
      this.addInterest(interest);
    }
  }

  // Check if user has a specific interest
  hasInterest(interest: InterestType): boolean {
    return this._interests().includes(interest);
  }

  // Check if onboarding has been completed
  // Demo mode always returns true to skip onboarding
  hasCompletedOnboarding(): boolean {
    if (environment.demoMode) return true;
    if (!this.isBrowser) return false;
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // Get primary interest (first selected)
  getPrimaryInterest(): InterestType {
    return this._interests()[0] || 'history';
  }
}
