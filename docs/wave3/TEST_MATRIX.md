# Wave 3 Contract Test Matrix

Measured against the escrow implementation on the Hardhat in-memory network. The suite contains 57 passing tests (44 existing plus 13 pre-mainnet regressions) and no skipped tests.

## Requirement mapping

| Requirement | Test(s) |
| --- | --- |
| Valid policy creation and stored fields | `creates a valid policy with the expected fields` |
| Zero policy values | `rejects zero max and daily policy values` |
| Threshold above max / max above daily | `validates threshold <= maxPerTx <= dailyLimit` |
| Non-owner update/deactivation | `rejects non-owner policy updates and deactivation` |
| Missing/inactive policy behavior | `rejects reading a missing policy and deactivating an inactive policy`; `rejects intents for an inactive policy` |
| Agent approve/revoke per policy | `approves and revokes agents per policy` |
| Receiver allow/remove per policy | `allows and removes receivers per policy` |
| Zero address rejection | `rejects zero addresses for permissions and withdrawal` |
| Permission isolation | `isolates permissions and balances between policies`; `blocks unapproved agents and disallowed receivers` |
| Correct owner deposit credit | `credits deposits only to the policy owner's balance`; `isolates permissions and balances between policies` |
| Owner-only withdrawal | `allows only the policy owner to withdraw available balance`; `cannot withdraw another owner's policy balance` |
| Insufficient balance and reserved funds | `rejects insufficient balance at intent creation`; `does not allow withdrawal of reserved balance` |
| Successful native transfer | `executes a low-value intent and pays the receiver from guarded balance` |
| Receiver failure rollback | `rolls back state and balance when the receiver rejects the transfer`; `does not consume daily spend when execution fails` |
| Reentrancy protection | `rejects reentrancy from a receiver during payment` |
| Low-value intent readiness | `executes a low-value intent and pays the receiver from guarded balance`; `returns deterministic preview reasons for invalid and valid requests` |
| High-value pending state | `requires exact owner approval above the threshold`; `allows only the policy owner to approve a high-value intent` |
| Exact owner approval | `requires exact owner approval above the threshold`; `allows only the policy owner to approve a high-value intent` |
| Unapproved agent / disallowed receiver | `blocks unapproved agents and disallowed receivers` |
| Max-per-transaction limit | `rejects an amount above maxPerTx` |
| Daily limit exact boundary | `succeeds exactly at the daily limit and rejects one base unit over it` |
| Daily limit one-unit overflow | `succeeds exactly at the daily limit and rejects one base unit over it`; `returns a daily-limit preview reason when existing spend leaves insufficient allowance` |
| Expiry at creation and execution | `expires intents after their deadline`; `rejects an expired intent at execution` |
| Cancellation and reservation release | `prevents replay and releases reservations on cancellation` |
| Replay prevention | `prevents replay and releases reservations on cancellation`; `rejects an already executed intent` |
| Unique nonce/hash | `uses a fresh nonce and hash for repeated otherwise-identical requests` |
| Wrong execution caller | `rejects execution by a caller unrelated to the intent` |
| Inactive policy execution | `deactivation blocks an already-ready intent but allows fund recovery` |
| Required pre-execution receipt root | `requires a pre-execution receipt root when the policy requires it` |
| Failed execution preserves intent/spend | `rolls back state and balance when the receiver rejects the transfer`; `does not consume daily spend when execution fails` |
| Balance decreases exactly once | `executes a low-value intent and pays the receiver from guarded balance`; `rejects an already executed intent` |
| Receiver amount excluding sender gas | `executes a low-value intent and pays the receiver from guarded balance` |
| Daily spend after success only | `executes a low-value intent and pays the receiver from guarded balance`; `does not consume daily spend when execution fails` |
| Event/state consistency | `emits creation and execution fields matching the intent` |
| Day rollover | `handles day rollover with a fresh daily counter` |
| Multi-policy accounting isolation | `keeps daily spend isolated across policies`; `isolates permissions and balances between policies` |
| Receipt finalization one-time behavior | `attaches a final receipt root only once after execution`; `returns executed payment details and rejects payment reads before execution` |
| Pause safety | `pauses mutating vault actions without changing read state` |
| Direct transfer cannot bypass deposit accounting | `rejects untagged direct native transfers` |
| Pause does not affect another policy | `a policy owner's pause does not stop another policy's deposits or payments` |
| Another owner cannot clear emergency controls | `another policy owner cannot clear a paused policy's circuit breaker` |
| Paused preview, deposit and approval | `paused policies preview as ineligible and reject deposits and approvals` |
| Paused fund recovery | `paused policies permit cancellation and withdrawal of released funds` |
| Paused receipt finalization | `paused policies stop finalization without preventing it after unpause` |
| Pause authorization, repeated transitions, events | `pause transitions are owner-only, policy-scoped, and emit matching events` |
| Updated max-per-transaction limit | `execution rechecks a reduced maxPerTx and preserves funds and reservations on failure` |
| Updated approval threshold | `execution rechecks a lowered threshold even for owner execution` |
| Newly required approval is exact and one-time | `approval of a newly above-threshold READY intent is exact and one-time` |
| Updated receipt requirement | `execution rechecks a newly required pre-receipt root` |
| Updated daily limit/reservations | `execution rechecks a reduced daily limit including other reservations` |
| Cross-day pending reservation settlement | `a carried-over intent accounts against its execution day and releases its creation-day reservation` |

## Coverage evidence

Command: `npm run coverage`  
Tool: `solidity-coverage v0.8.17`  
Network: HardhatEVM `hardhat`  
Tests: **57 passing**

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| AgentPaymentGuard | 99.24% | 82.35% | 100% | 100% |
| AgentPolicyRegistry | 100% | 90.91% | 100% | 100% |
| All contracts including test mocks | 99.30% | 83.54% | 100% | 99.45% |

All executable lines in the two production contracts are covered; branch coverage is not complete. The creation-day/execution-day reservation paths are now both exercised. Remaining unselected vault branches include constructor/revocation zero-address cases, zero/inactive deposits, failed withdrawal transfer, invalid creation expiry/amount, missing-intent reads, expired/inactive approval, unauthorized/invalid cancellation and finalization, and some preview short-circuit arms. These are real remaining test gaps, not proof that every failure mode has been exercised. The duplicate intent-hash guard is defensive: a caller cannot supply/reuse a nonce because the contract increments it. Registry alternate modifier arms remain partially unselected. The reentrancy mock's line 26 is the only uncovered line. Review these gaps before describing the suite as exhaustive.

The new regression file is `test/predeployment-security.ts`. Against the pre-fix contracts it produced 4 passing/9 failing; after the corrections all 13 pass. The separate deployment rehearsal checks complete runtime bytecode and immutable constructor binding. See [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md); rehearsal is not mainnet proof.

Coverage artifacts are generated in the ignored `coverage/` directory and `coverage.json`; they are evidence from the command run, not source-of-truth release artifacts.
