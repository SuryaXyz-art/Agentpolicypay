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
  }
] as const;

export const agentPaymentGuardAbi = [
  { type: "function", name: "approveAgent", stateMutability: "nonpayable", inputs: [{ name: "agent", type: "address" }], outputs: [] },
  { type: "function", name: "revokeAgent", stateMutability: "nonpayable", inputs: [{ name: "agent", type: "address" }], outputs: [] },
  { type: "function", name: "allowService", stateMutability: "nonpayable", inputs: [{ name: "service", type: "address" }], outputs: [] },
  { type: "function", name: "removeService", stateMutability: "nonpayable", inputs: [{ name: "service", type: "address" }], outputs: [] },
  {
    type: "function",
    name: "recordPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "policyId", type: "uint256" },
      { name: "receiptUri", type: "string" },
      { name: "receiptHash", type: "bytes32" }
    ],
    outputs: [{ name: "paymentId", type: "uint256" }]
  },
  {
    type: "event",
    name: "PaymentRecorded",
    inputs: [
      { name: "paymentId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "policyId", type: "uint256", indexed: false },
      { name: "receiptUri", type: "string", indexed: false },
      { name: "receiptHash", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "function",
    name: "canSpend",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "policyId", type: "uint256" }
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "string" }
    ]
  }
] as const;

export const contractAddresses = {
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined,
  paymentGuard: process.env.NEXT_PUBLIC_PAYMENT_GUARD_ADDRESS as `0x${string}` | undefined
};

export function hasRegistryConfig() {
  return Boolean(contractAddresses.registry && contractAddresses.registry.startsWith("0x") && contractAddresses.registry.length === 42);
}

export function hasPaymentGuardConfig() {
  return Boolean(contractAddresses.paymentGuard && contractAddresses.paymentGuard.startsWith("0x") && contractAddresses.paymentGuard.length === 42);
}
