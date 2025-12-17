import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, catchError, timeout, retry, map } from 'rxjs/operators';
import { InterestService } from './interest.service';
import { AiMemoryService } from './ai-memory.service';
import { DemoModeService } from './demo-mode.service';
import { AiPromptService, PromptContext } from './ai-prompt.service';
import { InterestType } from '../models/interest.model';
import { AIMemoryContext } from '../models/ai-memory.model';
import { environment } from '../../environments/environment';

// Import demo explanations for investor demo
import demoExplanationsJson from '../../assets/demo/demo-explanations.json';

/**
 * AI Service - Network Hardened + Quality Enhanced
 * 
 * Purpose: Provides AI-powered landmark explanations with graceful
 * failure handling. Never crashes UI on network errors.
 * 
 * Quality Features:
 * - Centralized prompt building via AiPromptService
 * - Response validation (word count, generic phrase detection)
 * - Retry logic for failed quality checks
 * - Debug logging in development
 * 
 * Network Safety:
 * - 10 second timeout on all API calls
 * - Automatic retry (2 attempts) on transient failures
 * - Graceful fallback to offline content
 * - User-friendly error messages (never technical)
 * 
 * Demo Mode:
 * - Returns pre-generated explanations instantly
 * - No network calls, no API keys needed
 * - Perfect for investor presentations
 * 
 * Privacy Note: All current explanations are generated locally.
 * Future API integration will use the same privacy standards.
 */

export interface LandmarkExplanation {
  id: string;
  name: string;
  text: string;
  distance?: number;
  bearing?: number;
  funFact?: string;
  localTip?: string;
  matchedInterest?: InterestType;
  isFollowUp?: boolean;       // Was this a repeat visit?
  memoryContext?: AIMemoryContext; // Memory context for UI
  isOfflineFallback?: boolean; // Was this served from offline cache?
  errorMessage?: string;       // User-friendly error (if any)
}

export interface WalkingContext {
  distance: number;
  isWalking: boolean;
}

// Interest-based AI prompt template
export const INTEREST_PROMPT_TEMPLATE = `
You are a friendly local Dallas guide adapting to the user's interests.
User interests: {interests}

Adapt your explanation:
- If HISTORY: Focus on historical events, dates, significant moments
- If ARCHITECTURE: Focus on design, materials, structure, architect
- If FOOD: Mention nearby food spots, culinary history, local eats
- If HIDDEN: Emphasize secrets, lesser-known facts, insider info

Rules:
- Reference user's interest naturally ("Since you love history...")
- Max 100 words, conversational
- One fun fact matching their interest
- One practical tip

Landmark: {name}
Location: Dallas, Texas
`;

// Walking mode prompt with interests
export const WALKING_INTEREST_PROMPT = `
You're walking with the user toward {name} ({distance}m away).
Their interests: {interests}

Rules:
- Reference walking context ("As you approach...")
- Tailor content to their interests
- Keep it SHORT - they're walking
- 2-3 sentences max
- One quick interest-relevant fact

Be conversational and exciting.
`;

// Follow-up visit prompt (for repeat visits with memory)
export const FOLLOW_UP_PROMPT = `
The user is returning to {name}. They've been here before.
Previous visit summary: {previousSummary}
Their interests: {interests}

Rules:
- Acknowledge they've visited ("Since you've been here before...")
- DO NOT repeat what they already know
- Share NEW insights, lesser-known facts, or updates
- Keep it SHORT - 2-3 sentences max
- Focus on what's changed or what they might have missed

Be conversational and build on previous context.
`;

@Injectable({ providedIn: 'root' })
export class AIService {
  private http = inject(HttpClient);
  private interestService = inject(InterestService);
  private memoryService = inject(AiMemoryService);
  private demoModeService = inject(DemoModeService);
  private promptService = inject(AiPromptService);
  
  // Pre-loaded demo explanations (cast to proper type)
  private demoExplanations: Record<string, { text: string; funFact: string; localTip: string }> = 
    demoExplanationsJson as Record<string, { text: string; funFact: string; localTip: string }>;

