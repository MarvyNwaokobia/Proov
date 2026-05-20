import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CircleManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CircleManager", function () {
  let circleManager: CircleManager;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    const CircleManagerFactory = await ethers.getContractFactory("CircleManager");
    circleManager = (await upgrades.deployProxy(CircleManagerFactory, [owner.address], {
      initializer: "initialize",
      kind: "uups",
      unsafeAllow: ["constructor"],
    })) as unknown as CircleManager;
    await circleManager.waitForDeployment();
  });

  describe("sendRequest", function () {
    it("sends a request and emits event", async function () {
      await expect(circleManager.connect(alice).sendRequest(bob.address))
        .to.emit(circleManager, "RequestSent")
        .withArgs(alice.address, bob.address);

      const pending = await circleManager.getPending(bob.address);
      expect(pending).to.include(alice.address);
    });

    it("reverts if sending to self", async function () {
      await expect(
        circleManager.connect(alice).sendRequest(alice.address)
      ).to.be.revertedWith("CircleManager: cannot add self");
    });

    it("reverts if already connected", async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await circleManager.connect(bob).acceptRequest(alice.address);
      await expect(
        circleManager.connect(alice).sendRequest(bob.address)
      ).to.be.revertedWith("CircleManager: already connected");
    });

    it("reverts if request already sent", async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await expect(
        circleManager.connect(alice).sendRequest(bob.address)
      ).to.be.revertedWith("CircleManager: request already sent");
    });
  });

  describe("acceptRequest", function () {
    beforeEach(async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
    });

    it("connects both users and emits RequestAccepted", async function () {
      await expect(circleManager.connect(bob).acceptRequest(alice.address))
        .to.emit(circleManager, "RequestAccepted")
        .withArgs(alice.address, bob.address);

      expect(await circleManager.connected(alice.address, bob.address)).to.be.true;
      expect(await circleManager.connected(bob.address, alice.address)).to.be.true;

      const aliceCircle = await circleManager.getCircle(alice.address);
      const bobCircle = await circleManager.getCircle(bob.address);
      expect(aliceCircle).to.include(bob.address);
      expect(bobCircle).to.include(alice.address);
    });

    it("also emits MemberAdded", async function () {
      await expect(circleManager.connect(bob).acceptRequest(alice.address))
        .to.emit(circleManager, "MemberAdded")
        .withArgs(bob.address, alice.address, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
    });

    it("clears pending request after accept", async function () {
      await circleManager.connect(bob).acceptRequest(alice.address);
      const pending = await circleManager.getPending(bob.address);
      expect(pending).to.not.include(alice.address);
    });

    it("reverts if no pending request", async function () {
      await expect(
        circleManager.connect(bob).acceptRequest(carol.address)
      ).to.be.revertedWith("CircleManager: no pending request");
    });
  });

  describe("rejectRequest", function () {
    it("clears pending without connecting", async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await expect(circleManager.connect(bob).rejectRequest(alice.address))
        .to.emit(circleManager, "RequestRejected")
        .withArgs(alice.address, bob.address);

      expect(await circleManager.connected(alice.address, bob.address)).to.be.false;
      const pending = await circleManager.getPending(bob.address);
      expect(pending.length).to.equal(0);
    });
  });

  describe("removeFromCircle", function () {
    beforeEach(async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await circleManager.connect(bob).acceptRequest(alice.address);
    });

    it("disconnects both and emits event", async function () {
      await expect(circleManager.connect(alice).removeFromCircle(bob.address))
        .to.emit(circleManager, "RemovedFromCircle")
        .withArgs(alice.address, bob.address);

      expect(await circleManager.connected(alice.address, bob.address)).to.be.false;
      expect(await circleManager.connected(bob.address, alice.address)).to.be.false;

      const aliceCircle = await circleManager.getCircle(alice.address);
      expect(aliceCircle).to.not.include(bob.address);
    });

    it("reverts if not connected", async function () {
      await expect(
        circleManager.connect(alice).removeFromCircle(carol.address)
      ).to.be.revertedWith("CircleManager: not connected");
    });
  });

  describe("witnessHabit", function () {
    beforeEach(async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await circleManager.connect(bob).acceptRequest(alice.address);
    });

    it("bob can witness alice's habit and emits event", async function () {
      await expect(circleManager.connect(bob).witnessHabit(alice.address, 0))
        .to.emit(circleManager, "WitnessAdded")
        .withArgs(alice.address, 0, bob.address);

      const w = await circleManager.getWitnesses(alice.address);
      expect(w.length).to.equal(1);
      expect(w[0].witness).to.equal(bob.address);
      expect(w[0].habitId).to.equal(0);
    });

    it("reverts if not in circle", async function () {
      await expect(
        circleManager.connect(carol).witnessHabit(alice.address, 0)
      ).to.be.revertedWith("CircleManager: not in circle");
    });
  });

  describe("cheer", function () {
    beforeEach(async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await circleManager.connect(bob).acceptRequest(alice.address);
    });

    it("emits CheerSent between circle members", async function () {
      await expect(circleManager.connect(alice).cheer(bob.address))
        .to.emit(circleManager, "CheerSent")
        .withArgs(alice.address, bob.address, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
    });

    it("reverts if not in circle", async function () {
      await expect(
        circleManager.connect(carol).cheer(alice.address)
      ).to.be.revertedWith("CircleManager: not in circle");
    });
  });

  describe("notifyStreakBroken", function () {
    it("emits StreakBrokenNotified with circle members", async function () {
      await circleManager.connect(alice).sendRequest(bob.address);
      await circleManager.connect(bob).acceptRequest(alice.address);

      await expect(circleManager.notifyStreakBroken(alice.address))
        .to.emit(circleManager, "StreakBrokenNotified")
        .withArgs(alice.address, [bob.address]);
    });
  });

  describe("MAX_CIRCLE_SIZE", function () {
    it("is 10", async function () {
      expect(await circleManager.MAX_CIRCLE_SIZE()).to.equal(10);
    });
  });

  describe("UUPS upgrade", function () {
    it("owner can upgrade the implementation", async function () {
      const CircleManagerV2 = await ethers.getContractFactory("CircleManager");
      await expect(upgrades.upgradeProxy(await circleManager.getAddress(), CircleManagerV2, { unsafeAllow: ["constructor"] })).to.not.be.rejected;
    });
  });

  describe("ETH rejection", function () {
    it("reverts on direct ETH transfer", async function () {
      await expect(
        owner.sendTransaction({ to: await circleManager.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.reverted;
    });
  });
});
