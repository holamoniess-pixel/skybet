# Skybet UI/UX and Responsive Component Specification

**Status:** Planning only. This specification defines the user experience to be implemented after approval. It does not reproduce the user-supplied account details, competitor copy, game data, odds, images, or interface layouts.

## 1. Design reading and visual direction

The reference is read as a **clean financial-service card system**: royal blue as the structural colour, warm white panels, large decisive headings, rounded information rows, subtle soft shadows, fine line work, and curved blue framing rather than generic gradients. Skybet will translate that visual language into an original product interface, with **emerald green limited to constructive states** such as verified, available, completed, or safe confirmation. It will not use emerald as a promotion or “win” colour, and it will not expose payment/account details as decorative content.

The visual system should feel composed, readable, and fast on a small mobile screen. The product will use a compact information hierarchy, not a crowded betting-board aesthetic. The intended design settings are medium visual density, low-motion interaction, high operational clarity, and original branded components built on the existing accessible component foundation.

| Design attribute | Skybet decision | Rationale |
| --- | --- | --- |
| Primary visual language | Cobalt/royal blue and warm white, with deep navy text and structure. | It matches the requested reference direction while preserving a distinct Skybet identity. |
| Emerald usage | Verification, successfully submitted action, service availability, and positive non-financial status only. | Emerald remains meaningful instead of becoming a second competing primary colour. |
| Surface treatment | Large-radius white cards, hairline blue-grey borders, and restrained soft elevation. | It creates a trustworthy, information-card feel without glassmorphism or visual noise. |
| Decorative system | Small blue dot grids, thin rules, and controlled curved-edge motifs used only at major section boundaries. | It borrows the reference’s rhythm without recreating its layout. |
| Typography | `Outfit` for headings and `Manrope` for body/UI text. | The pairing is legible, modern, and more distinct than a default generic sans-serif stack. |
| Motion | 150–220 ms opacity/transform transitions, with a static fallback under reduced-motion preferences. | It supports responsive feedback without interrupting fast betting/account tasks. |

## 2. Token system

All product code will use a three-layer token model: primitive values, semantic aliases, and component-specific tokens. Raw colour values will not be scattered through components.

| Token tier | Token | Value or alias | Intended use |
| --- | --- | --- | --- |
| Primitive | `--sky-blue-700` | `#0A3F9E` | Deep branded blue. |
| Primitive | `--sky-blue-600` | `#0F57C7` | Primary interactive blue. |
| Primitive | `--sky-blue-500` | `#1D70E8` | Hover/active information blue. |
| Primitive | `--sky-navy-950` | `#061A3B` | High-contrast heading and navigation colour. |
| Primitive | `--sky-ice-50` | `#F4F8FF` | Cool supporting surface. |
| Primitive | `--sky-white-50` | `#FCFDFE` | Warm white base surface. |
| Primitive | `--sky-emerald-700` | `#087A57` | Accessible constructive-status text. |
| Primitive | `--sky-emerald-600` | `#0E9F6E` | Constructive icon/badge background. |
| Primitive | `--sky-amber-700` | `#A85F00` | Pending/review state. |
| Primitive | `--sky-red-700` | `#B42318` | Error, restriction, or urgent-review state. |
| Semantic | `--color-action-primary` | `var(--sky-blue-600)` | Primary buttons and selected controls. |
| Semantic | `--color-action-success` | `var(--sky-emerald-700)` | Successful non-financial status. |
| Semantic | `--color-surface-base` | `var(--sky-white-50)` | App canvas. |
| Semantic | `--color-surface-soft` | `var(--sky-ice-50)` | Secondary panels and table headers. |
| Semantic | `--color-text-strong` | `var(--sky-navy-950)` | Headings and critical labels. |
| Component | `--bet-card-accent` | `var(--color-action-primary)` | Sports/event card selected state. |
| Component | `--status-verified` | `var(--color-action-success)` | Verified/available badge. |
| Component | `--admin-nav-active` | `var(--sky-blue-700)` | Admin navigation selection. |

The product will supply a coordinated dark theme using navy surfaces and desaturated blue/emerald actions. Both themes must preserve accessible contrast, readable active states, and clear distinction between financial, safety, warning, and success statuses.

## 3. Expanded competitor research: transferable conclusions

The supplementary review looked at SportyBet, BetFox Ghana, Football.com, and Betr. Each source was used to understand customer-facing navigation, account/safety discoverability, and product scope. The analysis deliberately excludes their visual assets, text, commercial terms, promotional claims, and proprietary flow logic.