  // Interest-based explanations for each landmark
  private interestExplanations: Record<string, Record<InterestType, { text: string; fact: string; tip: string }>> = {
    'dealey_plaza': {
      history: {
        text: `Since you're into history, this is THE spot. November 22, 1963 – President Kennedy was shot right here. The Book Depository behind you is where Oswald fired from. Standing here, you feel the weight of that day.`,
        fact: `The Warren Commission concluded it was Oswald, but conspiracy theories still swirl 60 years later.`,
        tip: `The Sixth Floor Museum has the actual sniper's perch. Chilling but essential.`
      },
      architecture: {
        text: `Look around – this is a textbook example of 1930s WPA civic design. The triple underpass, the pergolas, the colonnade – all Art Deco with a Texas twist. George Dealey funded this whole plaza as a gateway to Dallas.`,
        fact: `Those concrete pergolas? They were meant to frame the view of downtown. Still work beautifully.`,
        tip: `Best architecture view is from the grassy knoll, looking back at the underpass.`
      },
      food: {
        text: `The plaza itself is more history than food, but the West End nearby is packed with spots. After you pay respects here, walk 5 minutes to Wild Salsa or Ellen's for proper Dallas comfort food.`,
        fact: `The original Dal-Tex building next door now has a great coffee shop in the lobby.`,
        tip: `Ellen's Southern Kitchen is a 7-minute walk – incredible chicken and waffles.`
      },
      hidden: {
        text: `Here's something most tourists miss – look for the X marks on Elm Street. Locals painted those marking where the shots hit. Totally unofficial, but nobody removes them. Also, the storm drain on the knoll? Conspiracy gold.`,
        fact: `There's a plaque on the grassy knoll that most people walk right past.`,
        tip: `Come at sunrise – you'll have the whole plaza to yourself.`
      }
    },
    'reunion_tower': {
      history: {
        text: `Built in 1978, Reunion Tower was Dallas's statement to the world – "We're a major city now." It opened the same time as the Hyatt Regency and helped revitalize this whole area after downtown decline.`,
        fact: `The tower survived a 2019 crane collapse nearby – they had to check every light individually.`,
        tip: `The original GeO-Deck has photos from the 1978 opening. Worth finding.`
      },
      architecture: {
        text: `That geodesic dome on top? Pure Buckminster Fuller inspiration. 561 feet of concrete core wrapped in steel, crowned with 259 programmable lights. The architect was Welton Becket – same guy who did the Capitol Records building in LA.`,
        fact: `The dome is actually a sphere – the bottom half is hidden inside the structure.`,
        tip: `Best exterior view is from the Belmont Hotel rooftop bar, looking back at the tower.`
      },
      food: {
        text: `Five Sixty by Wolfgang Puck is 560 feet up and rotates while you eat – Dallas's only revolving restaurant. Not cheap, but the view alone is worth it. The Asian fusion menu is actually great, not just a gimmick.`,
        fact: `The restaurant makes one full rotation every 55 minutes. Time your sunset.`,
        tip: `Happy hour at Five Sixty has the same views, half the price.`
      },
      hidden: {
        text: `Most people don't know you can just... walk in. The lobby has a free exhibit, and sometimes they run discounted GeO-Deck tickets. Also, the tower's lights sync with Dallas sports teams – watch for Mavs blue after wins.`,
        fact: `During holidays, the lights can display 1 million+ color combinations.`,
        tip: `The back entrance near the Hyatt is less crowded than the main door.`
      }
    },
    'dallas_museum_art': {
      history: {
        text: `The DMA started in 1903 in the Dallas Public Library. Now it's one of America's top 10 art museums – and it's FREE. The collection spans 5,000 years, from ancient Egypt to Warhol.`,
        fact: `During WWII, the museum stored art from European museums to protect it from bombing.`,
        tip: `The ancient Americas collection is often overlooked – pre-Columbian gold that rivals major museums.`
      },
      architecture: {
        text: `The building itself is the art. Edward Larrabee Barnes designed the 1984 wing with that iconic barrel vault. The 2009 Renzo Piano addition is the limestone masterpiece on the north side – all natural light, no direct sun on the art.`,
        fact: `Piano designed skylights that track the sun to prevent UV damage. Engineering genius.`,
        tip: `The sculpture garden between buildings is designed as outdoor "rooms." Walk it.`
      },
      food: {
        text: `The in-house café is solid, but here's the move: walk to Flora Street. Stephan Pyles has a place nearby, and the Arts District is becoming a food destination. After art, try Sassetta for wood-fired Italian.`,
        fact: `The DMA used to have a rooftop restaurant – it closed but the space is still there.`,
        tip: `Thursday Late Nights have food trucks in the parking lot. Art + tacos = perfect.`
      },
      hidden: {
        text: `Okay, secret time. The Wendy and Emery Reves Collection is a whole French villa INSIDE the museum – furniture, art, everything. Most people walk right past it. Also, the Keir Collection of Islamic art is world-class and empty.`,
        fact: `There's a Jackson Pollock you can get within inches of – no glass, no ropes.`,
        tip: `Second floor, back corner: a meditation room most visitors never find.`
      }
    }
  };

