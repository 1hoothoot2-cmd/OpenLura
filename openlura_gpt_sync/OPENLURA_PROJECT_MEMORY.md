OPENLURA PROJECT MEMORY

Project: OpenLura AI Chat App

==================================================
PROJECT IDENTITY
==================================================

OpenLura is a production-minded Next.js AI chat app focused on:

- strong UX
- fast perceived speed
- stable architecture
- learning from feedback
- search + sources
- image upload + image analysis
- analytics visibility
- admin control
- personal environment / private AI behavior
- future user-based learning

This is not a toy app.
This is a real AI product moving from advanced prototype into structured product architecture.

==================================================
CURRENT STATUS
==================================================

OpenLura is currently between the end of Phase 3 and the end of Phase 3.5.

Short version:
- Phase 1: complete
- Phase 2: complete
- Phase 3: almost complete
- Phase 3.5: functionally complete
- Phase 4: not started yet

The highest-impact next step is:
activate true personal AI learning inside /api/chat so private/personal feedback actually affects runtime behavior separately from global learning.

==================================================
PHASE OVERVIEW
==================================================

Phase 1: COMPLETE
Focus:
- stable chat flow
- stable image upload
- image analysis
- search + sources
- mobile + desktop stability

Result:
- OpenLura became a stable chat product instead of a raw prototype

--------------------------------------------------

Phase 2: COMPLETE
Focus:
- speed improvements
- fast text path
- fast image path
- caching
- lighter prompt routing
- better perceived speed

Result:
- OpenLura became much faster and more responsive

--------------------------------------------------

Phase 3: ALMOST COMPLETE
Focus:
- style learning vs content learning separation
- learning control layer
- better response shaping
- cleaner routing for learned behavior

Current status:
- style learning and content learning are split
- learning control layer is added
- response style is influenced by active rules
- content preference routing is cleaned up

Still remaining before fully done:
- personal learning does not yet actively steer runtime AI behavior separately enough
- /api/chat still needs cleaner true separation between global learning and private/personal learning inputs

Phase 3 summary:
- architecture is mostly there
- final runtime learning activation is still missing

--------------------------------------------------

Phase 3.5: FUNCTIONALLY COMPLETE
Focus:
- auto debug system
- analytics stability
- admin/guest groundwork
- personal/private environment groundwork
- private sync groundwork

Current status:
- auto debug logging is active
- analytics filters work again
- admin/guest groundwork exists
- personal environment + private sync exists
- analytics connection exists
- personal route guard exists
- personal login flow exists
- redirect to /persoonlijke-omgeving works
- analytics opens in new tab from personal environment
- private chat is separated from general chat
- personal state sync via Supabase works
- computer ↔ phone linkage for personal environment works
- refresh remains in personal environment
- negative feedback and improvement feedback are working again
- desktop-only personal dashboard remains desktop-only

Still remaining before Phase 3.5 can be considered fully product-complete:
- logout is not yet a clean explicit UI flow
- private memory/chat sync is still single-account (“primary”)
- no true multi-user account model yet

Phase 3.5 summary:
- functionally working
- still missing final polish and account model evolution

--------------------------------------------------

Phase 4: NOT STARTED
Planned focus:
- true account system
- multi-user learning separation
- persistent per-user AI behavior
- stronger admin controls over learning
- account-aware memory and private chat models

Important:
- Do not start Phase 4 before finishing the remaining high-impact Phase 3 / 3.5 learning work

==================================================
CURRENTLY STABLE / WORKING
==================================================

These systems are currently working and should be protected:

- personal environment login flow
- redirect to /persoonlijke-omgeving
- personal route guard
- analytics in new tab from personal environment
- personal chat separated from general chat
- personal state sync via Supabase
- computer ↔ phone private environment linking
- refresh persistence inside personal environment
- negative feedback flow
- improvement feedback flow
- desktop-only personal dashboard behavior
- style learning / content learning split
- learning control layer
- response style active rules
- cleaned content preference routing
- auto debug logging
- analytics filters
- admin/guest groundwork
- personal environment groundwork
- analytics linkage

==================================================
CURRENT GAPS / NOT FULLY DONE
==================================================

These are the most important unfinished items:

1. Personal learning does not yet truly affect runtime AI behavior per account
2. Personal feedback is in the flow, but is not yet being used as a separate runtime learning source inside /api/chat
3. Logout is not yet a clean explicit UI flow
4. Personal memory/chat sync is still single-account ("primary")
5. There is no real multi-user model yet

==================================================
BEST NEXT STEP
==================================================

Highest-impact next step:

1. Read personal learning state inside /api/chat
2. Let personal feedback / memory weigh more strongly inside /persoonlijke-omgeving
3. Keep global learning and personal learning cleanly separated side by side
4. Only after that move toward true accounts / Phase 4

This is the correct next product step because:
- the private/personal environment already exists
- the feedback flow already exists
- the sync layer already exists
- the biggest missing value is runtime behavior separation

==================================================
ARCHITECTURE DIRECTION
==================================================

The correct architecture direction is:

- global learning remains shared product intelligence
- personal learning becomes private runtime bias
- admin/guest groundwork stays intact
- auto debug remains monitoring, not blind self-learning
- analytics remains visible and stable
- personal environment becomes the first true user-specific AI layer

Desired runtime hierarchy:
1. current user request
2. explicit personal/private learning state
3. global learning consensus
4. auto debug only as monitoring signal

==================================================
IMPORTANT RULES
==================================================

- Do not rewrite full files unless explicitly asked
- Always patch only
- Always preserve structure
- Always protect stable systems first
- Do not break analytics, feedback, auth, streaming, image flow, or personal environment routing
- Do not start Phase 4 early
- Finish runtime personal learning activation first

==================================================
SOURCE OF TRUTH FILES
==================================================

Current important files include:

- app/page.tsx
- app/api/chat/route.ts
- app/api/feedback/route.ts
- app/api/auth/route.ts
- app/api/personal-state/route.ts
- app/analytics/page.tsx
- personal environment page

Latest pasted file always overrides older uploaded context.

==================================================
CURRENT ONE-LINE STATUS
==================================================

Phase 3 is almost complete.
Phase 3.5 is functionally complete.
The highest-impact next step is activating true personal AI runtime learning inside /api/chat.