| Source | Verifiable pattern | Skybet adaptation |
| --- | --- | --- |
| SportyBet | Its public navigation groups Sports, Casino, Live Betting, virtual content, results, promotions, loyalty, app access, and contextual “How to play” material. Its responsible-gaming page describes user safety, temporary self-exclusion, account limits, and support contacts.[1] | Skybet will use a short, task-led product navigation, a single help entry, and a clearly separated safer-play route. It will not emulate SportyBet’s labels or layout. |
| BetFox Ghana | The site places Sports, Live Betting, casino content, referrals, promotions, chat, login, and registration within a compact top-level navigation. Its policy describes exclusion, marketing suppression, age checks, and a post-exclusion cooling-off concept.[2] | Skybet will make referral and support access easy to reach but will always suppress referral/promotion UI for excluded or restricted accounts. |
| Football.com Ghana | Its mobile help area presents support, self-exclusion, account-closure guidance, and clear explanatory content within a phone-scaled page.[3] | Skybet will use dedicated mobile account-control panels and a simple back path from every help/safety view. It will not borrow any terms or withdrawal logic. |
| Betr | Its responsible-play page lists independent time, deposit, betting, maximum-bet, time-out, and self-exclusion controls. Its terms describe account identity, age, and location verification as server-enforced eligibility conditions.[4] [5] | Skybet will group safety controls in a reusable “Safer Play” module and represent eligibility as a server-enforced account state, not a front-end toggle. |

## 4. Mobile-first interaction model

Mobile is the primary product environment. The interface will be designed at **360 px first**, validated at 390 px and 430 px, then progressively enhanced for tablet and desktop. There must be no horizontal page scroll, hover-only action, hidden critical state, or touch target below 44 by 44 CSS pixels.

| Breakpoint | Layout rule | Navigation and task behaviour |
| --- | --- | --- |
| 0–639 px | One-column content, 16 px page gutters, 12–16 px gaps, full-width task cards. | Bottom navigation for primary customer destinations; sticky compact bet/account action; filters and detail controls open in sheets. |
| 640–1023 px | Two-column adaptive grids where content benefits from comparison. | Top navigation becomes available; account and bet-slip panels may coexist in drawers. |
| 1024–1279 px | Content max width 1280 px; sports catalogue uses a main column plus contextual bet-slip/summary rail. | Header navigation remains one line; persistent actions stay visible without masking data. |
| 1280 px and above | Wider editorial composition with a 12-column grid and carefully capped readable line lengths. | Admin can use persistent sidebar; public experience retains a focused centre column and lightweight contextual rail. |

### Mobile customer navigation

| Destination | Icon/label treatment | Mobile route behaviour |
| --- | --- | --- |
| Home | Home icon and “Home” label | Returns to personalised discovery and visible safer-play entry. |
| Sports | Activity icon and “Sports” label | Opens sports catalogue with a tabbed, filterable league/event view. |
| Live | Pulse icon and “Live” label | Opens live events only when their data source is available and permitted. |
| Rewards | Gift icon and “Rewards” label | Shows referral status and eligible reward history; hides promotions for restricted users. |
| Account | Avatar icon and “Account” label | Opens secure account hub, including safer play and support. |

The bet-slip summary will appear as an anchored, keyboard-accessible button on small devices and open in a **Sheet** component. It will never be an always-expanded floating panel that covers event data. Any financial, account, or exclusion action will require an explicit confirmation component and visible result state.

## 5. Actual component inventory

Skybet will use the project’s existing accessible UI primitives where they match the interaction. Domain components will compose those primitives rather than recreating buttons, dialogs, focus management, or form semantics from scratch.

