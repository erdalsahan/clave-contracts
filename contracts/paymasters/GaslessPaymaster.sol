// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;
import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol';
import {IPaymasterFlow} from '@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol';
import {Transaction} from '@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol';
import {BOOTLOADER_FORMAL_ADDRESS} from '@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Errors} from '../libraries/Errors.sol';
import {IClaveRegistry} from '../interfaces/IClaveRegistry.sol';
import {BootloaderAuth} from '../auth/BootloaderAuth.sol';

/**
 * @title GaslessPaymaster to pay for limited number of transactions' fees for Clave users
 * @author https://getclave.io
 */
contract GaslessPaymaster is IPaymaster, Ownable, BootloaderAuth {
    // User tx limit per paymaster
    uint256 public immutable userLimit;
    // Clave account registry contract
    address public claveRegistry;

    // Store users sponsored tx count
    mapping(address => uint256) public userSponsored;

    // Event to be emitted when the balance is withdrawn
    event BalanceWithdrawn(address to, uint256 amount);
    // Event to be emitted when a user tx is sponsored
    event FeeSponsored(address user);

    // Allow receiving ETH
    receive() external payable {}

    /**
     * @notice Constructor functino of the paymaster
     * @param limit uint256 - User sponsorship limit
     */
    constructor(address registry, uint256 limit) {
        claveRegistry = registry;
        userLimit = limit;
    }

    /// @inheritdoc IPaymaster
    function validateAndPayForPaymasterTransaction(
        bytes32 /**_txHash*/,
        bytes32 /**_suggestedSignedHash*/,
        Transaction calldata _transaction
    ) external payable onlyBootloader returns (bytes4 magic, bytes memory context) {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;

        // Get the user address
        address userAddress = address(uint160(_transaction.from));

        // Check if the account is a Clave account
        if (!IClaveRegistry(claveRegistry).isClave(userAddress)) revert Errors.NOT_CLAVE_ACCOUNT();

        // Revert if standart paymaster input is shorter than 4 bytes
        if (_transaction.paymasterInput.length < 4) revert Errors.SHORT_PAYMASTER_INPUT();

        // Check the paymaster input selector to detect flow
        bytes4 paymasterInputSelector = bytes4(_transaction.paymasterInput[0:4]);
        if (paymasterInputSelector != IPaymasterFlow.general.selector)
            revert Errors.UNSUPPORTED_FLOW();

        // Check the user sponsorship limit and decrease
        uint256 txAmount = userSponsored[userAddress];
        if (txAmount >= userLimit) revert Errors.USER_LIMIT_REACHED();
        userSponsored[userAddress]++;

        // Required ETH and token to pay fees
        uint256 requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

        // Transfer fees to the bootloader
        (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{value: requiredETH}('');
        if (!success) revert Errors.FAILED_FEE_TRANSFER();

        // No context needed
        context = bytes('');
    }

    /// @inheritdoc IPaymaster
    function postTransaction(
        bytes calldata /**_context*/,
        Transaction calldata _transaction,
        bytes32 /**_txHash*/,
        bytes32 /**_suggestedSignedHash*/,
        ExecutionResult /**_txResult*/,
        uint256 /**_maxRefundedGas*/
    ) external payable onlyBootloader {
        address userAddress = address(uint160(_transaction.from));

        emit FeeSponsored(userAddress);
    }

    /**
     * @notice Withdraw paymaster funds as owner
     * @param to address - Token receiver address
     * @param amount uint256 - Amount to be withdrawn
     * @dev Only owner address can call this method
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        // Send paymaster funds to the owner
        (bool success, ) = payable(to).call{value: amount}('');
        if (!success) revert Errors.UNAUTHORIZED_WITHDRAW();

        emit BalanceWithdrawn(to, amount);
    }
}
