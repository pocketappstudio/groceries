# Restock: App Store metadata (DRAFT for Slade's approval, not submitted)

- **App name:** Restock (pending Slade's OK on the name)
- **Bundle ID:** com.pocketappstudio.restock
- **Primary category:** Food & Drink · **Secondary:** Productivity
- **Price:** one-time paid app, suggested $4.99 (Slade decides). No in-app purchases, no subscription.
- **Copyright:** 2026 pocketappstudio

## Subtitle (30 max)
Grocery list that learns  *(25 chars)*

## Promotional text (170 max)
Check off what you buy. Restock learns how often you need it, puts it back on your list before it runs out, and reminds you on your iPhone. No account. No ads.

## Description
Restock is a grocery list that learns your routine.

Check items off as you buy them. Restock records the date, spots the pattern, and puts each item back on your list a few days before it's due. Milk every week, coffee every three weeks: it learns it for you.

AT A GLANCE
Like a calendar on the wall: what you need now, and what's coming due.

REMINDERS ON YOUR IPHONE
"Don't forget milk." Reminders are scheduled on your iPhone and arrive even when the app is closed. The app icon badge shows how many items you need.

REMEMBERS THE HOLIDAYS
Restock keeps your purchase history. As Thanksgiving gets close, it offers what you bought last Thanksgiving. Save sets like "Thanksgiving casserole" or "Taco night" and add them back in one tap.

FAST TO ADD
Type or use dictation. Say "milk, eggs and bread" and confirm with one tap.

YOURS, ON YOUR DEVICE
No account and no sign-up. No ads and no tracking. Your lists stay on your iPhone and work offline. Export a backup file (JSON or CSV) any time, and import it again.

ONE PURCHASE
Pay once. No subscription.

Large text, big tap targets, high contrast, and light and dark themes.

## Keywords (100 max)
grocery,shopping list,groceries,recurring,reminder,pantry,restock,offline,holiday,recipe,checklist
*(98 chars)*

## URLs
- **Support URL:** https://pocketappstudio.github.io/groceries/privacy-ios.html *(no email; see approval note. Apple needs a support URL with a way to reach you.)*
- **Marketing URL:** leave blank (the web page links to Gumroad, and the App Store version must not point to other purchase options)
- **Privacy Policy URL:** https://pocketappstudio.github.io/groceries/privacy-ios.html

## Age rating questionnaire
All content categories: **None** (violence, sexual content, profanity, horror, drugs/alcohol/tobacco, gambling, contests, medical). Unrestricted web access: **No**. User-generated content shared with others: **No**. Messaging/chat: **No**. Parental controls: **No**. Age assurance: **No**. → expected rating **4+**.

## App Privacy ("nutrition label")
- Do you or your third-party partners collect data from this app? **No** → **Data Not Collected**.
- Basis: no accounts, no server, no analytics, ads or third-party SDKs. Lists and history live in on-device storage. Notifications are local (UNUserNotificationCenter via Capacitor LocalNotifications), not push. Export files go wherever the user saves them. Dictation is Apple's own system service.
- Tracking: **No**.

## Export compliance
Uses encryption: **No** (only standard OS HTTPS; the app makes no network calls of its own). Set `ITSAppUsesNonExemptEncryption = NO` in Info.plist.

## App Review notes (guideline 4.2, native functionality)
Restock is a grocery list that learns on the device and uses native iOS features:
1. Local notifications: after an item has been checked off as bought a few times on a regular interval, Restock schedules a local notification ("Don't forget milk") at 9:00 AM, 1 to 3 days before the item is due. They are scheduled on the device with UNUserNotificationCenter and fire while the app is closed. No server or push service is used.
2. App icon badge: shows the number of items needed now (Badge plugin).
3. Fully offline: all data is stored on the device. The app works in Airplane Mode and needs no account or login.
4. Backup: Export and Import (JSON/CSV) through the iOS share sheet and Files.
To test quickly (TO VERIFY on a real iPhone before submitting): add "Milk", tap Bought, open the item and set "Repeats every" to 2 days, then allow notifications. A reminder is scheduled for the day before it's due. No demo account is needed because there is no sign-in.

## Screenshots (6.9-inch, 1320×2868), /workspace/grocery/appstore/screenshots
1 home (wall-calendar view) · 2 add (dictation) · 3 memory (purchase history) · 4 sets · 5 last-Thanksgiving offer · 6 milk recurring interval, each in -light and -dark. Generic sample data, sample date Nov 16, 2026. Regenerate with `appstore/shots.py`.
