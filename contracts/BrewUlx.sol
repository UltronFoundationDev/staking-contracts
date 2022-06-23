// SPDX-License-Identifier: MIT

// P1 - P3: OK
pragma solidity 0.8.13;

import '@openzeppelin/contracts/access/Ownable.sol';
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./Swapper.sol";

// BrewUlx is MasterChef's left hand and kinda a wizard. He can brew Wulx from pretty much anything!
// This contract handles "serving up" rewards for xulx holders by trading tokens collected from fees for Wulx.
// The caller of convertMultiple, the function responsible for converting fees to wULX earns a 0.1% reward for calling.
contract BrewULX is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IUniswapV2Factory public immutable factory;
    ISwapper public immutable swapper;

    address public immutable xulx;
    address private immutable wulx;
    uint public devCut;  // in basis points aka parts per 10,000 so 5000 is 50%, cap of 50%, default is 0
    uint public constant BOUNTY_FEE = 10;
    address public devAddr;
    //uint public slippage = 9;

    // set of addresses that can perform certain functions
    mapping(address => bool) public isAuth;
    address[] public authorized;

    modifier onlyAuth() {
        require(isAuth[_msgSender()], "BrewUlx: FORBIDDEN");
        _;
    }

    // C6: It's not a fool proof solution, but it prevents flash loans, so here it's ok to use tx.origin
    modifier onlyEOA() {
        // Try to make flash-loan exploit harder to do by only allowing externally owned addresses.
        require(msg.sender == tx.origin, "BrewUlx: must use EOA");
        _;
    }

    mapping(address => uint) internal converted;
    mapping(address => bool) public overrode;
    mapping(address => bool) public swapperApproved;

    //token bridges to try in order when swapping, first three are immutably wulx, usdc, dai
    mapping(uint => address) public bridgeRoute;
    uint public bridgeRouteAmount = 3; // "array" size aka next free slot in the mapping
    mapping(address => address) public lastRoute; //tokens last succesful route, will be tried first

    mapping(address => mapping(address => address)) public pairOf;

    event SetDevAddr(address _addr);
    event LogBridgeSet(address indexed token, address indexed bridge);
    event LogConvert(
        address indexed server,
        address indexed token0,
        uint256 amount0,
        uint256 amountWULX
    );
    event LogToggleOverrode(address _adr);
    event LogSlippageOverrode(address _adr);

    constructor(
        address _factory,
        address _xulx,
        address _wulx,
        address route1,
        address route2
    ) {
        factory = IUniswapV2Factory(_factory);
        xulx = _xulx;
        wulx = _wulx;
        devAddr = msg.sender;
        isAuth[msg.sender] = true;
        authorized.push(msg.sender);
        bridgeRoute[0] = _wulx;
        bridgeRoute[1] = route1;
        bridgeRoute[2] = route2;
        swapper = new Swapper();
    }

    function setBridgeRoute(uint index, address token) external onlyAuth {
        require(index > 2, "first 3 bridge tokens are immutable");
        require(index <= bridgeRouteAmount, "index too large, use next free slot");

        bridgeRoute[index] = token;
        if(index == bridgeRouteAmount)
            bridgeRouteAmount += 1;
    }

    function setBridgeRouteAmount(uint amount) external onlyAuth {
        require(amount > 2);
        bridgeRouteAmount = amount;
    }

    function isLpToken(address _adr) internal returns (bool) {
        if (overrode[_adr]) return false;
        IUniswapV2Pair pair = IUniswapV2Pair(_adr);
        try pair.token0() returns (address token0) {
            address token1 = pair.token1();
            address realPair = _getPair(token0, token1);
            // check if newly derived pair is the same as the address passed in
            if (_adr != realPair) {
                overrode[_adr] = true;
                emit LogToggleOverrode(_adr);
                return false;
            }
            return true;
        } catch {
            overrode[_adr] = true;
            return false;
        }
    }

    // Begin Owner functions
    function addAuth(address _auth) external onlyOwner {
        isAuth[_auth] = true;
        authorized.push(_auth);
    }

    function revokeAuth(address _auth) external onlyOwner {
        isAuth[_auth] = false;
    }
    

    function setDevAddr(address _addr) external {
        require(owner() == _msgSender() || devAddr == _msgSender(), "not allowed");
        require(_addr != address(0), "setDevAddr, address cannot be zero address");
        devAddr = _addr;

        emit SetDevAddr(_addr);
    }
    // End owner functions

    // onlyAuth type functions

    function overrideSlippage(address _token) external onlyAuth {
        swapper.overrideSlippage(_token);
        emit LogSlippageOverrode(_token);
    }

    function setSlippage(uint _amt) external onlyAuth {
        swapper.setSlippage(_amt);
    }

    function setBridge(address token, address bridge) external onlyAuth {
        // Checks
        require(
            token != wulx && token != bridge,
            "BrewUlx: Invalid bridge"
        );

        // Effects
        lastRoute[token] = bridge;
        emit LogBridgeSet(token, bridge);
    }

    function convertMultiple(
        address[] calldata token0,
        address[] calldata token1,
        uint[] calldata LPamounts
    ) external onlyEOA() nonReentrant() {
        uint i;
        IUniswapV2Pair pair;
        for (i = 0; i < token0.length;) {
            if (token0[i] == token1[i]) {
                require(!isLpToken(token0[i]), "no LP allowed");
                unchecked {++i;}
                continue;
            }
            require(!isLpToken(token0[i]) && !isLpToken(token1[i]), "no LP allowed");
            pair = IUniswapV2Pair(_getPair(token0[i], token1[i]));
            require(address(pair) != address(0), "BrewUlx: Invalid pair");

            IERC20(address(pair)).safeTransfer(address(pair), LPamounts.length == 0 ? pair.balanceOf(address(this)) : LPamounts[i]);
            pair.burn(address(this));
            unchecked {++i;}
        }

        converted[wulx] = block.number; // wulx is done last
        for (i = 0; i < token0.length;) {
            if(block.number > converted[token0[i]]) {
                _convertStep(token0[i], IERC20(token0[i]).balanceOf(address(this)));
                converted[token0[i]] = block.number;
            }
            if(block.number > converted[token1[i]]) {
                _convertStep(token1[i], IERC20(token1[i]).balanceOf(address(this)));
                converted[token1[i]] = block.number;
            }
            unchecked {++i;}
        }

        //disperse
        uint _amt = IERC20(wulx).balanceOf(address(this));
        uint bounty = _amt.mul(BOUNTY_FEE).div(10000);
        i = _amt.sub(bounty); //reuse i for amount to save gas
        IERC20(wulx).safeTransfer(xulx, i); // send xulx its share
        IERC20(wulx).safeTransfer(_msgSender(), bounty); // send message sender their share of 0.1%
        emit LogConvert(_msgSender(), wulx, _amt, i);
    }

    // internal functions

    function _convertStep(
        address token0,
        uint256 amount
    ) internal returns (bool) {
        // Interactions
        if (token0 == wulx) {
            return true;
        } else {
            address bridge = lastRoute[token0];
            bool success = false;
            if(bridge != address(0))
                (amount, success) = _swap(token0, bridge, amount);

            if(success)
                _convertStep(bridge, amount);
            else for(uint i = 0; i < bridgeRouteAmount;) {
                bridge = bridgeRoute[i];
                if(bridge == address(0)) {
                    unchecked {++i;}
                    continue;
                }
                (amount, success) = _swap(token0, bridge, amount);
                if(!success)
                    if(i == bridgeRouteAmount - 1)
                        revert("BrewUlx: bridge route failure - all options exhausted");
                    else {
                        unchecked {++i;}
                        continue;
                    }
                lastRoute[token0] = bridge;
                _convertStep(bridge, amount);
                break;
            }
        }
        return true;
    }

    function _swap(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) internal returns (uint256 amountOut, bool success) {
        if(fromToken == toToken)
            return (amountIn, false);

        if(!swapperApproved[fromToken]) {
            IERC20(fromToken).approve(address(swapper), 2**256 - 1);
            swapperApproved[fromToken] = true;
        }

        try swapper.swap(fromToken, IUniswapV2Pair(_getPair(fromToken, toToken)), amountIn) returns (uint amount) {
            return (amount, true);
        } catch {
            return (amountIn, false);
        }
    }

    function _getPair(address tokenA, address tokenB) internal returns (address pair) {
        (tokenA, tokenB) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pair = pairOf[tokenA][tokenB];
        if(pair == address(0)) {
            pair = factory.getPair(tokenA, tokenB);
            pairOf[tokenA][tokenB] = pair;
        }
    }

    //allows migration of lp tokens balance ONLY to the new(current) BrewUlx
    function migrate(address[] calldata tokens) external {
        address feeToo = factory.feeTo();
        for(uint i = 0; i < tokens.length; ++i)
            IERC20(tokens[i]).transfer(feeToo, IERC20(tokens[i]).balanceOf(address(this)));
    }
}