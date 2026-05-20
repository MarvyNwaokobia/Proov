import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProovCore, SessionManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SessionManager", function () {
  let proovCore: ProovCore;
  let sessionManager: SessionManager;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const HabitType = { FOCUS: 0, FITNESS: 1, READING: 2, HYDRATION: 3, SLEEP: 4, CUSTOM: 5 };
  const Frequency = { DAILY: 0, WEEKLY: 1 };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const ProovCoreFactory = await ethers.getContractFactory("ProovCore");
    proovCore = (await upgrades.deployProxy(ProovCoreFactory, [owner.address], {
      initializer: "initialize",
      kind: "uups",
      unsafeAllow: ["constructor"],
    })) as unknown as ProovCore;
    await proovCore.waitForDeployment();

    const SessionManagerFactory = await ethers.getContractFactory("SessionManager");
    sessionManager = (await upgrades.deployProxy(
      SessionManagerFactory,
      [owner.address, await proovCore.getAddress()],
      { initializer: "initialize", kind: "uups", unsafeAllow: ["constructor"] }
    )) as unknown as SessionManager;
    await sessionManager.waitForDeployment();

    await proovCore.setSessionManager(await sessionManager.getAddress());

    // Create a habit for user1 to use in sessions
    await proovCore.connect(user1).createHabit("Deep Work", HabitType.FOCUS, 5400, Frequency.DAILY);
  });

  describe("Deployment", function () {
    it("stores proovCore address", async function () {
      expect(await sessionManager.proovCore()).to.equal(await proovCore.getAddress());
    });

    it("has correct MIN_SESSION_SECONDS", async function () {
      expect(await sessionManager.MIN_SESSION_SECONDS()).to.equal(1500);
    });
  });

  describe("startSession", function () {
    it("starts a session and emits event", async function () {
      await expect(sessionManager.connect(user1).startSession(0))
        .to.emit(sessionManager, "SessionStarted")
        .withArgs(user1.address, 0, await time.latest().then((t) => t + 1));

      const s = await sessionManager.getActiveSession(user1.address);
      expect(s.active).to.be.true;
      expect(s.habitId).to.equal(0);
    });

    it("reverts if session already active", async function () {
      await sessionManager.connect(user1).startSession(0);
      await expect(
        sessionManager.connect(user1).startSession(0)
      ).to.be.revertedWith("SessionManager: session already active");
    });
  });

  describe("endSession — completed", function () {
    it("completes session if duration >= 25 min and calls ProovCore", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(1499); // next block will be at +1500

      await expect(sessionManager.connect(user1).endSession())
        .to.emit(sessionManager, "SessionCompleted")
        .withArgs(user1.address, 0, 1500);

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(1);
    });

    it("also emits SessionEnded on completion", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(1499);
      const tx = await sessionManager.connect(user1).endSession();
      const receipt = await tx.wait();
      const event = receipt?.logs.find((l: any) => l.fragment?.name === "SessionEnded");
      expect(event).to.not.be.undefined;
    });

    it("saves completed session to history", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(1800);
      await sessionManager.connect(user1).endSession();

      const history = await sessionManager.getHistory(user1.address);
      expect(history.length).to.equal(1);
      expect(history[0].completed).to.be.true;
    });

    it("clears active session after end", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(1500);
      await sessionManager.connect(user1).endSession();

      const s = await sessionManager.getActiveSession(user1.address);
      expect(s.active).to.be.false;
    });
  });

  describe("endSession — short (abandoned)", function () {
    it("emits SessionAbandoned and gives no streak credit for short session", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(599); // next block at +600

      await expect(sessionManager.connect(user1).endSession())
        .to.emit(sessionManager, "SessionAbandoned")
        .withArgs(user1.address, 0, 600);

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(0);
    });
  });

  describe("abandonSession", function () {
    it("saves partial session to history without credit", async function () {
      await sessionManager.connect(user1).startSession(0);
      await time.increase(300);
      await sessionManager.connect(user1).abandonSession();

      const history = await sessionManager.getHistory(user1.address);
      expect(history.length).to.equal(1);
      expect(history[0].completed).to.be.false;

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(0);
    });

    it("reverts if no active session", async function () {
      await expect(
        sessionManager.connect(user1).abandonSession()
      ).to.be.revertedWith("SessionManager: no active session");
    });
  });

  describe("endSession reverts", function () {
    it("reverts if no active session", async function () {
      await expect(
        sessionManager.connect(user1).endSession()
      ).to.be.revertedWith("SessionManager: no active session");
    });
  });

  describe("UUPS upgrade", function () {
    it("owner can upgrade the implementation", async function () {
      const SessionManagerV2 = await ethers.getContractFactory("SessionManager");
      await expect(upgrades.upgradeProxy(await sessionManager.getAddress(), SessionManagerV2, { unsafeAllow: ["constructor"] })).to.not.be.rejected;
    });
  });

  describe("ETH rejection", function () {
    it("reverts on direct ETH transfer", async function () {
      await expect(
        owner.sendTransaction({ to: await sessionManager.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.reverted;
    });
  });
});
