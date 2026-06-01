import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProovCore, CircleManager, SessionManager, FuelFaucet } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const TWO_DAYS = 2 * 24 * 60 * 60;
const UPGRADE_ABI = ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"];

// Encode the upgradeToAndCall payload that the Timelock will forward to the proxy.
function encodeUpgrade(newImplAddress: string): string {
  return new ethers.Interface(UPGRADE_ABI).encodeFunctionData("upgradeToAndCall", [newImplAddress, "0x"]);
}

describe("TimelockController — Proov governance", function () {
  let owner:    HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let anyone:   HardhatEthersSigner;

  let timelock:        any;
  let timelockAddress: string;

  let proovCore:      ProovCore;
  let circleManager:  CircleManager;
  let sessionManager: SessionManager;
  let fuelFaucet:     FuelFaucet;

  beforeEach(async function () {
    [owner, attacker, anyone] = await ethers.getSigners();

    // Deploy all four proxies.
    const opts = { kind: "uups" as const };

    const ProovCoreFactory = await ethers.getContractFactory("ProovCore");
    proovCore = (await upgrades.deployProxy(ProovCoreFactory, [owner.address], {
      ...opts, initializer: "initialize",
    })) as unknown as ProovCore;
    await proovCore.waitForDeployment();

    const SessionManagerFactory = await ethers.getContractFactory("SessionManager");
    sessionManager = (await upgrades.deployProxy(
      SessionManagerFactory,
      [owner.address, await proovCore.getAddress()],
      { ...opts, initializer: "initialize" },
    )) as unknown as SessionManager;
    await sessionManager.waitForDeployment();

    const CircleManagerFactory = await ethers.getContractFactory("CircleManager");
    circleManager = (await upgrades.deployProxy(CircleManagerFactory, [owner.address], {
      ...opts, initializer: "initialize",
    })) as unknown as CircleManager;
    await circleManager.waitForDeployment();

    const FuelFaucetFactory = await ethers.getContractFactory("FuelFaucet");
    fuelFaucet = (await upgrades.deployProxy(FuelFaucetFactory, [owner.address], {
      ...opts, initializer: "initialize",
    })) as unknown as FuelFaucet;
    await fuelFaucet.waitForDeployment();

    // Deploy TimelockController.
    // proposers : [owner]          — will be replaced by Safe in production
    // executors : [address(0)]     — anyone may execute after the delay
    // admin     : owner            — renounced after Safe is set as proposer
    const TimelockFactory = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockFactory.deploy(
      TWO_DAYS,
      [owner.address],
      [ethers.ZeroAddress],
      owner.address,
    );
    await timelock.waitForDeployment();
    timelockAddress = await timelock.getAddress();

    // Transfer ownership of all four proxies to the Timelock.
    const ownableAbi = ["function transferOwnership(address) external"];
    for (const proxy of [proovCore, sessionManager, circleManager, fuelFaucet]) {
      const c = new ethers.Contract(await proxy.getAddress(), ownableAbi, owner);
      await (await c.transferOwnership(timelockAddress)).wait();
    }
  });

  // ── Ownership ─────────────────────────────────────────────────────────────────

  describe("ownership after transfer", function () {
    it("ProovCore owner is Timelock", async function () {
      expect(await proovCore.owner()).to.equal(timelockAddress);
    });

    it("SessionManager owner is Timelock", async function () {
      expect(await sessionManager.owner()).to.equal(timelockAddress);
    });

    it("CircleManager owner is Timelock", async function () {
      expect(await circleManager.owner()).to.equal(timelockAddress);
    });

    it("FuelFaucet owner is Timelock", async function () {
      expect(await fuelFaucet.owner()).to.equal(timelockAddress);
    });
  });

  // ── Access control ────────────────────────────────────────────────────────────

  describe("direct upgrade is blocked", function () {
    it("owner EOA cannot upgrade ProovCore directly", async function () {
      const Factory = await ethers.getContractFactory("ProovCore");
      await expect(
        upgrades.upgradeProxy(await proovCore.getAddress(), Factory)
      ).to.be.rejected;
    });

    it("attacker cannot upgrade ProovCore directly", async function () {
      const Factory = await ethers.getContractFactory("ProovCore", attacker);
      await expect(
        upgrades.upgradeProxy(await proovCore.getAddress(), Factory)
      ).to.be.rejected;
    });
  });

  describe("Timelock access control", function () {
    it("non-proposer cannot schedule an upgrade", async function () {
      const proxyAddress = await proovCore.getAddress();
      // Deploy impl separately so we have an address to use.
      const Factory  = await ethers.getContractFactory("ProovCore");
      const newImpl  = await Factory.deploy();
      await newImpl.waitForDeployment();
      const data     = encodeUpgrade(await newImpl.getAddress());
      const salt     = ethers.id("attacker-salt");

      await expect(
        timelock.connect(attacker).schedule(proxyAddress, 0, data, ethers.ZeroHash, salt, TWO_DAYS)
      ).to.be.reverted;
    });
  });

  // ── Upgrade flow ──────────────────────────────────────────────────────────────

  describe("timelocked upgrade flow — ProovCore", function () {
    let proxyAddress: string;
    let newImplAddress: string;
    let upgradeData: string;
    let salt: string;

    beforeEach(async function () {
      proxyAddress = await proovCore.getAddress();

      // Deploy a fresh implementation (same bytecode, different address — valid upgrade target).
      const Factory = await ethers.getContractFactory("ProovCore");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      newImplAddress = await newImpl.getAddress();
      upgradeData    = encodeUpgrade(newImplAddress);
      salt           = ethers.id(`test-upgrade-${Date.now()}`);
    });

    it("cannot execute immediately after scheduling", async function () {
      await timelock.connect(owner).schedule(
        proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, TWO_DAYS
      );
      await expect(
        timelock.connect(owner).execute(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt)
      ).to.be.reverted;
    });

    it("cannot execute before the full delay", async function () {
      await timelock.connect(owner).schedule(
        proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, TWO_DAYS
      );
      await time.increase(TWO_DAYS - 60); // one minute short
      await expect(
        timelock.connect(owner).execute(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt)
      ).to.be.reverted;
    });

    it("executes after the 2-day delay and updates the implementation", async function () {
      const implBefore = await upgrades.erc1967.getImplementationAddress(proxyAddress);

      await timelock.connect(owner).schedule(
        proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, TWO_DAYS
      );
      await time.increase(TWO_DAYS + 1);

      await expect(
        timelock.connect(anyone).execute(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt)
      ).to.not.be.reverted;

      const implAfter = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      expect(implAfter.toLowerCase()).to.equal(newImplAddress.toLowerCase());
      expect(implAfter.toLowerCase()).to.not.equal(implBefore.toLowerCase());
    });

    it("anyone can execute once the delay has passed (open executor role)", async function () {
      await timelock.connect(owner).schedule(
        proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, TWO_DAYS
      );
      await time.increase(TWO_DAYS + 1);

      // `attacker` address holds no special role — should still be able to execute
      // because executors is set to address(0) (open).
      await expect(
        timelock.connect(attacker).execute(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt)
      ).to.not.be.reverted;
    });

    it("cancelled upgrade cannot execute even after the delay", async function () {
      await timelock.connect(owner).schedule(
        proxyAddress, 0, upgradeData, ethers.ZeroHash, salt, TWO_DAYS
      );

      const opId = await timelock.hashOperation(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt);
      await timelock.connect(owner).cancel(opId);

      await time.increase(TWO_DAYS + 1);

      await expect(
        timelock.connect(owner).execute(proxyAddress, 0, upgradeData, ethers.ZeroHash, salt)
      ).to.be.reverted;
    });
  });

  // ── Safe handoff ──────────────────────────────────────────────────────────────

  describe("Safe multisig handoff", function () {
    it("owner can grant PROPOSER_ROLE to a Safe and revoke their own", async function () {
      const safe = attacker.address; // stand-in for a Safe address in tests

      const PROPOSER_ROLE  = await timelock.PROPOSER_ROLE();
      const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();

      await timelock.connect(owner).grantRole(PROPOSER_ROLE, safe);
      await timelock.connect(owner).grantRole(CANCELLER_ROLE, safe);
      await timelock.connect(owner).revokeRole(PROPOSER_ROLE, owner.address);
      await timelock.connect(owner).revokeRole(CANCELLER_ROLE, owner.address);

      expect(await timelock.hasRole(PROPOSER_ROLE, safe)).to.be.true;
      expect(await timelock.hasRole(PROPOSER_ROLE, owner.address)).to.be.false;
    });

    it("owner EOA cannot propose after handing off to Safe", async function () {
      const safe = attacker.address;
      const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();

      await timelock.connect(owner).grantRole(PROPOSER_ROLE, safe);
      await timelock.connect(owner).revokeRole(PROPOSER_ROLE, owner.address);

      const proxyAddress = await proovCore.getAddress();
      const Factory      = await ethers.getContractFactory("ProovCore");
      const newImpl      = await Factory.deploy();
      await newImpl.waitForDeployment();
      const data = encodeUpgrade(await newImpl.getAddress());

      await expect(
        timelock.connect(owner).schedule(
          proxyAddress, 0, data, ethers.ZeroHash, ethers.id("post-handoff-salt"), TWO_DAYS
        )
      ).to.be.reverted;
    });
  });
});
