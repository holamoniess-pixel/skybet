# Skybet Verification Record

The current public match centre was visually checked at desktop width (`1280×720`) and mobile width (`375×812`). The public layout maintains readable event cards, clear primary actions, mobile quick filters, and reserved space above the bottom navigation. The protected `/admin` workspace was checked at desktop width using an authenticated administrator session; its referral controls, customer-override controls, and pre-activation guardrails rendered correctly.

The visual review found the blue, white, navy, and limited emerald hierarchy coherent and responsive. The next brand iteration may introduce a stronger Skybet-native live ticker or odds-board motif, but this is an enhancement rather than a release blocker. One copy correction is required: the admin audit panel still says that audit activity is not connected although the current server now writes administrator audit events.

The expanded customer suite was visually checked at `375×812` across the home, live, sports, games, search, activity, account, and event-detail routes. The desktop home, games preview, and administrator workspace were also checked at `1280×720`. The compact live rail, mobile filter strip, original route header, simulated feed cards, and searchable administrator user panel all render without horizontal overflow. The bottom navigation is intentionally omitted from full-page captures because the verification tool suppresses non-top fixed chrome.

The current visual refinement was checked on the home route at `375×812` and `1280×720`. The generated Skybet crest replaced the temporary letter tile, the header now presents an account-first action with no search control, and the original stadium hero has sufficient contrast for its reduced copy and primary live-board action. The renamed virtual-game demo remains explicitly simulated, and the reduced event-card height preserves readable market values and mobile-size tap targets.

After adding the virtual-game category row, the home route was checked again at `375×812` and `1280×720`. The `All demos`, `Live virtuals`, `Football demos`, and `Court demos` controls remain horizontally reachable on mobile and fully visible at desktop width. The hero, category strip, compact event cards, and account-first header continue to render without overlap or horizontal page overflow.

The final mobile home-layout refinement was checked at `375×812` and `1280×720`. The original sport-discovery rail is compact, horizontally reachable, and includes clear shortcuts for live events, Premier football, basketball, virtual games, and tennis. The simulated preview balance is visible before the account icon on both screen sizes. The mobile hero is materially shorter, with reduced padding, copy scale, action height, and discovery-row density; desktop retains its wider hero composition without header congestion.

Following the final preview-balance interaction test and defensive mobile scroll guard, the home route was rechecked at `375×812` and `1280×720`. The balance remains visible and aligned, sport shortcuts remain legible and tappable, and the compact hero, virtual category controls, match cards, and desktop header retain their intended layout without overflow.

## Interaction Audit

The current development preview was audited with browser automation at **desktop `1280×720`** and **mobile `375×812`**. A complete accessibility inventory was collected for the home route, live, sports, games, search, activity, account, a valid event-detail route, and the event-not-found recovery route at both sizes. Each route resolved its expected title and heading. The inventory recorded all visible buttons, links, and text inputs before click-through checks began.

| Surface | Visible-control coverage | Verified outcome |
|---|---|---|
| Home match centre | Header, preview balance, account access, theme, mobile rail, hero and discovery actions, event-code form, sport filters, simulated-feed controls, tabs, market buttons, account sheet entry, and support | All controls either route, update the preview state, open a safe sheet, refresh/filter simulated content, or give inline validation feedback. |
| Live, sports, and games | Shared shell navigation, simulated feed controls, event-card markets | Shell actions route correctly. Event cards open their respective event previews. The feed remains explicitly simulated and routes only to preview detail. |
| Search, activity, and account | Search input/result cards, shell controls, account sections | Search narrows the preview catalogue and its result opens a detail route. Account and activity anchors resolve to their present informational sections. |
| Event detail and recovery | Market choices, return action, missing-event recovery | Detail markets now open the non-transactional selection sheet. Return and recovery actions route to their event-board destinations. |
| Mobile navigation | Home, Sports, Live, Rewards, Account | Each item was activated by keyboard in the audit environment and reached its intended route. Keyboard activation was used because the sandbox preview overlay can intercept physical pointer clicks on fixed bottom controls. |

#### Route-by-route public inventory

| Route | Desktop controls observed | Mobile controls observed | Audited behaviour |
|---|---|---|---|
| `/` | Primary navigation, balance/account/theme, hero and discovery actions, event-code input, sport and mode filters, simulated-feed refresh/categories/cards, market buttons, account-sheet entry, support | Balance/account, sport rail, hero/discovery actions, event-code input, filters, simulated-feed controls/cards, market buttons, support, bottom navigation | Every control routes, filters/changes preview state, opens a safe sheet, refreshes simulated content, or shows inline validation. |
| `/live` | Brand/desktop links, search/theme/account, live market buttons | Brand/search, live market buttons, bottom navigation | Market buttons open the related event detail. Shell actions route to their named destinations. |
| `/sports` | Brand/desktop links, search/theme/account, upcoming market buttons | Brand/search, upcoming market buttons, bottom navigation | Market buttons open the related preview detail; navigation remains available at both breakpoints. |
| `/games` | Brand/desktop links, search/theme/account, simulated-feed refresh/category/card controls | Brand/search, simulated-feed refresh/category/card controls, bottom navigation | Refresh and category controls update the clearly labelled simulated feed; event cards open preview detail only. |
| `/search` | Brand/desktop links, search/theme/account, search input and event-result buttons | Brand/search, search input/result buttons, bottom navigation | Typing filters the preview catalogue and result buttons open the selected event. |
| `/activity` | Brand/desktop links, search/theme/account | Brand/search, bottom navigation | Navigation and referral-activity anchor destination remain available; the page deliberately presents non-transactional preview information. |
| `/account` | Brand/desktop links, search/theme/account | Brand/search, bottom navigation | Support, safer-play, and preferences anchors provide valid destinations for home and drawer actions. |
| `/event/live-skyline` | Brand/desktop links, search/theme/account, return control, three market buttons | Brand/search, return control, three market buttons, bottom navigation | Markets open the safe selection sheet; return opens the live board. |
| `/event/missing-event` | Brand/desktop links, search/theme/account, recovery button | Brand/search, recovery button, bottom navigation | The recovery action opens `/sports`; the page does not leave the user at a dead end. |