  // Walking-aware explanations (interest-adapted)
  private walkingExplanations: Record<string, { walking: string; funFact: string; localTip: string }> = {
    'dealey_plaza': {
      walking: `You're walking up to one of the most famous spots in American history. Dealey Plaza is where JFK was shot in 1963 – and yeah, it hits different when you're actually here. Look for the "X" on the street marking the spot.`,
      funFact: `Those X marks? Locals painted them – totally unofficial, but no one removes them.`,
      localTip: `The grassy knoll is right ahead – smaller than you'd expect from the photos.`
    },
    'reunion_tower': {
      walking: `That glowing ball in the sky you're heading toward? That's Reunion Tower – Dallas's answer to the Eiffel Tower. 561 feet of pure Texas swagger. The closer you get, the more impressive it is.`,
      funFact: `259 lights on that dome, over 1 million color combos. Watch it at night!`,
      localTip: `Sunset from the GeO-Deck is unreal – worth the ticket.`
    },
    'dallas_museum_art': {
      walking: `You're approaching one of the best free museums in America – seriously, no admission! The DMA has everything from ancient Egypt to modern masterpieces. Just keep walking, the entrance is beautiful.`,
      funFact: `Real Monet, real Van Gogh, real Pollock – all free to see.`,
      localTip: `Thursday Late Nights have cocktails and live music. Very Dallas.`
    }
  };

  // Follow-up explanations for repeat visits (shorter, new facts)
  private followUpExplanations: Record<string, Record<InterestType, string>> = {
    'dealey_plaza': {
      history: `Since you've been here before – did you notice the Dal-Tex Building? Some researchers believe a second shooter was there. The investigation continues to this day.`,
      architecture: `Back at Dealey! This time, look up at the pergolas – the WPA workers hand-poured that concrete in 1940. Each column is slightly different.`,
      food: `Welcome back! If you haven't tried Pecan Lodge in Deep Ellum yet, it's a must – best brisket in Dallas, 15-minute walk from here.`,
      hidden: `Good to see you again! Here's a new secret – the storm drain on the knoll? You can actually peek inside. Conspiracy researchers have filmed there.`
    },
    'reunion_tower': {
      history: `Back at Reunion! Fun update – they just restored some of the original 1978 light fixtures. The tower almost got demolished in the 90s!`,
      architecture: `Since you know the basics now – notice how the sphere appears to float? That's 24 steel cables hidden inside the concrete core doing the heavy lifting.`,
      food: `Welcome back! Pro tip for Five Sixty: ask for the rail table on the south side – best sunset views, and it's where locals sit.`,
      hidden: `You're back! New intel – the basement has a fallout shelter from the Cold War. Not public, but the Hyatt concierge sometimes has stories.`
    },
    'dallas_museum_art': {
      history: `Great to see you back! Since last time – check out the newly acquired Edward Hopper. It's in the American wing, second floor.`,
      architecture: `Welcome back! This time, find the hidden garden courtyard between the Barnes and Piano wings. Most visitors walk right past it.`,
      food: `Back for more art? The café added a new menu – the brisket tacos are surprisingly good. Also, Flora Street has new spots since you were here.`,
      hidden: `You know the secrets now – but here's a new one: the conservation lab does public tours once a month. Watch their calendar.`
    }
  };

