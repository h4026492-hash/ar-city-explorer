# AR City Explorer - Launch Day Checklist

## Pre-Submission Testing Checklist

Complete **every item** before submitting to App Store. One missed item = rejection or 1-star reviews.

---

## 🌐 NETWORK TESTS

### First Launch Without Internet
- [ ] Turn on Airplane Mode
- [ ] Launch app fresh (delete and reinstall)
- [ ] Verify: App shows meaningful offline message
- [ ] Verify: App does NOT crash
- [ ] Verify: Can browse previously downloaded content

### API Failure Handling
- [ ] Simulate slow network (Network Link Conditioner)
- [ ] Verify: Loading indicators show properly
- [ ] Verify: Timeout messages are user-friendly
- [ ] Verify: Retry works after connection restored

---

## 📷 CAMERA PERMISSION TESTS

### Camera Denied Flow
- [ ] Go to Settings > Privacy > Camera > Deny AR City Explorer
- [ ] Open app and try AR view
- [ ] Verify: Shows clear permission message
- [ ] Verify: Offers Settings button to enable
- [ ] Verify: App does NOT crash
- [ ] Verify: Other features (list, tours) still work

### Camera Never Asked
- [ ] Fresh install (delete app)
- [ ] Open AR view
- [ ] Verify: Permission prompt appears
- [ ] Grant permission
- [ ] Verify: AR works immediately after grant

---

## 📍 LOCATION PERMISSION TESTS

### Location Denied Flow
- [ ] Go to Settings > Privacy > Location > Deny AR City Explorer
- [ ] Open app
- [ ] Verify: App works without location
- [ ] Verify: Distance features gracefully disabled
- [ ] Verify: Clear message explains location is optional
- [ ] Verify: Walk mode shows appropriate message

### Location Restricted (Parental Controls)
- [ ] Set location to Restricted in Settings
- [ ] Open app
- [ ] Verify: Same graceful handling as denied

---

## 🎯 AR STABILITY TESTS

### Start and Stop AR Repeatedly
- [ ] Open AR view
- [ ] Close immediately
- [ ] Repeat 10 times rapidly
- [ ] Verify: No crashes
- [ ] Verify: No memory leaks (check Xcode)
- [ ] Verify: Camera releases properly each time

### AR Session Interruption
- [ ] Open AR view
- [ ] Receive phone call
- [ ] End call
- [ ] Verify: AR resumes or shows recovery message

### Memory Pressure
- [ ] Open AR view
- [ ] Open multiple Safari tabs
- [ ] Switch apps rapidly
- [ ] Verify: App handles memory warning
- [ ] Verify: No crashes

---

## 💳 SUBSCRIPTION TESTS

### Purchase Flow
- [ ] Start purchase as free user
- [ ] Complete purchase in sandbox
- [ ] Verify: Premium features unlock immediately
- [ ] Verify: Receipt validation works

### Purchase Cancellation
- [ ] Start purchase
- [ ] Cancel at payment sheet
- [ ] Verify: App shows appropriate message
- [ ] Verify: No crash
- [ ] Verify: Can retry purchase

### Restore Purchases
- [ ] Uninstall app
- [ ] Reinstall
- [ ] Tap "Restore Purchases"
- [ ] Verify: Previous purchase restored
- [ ] Verify: Premium features work

### Failed Payment
- [ ] Use sandbox account configured to fail
- [ ] Attempt purchase
- [ ] Verify: User-friendly error message
- [ ] Verify: No crash
- [ ] Verify: Can retry later

---

## 📦 OFFLINE DATA TESTS

### Offline Pack Download
- [ ] Download Dallas pack as premium user
- [ ] Verify: Progress indicator works
- [ ] Verify: Pack saves correctly
- [ ] Turn on Airplane Mode
- [ ] Verify: Can view downloaded landmarks

### Corrupted Data Recovery
- [ ] Download pack
- [ ] Use Safari console to corrupt localStorage
- [ ] Reopen app
- [ ] Verify: App detects corruption
- [ ] Verify: Auto-repairs or prompts re-download
- [ ] Verify: No crash

---

## 🔄 APP LIFECYCLE TESTS

### Background and Resume
- [ ] Open app
- [ ] Press home button
- [ ] Wait 30 seconds
- [ ] Reopen app
- [ ] Verify: State preserved
- [ ] Verify: No blank screen

### Background During Walk Mode
- [ ] Start walk mode
- [ ] Press home button
- [ ] Verify: Walk pauses
- [ ] Reopen app
- [ ] Verify: Walk resumes or shows resume prompt

### App Termination
- [ ] Force quit app (swipe up)
- [ ] Reopen
- [ ] Verify: Graceful startup
- [ ] Verify: User data preserved

---

## 🏪 APP STORE REQUIREMENTS

### Required Screens
- [ ] All screenshots use approved device sizes
- [ ] No placeholder text visible
- [ ] No debug UI visible in screenshots

### Required Metadata
- [ ] Camera usage description in Info.plist
- [ ] Location usage description in Info.plist
- [ ] Privacy policy URL valid and accessible

### App Review Preparation
- [ ] Demo account ready (if needed)
- [ ] Subscription prices match App Store Connect
- [ ] All text is in expected language

---

## ✅ FINAL CHECKS

### Performance
- [ ] App launch time < 3 seconds
- [ ] No jank during scrolling
- [ ] Battery usage reasonable (test 10 min session)

### Accessibility
- [ ] VoiceOver works on main screens
- [ ] Text scales properly with Dynamic Type

### Error Handling
- [ ] Check Xcode crash logs - should be empty
- [ ] Check console for uncaught errors - should be none

---

## Sign-Off

| Tester | Date | All Tests Pass |
|--------|------|----------------|
| | | ☐ |

**Do NOT submit until all items checked.**
