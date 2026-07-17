# Apolo Mind

**Programmable spending control for autonomous AI agents on 0G.**

Apolo Mind is a policy-based payment safety layer for autonomous AI agents. It helps users give agents useful spending power without giving them unlimited wallet control.

As AI agents become part of daily life, they will not only answer questions. They will book services, buy API credits, pay for research, rent compute, access data, renew subscriptions, and act while the user is busy. That future is powerful, but it creates a very human fear: if an agent can spend for me, how do I know it will spend safely?

Apolo Mind exists for that moment. It turns agent payments from a blind permission into a controlled relationship: rules first, payment second, proof always.

## Why This Matters

Most people do not want to approve every tiny digital payment manually. A student may want an AI research agent to buy data access. A builder may want an agent to pay for inference, storage, or APIs. A small business may want an assistant to compare vendors, subscribe to useful SaaS tools, or pay for automation services.

Without a safety layer, users face two bad options:

- Approve every payment by hand, which removes the benefit of autonomy.
- Give the agent broad wallet access, which creates overspending, fraud, unknown receiver, and audit risks.

Apolo Mind creates the missing middle path. Users define spending boundaries once, approve trusted agents, allow trusted services, and keep receipts for what happened. The goal is not to slow agents down. The goal is to let them operate with responsibility.

## Problem

Autonomous agents increasingly need to pay for APIs, data, storage, compute, and SaaS tools. Wallets were designed for humans clicking buttons, not for software agents making repeated decisions on behalf of a user.

The risks are practical and immediate:

- An agent can overspend when a task loops or fails.
- A payment can go to an unknown or malicious receiver.
- A useful tool can become dangerous if the agent has no daily cap.
- A user may not remember why a payment happened.
- A business cannot audit agent actions without receipts and policy history.

In daily life, these failures are not abstract. They are the difference between a helpful assistant and a financial liability.

## Solution

Apolo Mind adds a policy safety layer between the user wallet and autonomous AI agents.

Users can:

- Create spending policies with per-transaction limits, daily limits, approval thresholds, and receipt requirements.
- Approve specific AI agent wallets.
- Allow trusted service receivers.
- Review research-payment requests with Nous-powered analysis.
- Store private payment context in Mind Vault.
- Generate proof-ready receipts for approved actions.
- Prepare for future on-chain identity, storage, and decentralized risk checks.

The product follows a simple principle: an AI agent should be able to help you act faster, but it should never get unlimited financial power by default.

## Daily Life Use Cases

Apolo Mind is built for ordinary agent-payment moments that will become common:

- **Research agent:** pays for a market data report, but only if the amount is below policy and the receiver is approved.
- **Developer agent:** buys API credits or storage while staying inside a daily budget.
- **Business assistant:** compares SaaS tools and prepares a payment record before renewal.
- **Data agent:** purchases datasets from approved providers and stores receipts for later review.
- **Personal productivity agent:** handles small recurring digital expenses without needing full wallet access.

Small payments at agent speed can become large risk. Apolo Mind makes those actions visible, bounded, and reviewable.

## Why 0G

0G is a strong fit for agentic payment workflows because policy execution, receipt storage, AI risk checks, and agent identity can live close to decentralized infrastructure.

Apolo Mind uses 0G as the trust foundation for the future version of the system:

- **0G Chain:** smart contracts for policy registry and payment receipt references.
- **0G Pay:** payment-flow concept for agent-triggered payments. In this demo, payments are not real transfers.
- **0G Storage:** receipt and log storage target. Current app uses demo-mode receipt URIs unless a real storage SDK is added.
- **0G Compute:** future target for decentralized risk checks. Current risk logic runs in the frontend and is marked compute-ready.
- **Agentic ID:** integration-ready identity layer for verified agent ownership and metadata. Current profile storage is local demo mode.

The project is intentionally honest about what is live and what is demo-mode. Smart contracts are deployed and frontend integration points are prepared. Storage, compute, 0G Pay, and ERC-7857 minting are marked as future or demo-mode where they are not fully wired yet.

## What Makes It Different

Apolo Mind is not just a wallet connect demo. It is a control model for agentic finance:

