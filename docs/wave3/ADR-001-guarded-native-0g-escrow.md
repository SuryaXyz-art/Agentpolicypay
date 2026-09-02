# ADR-001: Guarded Native-0G Escrow

- **Status:** Accepted
- **Date:** 2026-08-29
- **Scope:** Apolo Mind 0G Bridge by AKINDO Wave 3 MVP
- **Decision owners:** Apolo Mind implementation team

## Context

The current `AgentPaymentGuard` records payment metadata but does not hold, transfer, intercept, or authorize funds. An agent can therefore bypass it through another wallet path, and a recorded payment is not evidence that a payment occurred. The Wave 3 MVP needs a payment path that actually controls the funds demonstrated to judges.

The MVP also needs meaningful 0G depth without claiming unsupported components. The audit identifies 0G Chain deployment as real but testnet-only, while Storage, Compute, Agentic ID, and 0G Pay are currently placeholders or future work.

## Decision

Implement a native-0G funded escrow/vault on 0G Chain. The policy owner deposits native 0G into a policy-scoped vault balance. An approved agent can create a narrowly defined native payment intent. The vault—not an unrelated EOA—checks the policy and performs the receiver transfer.

The vault will:

- keep available and reserved balances per policy;
- key agent/service permissions and daily spend by policy ID;
- use 18-decimal integer base units;
- assign a nonce and unique hash to every intent;
- enforce expiry, one-time state consumption, max-per-transaction, daily limits, active state, receiver allowlisting, and available balance;
- require exact owner approval for above-threshold intents;
- use checks-effects-interactions and reentrancy protection;
- expose only a fixed native transfer, with no arbitrary calldata or external target;
- let the owner deposit/withdraw available funds and deactivate/pause a policy; and
- record a `bytes32` receipt root after settlement, when Storage proof is available.

Real 0G Storage will hold canonical receipt JSON and return the root recorded by the vault. Real 0G Compute will provide advisory risk analysis. Compute output can escalate a request or add evidence, but it cannot bypass deterministic contract rules. Agentic ID and 0G Pay remain future work unless an official, currently supported integration is verified.

## Alternatives considered

### Keep the existing registry + metadata guard

Rejected. It does not control funds, cannot prevent bypass, and accepts self-asserted receipt metadata.

### Smart-account/session-key executor

Deferred. It can provide strong authority boundaries, but it adds account-module compatibility, key/session lifecycle, and deployment complexity. Escrow is smaller and easier to demonstrate and test for one native-0G payment.

### General-purpose vault with arbitrary calls

Rejected for the MVP. Arbitrary target/calldata turns a payment guard into a proxy and greatly expands the attack surface. Fixed native transfer to an allowlisted receiver is sufficient for the Wave 3 proof.

### Pre-settlement receipt required for every payment

Rejected as the default. A final receipt needs the actual settlement transaction hash. The MVP uses a post-settlement `finalizeReceiptRoot` step, cryptographically binding canonical receipt JSON to the executed intent and payment event. If proof is delayed or unavailable, the UI must show “settled, proof incomplete,” never “verified.”

### Add Agentic ID or 0G Pay now

Rejected. They are not required to prove the core escrow path and are not currently verified as supported integrations in the repository. Adding them would expand claims and scope before the payment path is credible.

## Consequences

### Positive

- The demonstrated funds are genuinely controlled by the contract execution path.
- Unauthorized agents, receivers, over-limit requests, expired intents, and replays can be rejected on chain.
- Escrow balance, daily spend, intent state, settlement, and receipt root have verifiable chain evidence.
- The design is small enough for focused unit, fuzz, and end-to-end tests.
- Chain + Storage + Compute gives a defensible 0G story without unsupported claims.

### Tradeoffs

- Owners must pre-fund the vault and understand that unrelated EOA funds are outside protection.
- Native 0G only is narrower than token payments or arbitrary agent actions.
- Receipt proof is two-step because Storage upload occurs outside the settlement transaction.
- Storage availability and canonical serialization must be handled by the proof page.
- Escrow introduces reserved-balance and cancellation/expiry lifecycle complexity.
- AI cannot make the product more permissive; useful AI output is limited to advisory risk and escalation.

## Implementation contract boundary

The target interface is documented in [ARCHITECTURE.md](ARCHITECTURE.md). The implementation must not silently add arbitrary calls, URI strings, unscoped permissions, floating-point amounts, or owner approval that is not bound to the exact intent hash.

## Validation before deployment

2026-09-01 clarification: emergency controls are policy-scoped, not controlled globally by any policy owner. Updated limits are rechecked at execution. A lowered threshold requires explicit hash-bound approval; a newly required missing pre-receipt requires cancellation/recreation. These corrections implement the original isolation/current-policy decision, not a broader payment model. The user's Aristotle deployment authorization permits the contract deployment gate; it does not certify unfinished Storage, Compute, or public-app release work.

This ADR is accepted only as an architecture decision; it is not evidence that the implementation exists. Before any deployment, the team must:

1. implement the vault and tests without modifying the product scope;
2. prove unauthorized/disallowed/replayed/expired payments fail;
3. prove receiver failure rolls back state and funds;
4. prove owner withdrawal cannot withdraw reservations;
5. integrate and verify real 0G Storage root/content binding;
6. integrate and label real 0G Compute as advisory;
7. deploy only after chain-ID/address checks and mainnet proof preparation; and
8. update the progress record with transaction, Storage, and Compute evidence.
