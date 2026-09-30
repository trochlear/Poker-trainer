# Astra Rebuild Spec — 4-Max NLHE Poker Trainer

## Mission
Rebuild the poker trainer **from scratch**. Do not patch or extend the current implementation. The existing app is only a reference for user requirements and known failure modes.

Primary goal: a reliable 4-max NLHE training web app that helps a beginner build real decision-making skill, starting with preflop fundamentals.

## Core priorities
1. Poker rules correctness
2. Training feedback correctness
3. Tablet/mobile usability
4. Persistence
5. Bot realism
6. Visual polish

Never pretend uncertain heuristics are GTO.

---

## 1) Game specification
- 4-max No-Limit Texas Hold'em
- Blinds: 50 / 100
- Starting stack: 10,000 each = 100BB
- Players:
  - Human
  - Bot A: TAG
  - Bot B: LAG
  - Bot C: Loose-passive / Calling Station
- Positions rotate correctly: CO / BTN / SB / BB
- Heads-up rules must be correct if only two players remain
- Real 52-card deck per hand, shuffled once
- Deal hole cards one card at a time
- Future board may be predetermined internally, but:
  - bot AI may not see future cards
  - trainer evaluator may not see future cards
  - bots may not see opponents' hole cards
- Correct support for:
  - fold
  - check
  - call
  - bet
  - raise
  - all-in
  - minimum raise rules
  - all-in runout
  - side pots
  - split pots
  - showdown
  - action order
  - blind rules

At showdown, reveal live hands. Folded hands remain hidden during play.

---

## 2) Architecture
Separate at minimum:

### A. Poker engine
Owns:
- deck
- deal
- positions
- blinds
- betting
- legal actions
- action order
- pot
- side pots
- showdown
- hand result
- hand history

### B. Bot engine
Owns bot behavior only.
Must not be the source of truth for "correct" human decisions.

### C. Training engine
Owns human decision evaluation.
May only use information available to the human at the time of decision.
Must never use actual opponent hole cards to grade the user's action.

### D. Persistence layer
Owns saved session/game state and schema migrations.

UI must not contain poker rules.

---

## 3) Device/UI requirements

### Hard requirement
Design **tablet and phone interfaces deliberately**, not as one layout with a few CSS tweaks.

Test at:
- 360×800
- 390×844
- 412×915
- 800×1280
- 1280×800
- 1366×768
- 1440×900

At browser zoom 100%:
- no page-level vertical scrolling during normal play
- app fits viewport
- only internal panels may scroll
- no seat, board, log, HUD, or action controls may overlap
- do not place floating logs or badges over seats
- action controls must never cover human hole cards

### Tablet landscape
Preferred layout:
- left/main: poker table + action controls
- narrow dedicated hand-log rail beside table OR fixed non-overlapping row
- right: tabbed side panel
  - Status
  - Session
  - History
  - Analysis

### Phone portrait
Preferred layout:
- top: compact header
- compact HUD
- current-hand log in its own dedicated row, not over table
- table
- large bottom action controls
- settings/info via modal or sheet

### Mobile touch targets
- Fold / Check-Call / Raise are the largest controls
- minimum 44px high
- raise amount input also large
- quick sizes:
  - 1/3 pot
  - 1/2 pot
  - 2/3 pot
  - pot
  - all-in
- chip amount rounded to 50

---

## 4) Save / restore
Persist across refresh:
- deck order
- board
- hole cards
- stacks
- positions
- pot
- street
- actor
- contributions
- full action history
- hand history
- session timer/settings
- trainer statistics

Use localStorage or IndexedDB with versioned schema.

Updating the app must not wipe a session if migration is feasible.
Only explicit New Game/New Session should reset.

---

## 5) Session flow
- Automatic next hand after hand completes
- default delay around 1.0–1.5 sec
- configurable bot delay
- configurable next-hand delay
- session stopping rules:
  - N minutes
  - until clock time
  - N hands
  - stop loss
  - profit target
  - player bust
  - manual pause
- if time expires mid-hand, finish current hand, then stop
- default recommended session: 20–30 minutes

---

## 6) Bot personalities
Bot A — TAG
- narrower preflop range
- disciplined
- moderate aggression

Bot B — LAG
- wider range
- higher aggression
- more bluffs

Bot C — Calling Station
- loose
- calls too much
- raises rarely
- almost no bluffing

Bot AI can be heuristic.
Do not label bot behavior as GTO.

---

## 7) Trainer philosophy
Beginner-first.

Flow:
1. User sees situation
2. User chooses
3. App gives immediate, short feedback
4. Game continues

Do not show the answer before the user acts.

Default feedback should be simple Korean:
- 🟢 좋은 선택
- 🟣 둘 다 가능
- 🟡 조금 아쉬움
- 🟠 실수
- 🔴 큰 실수
- ⚪ 정확한 채점 데이터 없음

Examples:

🟢 좋은 선택
추천: 250 레이즈
버튼에서는 이 패로 먼저 레이즈하는 것이 기본입니다.

🟣 둘 다 가능
추천: 콜 또는 레이즈
두 선택 모두 자주 사용되는 혼합 구간입니다.

⚪ 정확한 채점 데이터 없음
이 상황은 현재 데이터셋에 없습니다.
팟오즈 등 확실한 수학 정보만 제공합니다.

Professional terms should be secondary:
- "다시 레이즈 (3-bet)"
- detailed solver terminology behind a Details control only

---

## 8) GTO / strategy correctness
CRITICAL:
Never manufacture fake GTO precision.

Forbidden:
- calling a custom hand-strength heuristic "GTO"
- fake exact EV such as "-0.45 BB" without solver data
- grading mixed strategy as a single forced action
- calling borderline SB folds "Blunder"
- using opponent actual cards to grade a decision

Every strategy record should carry:
- source
- assumptions
- stack depth
- rake assumption
- open size / raise size assumptions
- spot identifier
- action frequencies
- confidence / provenance

If the app does not have verified data for a spot:
- do not grade it as Best/Mistake/Blunder
- show "정확한 채점 데이터 없음"

### Phase 1 preflop trainer
Focus first on unopened 100BB pots:
- CO first-in
- BTN first-in
- SB vs BB

Phase 2:
- BB vs CO open
- BB vs BTN open
- SB vs BTN open
- BTN vs CO open

Phase 3:
- versus 3-bet
- 4-bet pots

Start small and trustworthy.

Mixed strategies should be represented as frequencies where verified data exists, e.g.
- Raise 70%
- Fold 30%

Do not invent frequencies.

---

## 9) Postflop trainer
Version 1 must NOT pretend to solve postflop GTO.

Provide only mathematically defensible information first:
- pot size
- amount to call
- pot odds
- required equity
- outs where calculation is unambiguous
- approximate draw odds
- SPR

Example:
Opponent bets 500 into 1,000.
Calling 500 creates a final pot of 2,000.
Required equity = 25%.

Postflop GTO can be added later only with a reliable data/source layer.

---

## 10) Hand history
Save structured JSON per hand.

Each hand:
- hand id
- timestamp
- starting stacks
- positions
- hole cards
- blinds
- board cards
- every action
- pot before each action
- amount to call
- action size
- legal actions
- street
- showdown
- result
- human decisions
- trainer feedback

Each human decision:
- known state at decision time
- available actions
- chosen action
- recommended action if verified
- strategy frequencies if verified
- source spot id
- confidence/provenance

---

## 11) Session review
At session end show:
- duration
- hands played
- number of human preflop decisions
- good / mixed / inaccuracy / mistake / blunder / ungraded counts
- common recurring mistakes
- review-worthy hand IDs

Prioritize decision quality, not money won/lost.

Bad beats must not be labeled as mistakes.

Allow replay of selected hands.

---

## 12) Drill mode
Add a dedicated "Preflop Drill" mode separate from live game.

Initial drill:
- unopened pots only
- random valid 4-max positions
- random hole cards
- user chooses Fold / Call if relevant / Raise
- immediate feedback
- next question quickly
- track accuracy by position and hand class

This mode is for fast repetition of core patterns without waiting for full hands.

---

## 13) Tests
Poker engine unit tests:
- unique deck
- dealing
- blinds
- position rotation
- heads-up blind rules
- action order
- legal actions
- fold
- check
- call
- bet
- minimum raise
- re-raise
- all-in
- side pots
- split pots
- showdown

UI validation:
- screenshots / visual checks for every required viewport
- explicit no-overlap checks for:
  - top seat
  - hand-log rail
  - board
  - human seat
  - action controls
  - side panel

---

## 14) Development workflow
Do not rush directly into one giant HTML file.

First produce:
A. architecture
B. state model
C. hand-history schema
D. trainer strategy-data schema
E. tablet wireframe
F. phone wireframe
G. source/provenance plan for verified preflop data
H. exact scope of what will be graded vs left ungraded
I. implementation sequence

Then implement in stages:
1. poker engine + tests
2. tablet/phone layout prototype
3. persistence
4. bot engine
5. hand history
6. verified preflop strategy data layer
7. trainer UI
8. drill mode
9. session review
10. visual QA

---

## 15) Repository workflow
Work on a **new branch / clean rebuild path**, not by patching the current production UI.

Do not replace the live GitHub Pages version until:
- poker engine tests pass
- required viewports have been visually checked
- user explicitly approves replacing the current version

---

## 16) Final instruction
If any requirement above is technically wrong, poker-theoretically wrong, internally inconsistent, or likely to teach bad habits:
**do not implement it blindly.**
Explain the issue and propose a better design first.

The evaluator must be conservative: it is better to say "not enough verified data to grade this" than to confidently teach a false answer.
