import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface LandmarkOfTheDay {
  id: string;
  name: string;
  date: string;
  notificationSent: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private platformId = inject(PLATFORM_ID);
  
  private readonly PERMISSION_KEY = 'notification_permission';
  private readonly LOTD_KEY = 'landmark_of_the_day';
  
  private _permissionGranted = signal(false);
  readonly permissionGranted = this._permissionGranted.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    if (this.isBrowser) {
      this.checkPermission();
    }
  }

  private checkPermission() {
    if (!('Notification' in window)) return;
    
    this._permissionGranted.set(Notification.permission === 'granted');
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isBrowser || !('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    this._permissionGranted.set(granted);
    
    if (this.isBrowser) {
      localStorage.setItem(this.PERMISSION_KEY, JSON.stringify(granted));
    }
    
    return granted;
  }

  // Schedule landmark of the day notification
  scheduleLandmarkOfTheDay(landmark: { id: string; name: string }) {
    if (!this.isBrowser) return;

    const today = new Date().toISOString().split('T')[0];
    const lotd: LandmarkOfTheDay = {
      id: landmark.id,
      name: landmark.name,
      date: today,
      notificationSent: false
    };

    localStorage.setItem(this.LOTD_KEY, JSON.stringify(lotd));
  }

  // Get today's landmark (for display in app)
  getLandmarkOfTheDay(): LandmarkOfTheDay | null {
    if (!this.isBrowser) return null;

    try {
      const stored = localStorage.getItem(this.LOTD_KEY);
      if (!stored) return null;

      const lotd: LandmarkOfTheDay = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      
      // Return only if it's for today
      if (lotd.date === today) {
        return lotd;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // Show local notification (for web/PWA)
  showNotification(title: string, body: string, icon?: string) {
    if (!this._permissionGranted() || !this.isBrowser) return;

    new Notification(title, {
      body,
      icon: icon || '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      tag: 'ar-city-explorer'
    });
  }

  // Send landmark of the day notification
  sendLandmarkNotification(name: string) {
    this.showNotification(
      '🏛️ Landmark of the Day',
      `Today's featured spot: ${name}. Tap to explore in AR!`
    );

    // Mark as sent
    const lotd = this.getLandmarkOfTheDay();
    if (lotd) {
      lotd.notificationSent = true;
      localStorage.setItem(this.LOTD_KEY, JSON.stringify(lotd));
    }
  }

  // Streak reminder notification
  sendStreakReminder(currentStreak: number) {
    if (currentStreak > 0) {
      this.showNotification(
        '🔥 Keep your streak alive!',
        `You're on a ${currentStreak}-day streak. Explore a landmark today!`
      );
    } else {
      this.showNotification(
        '👋 We miss you!',
        `Discover something new in Dallas today.`
      );
    }
  }
}
