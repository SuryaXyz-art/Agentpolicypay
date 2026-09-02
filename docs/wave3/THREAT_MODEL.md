# Wave 3 MVP Threat Model

Status: architecture-freeze threat model. This is an implementation checklist, not a completed security audit.

## Assets and security objectives

Assets are native 0G deposited into policy vaults, policy authorization state, pending intent reservations, settlement history, receipt roots, and the owner/agent keys that initiate transactions.

Security objectives:

- only an eligible agent or owner can create/execute an intent for a policy;
- only allowlisted receivers receive funds;
- per-transaction, threshold, daily, active-policy, and available-balance rules are enforced by the vault;
- one intent can settle at most once;
- failed transfers do not consume balance or spend allowance;
- owner withdrawal cannot access reserved funds or another policy's funds;
- receipt proof is bound to the exact chain settlement and retrievable Storage content;
- advisory AI cannot bypass deterministic authorization; and
- browser/API compromise cannot silently turn local state into chain truth.

## Trust boundaries

| Boundary | Attacker capability | Control |
| --- | --- | --- |
| Owner wallet ↔ browser | Inject UI transaction parameters or trick the owner into signing | Show chain/policy/amount/receiver clearly; owner signature remains required; contract validates all facts |
| Agent runtime ↔ vault | Agent key may be stolen or malicious | Per-policy approval, receiver allowlist, limits, nonce/expiry, no arbitrary calldata, vault-only funds |
| Browser ↔ 0G Compute | Provider can return incorrect/high-risk/low-risk output or observe input | Treat output as advisory; hash evidence; hard limits remain on chain |
| Browser/server ↔ 0G Storage | Object may be missing, substituted, or malformed | Store `bytes32` root on chain; retrieve and canonicalize content; compare every payment field |
| Browser ↔ local storage | Wallet switching, shared browser, extension, XSS | Key cache by chain and owner; label drafts; read chain state before display; do not store secrets |
| App ↔ RPC | Stale/censored/malicious responses | Verify chain ID, confirmations, event/transaction fields, and independent proof reads |
| Vault ↔ receiver | Receiver fallback/reentrancy or reverting transfer | Checks-effects-interactions, reentrancy guard, exact native call, revert on failure |

## Threats and mitigations

### T1 — Payment bypass through an unrelated EOA

**Threat:** an agent sends native 0G directly from its own EOA and the UI calls it an Apolo-protected payment.

**Mitigation:** the MVP claims protection only for funds deposited in the vault. The proof page requires a vault `IntentExecuted` event and matching native transfer. Documentation and UI must explicitly say that unrelated EOA balances are outside scope.

### T2 — Unauthorized agent or service

**Threat:** an unapproved agent creates an intent, or an approved agent changes the receiver to an attacker.

**Mitigation:** permission mappings are keyed by policy ID; `msg.sender` is the agent; receiver must be nonzero and allowed under the same policy; execute rechecks permission and active state. Revocation blocks new and not-yet-executed intents according to the implementation decision, with the safer MVP behavior of rechecking revocation at execution.

### T3 — Limit bypass and daily accounting race

**Threat:** split payments, multiple pending intents, policy switching, or boundary timestamps exceed limits.

**Mitigation:** enforce `amount <= maxPerTx`, aggregate `dailySpent + amount + relevant reservations` against the policy's daily limit, key counters by policy ID and chain day, reserve funds at intent creation, and recheck current limits/balance at execution. Tests must cover exact boundary, midnight/day change, multiple policies, and concurrent pending intents.

### T4 — Threshold approval substitution

**Threat:** owner approves one intent and an agent reuses that approval for another amount, receiver, policy, or nonce.

**Mitigation:** approval is stored against the complete unique `intentHash`, not an agent or amount alone. The hash includes chain ID, vault, policy, nonce, agent, receiver, amount, expiry, reason hash, and decision root. Approval is owner-only and one-time.

### T5 — Replay or duplicate settlement

**Threat:** an intent transaction is submitted again, or an old signed/off-chain request is reused.

**Mitigation:** monotonic policy nonce plus unique intent hash; intent state is consumed on execution; only `READY` may execute; expiry is checked; duplicate hash creation and second execution revert. Do not use a client timestamp as the nonce.

### T6 — Expired or cancelled intent execution

**Threat:** a delayed agent executes after expiry or cancellation.

**Mitigation:** execute checks state and `block.timestamp <= expiry`; cancel/expire transitions release reservation and permanently prevent execution. `expireIntent` is permissionless after expiry so a stuck reservation can be cleared.

### T7 — Reentrancy or receiver failure

**Threat:** a receiver fallback reenters withdrawal/execute, or deliberately reverts after state changes.

**Mitigation:** no arbitrary external calls; use a reentrancy guard; update state, balances, reservation, and daily spend before the exact native transfer; revert on failed call. Solidity revert semantics restore all effects, including accounting. Add a reverting and reentrant receiver test.

### T8 — Owner withdrawal drains reserved or wrong-policy funds

