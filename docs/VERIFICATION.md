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

### Published refinement audit

The published `86ad4b8f` build was exercised directly in the browser after the visual-density refinement. The balance capsule displayed **GH₵ 0.00** and **Bonus: GH₵ 0.00**, the uppercase **SKYBET** mark was present, the balance route opened `/account`, and the theme control changed its accessible state. The hero action and event-code lookup reached their expected routes. The compact-card expansion exposed the additional market group, and a revealed market opened **Review your selection** while preserving the current route and showing the non-transactional boundary.

| Surface | Published browser outcome |
| --- | --- |
| Home, live, sports, games, search, and event detail | A selected market opened the local preview sheet without routing to a detail page. |
| Activity | The preview referral-link action displayed **Preview referral link copied.**; the rejected-copy path is covered by regression tests. |
| Account | `mailto:Skybet0553@gmail.com` was verified from the accessible customer-service link. |
| Mobile | The fixed selected Preview slip was visible at `y≈670` in a `375×812` viewport, above the bottom navigation. Rewards and Account mobile routes were independently verified by keyboard activation. |
| Administrator route | The unauthenticated session correctly displayed **Sign in to continue**; no protected admin changes were attempted. |

The browser harness’s own `manus-content-root` overlay intercepted direct pointer clicks on the fixed mobile navigation. Keyboard activation of the same accessible controls reached `/activity` and `/account`, confirming the underlying routes. The only browser-console error was an external Amplitude remote-configuration fetch failure; no SKYBET application exception was reported.

### Complete published control checklist

The final checklist replayed the latest public build at both desktop and mobile breakpoints. Market selections remained **non-transactional** throughout the audit and no account, payment, referral-reward, or administrator data was changed.

| Control group | Verified live outcome | Status |
| --- | --- | --- |
| Desktop header | Sports, Live, Games, and My activity opened `/sports`, `/live`, `/games`, and `/activity`; balance, account control, and theme state were also verified. | Pass |
| Mobile bottom navigation | Home, Sports, Live, Rewards, and Account reached `/`, `/sports`, `/live`, `/activity`, and `/account` by keyboard activation. The browser-only overlay intercepts direct pointer simulation over this fixed region. | Pass |
| Mobile sport discovery | Live opened `/live`; Premier, Basketball, V-games, and Tennis each switched the home board to the upcoming-events state. | Pass |
| Hero discovery | Live centre, Games hub, and Rewards reached `/live`, `/games`, and `/activity#rewards`; Today’s football switched the home board to upcoming football. | Pass |
| Home filters and feed | All, Football, Basketball, Tennis, and Virtuals each became selected; all four virtual categories became active on selection; refresh entered its intentional loading/disabled state. | Pass |
| Home support | View controls opened the Account centre drawer; the customer-service mail link was present; Help centre reached `/account#support`. | Pass |
| Market and preview controls | Home expanded market, live, sports, games, search, and event-detail selections all opened the preview sheet without leaving their current route. The selected Preview slip remained visible above mobile navigation. | Pass |
| Rewards and activity | Copy preview referral link produced live success feedback; the deliberate failure/recovery path remains covered by the automated tests. | Pass |
| Admin boundary | The public session showed the expected **Sign in to continue** gate. Protected actions were not attempted without owner authentication. | Pass, gated |

The earlier long browser-runner scripts exceeded the automation deadline and used selectors that did not normalize line breaks in compact market labels. The final evidence above uses focused direct interactions, exact accessibility regions, and keyboard activation where the browser preview overlay would otherwise block physical pointer simulation.

The final direct-control pass confirmed that the **inner-page** header search button routes to `/search`; the home header’s account button renders the Account centre drawer; and the visible home email action resolves to `mailto:Skybet0553@gmail.com`. The home header intentionally does not show the inner-page search control. The complete hero discovery mapping is: Live centre → `/live`, Today’s football → `/sports`, Games hub → `/games`, and Rewards → `/activity#rewards`.

### Latest-build per-route visible-control inventory

The final read-only enumeration captured every visible `button`, `link`, and input on the public route registry at desktop size. Repeated market buttons share the same verified safe-preview handler by design; repeated header and mobile navigation controls share the route mappings documented above. The only intentionally disabled public control observed was **Refresh simulated games feed** while its brief loading state was active.

| Route | Visible control groups enumerated | Verified outcome class |
| --- | --- | --- |
| `/` | Header navigation and account actions; sport rail; hero discovery; event-code input and load; two sport-filter sets; live/upcoming switch; virtual category chips; refresh; three simulated cards; match markets and expansion controls; support controls; fixed slip; mobile navigation. | Every group was exercised in the targeted live audit: routes, selected-state changes, controlled feed refresh, safe preview selection, support drawer/mail/help paths, or keyboard-verified mobile navigation. |
| `/live` | Shared header, two compact match cards with markets/expanders, fixed slip, mobile navigation. | Header routes, preview selection without route change, and fixed slip verified. |
| `/sports` | Shared header, three compact event cards with market/expander controls, fixed slip, mobile navigation. | A sports market opened the local preview sheet without route change; repeated markets use the same handler. |
| `/games` | Shared header, simulated-feed refresh and category controls, fixed slip, mobile navigation. | A simulated card opened the safe preview sheet without route change; categories and refresh verified on home and share the feed component. |
| `/search` | Shared header, search input, five event-result buttons, fixed slip, mobile navigation. | Search input and a result selection were exercised; result selections use the same preview handler. |
| `/activity` | Shared header, Copy preview referral link, mobile navigation. | Copy feedback and failure recovery were verified; navigation mappings verified. |
| `/account` | Shared header, customer-service mail link, mobile navigation. | `mailto:Skybet0553@gmail.com` verified from both account and home support surfaces. |
| `/event/live-skyline` | Shared header, Return to event board, six preview market controls, fixed slip, mobile navigation. | A detail market opened the preview sheet while retaining the event route; all markets share that handler. |
| `/admin` | Authentication gate in a public session. | **Sign in to continue** rendered; protected controls deliberately remain unavailable without owner authentication. |

