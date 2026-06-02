import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProovCore } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ProovCore", function () {
  let proovCore: ProovCore;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ProovCore");
    proovCore = (await upgrades.deployProxy(Factory, [owner.address], {
      initializer: "initialize",
      kind: "uups",
    })) as unknown as ProovCore;
    await proovCore.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the owner correctly", async function () {
      expect(await proovCore.owner()).to.equal(owner.address);
    });
  });

  describe("createHabit", function () {
    it("emits HabitCreated with habitId 0 for first habit", async function () {
      await expect(proovCore.connect(user1).createHabit("Deep Work", 0, 5400, 0))
        .to.emit(proovCore, "HabitCreated")
        .withArgs(user1.address, 0, "Deep Work", 0, 5400, 0);
    });

    it("increments habitId per user across habits", async function () {
      await proovCore.connect(user1).createHabit("Habit A", 0, 0, 0);
      await expect(proovCore.connect(user1).createHabit("Habit B", 1, 0, 0))
        .to.emit(proovCore, "HabitCreated")
        .withArgs(user1.address, 1, "Habit B", 1, 0, 0);
    });

    it("habit IDs restart at 0 for each user", async function () {
      await proovCore.connect(user1).createHabit("H1", 0, 0, 0);
      await expect(proovCore.connect(user2).createHabit("H2", 0, 0, 0))
        .to.emit(proovCore, "HabitCreated")
        .withArgs(user2.address, 0, "H2", 0, 0, 0);
    });

    it("preserves packed streak fields across habit creations", async function () {
      await proovCore.connect(user1).createHabit("H1", 0, 0, 0);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await proovCore.connect(user1).createHabit("H2", 0, 0, 0);
      const stats = await proovCore.getUserStats(user1.address);
      expect(stats.habitCount).to.equal(2);
      expect(stats.currentStreak).to.equal(1);
    });
  });

  describe("selfCompleteHabit — streak logic", function () {
    beforeEach(async function () {
      // Create two habits so habitId 0 and 1 pass the bounds check.
      await proovCore.connect(user1).createHabit("Habit A", 0, 0, 0);
      await proovCore.connect(user1).createHabit("Habit B", 0, 0, 0);
    });

    it("emits HabitCompleted with streak=1 on first completion", async function () {
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "HabitCompleted")
        .withArgs(user1.address, 0, 1);
    });

    it("emits StreakUpdated on first completion", async function () {
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "StreakUpdated")
        .withArgs(user1.address, 1, 1);
    });

    it("does NOT emit StreakUpdated on second completion same day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await expect(proovCore.connect(user1).selfCompleteHabit(1, ethers.ZeroHash))
        .not.to.emit(proovCore, "StreakUpdated");
    });

    it("emits HabitCompleted with same streak on second completion same day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await expect(proovCore.connect(user1).selfCompleteHabit(1, ethers.ZeroHash))
        .to.emit(proovCore, "HabitCompleted")
        .withArgs(user1.address, 1, 1);
    });

    it("increments streak on consecutive day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "StreakUpdated")
        .withArgs(user1.address, 2, 2);
    });

    it("resets streak and emits StreakBroken after a missed day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400 * 2); // skip a day
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "StreakBroken")
        .withArgs(user1.address, 1);
    });

    it("streak restarts at 1 after a broken streak", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400 * 2);
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "StreakUpdated")
        .withArgs(user1.address, 1, 1);
    });

    it("does NOT emit StreakBroken on very first completion", async function () {
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .not.to.emit(proovCore, "StreakBroken");
    });

    it("reverts on habitId that was never created", async function () {
      await expect(proovCore.connect(user1).selfCompleteHabit(99, ethers.ZeroHash))
        .to.be.revertedWithCustomError(proovCore, "NotAuthorized");
    });

    it("reverts with AlreadyCompletedToday on same habit same day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.be.revertedWithCustomError(proovCore, "AlreadyCompletedToday");
    });

    it("allows completing a different habit on the same day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await expect(proovCore.connect(user1).selfCompleteHabit(1, ethers.ZeroHash))
        .to.emit(proovCore, "HabitCompleted");
    });

    it("allows completing the same habit again on the next day", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "HabitCompleted");
    });

    it("preserves longestStreak across a reset", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash); // streak=2
      await time.increase(86400 * 5); // miss days
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash); // streak=1
      const stats = await proovCore.getUserStats(user1.address);
      expect(stats.currentStreak).to.equal(1);
      expect(stats.longestStreak).to.equal(2);
    });

    it("emits MilestoneReached at streak 7", async function () {
      // Build up to 6 days
      for (let i = 0; i < 6; i++) {
        await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
        await time.increase(86400);
      }
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "MilestoneReached")
        .withArgs(user1.address, 7);
    });
  });

  describe("getUserStats", function () {
    it("returns zero values before any activity", async function () {
      const stats = await proovCore.getUserStats(user1.address);
      expect(stats.habitCount).to.equal(0);
      expect(stats.currentStreak).to.equal(0);
      expect(stats.longestStreak).to.equal(0);
      expect(stats.lastCompletionDay).to.equal(0);
    });

    it("reflects habit count and streak after activity", async function () {
      await proovCore.connect(user1).createHabit("H1", 0, 0, 0);
      await proovCore.connect(user1).createHabit("H2", 0, 0, 0);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      const stats = await proovCore.getUserStats(user1.address);
      expect(stats.habitCount).to.equal(2);
      expect(stats.currentStreak).to.equal(1);
    });
  });

  describe("recordStreakIncrement (no-op compat stub)", function () {
    it("accepts any value without reverting", async function () {
      await expect(proovCore.connect(user1).recordStreakIncrement(5)).to.not.be.reverted;
      await expect(proovCore.connect(user1).recordStreakIncrement(200)).to.not.be.reverted;
    });

    it("does not emit any events", async function () {
      const tx = await proovCore.connect(user1).recordStreakIncrement(7);
      const receipt = await tx.wait();
      expect(receipt!.logs.length).to.equal(0);
    });
  });

  describe("deactivateHabit", function () {
    it("emits HabitDeactivated", async function () {
      await expect(proovCore.connect(user1).deactivateHabit(0))
        .to.emit(proovCore, "HabitDeactivated")
        .withArgs(user1.address, 0);
    });
  });

  describe("reactivateHabit", function () {
    it("emits HabitReactivated", async function () {
      await expect(proovCore.connect(user1).reactivateHabit(0))
        .to.emit(proovCore, "HabitReactivated")
        .withArgs(user1.address, 0);
    });
  });

  describe("Profile", function () {
    it("setUsername emits UsernameSet", async function () {
      await expect(proovCore.connect(user1).setUsername("alice"))
        .to.emit(proovCore, "UsernameSet")
        .withArgs(user1.address, "alice");
    });

    it("updateVisibility emits VisibilityUpdated", async function () {
      await expect(proovCore.connect(user1).updateVisibility("public"))
        .to.emit(proovCore, "VisibilityUpdated")
        .withArgs(user1.address, "public");
    });
  });

  describe("logJournalEntry", function () {
    it("emits JournalLogged with the provided hash", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("journal entry"));
      await expect(proovCore.connect(user1).logJournalEntry(hash))
        .to.emit(proovCore, "JournalLogged")
        .withArgs(user1.address, hash);
    });
  });

  describe("Admin stubs", function () {
    it("owner can call setSessionManager", async function () {
      await expect(proovCore.setSessionManager(user1.address)).to.not.be.reverted;
    });

    it("owner can call setCircleManager", async function () {
      await expect(proovCore.setCircleManager(user1.address)).to.not.be.reverted;
    });

    it("non-owner cannot call setSessionManager", async function () {
      await expect(proovCore.connect(user1).setSessionManager(user2.address))
        .to.be.revertedWithCustomError(proovCore, "OwnableUnauthorizedAccount");
    });

    it("non-owner cannot call setCircleManager", async function () {
      await expect(proovCore.connect(user1).setCircleManager(user2.address))
        .to.be.revertedWithCustomError(proovCore, "OwnableUnauthorizedAccount");
    });
  });

  describe("UUPS upgrade", function () {
    it("owner can upgrade the implementation", async function () {
      const V2 = await ethers.getContractFactory("ProovCore");
      await expect(upgrades.upgradeProxy(await proovCore.getAddress(), V2)).to.not.be.rejected;
    });

    it("non-owner cannot upgrade", async function () {
      const V2 = await ethers.getContractFactory("ProovCore", user1);
      await expect(
        upgrades.upgradeProxy(await proovCore.getAddress(), V2)
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });
});
