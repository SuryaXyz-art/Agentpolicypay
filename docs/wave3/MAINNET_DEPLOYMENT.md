# Aristotle deployment gate — 2026-09-01

Status: `DEPLOYED_AND_VERIFIED` — both contracts are live on Aristotle mainnet, complete runtime bytecode matched the compiler output, explorer source verification succeeded, and a funded Chain/Storage payment proof is recorded. Legacy Galileo metadata was preserved separately.

## Confirmed target

The [official mainnet documentation](https://docs.0g.ai/developer-hub/mainnet/mainnet-overview) specifies chain ID **16661**, RPC `https://evmrpc.0g.ai`, explorer `https://chainscan.0g.ai`, and Storage indexer `https://indexer-storage-turbo.0g.ai`. Deployment preflight independently checked chain 16661, signer balance, pending nonce, gas limits, and the configured cost ceiling before submission.

`aristotle` is an explicit Hardhat network; it ignores Galileo's `OG_RPC_URL` and `OG_CHAIN_ID`. Both configured and RPC-reported IDs must match. The `og` alias remains Galileo-only. The compiler is pinned to Solidity 0.8.20, Paris EVM, optimizer 200, viaIR, preserving this repository's tested compiler output. No dependency or compiler upgrade was made. Paris bytecode does not require newer experimental opcodes. Explorer verification must use the exact settings, not blindly copy incompatible compiler/EVM combinations from examples.

## Safety corrections before immutable deployment

1. Any owner could previously pause/unpause every policy. Pause is now policy-scoped; only the matching owner can change it. Withdrawal of available funds, cancellation and expiry remain available. Receipt finalization waits until unpaused.
2. Execution previously failed to recheck updated max-per-transaction, threshold and receipt-required rules. All are now rechecked. If the threshold is lowered, a `READY` intent requires explicit owner approval. If a required root is missing, cancel and recreate with a real root.

The new regression file initially produced **4 passing / 9 failing** against the old implementation. After the fixes the complete suite produced **57 passing / 0 failing** (44 existing + 13 regressions). The original pause test was updated for the policy-scoped API; no test was skipped or weakened.

## Validation evidence

| Check | Actual result |
| --- | --- |
| `npm test` | 57 passing, exit 0 |
| `npm run coverage` | 57 passing, exit 0; 99.30% statements, 83.54% branches, 100% functions, 99.45% lines |
| Production vault coverage | 99.24% statements, 82.35% branches, 100% functions/lines |
| Registry coverage | 100% statements/functions/lines; 90.91% branches |
| `npm run compile` after coverage | Exit 0; normal, non-instrumented artifacts regenerated |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| Build with `NEXT_PUBLIC_OG_CHAIN_ID=16661` | Exit 0; 16 routes |
| `npm run deploy:rehearsal` | Exit 0 on ephemeral chain 31337; both runtime bytecodes matched, including vault registry immutable; linked registry read matched |
| `npm run preflight:aristotle` | Exit 0 with fresh deployer; balance `0.899830999999706 0G`; pinned maximum `0.014451590427096732 0G` under the `0.1 0G` cap |
| `npm run deploy:aristotle` | Exit 0; registry and guard receipts confirmed; full runtime bytecode matched; registry immutable read matched |
| `npm run verify:aristotle` | Exit 0; both contracts source-verified by ChainScan |
| Funded payment proof | Policy 1 deposited `0.02 0G`; guarded `0.001 0G` settlement produced exact receiver delta; unapproved `0.006 0G` intent rejected and cancelled |
| 0G Storage proof | Pre/final receipt roots matched local Merkle roots, proof-enabled retrieval succeeded, exact JSON content matched, and the final root was bound on chain |
| Negative deployment checks | Zero gas-budget cap rejected; Galileo RPC rejected when selected as Aristotle. Both stopped without broadcasting |
| `npm audit --omit=dev --json` | Exit 1: 34 findings (11 high, 23 moderate, 0 critical/low); lockfile unchanged |
| Git status/diff | Unavailable: workspace has no `.git` metadata |

Local rehearsal output is generated under ignored `artifacts/wave3/rehearsal-*.json` with `rehearsalOnly: true`. Its addresses and transactions are **not public-chain evidence**. Coverage output is ignored. Source-of-truth assertions are in `test/deploy.ts` and `test/predeployment-security.ts`.

## Deployment procedure

Use a dedicated deployer funded with native 0G on **Aristotle**, not Galileo. Configure `PRIVATE_KEY` only in the ignored root `.env` or a secure process environment. Do not paste the key into chat, put it in command arguments, reuse an owner/Storage key unnecessarily, or expose it via `NEXT_PUBLIC_*`. Never overwrite an existing `.env` with the example file.

```powershell
npm run compile
npm test
npm run preflight:aristotle
npm run deploy:aristotle
npm run verify:aristotle
```

Preflight is read-only. It checks signer balance/pending nonce, estimates **both** deployments before either is sent, and pins gas price and gas limits with 20% headroom each. Their combined maximum must fit the balance and `OG_MAX_DEPLOYMENT_COST` (default **0.1 0G**). This ceiling is not a spend target. No policy is funded and no service payment is made by this script.

The deploy script creates `deployments/0g-aristotle-wave3.json` exclusively before signing and records each submission hash, receipt, block, constructor arguments, compiler settings, actual gas, runtime hash and explorer links. It also saves standard compiler input JSON for exact source verification. It waits for two confirmations and compares complete runtime bytecode, substituting only the compiler-declared immutable registry slots. A final `policyRegistry()` read must match.

The [official verification API](https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts) is configured at `https://chainscan.0g.ai/open/api`. `verify:aristotle` rechecks chain, receipt and runtime before submission, and records `VERIFIED` only after the explorer accepts source verification. A bytecode match alone is not an explorer verification claim.

### Interrupted deployment

If a Wave 3 manifest already exists, deployment **refuses to send again**. Inspect its stage, nonce, predicted address and transaction hash against the same chain. A `SUBMITTING`/`PENDING` record can represent an uncertain successful broadcast: do not delete it or rerun blindly. Reconcile receipts first; resume only the missing contract with a reviewed transaction. This deliberately trades automatic retries for duplicate-spend prevention.

## Frontend handoff after real addresses exist

The local application build is configured with `NEXT_PUBLIC_OG_CHAIN_ID=16661`, registry `0x48d2A5661340ad0B44f36769F512dFC19773e55D`, and guard `0x94944FB6D36a70E14AF8B984C543E73d444D19A5`. The shared network module selects the matching wallet chain, RPC, write chain IDs and displayed network name. Receipt explorer links use the receipt's own chain; unknown-chain/mock records are not linked as mainnet transactions. Cross-network proof verification fails closed.

No public hosting deployment was performed. A separate funded Storage signer completed local mainnet upload/proof tests, but do not expose it through the public uploader yet: that route still lacks the authentication, rate limits and quota protections required by the threat model. Chain deployment does not fix API abuse, wallet-scoped cache reconciliation, browser proof retries, missing vault-funding UI, real Compute integration, or dependency findings. Those remain explicit public-release gates.

## Files changed in this deployment-preparation phase

- Contracts/tests: `contracts/AgentPaymentGuard.sol`, `test/deploy.ts`, `test/predeployment-security.ts`.
- Deployment/config: `hardhat.config.ts`, `scripts/deploy.ts`, `scripts/lib/deployment.ts`, `scripts/preflight.ts`, `scripts/verify-deployment.ts`, `scripts/rotate-signers.cjs`, `scripts/storage-smoke.cjs`, `scripts/mainnet-payment-smoke.cjs`, `package.json`, `tsconfig.json`, `.env.example`, `.gitignore`.
- Frontend network/write safeguards: `frontend/lib/network.ts`, `frontend/lib/wagmi.tsx`, `frontend/lib/contracts.ts`, `frontend/app/create-policy/page.tsx`, `frontend/app/agents/page.tsx`, `frontend/app/request-payment/page.tsx`, `frontend/app/receipts/page.tsx`, `frontend/components/ReceiptCard.tsx`.
- Documentation: `WAVE3_PROGRESS.md`, `README.md`, `docs/wave3/ARCHITECTURE.md`, `docs/wave3/THREAT_MODEL.md`, `docs/wave3/ADR-001-guarded-native-0g-escrow.md`, `docs/wave3/TEST_MATRIX.md`, this report.

The lockfile, dependencies, legacy deployment metadata and policy-registry behavior were not changed. No secret values were written into these files. Git-diff verification cannot be performed because this extracted workspace is not a Git worktree.

## Exact next gate

Add authentication/authorization, rate limits, quotas and abuse controls before exposing the funded Storage uploader; add vault-funding/proof-retry UI; reconcile browser state with chain events; and run the verified flow through the browser. Real 0G Compute and production dependency remediation remain separate gates.