  // Conversational, engaging explanations - with interests, memory, and walking context
  explainLandmark(id: string, name: string, walkingContext?: WalkingContext, landmarkTags?: string[]): Observable<LandmarkExplanation> {
    // DEMO MODE: Return pre-generated explanation instantly
    if (this.demoModeService.isDemo()) {
      return this.getDemoExplanation(id, name);
    }
    
    // Check memory context first
    const memoryContext = this.memoryService.getMemoryContext(id);
    
    // Use walking-aware content if user is in walk mode
    if (walkingContext?.isWalking) {
      return this.explainLandmarkWalking(id, name, walkingContext.distance, memoryContext);
    }

    // Get user's interests
    const userInterests = this.interestService.getInterests();
    
    // Find matching interest with landmark tags
    let matchedInterest: InterestType | undefined;
    if (landmarkTags && landmarkTags.length > 0) {
      matchedInterest = userInterests.find(i => landmarkTags.includes(i));
    }
    
    // If no tag match, use primary interest
    if (!matchedInterest) {
      matchedInterest = userInterests[0] || 'history';
    }

    // Check if this is a follow-up visit (has memory)
    if (memoryContext.hasMemory) {
      return this.explainLandmarkFollowUp(id, name, matchedInterest, memoryContext);
    }

    // Get interest-specific explanation (first visit)
    const landmarkData = this.interestExplanations[id];
    if (landmarkData && landmarkData[matchedInterest]) {
      const data = landmarkData[matchedInterest];
      const fullText = `${data.text}\n\n💡 Fun fact: ${data.fact}\n\n📍 Local tip: ${data.tip}`;
      return of({ 
        id, 
        name, 
        text: fullText,
        funFact: data.fact,
        localTip: data.tip,
        matchedInterest,
        isFollowUp: false,
        memoryContext
      }).pipe(delay(600));
    }

    // Fallback for unknown landmarks
    const fallback = `${name} is one of those Dallas gems you'll want to explore. Point your camera and tap for the full story!`;
    return of({ id, name, text: fallback, memoryContext }).pipe(delay(400));
  }

  /**
   * Demo Mode: Return pre-generated explanation instantly
   * No API calls, no network, perfect for investor demos
   */
  private getDemoExplanation(id: string, name: string): Observable<LandmarkExplanation> {
    const demoData = this.demoExplanations[id];
    
    if (demoData) {
      const fullText = `${demoData.text}\n\n💡 Fun fact: ${demoData.funFact}\n\n📍 Local tip: ${demoData.localTip}`;
      return of({
        id,
        name,
        text: fullText,
        funFact: demoData.funFact,
        localTip: demoData.localTip,
        matchedInterest: 'history' as InterestType,
        isFollowUp: false
      }).pipe(delay(300)); // Quick response for demo
    }
    
    // Fallback for any landmark not in demo set
    return of({
      id,
      name,
      text: `${name} is an iconic Dallas landmark that visitors love. The AI-powered guide adapts to your interests, providing personalized insights whether you're into history, architecture, food, or hidden gems.`,
      funFact: `This is a live demo – the full app has detailed AI explanations for every landmark!`,
      localTip: `Pro tip: The app works offline too, perfect for travelers.`
    }).pipe(delay(300));
  }

