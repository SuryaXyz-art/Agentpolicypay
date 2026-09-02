import { preflight, safeFailure } from "./lib/deployment.ts";

// Read-only: compile, chain ID, signer address/balance, nonce, estimates. Never broadcasts.
preflight().then(() => console.log("Preflight passed. No transaction sent.")).catch(safeFailure);
