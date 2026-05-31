import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
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
    const Factory = await ethers.getContractFactory("CircleManager");
    circleManager = (await upgrades.deployProxy(Factory, [owner.address], {
      initializer: "initialize",
      kind: "uups",
    })) as unknown as CircleManager;
    await circleManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the owner correctly", async function () {
      expect(await circleManager.owner()).to.equal(owner.address);
    });
  });

  describe("sendRequest (compat stub)", function () {
    it("accepts call without reverting", async function () {
      await expect(circleManager.connect(alice).sendRequest(bob.address)).to.not.be.reverted;
    });
  });

  describe("acceptRequest", function () {
    it("emits MemberAdded with from/to and timestamp", async function () {
      await expect(circleManager.connect(bob).acceptRequest(alice.address))
        .to.emit(circleManager, "MemberAdded")
        .withArgs(alice.address, bob.address, anyValue);
    });

    it("different users can accept independently", async function () {
      await expect(circleManager.connect(alice).acceptRequest(carol.address))
        .to.emit(circleManager, "MemberAdded")
        .withArgs(carol.address, alice.address, anyValue);
    });
  });

  describe("sendCheer", function () {
    it("emits CheerSent", async function () {
      await expect(circleManager.connect(alice).sendCheer(bob.address))
        .to.emit(circleManager, "CheerSent")
        .withArgs(alice.address, bob.address, anyValue);
    });
  });

  describe("cheer (alias)", function () {
    it("emits CheerSent identically to sendCheer", async function () {
      await expect(circleManager.connect(alice).cheer(bob.address))
        .to.emit(circleManager, "CheerSent")
        .withArgs(alice.address, bob.address, anyValue);
    });
  });

  describe("removeFromCircle", function () {
    it("emits RemovedFromCircle", async function () {
      await expect(circleManager.connect(alice).removeFromCircle(bob.address))
        .to.emit(circleManager, "RemovedFromCircle")
        .withArgs(alice.address, bob.address, anyValue);
    });
  });

  describe("UUPS upgrade", function () {
    it("owner can upgrade the implementation", async function () {
      const V2 = await ethers.getContractFactory("CircleManager");
      await expect(upgrades.upgradeProxy(await circleManager.getAddress(), V2)).to.not.be.rejected;
    });

    it("non-owner cannot upgrade", async function () {
      const V2 = await ethers.getContractFactory("CircleManager", alice);
      await expect(
        upgrades.upgradeProxy(await circleManager.getAddress(), V2)
      ).to.be.rejectedWith(/OwnableUnauthorizedAccount/);
    });
  });
});
