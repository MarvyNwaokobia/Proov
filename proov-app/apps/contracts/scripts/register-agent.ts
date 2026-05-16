import { createWalletClient, createPublicClient, http, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
dotenv.config();

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)",
]);

async function main() {
  console.log("\n🤖 Registering Proov Agent — Celo Mainnet");
  console.log("==========================================");

  if (!process.env.AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY not set in .env");
  if (!process.env.AGENT_METADATA_URI) throw new Error("AGENT_METADATA_URI not set in .env");

  const pk = process.env.AGENT_PRIVATE_KEY.startsWith("0x")
    ? process.env.AGENT_PRIVATE_KEY
    : `0x${process.env.AGENT_PRIVATE_KEY}`;

  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Agent wallet: ${account.address}`);
  console.log(`Balance:      ${formatEther(balance)} CELO`);

  if (balance === 0n) {
    throw new Error(`Agent wallet is empty. Send CELO to: ${account.address}`);
  }

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  console.log(`\nMetadata URI: ${process.env.AGENT_METADATA_URI}`);
  console.log("Sending registration transaction...");

  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY as `0x${string}`,
    abi: ABI,
    functionName: "register",
    args: [process.env.AGENT_METADATA_URI],
  });

  console.log(`Transaction: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ Agent registered on Celo Mainnet!`);
  console.log(`Block:  ${receipt.blockNumber}`);
  console.log(`Status: ${receipt.status}`);
  console.log(`\nView: https://celoscan.io/tx/${hash}`);
  console.log(`\n📋 Add to apps/web/.env.local:`);
  console.log(`NEXT_PUBLIC_AGENT_ADDRESS=${account.address}`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
