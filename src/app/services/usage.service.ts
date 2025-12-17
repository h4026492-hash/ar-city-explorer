import { Injectable, signal, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface DailyUsage {
  date: string; // YYYY-MM-DD
  taps: number;
  landmarks: string[];
}

export interface UsageStats {
  totalTaps: number;
  totalLandmarks: number;
  streak: number;
  lastActiveDate: string;
}

@Injectable({ providedIn: 'root' })
export class UsageService {
  private platformId = inject(PLATFORM_ID);
  
  private readonly STORAGE_KEY = 'ar_usage_data';
  private readonly FREE_DAILY_LIMIT = 3;
  
  private _todayTaps = signal(0);
  private _streak = signal(0);
  
  readonly todayTaps = this._todayTaps.asReadonly();
  readonly streak = this._streak.asReadonly();
  readonly remainingFreeTaps = computed(() => 
    Math.max(0, this.FREE_DAILY_LIMIT - this._todayTaps())
  );
  readonly hitDailyLimit = computed(() => 
    this._todayTaps() >= this.FREE_DAILY_LIMIT
  );

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor() {
    if (this.isBrowser) {
      this.loadTodayUsage();
      this.calculateStreak();
    }
  }

  private loadTodayUsage() {
    const data = this.getAllUsage();
    const today = this.getTodayKey();
    const todayData = data[today];
    
    if (todayData) {
      this._todayTaps.set(todayData.taps);
    }
  }

  private getAllUsage(): Record<string, DailyUsage> {
    if (!this.isBrowser) return {};
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveUsage(data: Record<string, DailyUsage>) {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Record a tap on a landmark
  // Set isLotd=true for Landmark of the Day (doesn't count toward limit)
  recordTap(landmarkId: string, isLotd: boolean = false): { allowed: boolean; remaining: number } {
    const today = this.getTodayKey();
    const data = this.getAllUsage();
    
    if (!data[today]) {
      data[today] = { date: today, taps: 0, landmarks: [] };
    }
    
    // Landmark of the Day doesn't count toward daily limit
    if (!isLotd) {
      data[today].taps++;
    }
    
    if (!data[today].landmarks.includes(landmarkId)) {
      data[today].landmarks.push(landmarkId);
    }
    
    this.saveUsage(data);
    this._todayTaps.set(data[today].taps);
    this.calculateStreak();
    
    return {
      allowed: true,
      remaining: Math.max(0, this.FREE_DAILY_LIMIT - data[today].taps)
    };
  }

  // Check if user can tap (for free users)
  // Landmark of the Day is always allowed
  canTap(isLotd: boolean = false): boolean {
    if (isLotd) return true;
    return this._todayTaps() < this.FREE_DAILY_LIMIT;
  }

  private calculateStreak() {
    const data = this.getAllUsage();
    const dates = Object.keys(data).sort().reverse();
    
    if (dates.length === 0) {
      this._streak.set(0);
      return;
    }

    let streak = 0;
    const today = this.getTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    // Check if active today or yesterday to start counting
    if (dates[0] !== today && dates[0] !== yesterdayKey) {
      this._streak.set(0);
      return;
    }

    // Count consecutive days
    let checkDate = new Date(dates[0]);
    for (const dateStr of dates) {
      const date = new Date(dateStr);
      const diff = Math.floor((checkDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff <= 1) {
        streak++;
        checkDate = date;
      } else {
        break;
      }
    }

    this._streak.set(streak);
  }

  getStats(): UsageStats {
    const data = this.getAllUsage();
    const dates = Object.keys(data);
    
    let totalTaps = 0;
    const allLandmarks = new Set<string>();
    
    for (const date of dates) {
      totalTaps += data[date].taps;
      data[date].landmarks.forEach(l => allLandmarks.add(l));
    }

    return {
      totalTaps,
      totalLandmarks: allLandmarks.size,
      streak: this._streak(),
      lastActiveDate: dates.sort().reverse()[0] || ''
    };
  }

  // Get landmarks explored today (for "continue exploring" feature)
  getTodayLandmarks(): string[] {
    const today = this.getTodayKey();
    const data = this.getAllUsage();
    return data[today]?.landmarks || [];
  }
}
