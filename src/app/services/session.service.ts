import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface SessionData {
  date: string;
  visitedIds: string[];
  skippedIds: string[];
  walkStartTime?: string;
  totalWalkTime?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private platformId = inject(PLATFORM_ID);
  
  private readonly STORAGE_KEY = 'ar_session_data';
  
  private _visitedIds = signal<Set<string>>(new Set());
  private _skippedIds = signal<Set<string>>(new Set());
  
  readonly visitedIds = this._visitedIds.asReadonly();
  readonly skippedIds = this._skippedIds.asReadonly();
  readonly visitedCount = () => this._visitedIds().size;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor() {
    if (this.isBrowser) {
      this.loadSession();
    }
  }

  private loadSession(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data: SessionData = JSON.parse(stored);
      const today = this.getTodayKey();

      // Auto-reset if date changed
      if (data.date !== today) {
        this.resetSession();
        return;
      }

      this._visitedIds.set(new Set(data.visitedIds));
      this._skippedIds.set(new Set(data.skippedIds));
    } catch {
      this.resetSession();
    }
  }

  private saveSession(): void {
    if (!this.isBrowser) return;

    const data: SessionData = {
      date: this.getTodayKey(),
      visitedIds: [...this._visitedIds()],
      skippedIds: [...this._skippedIds()]
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Mark a landmark as visited
  markVisited(id: string): void {
    this._visitedIds.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });
    
    // Remove from skipped if it was there
    this._skippedIds.update((set) => {
      const newSet = new Set(set);
      newSet.delete(id);
      return newSet;
    });
    
    this.saveSession();
  }

  // Mark a landmark as skipped
  markSkipped(id: string): void {
    this._skippedIds.update((set) => {
      const newSet = new Set(set);
      newSet.add(id);
      return newSet;
    });
    this.saveSession();
  }

  // Check if landmark was visited today
  hasVisited(id: string): boolean {
    return this._visitedIds().has(id);
  }

  // Check if landmark was skipped today
  hasSkipped(id: string): boolean {
    return this._skippedIds().has(id);
  }

  // Check if landmark should be shown (not visited or skipped)
  shouldShow(id: string): boolean {
    return !this.hasVisited(id) && !this.hasSkipped(id);
  }

  // Reset session (new day or manual reset)
  resetSession(): void {
    this._visitedIds.set(new Set());
    this._skippedIds.set(new Set());
    this.saveSession();
  }

  // Get all visited landmark IDs
  getVisitedIds(): string[] {
    return [...this._visitedIds()];
  }

  // Get all skipped landmark IDs
  getSkippedIds(): string[] {
    return [...this._skippedIds()];
  }

  // Get session stats
  getStats(): { visited: number; skipped: number; remaining: number } {
    return {
      visited: this._visitedIds().size,
      skipped: this._skippedIds().size,
      remaining: 0 // Will be calculated by caller with total landmarks
    };
  }
}