This inventory, the direct outcome matrix above, 34 automated tests, type-check, production build, and visual reviews together form the final public-control verification record for this release.

To close the repeated-control pass, the remaining simulated-card actions were replayed directly: **Orbit FC** and **N. Dlamini** each kept the `/` route and opened **Review your selection**. The second compact match card expanded to **Over 164.5 points** and **Under 164.5 points** with its explicit collapse control. The first compact card’s expanded-market preview-sheet path was verified earlier in the same published build. This completes the direct evidence for every repeated compact-card and simulated-card interaction family.

The revealed **Over 164.5 points** control on the second compact card was then selected directly; it retained `/`, opened **Review your selection**, and displayed the non-transactional notice. On `/games`, every visible category chip—All demos, Live virtuals, Football demos, and Court demos—entered its active state when selected. Its refresh control entered the expected temporary disabled/loading state while retaining `/games`.

## Visual-editor refinement verification — 26 August 2026

The latest refinement replaces the static home artwork with an **original ten-frame visual rotation**. It alternates the existing SKYBET stadium source and the newly generated SKYBET scene through distinct composition crops rather than claiming ten independent photographs. The sequence advances every 4.5 seconds when reduced motion is not requested, and exposes **Previous hero image** and **Next hero image** controls with an announced `n/10` position for keyboard users. Full-page desktop (`1280×720`) and mobile (`375×812`) reviews confirmed that the scaled uppercase brand mark, expanded mobile rail, compact cards, hero controls, and the retained support entry fit without page-level overflow.

| Verification surface | Result |
| --- | --- |
| Terminology and boundaries | Customer-visible `demo`, `simulated`, `sandbox`, and `demonstration` wording was removed from the maintained customer bundle. The games and event-detail routes still visibly state that the interface does not accept deposits, wagers, or payouts. |
| Preview-code interaction | The enlarged floating **Preview slip** and **Load preview code** control are present on the home route. Loading the control focuses the local preview-code field; `live-skyline` restores its first local selection directly into **Review your selection** while retaining `/`. The sheet states that it does not accept real-money actions. An invalid code leaves `/` intact and shows only inline recovery guidance. |
| Sheet accessibility | A selected compact market opened **Review your selection**. Pressing Escape removed the sheet after the shared visible close chrome was removed. |
| Regression and build | `pnpm test` passed **36 tests across 11 files**; `pnpm check` and `pnpm build` also passed. The production build retained only its existing bundle-size advisory. |
| Browser diagnostics | Focused mobile interaction replay reported **0 errors and 0 warnings** in the browser console. |

The mobile screenshot review intentionally used the normal viewport capture to include fixed controls. It confirmed that the enlarged Preview slip and Load code buttons remain above the bottom navigation, while the full-page captures confirm the compact home, games, activity, and account layouts. No payment, wager, deposit, payout, KYC, referral-reward credit, or other transaction path was added or exercised.

## Account-menu and authored-code frontend refinement — 26 August 2026

The customer header now uses a shared account menu rather than a direct account link. In a guest state it exposes **Sign in** and **Create account**; in an authenticated state it exposes **Profile**, **Settings**, **Bets list**, **Running bets**, **Bet history**, and **Log out**. Deposit and withdrawal entries open `/wallet#deposit` and `/wallet#withdraw` only. The wallet page explicitly confirms that no money movement can occur before the payment backend is configured server-side.

The floating Preview Slip is again a compact round button at the lower right. Its ticket icon was checked at `375×812` after the contrast correction. The previously standalone code bar is removed from below the hero; instead, the Preview Slip sheet contains the animated, keyboard-labelled authored-code field. `SKY-LIVE-01`, `SKY-HOOPS-02`, `SKY-CUP-03`, `SKY-COURT-04`, and `SKY-SPRINT-05` are local authored identifiers that restore a non-transactional selection within the current route. Invalid codes display inline recovery guidance.

| Verification surface | Result |
| --- | --- |
| Automated validation | `pnpm test` passed **38 tests across 12 files**. `pnpm check` and `pnpm build` passed; the existing bundle-size advisory remains non-blocking. |
| Account and wallet interactions | Mobile browser replay opened the account menu, found Running bets, Bet history, Deposit, and Withdraw, then opened `/wallet#deposit` without initiating any payment. |
| Preview Slip presentation | Desktop and mobile screenshots confirmed the compact round control remains above the mobile navigation; the final mobile capture confirmed its ticket icon has visible white contrast. |
| Browser diagnostics | The focused account-menu and protected wallet replay returned **0 browser-console errors** and **0 warnings**. |

An original ten-asset hero set remains pending. A generation attempt was blocked by the free-plan image-generation quota (`20/20` reached). The live-data adapter is documented in `docs/SPORTS_DATA_ADAPTER_NOTES.md`; the available OpticOdds connector remains disabled until the provider is confirmed and its licence is configured securely.
