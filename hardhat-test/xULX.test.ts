import {ethers} from "hardhat";
import { ERC20Mock, ERC20Mock__factory, NewWETH, NewWETH__factory, Swapper, Swapper__factory, ULXMirrorWorld, ULXMirrorWorld__factory, UniswapDAO, UniswapDAO__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Router02, UniswapV2Router02__factory } from "../typechain-types";
import {expect} from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("xULX tests", () => {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
    let provider: any;

    let owner: SignerWithAddress;
    let treasuryAccount: SignerWithAddress;
    let account: SignerWithAddress;

    let factory: UniswapV2Factory;
    let dao: UniswapDAO;
    let router: UniswapV2Router02;
    let weth: NewWETH;
    let swapper: Swapper;
    let xUlx: ULXMirrorWorld;

    let token0: ERC20Mock;
    let token1: ERC20Mock;

    beforeEach(async () => {
        provider = ethers.provider;

        [ owner, treasuryAccount, account ] = await ethers.getSigners();

        const totalSupply = ethers.utils.parseEther("1000000");
        token0 = await (await new ERC20Mock__factory(owner).deploy("MyToken1", "MYT1", totalSupply)).deployed();
        token1 = await (await new ERC20Mock__factory(owner).deploy("MyToken2", "MYT2", totalSupply)).deployed();

        factory = await (await new UniswapV2Factory__factory(owner).deploy(owner.address, treasuryAccount.address)).deployed();

        dao = await (await new UniswapDAO__factory(owner).deploy(factory.address)).deployed();

        await expect(factory.connect(treasuryAccount).setDAOContractInitial(dao.address)).revertedWith("not daoSetter");
        await expect(factory.connect(owner).setDAOContractInitial(zeroAddress)).revertedWith("zero address");
        await expect(factory.connect(owner).setDAOContractInitial(owner.address)).revertedWith("EOA");
        await factory.connect(owner).setDAOContractInitial(dao.address);

        weth = await (await new NewWETH__factory(owner).deploy()).deployed();

        router = await (await new UniswapV2Router02__factory(owner).deploy(factory.address, weth.address)).deployed();
        
        await dao.connect(owner).newRouterChangeRequest(router.address);
        await factory.connect(owner).setRouterAddress(1);

        swapper = await (await new Swapper__factory(owner).deploy()).deployed();

        xUlx = await (await new ULXMirrorWorld__factory(owner).deploy(weth.address));

        await owner.sendTransaction({
            to: weth.address,
            value: ethers.utils.parseEther("100"),
        });
    });

    it("Enter and leave xULX", async () => {
        const amount = ethers.utils.parseEther("10");
        await weth.connect(owner).approve(xUlx.address, amount);
        await xUlx.connect(owner).enter(amount);
        expect(await xUlx.connect(owner).wULXBalance(owner.address)).equals(amount);
        await xUlx.connect(owner).leave(amount);
        expect(await weth.connect(owner).balanceOf(owner.address)).equals(ethers.utils.parseEther("100"));
    });

    it("Enter and redeem xULX", async () => {
        const amount = ethers.utils.parseEther("10");
        await weth.connect(owner).approve(xUlx.address, amount);
        await xUlx.connect(owner).enter(amount);
        expect(await xUlx.connect(owner).wULXForxULX(amount)).equals(amount);
    });

    it("Enter and expect wULX", async () => {
        const amount = ethers.utils.parseEther("10");
        await weth.connect(owner).approve(xUlx.address, amount);
        await xUlx.connect(owner).enter(amount);
        expect(await xUlx.connect(owner).wULXForxULX(amount)).equals(amount);
    });

});