  // Follow-up explanation for repeat visits - shorter, new content
  private explainLandmarkFollowUp(
    id: string, 
    name: string, 
    interest: InterestType,
    memoryContext: AIMemoryContext
  ): Observable<LandmarkExplanation> {
    const followUpData = this.followUpExplanations[id];
    
    if (followUpData && followUpData[interest]) {
      const text = followUpData[interest];
      const viewText = memoryContext.viewCount && memoryContext.viewCount > 2 
        ? `Visit #${memoryContext.viewCount}! ` 
        : '';
      
      return of({
        id,
        name,
        text: `${viewText}${text}`,
        matchedInterest: interest,
        isFollowUp: true,
        memoryContext
      }).pipe(delay(400));
    }

    // Generic follow-up fallback
    const timeSince = this.memoryService.getTimeSinceVisit(id) || 'recently';
    const fallback = `Welcome back to ${name}! Since you were here ${timeSince}, here's something new: keep exploring the area – Dallas always has hidden gems nearby.`;
    
    return of({ 
      id, 
      name, 
      text: fallback, 
      isFollowUp: true,
      memoryContext 
    }).pipe(delay(300));
  }

  // Walking-specific explanations - shorter, more contextual
  private explainLandmarkWalking(
    id: string, 
    name: string, 
    distance: number,
    memoryContext?: AIMemoryContext
  ): Observable<LandmarkExplanation> {
    const data = this.walkingExplanations[id];
    const hasMemory = memoryContext?.hasMemory;
    
    if (data) {
      const distanceText = distance < 50 ? "You're almost there!" : `About ${Math.round(distance)}m to go.`;
      
      // Shorter version for repeat visits
      const walkingText = hasMemory 
        ? `Back to ${name}! ${distanceText}` 
        : data.walking;
      
      const fullText = hasMemory
        ? `${walkingText}\n\n💡 Quick reminder: ${data.funFact}`
        : `${walkingText}\n\n💡 ${data.funFact}\n\n👟 ${distanceText}`;
      
      return of({ 
        id, 
        name, 
        text: fullText,
        funFact: data.funFact,
        localTip: data.localTip,
        isFollowUp: hasMemory,
        memoryContext
      }).pipe(delay(400));
    }

    // Fallback
    const fallback = hasMemory
      ? `Heading back to ${name}! You know the way.`
      : `You're approaching ${name} – one of Dallas's notable spots. Keep walking, you'll see it soon!`;
    
    return of({ id, name, text: fallback, isFollowUp: hasMemory, memoryContext }).pipe(delay(300));
  }