| Component | Base components to use | Customer/admin purpose | Responsive behaviour |
| --- | --- | --- | --- |
| `SkybetHeader` | Navigation Menu, Button, Avatar, Popover | Brand, primary routes, authentication, account shortcut. | Compact logo plus actions on phone; one-line navigation on desktop. |
| `MobileBottomNav` | Button, Tooltip | Five primary customer destinations. | Fixed only on small screens; reserves bottom safe-area space. |
| `SportSegmentTabs` | Tabs, Scroll Area | Switches sport, live, virtual, or saved collections. | Horizontally scrollable with visible focus; no clipped labels. |
| `EventCard` | Card, Badge, Button, Collapsible | Event summary, start state, and permitted market entry. | One event per row on phone, enhanced grid on tablet/desktop. |
| `MarketOddsButton` | Button, Badge | Displays a market outcome and its selection state. | 44 px minimum target; wraps into a two-column grid before shrinking text. |
| `BetSlipSheet` | Sheet, Dialog, Form, Alert | Displays selected items, validation, confirmation, and clear unavailable states. | Sheet from bottom on phone, right rail/drawer from tablet upward. |
| `AccountSummaryCard` | Card, Avatar, Skeleton | Shows account status, verification, safe-play state, and action shortcuts. | Full width on mobile; compact profile row on desktop. |
| `ReferralStatusCard` | Card, Progress, Badge, Tooltip | Shows referral link, qualification stage, and reward status. | Stacked layout on phone; statement-style data row on wide screens. |
| `ReferralRuleEditor` | Form, Input, Select, Switch, Alert Dialog | Lets a permitted administrator version a programme amount or set a user override. | Wizard-like step order on phone; grouped desktop form with change summary. |
| `SaferPlayControl` | Card, Slider, Select, Dialog, Alert | Models each limit/time-out/exclusion control separately. | Full-width card with brief description, current state, and protected confirmation flow. |
| `EligibilityBanner` | Alert, Badge | Announces unavailable content, verification requirement, or safety restriction. | Inline at the action point, never only in a distant notification centre. |
| `SupportEntry` | Button, Sheet, Accordion | Brings help, FAQ, and support/contact methods together. | Bottom sheet on phone, inline support panel on desktop. |
| `AdminShell` | Existing DashboardLayout, Sidebar, Breadcrumb, Command | Role-based operations layout. | Desktop sidebar; mobile slide-in navigation with persistent page title. |
| `AuditEventTable` | Table, Pagination, Select, Date Picker, Dialog | Reviews immutable sensitive actions and evidence. | Card/list rows on phones; table only at tablet and desktop widths. |
| `EmptyState` and `LoadState` | Empty, Skeleton, Spinner, Alert | Makes unavailable data, no referrals, safety restriction, or provider downtime explicit. | Avoids blank screens and preserves layout stability on all screens. |

## 6. Component states and safety rules

Every component must support loading, empty, error, disabled, focus-visible, active, and reduced-motion states. Components that affect access, referrals, or prospective money movement additionally require pending, review, restricted, and completed states. Status colour must be paired with text and iconography so colour is never the sole indicator.

| Interaction | Required protection | UI response |
| --- | --- | --- |
| Referral amount override | Role check, reason, effective date, approval/audit event. | A change-review dialog shows previous amount, new amount, scope, rule version, and reason before submission. |
| Self-exclusion / time-out | Server-enforced state, programme/marketing suppression, immutable audit event. | A dedicated confirmation flow explains the restriction period and shows support options. |
| Eligibility or verification block | Server-only decision and reason-code mapping. | Inline eligibility banner explains next permitted action without leaking risk/fraud logic. |
| Provider unavailable | Adapter health decision and stale-data guard. | Event/game action is disabled with a transparent “currently unavailable” state. |
| External deep-link launch | Allowlisted provider URL and new-window safety controls. | Launch control confirms the source and returns safely to Skybet. |

## 7. Accessibility and performance acceptance criteria

Skybet components must meet WCAG AA contrast targets, keep focus rings visible, use keyboard-reachable controls, preserve semantic labels, and announce critical changes with accessible status regions. Body text remains at least 16 px with comfortable line height. Forms use permanent visible labels, not placeholder-only inputs.

On mobile, actions use a minimum 44 px hit area with 8 px spacing. All nonessential animation is disabled when the device requests reduced motion. Images and charts reserve layout space to reduce visual shifting. No screen should require JavaScript-only hover to reveal an essential action, and no dashboard table will be forced onto a narrow screen when a list/card representation communicates the data more clearly.

## 8. Implementation acceptance checklist

| Area | Must be true before this design work is accepted |
| --- | --- |
| Tokens | All colours, spacing, radius, shadows, and typography come from documented CSS variables or semantic utility mappings. |
| Components | Every listed component exists as an actual reusable React component with typed properties and Storybook-equivalent documented states if introduced. |
| Accessibility | Keyboard traversal, focus visibility, error announcements, labelled forms, semantic landmarks, and contrast are tested. |
| Responsive design | Customer and admin routes are verified at 360, 390, 768, 1024, and 1440 px, with no horizontal overflow. |
| Mobile behaviour | Bottom navigation, sheets, filters, bet-slip/account actions, and safe-area spacing work without overlap. |
| Safety | Referral/marketing components respect server-provided restricted, self-excluded, and verification-required states. |
| Testing | Vitest covers role gating, referral amount validation, restriction-aware UI states, and responsive component behaviour where practical. |

## References

[1]: https://www.sportybet.com/ng/help?nav=responsible-gaming "SportyBet Nigeria — Responsible Gaming"
[2]: https://www.betfox.com.gh/cms/responsible-gaming "BetFox Ghana — Responsible Gaming"
[3]: https://www.football.com/gh/m/n/help/about/responsible-gaming/getting_help "Football.com Ghana — Getting Help"
[4]: https://www.betr.app/responsibility "Betr — Playing Responsibly"
[5]: https://www.betr.app/terms-and-conditions/social-sportsbook-and-casino "Betr — Social Sportsbook and Casino Terms and Conditions"
