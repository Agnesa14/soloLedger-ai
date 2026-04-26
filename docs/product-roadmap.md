# SoloLedger AI Product Roadmap

## 1. What this app is becoming

SoloLedger AI is shaping into a personal finance workspace for people who want help understanding their money without needing accounting knowledge.

The core product promise is:

- track income and expenses easily
- understand where money is going
- plan budgets and savings goals
- stay ahead of recurring bills and fixed commitments
- get practical AI guidance based on real personal data

This means the app should feel less like a "finance tool for experts" and more like a calm assistant that explains things clearly.

## 2. Product direction

The best version of SoloLedger AI should work well for two user types:

- beginners who need clarity, plain language, and guidance
- organized users who want fast control over budgets, goals, and recurring items

So the product should be:

- simple on first use
- structured and trustworthy
- visually clean
- action-oriented
- bilingual: English and Albanian

## 3. Current strengths

- clear product idea: finance tracking + planning + AI
- useful modules already exist: overview, planning, recurring, AI copilot
- authenticated user workspace with Supabase
- practical financial context for the assistant

## 4. Current gaps to improve

### UX and clarity

- a first-time user may not immediately understand where to start
- the app assumes some familiarity with finance terms like budgets, recurring items, and planning
- there is no onboarding flow that explains the workspace step by step
- there is no empty-state guidance that teaches the product clearly enough

### Product language

- the app is English-only right now
- text is hardcoded in many files, which will make translation harder later if not centralized

### Information architecture

- overview, plan, automation, and AI are useful, but the app should explain what each section is for in more human terms
- "Automation" may be less clear than "Recurring" or "Bills & Income"

### Trust and usability

- the product needs more helper text, friendly labels, and beginner-safe defaults
- the UI should reduce cognitive load for users who do not use apps often

## 5. UX principles for the next phase

- show the next best action on every screen
- explain finance concepts in simple language
- use labels users understand immediately
- avoid making users guess what a section does
- prefer "guided first use" over "empty dashboard"
- keep advanced features available, but not dominant

## 6. Bilingual strategy

Recommended languages:

- English
- Albanian

Recommended implementation approach:

- create a small translation layer instead of hardcoding UI strings
- store messages in dictionaries such as `en` and `sq`
- add a language switcher in the top header
- default language can be English, with Albanian selectable manually
- persist selected language in local storage first, then later in user profile if needed

Suggested structure:

- `lib/i18n.ts`
- `lib/translations/en.ts`
- `lib/translations/sq.ts`
- `app/providers/LanguageProvider.tsx`

## 7. Sprint plan

### Sprint 1: Product clarity and UX foundation

Goal:
Make the app understandable for a first-time user within the first minute.

Scope:

- review section naming across the app
- improve header copy and navigation labels
- add better empty states for transactions, budgets, goals, and recurring items
- add short guidance text on each main screen
- define a clearer "start here" path
- decide whether `Automation` should be renamed to `Recurring` or `Bills & Income`

Definition of done:

- a new user can understand what each section does without asking for help
- every empty state gives a clear next action

### Sprint 2: Onboarding and beginner-friendly flows

Goal:
Help non-technical or non-finance users set up the workspace confidently.

Scope:

- add a lightweight onboarding checklist
- add first-use prompts like:
  - add your first income
  - add your first expense
  - create a monthly budget
  - add a savings goal
  - add a recurring bill
- add contextual tips for forms
- improve form placeholders and labels
- reduce jargon where possible

Definition of done:

- a new user can complete initial setup without confusion
- the app teaches the core workflow through the interface

### Sprint 3: Internationalization (English + Albanian)

Goal:
Make the full UI switchable between English and Albanian.

Scope:

- create translation dictionaries
- extract hardcoded UI strings from pages and components
- add language provider and switcher
- translate navigation, buttons, forms, empty states, and status messages
- test both languages on desktop and mobile

Definition of done:

- users can switch between English and Albanian
- key flows work fully in both languages

### Sprint 4: Professional polish and consistency

Goal:
Make the product feel more mature, reliable, and cohesive.

Scope:

- normalize spacing, headings, button hierarchy, and card styles
- improve visual emphasis for important metrics
- make success, warning, and error states more consistent
- review mobile responsiveness carefully
- improve naming consistency across dashboard and AI workspace

Definition of done:

- the UI feels consistent across all screens
- key actions stand out clearly
- there are fewer places where the product feels unfinished

### Sprint 5: AI assistant clarity and trust

Goal:
Make the AI feel more useful, transparent, and beginner-friendly.

Scope:

- improve AI empty state and prompt suggestions
- explain what data the AI is using in simpler language
- make AI responses easier to act on with sharper prompts
- add beginner prompt categories like spending, saving, monthly plan, and upcoming bills
- consider bilingual AI prompt presets

Definition of done:

- users understand how to use the AI
- the assistant feels practical, not vague

### Sprint 6: Validation, testing, and production readiness

Goal:
Stabilize the product before wider use.

Scope:

- test key user journeys end to end
- verify auth, dashboard loading, and empty states
- test language switching persistence
- test mobile layouts
- fix UX edge cases and content inconsistencies

Definition of done:

- major user flows are stable
- the product feels ready for real users

## 8. Recommended build order

If we want the fastest visible improvement, the best order is:

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 4
5. Sprint 5
6. Sprint 6

## 9. What I recommend we do next

Start with Sprint 1 and keep it tightly focused on clarity:

- rename unclear labels
- improve dashboard and sidebar copy
- improve empty states
- define the "start here" experience

That will immediately make the app feel more professional and easier to understand, even before we add Albanian language support.
