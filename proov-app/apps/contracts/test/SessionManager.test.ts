import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SessionManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SessionManager", function () {
  let sessionManager: SessionManager;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SessionManager");
    sessionManager = (await upgrades.deployProxy(
      Factory,
      [owner.address, ethers.ZeroAddress],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as SessionManager;
    await sessionManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the owner correctly", async function () {
      expect(await sessionManager.owner()).to.equal(owner.address);
    });
  });

  describe("startSession", function () {
    it("emits SessionStarted with habitId and timestamp", async function () {
      await expect(sessionManager.connect(user1).startSession(5))
        .to.emit(sessionManager, "SessionStarted")
        .withArgs(user1.address, 5, anyValue);
    });

    it("different users emit independent events", async function () {
      await expect(sessionManager.connect(user1).startSession(0))
        .to.emit(sessionManager, "SessionStarted")
        .withArgs(user1.address, 0, anyValue);
      await expect(sessionManager.connect(user2).startSession(1))
        .to.emit(sessionManager, "SessionStarted")
        .withArgs(user2.address, 1, anyValue);
    });
  });

  describe("endSession", function () {
    it("emits SessionCompleted with habitId and duration", async function () {
      await expect(sessionManager.connect(user1).endSession(3, 1800))
        .to.emit(sessionManager, "SessionCompleted")
        .withArgs(user1.address, 3, 1800);
    });

    it("records zero duration without reverting", async function () {
      await expect(sessionManager.connect(user1).endSession(0, 0))
        .to.emit(sessionManager, "SessionCompleted")
        .withArgs(user1.address, 0, 0);
    });
  });

  describe("abandonSession", function () {
    it("emits SessionAbandoned with habitId and partial duration", async function () {
      await expect(sessionManager.connect(user1).abandonSession(2, 300))
        .to.emit(sessionManager, "SessionAbandoned")
        .withArgs(user1.address, 2, 300);
    });
  });

  describe("recordProgress (compat stub)", function () {
    it("accepts call without reverting", async function () {
      await expect(sessionManager.connect(user1).recordProgress(0)).to.not.be.reverted;
    });
  });

  describe("UUPS upgrade", function () {
    it("owner can upgrade the implementation", async function () {
      const V2 = await ethers.getContractFactory("SessionManager");
      await expect(upgrades.upgradeProxy(await sessionManager.getAddress(), V2)).to.not.be.rejected;
    });

    it("non-owner cannot upgrade", async function () {
      const V2 = await ethers.getContractFactory("SessionManager", user1);
      await expect(
        upgrades.upgradeProxy(await sessionManager.getAddress(), V2)
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });
});
