export const agentPolicyRegistryAbi = [
  {
    type: "function",
    name: "createPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "approvalThreshold", type: "uint256" },
      { name: "receiptRequired", type: "bool" }
    ],
    outputs: [{ name: "policyId", type: "uint256" }]
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "policyId", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "maxPerTx", type: "uint256" },
          { name: "dailyLimit", type: "uint256" },
          { name: "approvalThreshold", type: "uint256" },
          { name: "receiptRequired", type: "bool" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "updatePolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "approvalThreshold", type: "uint256" },
      { name: "receiptRequired", type: "bool" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "deactivatePolicy",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: []
  },
  {
    type: "event",
    name: "PolicyCreated",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "maxPerTx", type: "uint256", indexed: false },
      { name: "dailyLimit", type: "uint256", indexed: false },
      { name: "approvalThreshold", type: "uint256", indexed: false },
      { name: "receiptRequired", type: "bool", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "maxPerTx", type: "uint256", indexed: false },
      { name: "dailyLimit", type: "uint256", indexed: false },
      { name: "approvalThreshold", type: "uint256", indexed: false },
      { name: "receiptRequired", type: "bool", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PolicyDeactivated",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true }
    ]
  }
] as const;

export const agentPaymentGuardAbi = [
  { type: "function", name: "policyPaused", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }], outputs: [] },
  { type: "event", name: "PolicyPauseChanged", inputs: [{ name: "policyId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "paused", type: "bool", indexed: false }] },
  { type: "function", name: "policyRegistry", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "approveAgent", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "agent", type: "address" }], outputs: [] },
  { type: "function", name: "revokeAgent", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "agent", type: "address" }], outputs: [] },
  { type: "function", name: "allowService", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "service", type: "address" }], outputs: [] },
  { type: "function", name: "removeService", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "service", type: "address" }], outputs: [] },
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "policyId", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "recipient", type: "address" }], outputs: [] },
  { type: "function", name: "createIntent", stateMutability: "nonpayable", inputs: [{ name: "policyId", type: "uint256" }, { name: "receiver", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiry", type: "uint256" }, { name: "reasonHash", type: "bytes32" }, { name: "decisionRoot", type: "bytes32" }, { name: "preReceiptRoot", type: "bytes32" }], outputs: [{ name: "intentHash", type: "bytes32" }] },
  { type: "function", name: "approveIntent", stateMutability: "nonpayable", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "executeIntent", stateMutability: "nonpayable", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "cancelIntent", stateMutability: "nonpayable", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "expireIntent", stateMutability: "nonpayable", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "finalizeReceiptRoot", stateMutability: "nonpayable", inputs: [{ name: "intentHash", type: "bytes32" }, { name: "receiptRoot", type: "bytes32" }], outputs: [] },
  { type: "function", name: "getBalance", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }], outputs: [{ name: "available", type: "uint256" }, { name: "reserved", type: "uint256" }] },
  { type: "function", name: "spentToday", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getIntent", stateMutability: "view", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "intentHash", type: "bytes32" }, { name: "policyId", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "agent", type: "address" }, { name: "receiver", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiry", type: "uint256" }, { name: "reservedDay", type: "uint256" }, { name: "executedAt", type: "uint256" }, { name: "reasonHash", type: "bytes32" }, { name: "decisionRoot", type: "bytes32" }, { name: "preReceiptRoot", type: "bytes32" }, { name: "finalReceiptRoot", type: "bytes32" }, { name: "state", type: "uint8" }, { name: "ownerApproved", type: "bool" }] }] },
  { type: "function", name: "getPayment", stateMutability: "view", inputs: [{ name: "intentHash", type: "bytes32" }], outputs: [{ name: "receiver", type: "address" }, { name: "amount", type: "uint256" }, { name: "executedAt", type: "uint256" }, { name: "preReceiptRoot", type: "bytes32" }, { name: "finalReceiptRoot", type: "bytes32" }] },
  { type: "function", name: "nextNonce", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approvedAgents", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }, { name: "agent", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowedServices", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }, { name: "service", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "previewIntent", stateMutability: "view", inputs: [{ name: "policyId", type: "uint256" }, { name: "agent", type: "address" }, { name: "receiver", type: "address" }, { name: "amount", type: "uint256" }, { name: "expiry", type: "uint256" }], outputs: [{ name: "allowed", type: "bool" }, { name: "needsApproval", type: "bool" }, { name: "reason", type: "bytes32" }] },
  { type: "event", name: "PaymentIntentCreated", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "policyId", type: "uint256", indexed: true }, { name: "nonce", type: "uint256", indexed: true }, { name: "agent", type: "address", indexed: false }, { name: "receiver", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "expiry", type: "uint256", indexed: false }, { name: "reasonHash", type: "bytes32", indexed: false }, { name: "decisionRoot", type: "bytes32", indexed: false }, { name: "preReceiptRoot", type: "bytes32", indexed: false }, { name: "state", type: "uint8", indexed: false }] },
  { type: "event", name: "PaymentApproved", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "owner", type: "address", indexed: true }] },
  { type: "event", name: "PaymentExecuted", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "policyId", type: "uint256", indexed: true }, { name: "agent", type: "address", indexed: true }, { name: "receiver", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "nonce", type: "uint256", indexed: false }, { name: "preReceiptRoot", type: "bytes32", indexed: false }] },
  { type: "event", name: "PaymentCancelled", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "policyId", type: "uint256", indexed: true }, { name: "caller", type: "address", indexed: true }] },
  { type: "event", name: "PaymentExpired", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "policyId", type: "uint256", indexed: true }] },
  { type: "event", name: "PaymentReceiptRootFinalized", inputs: [{ name: "intentHash", type: "bytes32", indexed: true }, { name: "receiptRoot", type: "bytes32", indexed: true }] },
  { type: "event", name: "AgentPermissionChanged", inputs: [{ name: "policyId", type: "uint256", indexed: true }, { name: "agent", type: "address", indexed: true }, { name: "approved", type: "bool", indexed: false }] },
  { type: "event", name: "ServicePermissionChanged", inputs: [{ name: "policyId", type: "uint256", indexed: true }, { name: "service", type: "address", indexed: true }, { name: "allowed", type: "bool", indexed: false }] },
  { type: "event", name: "Deposited", inputs: [{ name: "policyId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "newBalance", type: "uint256", indexed: false }] },
  { type: "event", name: "Withdrawn", inputs: [{ name: "policyId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "recipient", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "newBalance", type: "uint256", indexed: false }] }
] as const;

export const GALILEO_CHAIN_ID = 16602;
export const GALILEO_EXPLORER_URL = "https://chainscan-galileo.0g.ai";

/**
 * These are retained only as historical references. The deployment manifest
 * marks them legacy-galileo-v1-record-only and the escrow UI must not use the
 * old guard address with the Wave 3 ABI.
 */
export const legacyDeployment = {
  registry: "0x1128E66806605bCEf7836147C60a222CDa47cA53" as `0x${string}`,
  paymentGuard: "0x0cf76Ce76684AB75978dE7e27046Faf63dC7898A" as `0x${string}`
};

const configuredRegistry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS?.trim();
const configuredPaymentGuard = process.env.NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS?.trim();

export const contractAddresses = {
  registry: configuredRegistry as `0x${string}` | undefined,
  paymentGuard: configuredPaymentGuard as `0x${string}` | undefined
};

function isAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/.test(value));
}

function sameAddress(left: string | undefined, right: string) {
  return isAddress(left) && left.toLowerCase() === right.toLowerCase();
}

export function hasRegistryConfig() {
  return isAddress(contractAddresses.registry) && !sameAddress(contractAddresses.registry, legacyDeployment.registry);
}

export function hasPaymentGuardConfig() {
  return isAddress(contractAddresses.paymentGuard) && !sameAddress(contractAddresses.paymentGuard, legacyDeployment.paymentGuard);
}

export function deploymentStatus() {
  if (sameAddress(contractAddresses.paymentGuard, legacyDeployment.paymentGuard)) return "legacy" as const;
  if (!hasRegistryConfig() || !hasPaymentGuardConfig()) return "missing" as const;
  return "wave3" as const;
}
