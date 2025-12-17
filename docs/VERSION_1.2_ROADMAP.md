# Version 1.2 Roadmap - Revenue Focus

> **Goal**: Increase paid conversions, retention, and ARPU without increasing AI or infra cost.

## Primary KPIs
- Free → Paid conversion rate
- Monthly → Yearly upgrade rate  
- Repeat weekly usage
- Cost per active user

---

## Feature Priority Matrix

| Feature | Revenue Impact | Effort | Week |
|---------|---------------|--------|------|
| Yearly Plan Push | 🔥 High | Low | 1 |
| Smart Paywall Timing | 🔥 High | Medium | 1 |
| City Pack Bundles | Medium | Low | 2 |
| Walk Completion Rewards | Medium | Medium | 2 |
| Weekly Discovery Digest | Medium | Low | 3 |
| Sponsored Landmarks MVP | Medium | Medium | 3 |
| Price Increase (after metrics) | High | Low | 4 |

---

## Feature 1: Yearly Plan Push with Value Stacking

### What Changes
- Yearly plan becomes default highlighted option
- Monthly remains available but visually secondary
- Copy stacks perceived value

### Value Stack Copy
```
✓ Unlimited landmarks
✓ All walking tours  
✓ Offline packs for all cities
✓ AI memory across sessions
✓ Founding member badge (if eligible)
```

### Implementation
- Pure UI/copy change in `paywall.component.ts`
- No StoreKit changes required
- A/B test: yearly-first vs monthly-first

---

## Feature 2: City Pack Bundles

### User Sees
- "Texas Explorer Pack" - Dallas + Austin + Houston
- Premium yearly only

### Why It Works
- Perceived high value (3 cities!)
- Locks users into yearly plan
- City content reuse = zero marginal cost

### Implementation
- New `CityBundle` model
- Bundle display in paywall
- Analytics: `bundle_viewed`, `bundle_purchased`

---

## Feature 3: Walk Mode Completion Reward

### Flow
1. User completes full walking tour
2. Celebration screen appears
3. Reward unlocked

### Reward Options
- 🔓 Hidden landmark unlocked
- 🧠 Bonus AI deep dive (cached)
- 🏅 Profile badge

### Implementation
- `TourCompletionReward` component
- Cached rewards = zero AI cost
- Track: `tour_completed`, `reward_claimed`

---

## Feature 4: Smart Paywall Timing (HIGH IMPACT)

### Current Behavior
- Paywall shows immediately after free limit

### New Behavior
- Paywall shows ONLY after:
  - User completes a walk preview, OR
  - User reads 2+ high-quality explanations

### Why
- Users convert after experiencing value
- Higher intent = higher conversion

### Implementation
- `PaywallTriggerService` with engagement scoring
- Track: `paywall_trigger_reason`

---

## Feature 5: Sponsored Landmarks (Soft Intro)

### What It Is
- Clearly labeled "Sponsored Story" landmarks
- Local business partnerships

### Rules (Non-Negotiable)
- ❌ Never interrupt walk mode
- ❌ Never block free content  
- ❌ Never fake recommendations
- ✅ Always labeled "Sponsored"

### Implementation
- `isSponsored` flag on landmark
- Separate sponsored content display
- Track: `sponsored_view`, `sponsored_tap`

---

## Feature 6: Weekly Discovery Digest

### User Sees
- Weekly card: "3 places you haven't explored yet"
- Personalized by: visited landmarks, interests, city

### Delivery
- In-app only (no email needed)
- Shows on home screen once per week

### Implementation
- `DiscoveryDigestService`
- localStorage for weekly reset
- Track: `digest_shown`, `digest_tap`

---

## Feature 7: Conversion-Safe Price Increase

### Prerequisites
- 30+ App Store reviews
- Stable crash rate (<1%)
- Good conversion metrics baseline

### Action
- Monthly: $2.99 → $3.99
- Yearly: Keep unchanged
- Founding users: Price locked (existing feature)

---

## What We Do NOT Build in 1.2

| Don't Build | Why |
|-------------|-----|
| Social features | Dilutes focus |
| Comments/likes | Moderation overhead |
| User-generated content | Legal/safety risk |
| Android | Focus on iOS revenue first |

---

## 4-Week Timeline

### Week 1: Conversion Foundation
- [ ] Yearly plan UI redesign
- [ ] Smart paywall timing
- [ ] A/B test setup

### Week 2: Retention Features  
- [ ] City bundles
- [ ] Walk completion rewards
- [ ] Reward caching system

### Week 3: Engagement Loop
- [ ] Weekly discovery digest
- [ ] Sponsored landmark MVP
- [ ] Partner onboarding flow

### Week 4: Revenue Optimization
- [ ] Pricing test (if metrics allow)
- [ ] Stability polish
- [ ] App Store update submission

---

## End State After 1.2

✅ Clear premium value proposition  
✅ Multiple revenue streams (subs + sponsors)  
✅ Higher yearly conversion rate  
✅ Stronger week-over-week retention  
✅ Low operating cost maintained  

**This is when the app stops being an experiment and becomes a business.**

---

## Metrics Dashboard (v1.2)

### Conversion Funnel
```
App Opens → AR Sessions → Explanations Viewed → Paywall Shown → Purchase
```

### Key Metrics to Track
- Conversion rate by paywall trigger
- Yearly vs Monthly split
- Tour completion rate
- Weekly active users (WAU)
- Sponsored content engagement

---

## App Store "What's New" Copy (v1.2)

```
🎯 Smarter Recommendations
Personalized weekly discoveries based on your interests

🗺️ Texas Explorer Pack  
Unlock Dallas, Austin, and Houston with yearly premium

🏆 Tour Rewards
Complete walking tours to unlock hidden landmarks and badges

⚡ Faster, Smoother
Performance improvements across the board
```