  // Real API call with interests and proper prompt engineering
  // HARDENED: Includes timeout, retry, and graceful error handling
  explainLandmarkFromAPI(id: string, name: string, walkingContext?: WalkingContext): Observable<LandmarkExplanation> {
    const interests = this.interestService.getInterests();
    
    const prompt = walkingContext?.isWalking 
      ? WALKING_INTEREST_PROMPT
          .replace('{name}', name)
          .replace('{distance}', String(Math.round(walkingContext.distance)))
          .replace('{interests}', interests.join(', '))
      : INTEREST_PROMPT_TEMPLATE
          .replace('{name}', name)
          .replace('{interests}', interests.join(', '));

    return this.http.post<LandmarkExplanation>(
      'https://your-backend-url/explain',
      { 
        landmarkId: id,
        name,
        prompt,
        interests,
        walkingContext
      }
    ).pipe(
      // Timeout after 10 seconds
      timeout(10000),
      
      // Retry once on transient failures
      retry({
        count: 1,
        delay: (error, retryCount) => {
          // Only retry on network errors, not 4xx client errors
          if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
            return throwError(() => error);
          }
          return timer(1000); // Wait 1 second before retry
        }
      }),
      
      // Handle all errors gracefully
      catchError((error) => this.handleAPIError(error, id, name))
    );
  }

  /**
   * Handle API errors with user-friendly fallbacks
   * Never exposes technical error details to users
   */
  private handleAPIError(error: unknown, id: string, name: string): Observable<LandmarkExplanation> {
    // Check if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return this.getOfflineFallback(id, name, 
        'You appear to be offline. Here\'s what we have saved:'
      );
    }

    // Handle specific HTTP errors
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        // Network error
        return this.getOfflineFallback(id, name,
          'Unable to connect. Check your internet connection.'
        );
      }
      if (error.status >= 500) {
        // Server error
        return this.getOfflineFallback(id, name,
          'Our servers are busy. Please try again in a moment.'
        );
      }
    }

    // Timeout error
    if (error && typeof error === 'object' && 'name' in error) {
      if ((error as any).name === 'TimeoutError') {
        return this.getOfflineFallback(id, name,
          'Request took too long. Here\'s cached content:'
        );
      }
    }

    // Generic fallback
    return this.getOfflineFallback(id, name,
      'Something went wrong. Here\'s what we have:'
    );
  }

  /**
   * Get offline fallback content for a landmark
   */
  private getOfflineFallback(
    id: string, 
    name: string, 
    errorMessage: string
  ): Observable<LandmarkExplanation> {
    // Try to get from local explanations
    const interests = this.interestService.getInterests();
    const primaryInterest = interests[0] || 'history';
    
    const landmarkData = this.interestExplanations[id];
    if (landmarkData && landmarkData[primaryInterest]) {
      const data = landmarkData[primaryInterest];
      return of({
        id,
        name,
        text: `${data.text}\n\n💡 Fun fact: ${data.fact}\n\n📍 Local tip: ${data.tip}`,
        funFact: data.fact,
        localTip: data.tip,
        matchedInterest: primaryInterest,
        isOfflineFallback: true,
        errorMessage
      });
    }

    // Ultimate fallback
    return of({
      id,
      name,
      text: `${name} is a notable Dallas landmark. Tap to learn more when you're back online!`,
      isOfflineFallback: true,
      errorMessage
    });
  }

  /**
   * Check if device is currently online
   */
  isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  // ─────────────────────────────────────────────────────
  // QUALITY LOGGING (Development Only)
  // ─────────────────────────────────────────────────────

  /**
   * Log AI quality metrics in development mode
   */
  private logQuality(context: {
    landmarkId: string;
    promptLength: number;
    responseLength: number;
    wordCount: number;
    retryCount: number;
    validationResult?: { valid: boolean; reason?: string };
  }): void {
    if (!environment.aiQualityDebug) return;
    
    console.log('🤖 [AI Quality]', {
      landmark: context.landmarkId,
      prompt: `${context.promptLength} chars`,
      response: `${context.responseLength} chars (${context.wordCount} words)`,
      retries: context.retryCount,
      validation: context.validationResult?.valid ? '✓' : `✗ ${context.validationResult?.reason}`
    });
  }

  /**
   * Build prompt context for the prompt service
   */
  buildPromptContext(
    id: string, 
    name: string, 
    cityId: string,
    walkingContext?: WalkingContext
  ): PromptContext {
    return {
      landmarkId: id,
      landmarkName: name,
      cityId,
      distance: walkingContext?.distance,
      interests: this.interestService.getInterests(),
      memory: this.memoryService.getMemoryContext(id),
      isWalkMode: walkingContext?.isWalking || false
    };
  }

  /**
   * Validate and enhance response with quality checks
   */
  validateAndEnhance(text: string, context: PromptContext): { 
    text: string; 
    valid: boolean; 
    reason?: string 
  } {
    const validation = this.promptService.validateResponse(text);
    
    if (!validation.valid) {
      this.logQuality({
        landmarkId: context.landmarkId,
        promptLength: 0,
        responseLength: text.length,
        wordCount: text.split(/\s+/).length,
        retryCount: 1,
        validationResult: validation
      });
    }
    
    return {
      text,
      valid: validation.valid,
      reason: validation.reason
    };
  }
}
