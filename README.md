# AgentPolicy Pay

**Programmable spending control for autonomous AI agents on 0G.**

AgentPolicy Pay is a hackathon demo showing how users can give AI agents limited payment authority without giving them unlimited wallet control.

## Problem

Autonomous agents increasingly need to pay for APIs, data, storage, compute, and SaaS tools. Giving an agent broad wallet access is risky: it can overspend, pay unknown receivers, or act without a clear audit trail.

## Solution

AgentPolicy Pay adds a policy safety layer. Users create spending rules, approve agent wallets, allow service receivers, simulate payment requests, block risky payments, and generate verifiable receipts.

## Why 0G

0G is a strong fit for agentic payment workflows because policy execution, receipt storage, AI risk checks, and agent identity can live close to decentralized infrastructure.

## 0G Components Used

- **0G Chain:** smart contracts for policy registry and payment receipt references.
- **0G Pay:** payment-flow concept for agent-triggered payments. In this demo, payments are simulated.
- **0G Storage:** receipt/log storage target. Current app uses demo-mode receipt URIs unless a real storage SDK is added.
- **0G Compute:** future target for decentralized risk checks. Current risk module runs in the frontend and is marked compute-ready.
- **Agentic ID:** integration-ready identity layer for verified agent ownership and metadata. Current profile storage is local demo mode.

## Features

- Spending policy creation with max transaction, daily limit, approval threshold, and receipt requirement.
- AI agent approval and revocation.
- Service receiver allowlist and blocklist.
- Payment simulator with safe, overspend, unknown receiver, and vague-reason scenarios.
- AI-style risk analyzer with score, warnings, and recommended action.
- Receipt generation with full payload hash, mock tx hash, demo storage URI, and optional smart-contract `recordPayment` call.
- Agentic ID profile UI for future ERC-7857 support.
- One-click demo seed data.

## Demo Flow

1. Load demo data from `/dashboard`.
2. Review the demo policy: maxPerTx 5, dailyLimit 25, approvalThreshold 3, receipt required.
3. Review ResearchBot and MarketDataAPI.
4. Run a safe payment in `/payment-simulator`.
5. Run an overspend or unknown receiver attempt to see blocking.
6. Generate a receipt for an approved payment.
7. Inspect the receipt proof in `/receipts`.

## Architecture

```text
User -> Next.js UI -> Policy Engine / Risk Analyzer
                  -> Demo localStorage state
                  -> Wagmi/Viem contract writes when configured
                  -> AgentPolicyRegistry + AgentPaymentGuard on 0G Chain
                  -> Demo 0G Storage URI for receipt payloads
```

## Smart Contracts

- `AgentPolicyRegistry.sol`: create, update, deactivate, and read payment policies.
- `AgentPaymentGuard.sol`: approve/revoke agents, allow/remove services, check spend, track daily spend, and record payment receipts.

## Frontend Pages

- `/`: landing page
- `/dashboard`: metrics and demo seed loading
- `/create-policy`: policy creation
- `/agents`: agent and service controls
- `/agentic-id`: Agentic ID profile UI
- `/payment-simulator`: risk checks and receipt generation
- `/receipts`: receipt proofs, filters, details, and JSON export
- `/demo`: judge-friendly walkthrough

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy Contracts

```bash
cp .env.example .env
npm run compile
npm run deploy:0g
```

Set `.env` values first. Never commit private keys.

## Environment Variables

```bash
PRIVATE_KEY=
OG_RPC_URL=
OG_CHAIN_ID=
NEXT_PUBLIC_REGISTRY_ADDRESS=
NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ENABLE_REAL_0G_STORAGE=false
```

## Screenshots

Screenshots placeholder:

- Dashboard with demo seed data
- Payment simulator approved flow
- Receipts proof modal
- Agentic ID profile page

## Future Roadmap

- Replace demo storage URI with real 0G Storage upload.
- Wire live 0G Pay transfer flow after policy approval.
- Move risk analyzer to 0G Compute for decentralized checks.
- Add ERC-7857 Agentic ID minting and encrypted metadata resolution.
- Add contract tests for edge cases and daily limit windows.

## Team / Builder Note

Built as a focused hackathon prototype. Real contract interactions are prepared and guarded by environment config; demo-mode features are clearly labeled to avoid overclaiming.

## Latest 0G Galileo Deployment

Deployed on 0G Galileo Testnet, chain ID `16602`:

- AgentPolicyRegistry: `0x1128E66806605bCEf7836147C60a222CDa47cA53`
- AgentPaymentGuard: `0x0cf76Ce76684AB75978dE7e27046Faf63dC7898A`
- Explorer: `https://chainscan-galileo.0g.ai`

Deployment metadata is also stored in `deployments/0g-galileo.json`.
