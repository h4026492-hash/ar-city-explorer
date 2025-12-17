import { Injectable, OnDestroy, signal } from '@angular/core';
import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { Subject, Observable } from 'rxjs';

interface ARCityPlugin {
  openAR(options: { landmarks: any[]; focusLandmarkId?: string }): Promise<{ supported: boolean; message?: string }>;
  addListener(eventName: 'landmarkTap', callback: (data: { id: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'landmarkTapped', callback: (data: { id: string; name: string; lat?: number; lng?: number; distance?: number; bearing?: number }) => void): Promise<PluginListenerHandle>;
  highlightLandmark(options: { id: string }): Promise<void>;
}

const ARCityPlugin = registerPlugin<ARCityPlugin>('ARCityPlugin');

@Injectable({ providedIn: 'root' })
export class ARService implements OnDestroy {
  // Track focused landmark for AR session
  private _focusedLandmarkId = signal<string | null>(null);
  readonly focusedLandmarkId = this._focusedLandmarkId.asReadonly();

  openAR(landmarks: any[]) {
    console.log('Calling native AR plugin with', landmarks.length, 'landmarks');
    return ARCityPlugin.openAR({ landmarks })
      .then((res) => {
        console.log('AR plugin response:', res);
        if (!res?.supported) {
          console.warn('AR not supported on device:', res?.message);
        }
        return res;
      })
      .catch((err: any) => {
        console.error('AR plugin error:', err);
        throw err;
      });
  }

  // Open AR with a specific landmark highlighted/prioritized
  openARWithFocus(landmarks: any[], focusLandmarkId: string) {
    this._focusedLandmarkId.set(focusLandmarkId);
    
    // Reorder landmarks to put focused one first
    const focusedLandmark = landmarks.find(l => l.id === focusLandmarkId);
    const otherLandmarks = landmarks.filter(l => l.id !== focusLandmarkId);
    
    const reorderedLandmarks = focusedLandmark 
      ? [focusedLandmark, ...otherLandmarks]
      : landmarks;
    
    return ARCityPlugin.openAR({ 
      landmarks: reorderedLandmarks,
      focusLandmarkId 
    });
  }

  // Clear focus when AR session ends
  clearFocus() {
    this._focusedLandmarkId.set(null);
  }

  // Subject that emits when a landmark is tapped (native -> Capacitor -> Angular)
  private _landmarkTapped$ = new Subject<any>();
  private _landmarkTappedListener?: PluginListenerHandle;

  // Observable for components to subscribe to
  get landmarkTapped$(): Observable<any> {
    return this._landmarkTapped$.asObservable();
  }

  onLandmarkTap(callback: (id: string) => void): Promise<PluginListenerHandle> {
    return ARCityPlugin.addListener('landmarkTap', (data) => {
      callback(data.id);
    });
  }

  // Start listening for native landmark tapped events and forward into an Observable
  startListeningForTaps() {
    if (this._landmarkTappedListener) { return; }
    ARCityPlugin.addListener('landmarkTapped', (data) => {
      // Small vibration on device for tactile feedback (optional)
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          (navigator as any).vibrate(10);
        }
      } catch (e) {}

      this._landmarkTapped$.next(data);
    }).then(handle => {
      this._landmarkTappedListener = handle;
    });
  }

  highlightLandmark(id: string) {
    return ARCityPlugin.highlightLandmark({ id }).catch(err => {
      console.warn('Failed to call highlightLandmark on native plugin:', err);
    });
  }

  ngOnDestroy(): void {
    if (this._landmarkTappedListener) {
      this._landmarkTappedListener.remove().catch(() => {});
      this._landmarkTappedListener = undefined;
    }
  }
}