The click-through audit exercised the repaired discovery links, known and unknown event-code paths, support destination, account-drawer destinations, event-detail markets, selection confirmation, event-card routes, simulated-feed card route, search result route, event return/recovery actions, shared search action, desktop shell links, and mobile bottom navigation. Every checked route assertion passed. The browser console contained only sandbox/platform warnings related to WebGL and an analytics remote-configuration timeout; no Skybet application exception was observed.

### Repairs completed from the audit

The home discovery tiles now route to the relevant existing Skybet pages rather than leaving users on an ambiguous state. Event-code lookup accepts known preview identifiers such as `live-skyline`, routes to that event, and shows inline guidance for unknown or empty values. The support entry routes to the account support section. Account-drawer actions route to safer-play, referral-reward, activity, and preferences sections; the sign-in button now invokes the existing authentication entry point from a user-triggered event.

Event-detail market buttons now populate the existing **non-transactional selection sheet**. Confirming a selection stores it only for the preview session and shows explicit feedback. The application still does not accept deposits, wagers, payouts, or other live financial actions.

### Administrator access boundary

The public browser session reached `/admin` and received the expected **“Sign in to continue”** gate with a single authentication action. No owner or administrator credentials were introduced during this audit, so persistence-changing referral actions, user search, and override saving were not invoked. Existing role-aware automated coverage confirms that an administrator sees the workspace while a customer role cannot see the referral amount control. This access-gated status is intentional and should be rechecked after an owner-authenticated test session is explicitly available.

### Automated verification

The repaired release passed **30 automated tests across 11 test files**, `pnpm check`, and `pnpm build`. The production build completed successfully with an existing bundle-size advisory only; it is an optimization opportunity rather than a functional failure.

### Post-repair visual review

Fresh full-page screenshots of `/`, `/event/live-skyline`, and `/account` at `1280×720` and `375×812` confirmed that the new event-code helper text, account destinations, selection-ready market cards, and support entry remain readable and visually aligned. At mobile width, the sport rail, short hero, discovery row, event-code form, virtual-demo strip, compact match cards, and account/help cards remain within the viewport without horizontal overflow. At desktop width, the added Preferences section preserves the original account-page card rhythm, and the event-detail market grid remains clear above the non-transactional boundary.

### Balance and customer-service refinement

The updated home header was visually checked at `1280×720` and `375×812`. The preview balance now uses an original, integrated navy capsule with a primary balance line, a clearly distinct emerald bonus line, and a connected account affordance. The compact mobile treatment remains legible without crowding the Skybet mark or sport-discovery rail. The account page now presents the supplied customer-service address as an explicit mail link, with readable contrast at desktop width.

### Fresh live control audit

Following the balance and customer-service update, browser automation exercised **58 visible public controls and access checks** against the running Skybet application. All 58 checks passed. The audit covered desktop navigation, balance/account/theme actions, hero and discovery routes, filters and mode tabs, simulated-feed refresh and categories, known and unknown event-code flows, selection review and confirmation, support and mail-contact surfaces, account-drawer destinations, event cards, search, recovery routes, shared shell controls, mobile rail actions, mobile bottom navigation, and the unauthenticated administrator gate. The customer-service address was verified as a `mailto:` link on both the home support card and account customer-service card. No money movement, wager, deposit, payout, or email-send action was performed.

### Published-domain replay

After publication, the same control set was replayed on `https://skybetapp-a2xeppgr.manus.space`. The initial run completed 53 of 58 assertions immediately. Follow-up checks confirmed that the five apparent misses were audit timing or selector artefacts rather than user-facing defects: the theme control changed its accessible label from **Use light theme** to **Use dark theme**; the home email link was present after returning to the home route; the simulated Aurora United feed card opened `/event/mock-live-aurora`; and `/admin` rendered the expected **Sign in to continue** gate with its Sign in control after the protected page finished loading. The published replay therefore verified all **58 of 58** intended control outcomes with no live transaction or email-send action.

### Compact-card and preview-slip refinement

Fresh visual review at `1280×720` and `375×812` confirmed that the shared wordmark now renders as **SKYBET**, while the original balance capsule preserves the requested compact dark-pill hierarchy of primary balance, emerald bonus, and a circular account affordance. The new hover and focus state lifts the capsule without changing layout and respects reduced-motion preferences. Match cards now keep their primary three preview values on a compact row and disclose additional preview values through an explicit control. Sports, activity, and account cards use reduced padding and denser responsive grids. The fixed **Preview slip** affordance remains visible above the mobile account navigation and is clearly labelled as non-transactional.
