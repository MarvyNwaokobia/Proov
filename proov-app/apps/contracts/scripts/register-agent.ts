import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, celoSepolia } from "viem/chains";

// ERC-8004 Identity Registry — from celopedia-skills ai-agents.md
const IDENTITY_REGISTRY_MAINNET = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const IDENTITY_REGISTRY_SEPOLIA = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const IDENTITY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

async function main() {
  const isMainnet = process.env.NETWORK === "mainnet";
  const chain = isMainnet ? celo : celoSepolia;
  const registry = isMainnet ? IDENTITY_REGISTRY_MAINNET : IDENTITY_REGISTRY_SEPOLIA;
  const rpc = isMainnet ? "https://forno.celo.org" : "https://forno.celo-sepolia.celo-testnet.org";

  if (!process.env.AGENT_PRIVATE_KEY) {
    throw new Error("AGENT_PRIVATE_KEY not set — create a dedicated agent wallet");
  }

  const account = privateKeyToAccount(`0x${process.env.AGENT_PRIVATE_KEY}` as `0x${string}`);
  console.log("Agent address:", account.address);

  const client = createWalletClient({ account, chain, transport: http(rpc) });

  const agentURI = process.env.AGENT_METADATA_URI ||
    "https://raw.githubusercontent.com/your-org/proov/main/agent-metadata.json";

  const hash = await client.writeContract({
    address: registry as `0x${string}`,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  console.log("Agent registered. tx:", hash);
  console.log("\nSave this to your .env:");
  console.log(`NEXT_PUBLIC_AGENT_ADDRESS=${account.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
