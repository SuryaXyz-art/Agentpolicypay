# Wave 3 Baseline (pre-escrow implementation)

Audit date: 29 August 2026  
Audit score: 46/100  
Scope: historical read-only baseline captured before the accepted escrow implementation; it is retained for comparison and does not describe the current contract implementation.

## Repository and Git state

The repository structure contains:

- `contracts/`: `AgentPolicyRegistry.sol` and `AgentPaymentGuard.sol`.
- `frontend/app/`: dashboard, policy, agents, research, receipts, Mind Vault, Agentic ID, demo, and API routes.
- `frontend/lib/`: contract bindings, policy engine, risk analyzer, receipt helper, 0G Storage placeholder, local storage, and wallet setup.
- `frontend/components/`: policy, agent, service, payment-request, receipt, risk, and stat components.
- `scripts/deploy.ts`, `test/deploy.ts`, `deployments/0g-galileo.json`, and the existing Next.js/Hardhat configuration.

No `AGENTS.md` was present. The workspace has no `.git` directory and no nearby parent `.git` directory, so current branch, baseline commit, and Git diff cannot be verified. The external audit referenced by this baseline is [ApoloMind-Full-Audit-2026-08-29 (1).md](C:/Users/msi/Downloads/ApoloMind-Full-Audit-2026-08-29%20(1).md); a same-named audit file is not present in the repository.

## Working features

- Next.js production build succeeds and currently generates 13 routes.
- ESLint and TypeScript checks pass.
- Two Solidity contracts compile with Solidity 0.8.20.
- The registry supports policy creation, update, deactivation, and policy reads.
- At this baseline, the guard supported global agent/service bookkeeping, `canSpend`, daily accounting, and record-only `recordPayment` metadata recording.
- Wallet-connected UI paths can submit policy/agent/service writes where implemented.
- A Galileo deployment metadata file records two contract addresses.
- The UI shell provides dashboard, policy, agent, service, research, receipt, Mind Vault, Agentic ID, and demo concepts.

These features are not equivalent to an end-to-end enforced payment system.

## Disconnected, mock, or non-enforcing features

- At this baseline, `AgentPaymentGuard.recordPayment` recorded metadata but did not transfer, escrow, intercept, or authorize funds.
- Approval thresholds are stored but are not enforced by the guard.
- There is no native/token payment execution path, smart-account executor, or escrow settlement.
- `evaluatePaymentRequest`, `analyzePaymentRisk`, receipt generation/saving, and `storeReceiptOn0G` are not connected into one user-facing payment route.
- `/demo` is a static checklist; it does not execute the claimed flow.
- `/pay-research` displays research/model output but does not read active policy state or create a payment receipt.
- Receipts use local browser storage and mock/demo proof values; no receipt is proven on 0G Storage.
- 0G Storage real mode deliberately throws; no 0G Storage SDK integration is present.
- No 0G Compute SDK/router integration is present.
- Agentic ID is local profile state with a user-selectable demo verification status.
- Local policy, agent, service, receipt, and vault state is not scoped by chain and wallet.
- Mind Vault raw text is plaintext browser storage; its proof helper is not a cryptographic commitment.
- `/api/pay-research` has no demonstrated authentication, rate limit, schema boundary, or quota control.

## Checks executed

Dependencies were installed with `npm ci` using the existing `package-lock.json`. The first attempt encountered a pre-existing partial `node_modules` cleanup error (`ENOTEMPTY`); that generated directory was isolated and `npm ci` was rerun. Installation emitted a React 19 peer-dependency warning involving `use-sync-external-store`.

| Command | Result | Baseline result |
| --- | --- | --- |
| `npm run lint` | Pass | exit 0 |
| `npm run typecheck` | Pass | exit 0 |
| `npm run build` | Pass | exit 0; Next.js 15.5.19; 13 routes |
| `npm run compile` | Pass | exit 0; 2 Solidity files; 8 typings |
| `npm test` | Pass | exit 0; 1 passing test |
| `npm audit --omit=dev` | Fail | exit 1; 77 vulnerabilities: 18 high, 41 moderate, 18 low |

`npm audit fix --force` was not run. The audit output indicates force-fix recommendations that include breaking upgrades.

## Current test count

There is one test file, [test/deploy.ts](../../test/deploy.ts), containing one passing test. It verifies only that a newly deployed guard stores the newly deployed registry address. There are no current behavior, security, replay, boundary, frontend, API, or end-to-end payment tests.

## Current Galileo deployment

From [deployments/0g-galileo.json](../../deployments/0g-galileo.json):

- Network: 0G Galileo Testnet
- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`
- `AgentPolicyRegistry`: `0x1128E66806605bCEf7836147C60a222CDa47cA53`
- `AgentPaymentGuard`: `0x0cf76Ce76684AB75978dE7e27046Faf63dC7898A`

The audit verified non-empty bytecode at both addresses. Exact source verification and meaningful payment activity were not verified.

## Missing Wave 3 proof and integrations

- No 0G mainnet deployment metadata, address, or transaction proof. The target mainnet chain is not represented in the current deployment metadata.
- No real 0G Storage upload/retrieval, encrypted receipt object, or root/content verification.
- No 0G Compute inference/provider call or reproducible result proof.
- No enforceable payment execution through escrow, a guarded smart account, or another settlement primitive.
- No atomic or cryptographically linked receipt proof tied to a real settlement.
- No reproducible approved-payment and blocked-payment mainnet evidence.
- No verified source links, direct transaction links, or wave Git-history evidence in this workspace.

## Baseline boundaries

This document records observed repository state and command results. It does not certify security, privacy, contract correctness, mainnet readiness, or production payment capability. Those claims require the proof described in [WAVE3_PROGRESS.md](../../WAVE3_PROGRESS.md).