**Threat:** owner withdraws funds backing a pending intent or passes another policy ID.

**Mitigation:** maintain separate available/reserved accounting per policy; withdraw only available balance; require policy owner and nonzero recipient; use exact policy ID in every mutation. Deactivation does not merge balances.

### T9 — Forged, substituted, or incomplete receipts

**Threat:** a caller supplies a fake URI/hash or stores a root for JSON describing a different payment.

**Mitigation:** receipt root is `bytes32`, not a URI; only an executed intent may finalize it; canonical JSON includes the intent hash and settlement fields; proof page retrieves Storage content and compares root and every field to chain event/transaction. A root without retrievable matching content is invalid.

### T10 — Storage availability or root mismatch

**Threat:** Storage is unavailable, content is deleted/unretrievable, or the app canonicalizes differently.

**Mitigation:** receipt proof is a separate finalization state; never label it verified until retrieval and canonical hash comparison pass. Define canonical JSON serialization and encoding before implementation. If `receiptRequired` is true, show settlement as complete but proof as incomplete until the root is finalized; a later repair flow may finalize the root without changing payment facts.

### T11 — AI manipulation or provider abuse

**Threat:** Compute says “safe” for a dangerous request, says “block” to cause denial of service, leaks request data, or the public API consumes provider quota.

**Mitigation:** AI can escalate or annotate only; the contract independently enforces policy. Use strict request schemas, bounded input/output, timeout, rate limits, authentication/signature or per-wallet quota at the API boundary, and audit provider errors. No AI response is a payment authorization.

### T12 — Wrong units and numeric precision

**Threat:** decimal UI values are rounded or interpreted as wei/base units incorrectly.

**Mitigation:** 18-decimal base-unit contract fields; decimal strings in the UI; bigint/`parseUnits`/`formatUnits`; no JavaScript `number` for money. Reject malformed, negative, zero, or excessive precision input before transaction creation.

### T13 — Wallet switching and stale local state

**Threat:** Account B sees Account A's local policy, or a stale cache causes a transaction for the wrong chain/policy.

**Mitigation:** cache key includes chain ID and checksummed/lowercase owner address; clear or rehydrate on account/network change; read policy and permissions from chain; label local drafts; proof page never reads local receipts as authority.

### T14 — Key and secret exposure

**Threat:** private keys, Compute credentials, or future Storage credentials are committed or shipped to the browser.

**Mitigation:** wallets sign through the provider; server secrets remain server-side and are excluded from Git; `.env` files and deployment secret patterns are ignored; CI secret scanning is required before deployment. The MVP does not claim receipt confidentiality because plaintext JSON and browser localStorage are not private.

### T15 — Wrong network or contract

**Threat:** browser or deployment script points at Galileo, an attacker contract, or an unintended chain.

**Mitigation:** assert chain ID `16661` for the Wave 3 mainnet target before writes, pin deployed vault address/configuration, display network and contract address, verify source where supported, and require proof transactions from the configured address. Galileo remains testnet evidence only.

### T16 — Malicious or arbitrary calldata

**Threat:** an agent uses the vault as a generic proxy to drain funds or call tokens/bridges.

**Mitigation:** no target address supplied for arbitrary calls, no calldata, no delegatecall, no token method, and exactly one native transfer to the allowlisted receiver. General-purpose execution is explicitly out of MVP scope.

## Required security tests before deployment

### T17 — Cross-policy emergency control and stale-policy execution

**Threat:** an owner creates a cheap policy and globally pauses/unpauses other users, or an agent executes an existing intent under superseded max/approval/receipt rules.

**Mitigation:** pause state and pause events are keyed by policy ID, owner checks apply to both transitions, and other policies remain usable. Execution checks current policy limits and receipt requirements. A previously low-value intent that is now above threshold requires exact owner approval even when the executor is the owner. If a required pre-receipt root is absent, cancel and recreate; a root cannot be injected into an existing intent. Regression tests reproduce the original failures and cover recovery/rollback (`test/predeployment-security.ts`).

The 2026-09-01 pre-mainnet run passes 57 contract tests. This is not a third-party audit or proof of the untested browser/API controls listed below.

The implementation must test zero addresses, invalid policy limits, threshold greater than max, inactive policy, unapproved/revoked agent, disallowed receiver, max/daily boundaries, multiple pending reservations, approval substitution, replay, expiry, cancellation, wrong chain/domain inputs, owner-only actions, withdrawal isolation, receiver revert, receiver reentrancy, and receipt-root mismatch. It must also test API schema/rate-limit/timeout behavior and wallet/network cache invalidation.

## Residual risk and explicit non-goals

The owner can authorize a bad receiver or approve a bad high-value request; the contract cannot infer business intent. Native vault funds are not insured. RPC/Storage availability can delay proof. Compute may be unavailable or wrong. Receipt roots prove content binding, not that the content is truthful beyond its agreement with the chain settlement. Agentic ID, 0G Pay, privacy encryption, arbitrary token support, and unrelated EOA protection are non-goals for this MVP.