- **Policy before payment:** every request is checked against user-defined rules.
- **Identity before trust:** only approved agents can request spending.
- **Receiver allowlist:** agents cannot freely send funds to unknown addresses.
- **Context memory:** Mind Vault preserves reasoning and sensitive payment context locally.
- **Model-assisted review:** Pay Research uses Nous to summarize and recommend payment decisions.
- **Receipts as proof:** payment events can become auditable artifacts instead of disappearing into wallet history.

## Features

- Spending policy creation with max transaction, daily limit, approval threshold, and receipt requirement.
- AI agent approval and revocation.
- Service receiver allowlist and blocklist.
- Mind Vault with private capture, anonymized model view, local memory index, pattern mirror, ask-memory, proof hashes, and JSON export.
- Pay Research review powered by the configured Nous endpoint.
- AI-style risk analyzer with score, warnings, and recommended action.
- Receipt generation with full payload hash, mock tx hash, demo storage URI, and optional smart-contract `recordPayment` call.
- Agentic ID profile UI for future ERC-7857 support.
- One-click demo seed data.

## Demo Flow

1. Load demo data from `/dashboard`.
2. Review the demo policy: maxPerTx 5, dailyLimit 25, approvalThreshold 3, receipt required.
3. Review ResearchBot and MarketDataAPI.
4. Save agent-payment context in `/mind-vault`.
5. Run a research payment review in `/pay-research`.
6. Generate or inspect proof-ready receipt context.
7. Inspect receipt proof in `/receipts`.

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
- `/mind-vault`: private payment memory, anonymized model view, index, mirror, proof ledger, and export
- `/create-policy`: policy creation
- `/agents`: agent and service controls
- `/agentic-id`: Agentic ID profile UI
- `/pay-research`: Nous-powered research payment review
- `/receipts`: receipt proofs, filters, details, and JSON export
- `/demo`: judge-friendly walkthrough

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy Frontend on Vercel

This repository is ready for Vercel deployment from the project root. The included `vercel.json` tells Vercel to run the root build script and use the Next.js app inside `frontend`.

Recommended Vercel settings:

- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `frontend/.next`

Add these environment variables in Vercel Project Settings:

```bash
NEXT_PUBLIC_REGISTRY_ADDRESS=
NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ENABLE_REAL_0G_STORAGE=false
NOUS_API_KEY=
NOUS_API_BASE_URL=https://inference-api.nousresearch.com/v1
NOUS_MODEL=nousresearch/hermes-4-70b
```

Do not add `PRIVATE_KEY` to the frontend deployment unless you are intentionally running server-side contract deployment from Vercel. Contract deployment should usually stay local or in a protected CI environment.

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
NOUS_API_KEY=
NOUS_API_BASE_URL=https://inference-api.nousresearch.com/v1
NOUS_MODEL=nousresearch/hermes-4-70b
```

## Screenshots

Screenshots placeholder:

- Dashboard with demo seed data
- Mind Vault private memory flow
- Pay Research review
- Receipts proof modal
- Agentic ID profile page

## Future Roadmap

- Replace demo storage URI with real 0G Storage upload.
- Wire live 0G Pay transfer flow after policy approval.
- Move risk analyzer to 0G Compute for decentralized checks.
- Add ERC-7857 Agentic ID minting and encrypted metadata resolution.
- Add stronger test coverage for policy edge cases and daily limit windows.
- Add richer receipt search, export, and team audit workflows.

## Team / Builder Note

Apolo Mind is built as a focused hackathon prototype with a serious long-term direction: safer financial autonomy for AI agents. Real contract interactions are prepared and guarded by environment config; demo-mode features are clearly labeled to avoid overclaiming.

The emotional core of the project is simple: people should be able to benefit from autonomous agents without feeling that they have surrendered control of their money. Autonomy should feel useful, not dangerous. Apolo Mind is a step toward that safer daily-life agent economy.

## Latest 0G Galileo Deployment

Deployed on 0G Galileo Testnet, chain ID `16602`:

- AgentPolicyRegistry: `0x1128E66806605bCEf7836147C60a222CDa47cA53`
- AgentPaymentGuard: `0x0cf76Ce76684AB75978dE7e27046Faf63dC7898A`
- Explorer: `https://chainscan-galileo.0g.ai`

Deployment metadata is also stored in `deployments/0g-galileo.json`.
