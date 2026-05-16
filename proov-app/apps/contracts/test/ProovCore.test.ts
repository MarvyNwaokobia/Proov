import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProovCore } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ProovCore", function () {
  let proovCore: ProovCore;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let authorized: HardhatEthersSigner;

  const HabitType = { FOCUS: 0, FITNESS: 1, READING: 2, HYDRATION: 3, SLEEP: 4, CUSTOM: 5 };
  const Frequency = { DAILY: 0, WEEKLY: 1 };

  beforeEach(async function () {
    [owner, user1, user2, authorized] = await ethers.getSigners();
    const ProovCore = await ethers.getContractFactory("ProovCore");
    proovCore = await ProovCore.deploy();
    await proovCore.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the owner correctly", async function () {
      expect(await proovCore.owner()).to.equal(owner.address);
    });

    it("starts with zero users", async function () {
      expect(await proovCore.getUserCount()).to.equal(0);
    });
  });

  describe("Setup", function () {
    it("owner can set sessionManager", async function () {
      await proovCore.setSessionManager(authorized.address);
      expect(await proovCore.sessionManager()).to.equal(authorized.address);
    });

    it("owner can set circleManager", async function () {
      await proovCore.setCircleManager(authorized.address);
      expect(await proovCore.circleManager()).to.equal(authorized.address);
    });

    it("non-owner cannot set sessionManager", async function () {
      await expect(
        proovCore.connect(user1).setSessionManager(authorized.address)
      ).to.be.revertedWithCustomError(proovCore, "OwnableUnauthorizedAccount");
    });
  });

  describe("createHabit", function () {
    it("creates a habit and registers user", async function () {
      await proovCore.connect(user1).createHabit("Deep Work", HabitType.FOCUS, 5400, Frequency.DAILY);

      const habits = await proovCore.getHabits(user1.address);
      expect(habits.length).to.equal(1);
      expect(habits[0].name).to.equal("Deep Work");
      expect(habits[0].habitType).to.equal(HabitType.FOCUS);
      expect(habits[0].targetDuration).to.equal(5400);
      expect(habits[0].active).to.be.true;
      expect(await proovCore.getUserCount()).to.equal(1);
    });

    it("returns the new habit id", async function () {
      const tx = await proovCore.connect(user1).createHabit("Run", HabitType.FITNESS, 0, Frequency.DAILY);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((l: any) => l.fragment?.name === "HabitCreated");
      expect(event).to.not.be.undefined;
    });

    it("registers the user only once across multiple habits", async function () {
      await proovCore.connect(user1).createHabit("Habit 1", HabitType.FOCUS, 0, Frequency.DAILY);
      await proovCore.connect(user1).createHabit("Habit 2", HabitType.READING, 0, Frequency.DAILY);
      expect(await proovCore.getUserCount()).to.equal(1);
    });
  });

  describe("selfCompleteHabit", function () {
    beforeEach(async function () {
      await proovCore.connect(user1).createHabit("Morning Run", HabitType.FITNESS, 0, Frequency.DAILY);
    });

    it("records completion and starts a streak", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(1);
      expect(s.totalCompletions).to.equal(1);
    });

    it("builds streak on consecutive days", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400); // +1 day
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(2);
    });

    it("resets streak on gap", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400 * 2); // skip a day
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);

      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(1);
    });

    it("emits StreakBroken when gap occurs and previous streak existed", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400); // day 2
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400 * 3); // skip 2 days
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "StreakBroken")
        .withArgs(user1.address, 2);
    });

    it("tracks longestStreak", async function () {
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      // break streak
      await time.increase(86400 * 3);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);

      const s = await proovCore.getStats(user1.address);
      expect(s.longestStreak).to.equal(3);
      expect(s.currentStreak).to.equal(1);
    });

    it("emits MilestoneReached at 7 days", async function () {
      for (let i = 0; i < 6; i++) {
        await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
        await time.increase(86400);
      }
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "MilestoneReached")
        .withArgs(user1.address, 7);
    });

    it("reverts for inactive habit", async function () {
      await proovCore.connect(user1).deactivateHabit(0);
      await expect(
        proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash)
      ).to.be.revertedWith("ProovCore: habit inactive");
    });

    it("reverts for out-of-range habitId", async function () {
      await expect(
        proovCore.connect(user1).selfCompleteHabit(99, ethers.ZeroHash)
      ).to.be.revertedWith("ProovCore: habit not found");
    });
  });

  describe("completeHabit (authorized)", function () {
    beforeEach(async function () {
      await proovCore.setSessionManager(authorized.address);
      await proovCore.connect(user1).createHabit("Focus", HabitType.FOCUS, 5400, Frequency.DAILY);
    });

    it("authorized sessionManager can complete habit", async function () {
      await proovCore.connect(authorized).completeHabit(user1.address, 0, ethers.ZeroHash);
      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(1);
    });

    it("unauthorized address cannot call completeHabit", async function () {
      await expect(
        proovCore.connect(user2).completeHabit(user1.address, 0, ethers.ZeroHash)
      ).to.be.revertedWith("ProovCore: not authorized");
    });
  });

  describe("deactivateHabit", function () {
    it("deactivates and emits event", async function () {
      await proovCore.connect(user1).createHabit("Sleep", HabitType.SLEEP, 0, Frequency.DAILY);
      await expect(proovCore.connect(user1).deactivateHabit(0))
        .to.emit(proovCore, "HabitDeactivated")
        .withArgs(user1.address, 0);

      const habits = await proovCore.getHabits(user1.address);
      expect(habits[0].active).to.be.false;
    });
  });

  describe("logJournalEntry", function () {
    it("stores hash and increments journalCount", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("Today was great"));
      const tx = await proovCore.connect(user1).logJournalEntry(hash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const today = Math.floor(block!.timestamp / 86400);

      const s = await proovCore.getStats(user1.address);
      expect(s.journalCount).to.equal(1);
      expect(await proovCore.dailyJournalHash(user1.address, today)).to.equal(hash);
    });

    it("counts as daily activity for streak", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("entry"));
      await proovCore.connect(user1).logJournalEntry(hash);
      const s = await proovCore.getStats(user1.address);
      expect(s.currentStreak).to.equal(1);
    });
  });

  describe("getLeaderboard", function () {
    it("returns sorted leaderboard", async function () {
      await proovCore.connect(user1).createHabit("H", HabitType.FOCUS, 0, Frequency.DAILY);
      await proovCore.connect(user2).createHabit("H", HabitType.FOCUS, 0, Frequency.DAILY);

      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);
      await time.increase(86400);
      await proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash);

      await proovCore.connect(user2).selfCompleteHabit(0, ethers.ZeroHash);

      const [addrs, streaks] = await proovCore.getLeaderboard(10);
      expect(addrs[0]).to.equal(user1.address);
      expect(streaks[0]).to.equal(2);
      expect(addrs[1]).to.equal(user2.address);
      expect(streaks[1]).to.equal(1);
    });
  });

  describe("ETH rejection", function () {
    it("reverts on direct ETH transfer", async function () {
      await expect(
        owner.sendTransaction({ to: await proovCore.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.reverted;
    });
  });
});
