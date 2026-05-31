import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
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
        .withArgs(user1.address, 0, "Deep Work", 0, 5400, 0, anyValue);
    });

    it("increments habitId per user across habits", async function () {
      await proovCore.connect(user1).createHabit("Habit A", 0, 0, 0);
      await expect(proovCore.connect(user1).createHabit("Habit B", 1, 0, 0))
        .to.emit(proovCore, "HabitCreated")
        .withArgs(user1.address, 1, "Habit B", 1, 0, 0, anyValue);
    });

    it("habit IDs restart at 0 for each user", async function () {
      await proovCore.connect(user1).createHabit("H1", 0, 0, 0);
      await expect(proovCore.connect(user2).createHabit("H2", 0, 0, 0))
        .to.emit(proovCore, "HabitCreated")
        .withArgs(user2.address, 0, "H2", 0, 0, 0, anyValue);
    });
  });

  describe("selfCompleteHabit", function () {
    it("emits HabitCompleted", async function () {
      await expect(proovCore.connect(user1).selfCompleteHabit(0, ethers.ZeroHash))
        .to.emit(proovCore, "HabitCompleted")
        .withArgs(user1.address, 0, 0, anyValue);
    });
  });

  describe("deactivateHabit", function () {
    it("emits HabitDeactivated", async function () {
      await expect(proovCore.connect(user1).deactivateHabit(0))
        .to.emit(proovCore, "HabitDeactivated")
        .withArgs(user1.address, 0, anyValue);
    });
  });

  describe("reactivateHabit", function () {
    it("emits HabitReactivated", async function () {
      await expect(proovCore.connect(user1).reactivateHabit(0))
        .to.emit(proovCore, "HabitReactivated")
        .withArgs(user1.address, 0, anyValue);
    });
  });

  describe("recordStreakIncrement", function () {
    it("emits StreakUpdated", async function () {
      await expect(proovCore.connect(user1).recordStreakIncrement(5))
        .to.emit(proovCore, "StreakUpdated")
        .withArgs(user1.address, 5, 5, anyValue);
    });

    it("emits MilestoneReached at 7", async function () {
      await expect(proovCore.connect(user1).recordStreakIncrement(7))
        .to.emit(proovCore, "MilestoneReached")
        .withArgs(user1.address, 7, anyValue);
    });

    it("emits MilestoneReached at all milestone values", async function () {
      for (const milestone of [21, 30, 50, 100, 200]) {
        await expect(proovCore.connect(user1).recordStreakIncrement(milestone))
          .to.emit(proovCore, "MilestoneReached")
          .withArgs(user1.address, milestone, anyValue);
      }
    });

    it("does NOT emit MilestoneReached for non-milestone values", async function () {
      await expect(proovCore.connect(user1).recordStreakIncrement(10))
        .not.to.emit(proovCore, "MilestoneReached");
    });
  });

  describe("Profile", function () {
    it("setUsername emits UsernameSet", async function () {
      await expect(proovCore.connect(user1).setUsername("alice"))
        .to.emit(proovCore, "UsernameSet")
        .withArgs(user1.address, "alice", anyValue);
    });

    it("editUsername emits UsernameSet", async function () {
      await expect(proovCore.connect(user1).editUsername("alice_v2"))
        .to.emit(proovCore, "UsernameSet")
        .withArgs(user1.address, "alice_v2", anyValue);
    });

    it("updateVisibility emits VisibilityUpdated", async function () {
      await expect(proovCore.connect(user1).updateVisibility("public"))
        .to.emit(proovCore, "VisibilityUpdated")
        .withArgs(user1.address, "public", anyValue);
    });
  });

  describe("logJournalEntry", function () {
    it("emits JournalLogged with the provided hash", async function () {
      const hash = ethers.keccak256(ethers.toUtf8Bytes("journal entry"));
      await expect(proovCore.connect(user1).logJournalEntry(hash))
        .to.emit(proovCore, "JournalLogged")
        .withArgs(user1.address, hash, anyValue);
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
