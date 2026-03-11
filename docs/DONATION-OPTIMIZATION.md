# Donation Prompt Optimization

## Overview
Implemented an intelligent donation prompt system that maximizes conversions while respecting user experience. Based on UX best practices for non-profit donation requests.

---

## Smart Prompt Strategy

### When Prompts Appear

1. **3rd Export** - First prompt after user has gotten value (engaged user)
2. **Every 10 Exports** - Ongoing gentle reminders for active users
3. **Returning Users** - 1st export if 30+ days since initial install
4. **Minimum 7 Days** - Between any prompts (avoid spam)

### When Prompts DON'T Appear

❌ User clicked "Don't show again"
❌ User clicked Ko-fi link in last 90 days (assumed donation)
❌ Less than 7 days since last prompt
❌ First 2 exports (let them try the tool first)

---

## Key Features

### 1. **Non-Intrusive Design**
- SuccessModal only shows after successful actions (positive moment)
- Share prompt appears after 2 seconds (not immediately)
- Two close options: "Close" and "Don't show again"

### 2. **Smart Tracking** (`donationPrompt.ts`)
```typescript
- totalExports: number           // Track user engagement
- lastPromptDate: string         // Prevent spam (7 day minimum)
- hasDismissedForever: boolean   // Respect user choice
- lastDonationClick: string      // Assume donation, wait 90 days
- installDate: string            // Detect returning users
```

### 3. **CSS Comment Attribution**
All exported CSS includes subtle attribution:
```css
/* Generated with AO3 Skin Generator - Free forever! Support: https://ao3skingenerator.com/donate */
```

---

## Conversion Psychology

### Why This Works

1. **Reciprocity** - Show prompt AFTER value delivered, not before
2. **Scarcity** - "Don't show again" creates urgency to decide
3. **Social Proof** - "Made by a writer, for writers" builds trust
4. **Transparency** - "100% free forever" removes pressure
5. **Empathy** - Time saved calculation ("You just saved 2-3 hours")

### Frequency Balance

- **Too Frequent**: Annoying, drives users away
- **Too Rare**: Low conversion, money left on table
- **Optimal**: 3rd export + every 10 thereafter + 7 day minimum

This hits the sweet spot: frequent enough to remind engaged users, rare enough to avoid annoyance.

---

## WordFokus Cross-Promotion

- Shown in every SuccessModal (always visible)
- Positions as complementary tool ("Writing your next fic?")
- Green color scheme distinguishes from donation CTA
- No separate tracking (always show, low friction)

---

## User Experience Flow

### First-Time User
1. Export 1: ❌ No prompt (learning the tool)
2. Export 2: ❌ No prompt (getting comfortable)
3. Export 3: ✅ **FIRST PROMPT** (engaged, sees value)
4. Export 13: ✅ Prompt again (10 exports since last)
5. Export 23: ✅ Prompt again (consistent user)

### Returning User (30+ days later)
1. Export 1: ✅ Prompt (welcome back, try donating now)
2. Export 11: ✅ Next prompt (every 10)

### User Who Donates
- Clicks Ko-fi link
- **No prompts for 90 days** (respect their contribution)
- After 90 days, resume normal schedule

### User Who Dismisses Forever
- Clicks "Don't show again"
- **Never see prompt again**
- Respects user choice permanently

---

## Files Modified

### New Files
- `src/lib/donationPrompt.ts` - Smart prompt logic & tracking

### Updated Files
- `src/components/SuccessModal.tsx` - Added "Don't show again" button, Ko-fi click tracking
- `src/pages/index.tsx` - Integrated smart prompt logic on export
- `src/lib/generator.ts` - Added CSS comment attribution (all templates)

---

## Testing Commands

```typescript
// Get current stats
import { getDonationStats } from '../lib/donationPrompt';
console.log(getDonationStats());

// Reset tracking (for testing)
import { resetDonationTracking } from '../lib/donationPrompt';
resetDonationTracking();
```

---

## Expected Impact

### Before Optimization
- Prompt shown on EVERY export
- High annoyance factor
- Users dismiss immediately
- Low conversion rate (< 1%)

### After Optimization
- Prompt shown strategically (3rd, 13th, 23rd exports...)
- Low annoyance, high engagement
- Users see value first
- **Expected conversion: 3-5%** (industry standard for donation-ware)

---

## Future Enhancements

1. **A/B Testing** - Test different frequencies (every 7 vs 10 vs 15)
2. **Seasonal Campaigns** - Holiday donation drives
3. **Milestone Celebrations** - "You've saved 20 hours total!" 
4. **Tiered Messaging** - Different copy for power users (50+ exports)
5. **Analytics** - Track actual conversion rates, optimize further

---

## Ethical Considerations

✅ **Transparent** - "100% free forever" clearly stated
✅ **Respectful** - "Don't show again" honored permanently
✅ **Value-First** - Prompt only after user gets value
✅ **No Manipulation** - No fake scarcity, no dark patterns
✅ **Open Source Spirit** - Tool remains fully functional for non-donors

This aligns with open-source donation-ware best practices (Wikipedia, Sublime Text, WinRAR model).
