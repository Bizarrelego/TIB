## BOLT'S JOURNAL
## 2026-05-30 - [Engine API Abuse] Learning: Firing native intents (like pickup or transfer) when creeps are out of range returns ERR_NOT_IN_RANGE but wastes CPU evaluating the intent. Action: Prevent the native intent call by checking range first via creep.pos.getRangeTo(target) > 1, falling back to moveTo.
