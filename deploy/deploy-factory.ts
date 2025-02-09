/**
 * Copyright Clave - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */
import { type AddressKey } from '@getclave/constants';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Provider, Wallet, utils } from 'zksync-web3';

import { contractNames } from './helpers/fully-qualified-contract-names';
import type { ReleaseType } from './helpers/release';
import { loadAddress, updateAddress } from './helpers/release';

export default async function (
    hre: HardhatRuntimeEnvironment,
    releaseType?: ReleaseType,
    implementationAddress?: string,
    registryAddress?: string,
): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const privateKey = process.env.PRIVATE_KEY!;
    const wallet = new Wallet(privateKey).connect(provider);
    const deployer = new Deployer(hre, wallet);
    const chainId = await deployer.zkWallet.getChainId();

    const IMPLEMENTATION_ADDRESS =
        implementationAddress ||
        (await loadAddress(releaseType, 'IMPLEMENTATION'));

    const REGISTRY_ADDRESS =
        registryAddress || (await loadAddress(releaseType, 'REGISTRY'));

    console.log(
        `Used implementation address ${IMPLEMENTATION_ADDRESS} to deploy factory`,
    );
    console.log(`Used registry address ${REGISTRY_ADDRESS} to deploy factory`);

    const DEPLOYER_ADDRESS = '0x40C28929fBD647c229F446C21090aD83431FD24E';

    const factoryArtifact = await deployer.loadArtifact('AccountFactory');
    const accountArtifact = await deployer.loadArtifact('ClaveProxy');

    // Getting the bytecodeHash of the account
    const bytecodeHash = utils.hashBytecode(accountArtifact.bytecode);

    const factory = await deployer.deploy(
        factoryArtifact,
        [
            IMPLEMENTATION_ADDRESS,
            REGISTRY_ADDRESS,
            bytecodeHash,
            DEPLOYER_ADDRESS,
        ],
        undefined,
        [accountArtifact.bytecode],
    );

    console.log(`Account factory address: ${factory.address}`);

    if (chainId === 0x118) {
        try {
            const verificationId = await hre.run('verify:verify', {
                address: factory.address,
                contract: contractNames.factory,
                constructorArguments: [
                    IMPLEMENTATION_ADDRESS,
                    REGISTRY_ADDRESS,
                    bytecodeHash,
                    DEPLOYER_ADDRESS,
                ],
            });
            console.log(`Verification ID: ${verificationId}`);
        } catch (e) {
            console.log(e);
        }
    }

    if (releaseType != null) {
        const key: AddressKey = 'FACTORY';
        updateAddress(releaseType, key, factory.address);
    }

    const registry = await hre.ethers.getContractAt(
        'ClaveRegistry',
        REGISTRY_ADDRESS,
        wallet,
    );

    await registry.connect(wallet).setFactory(factory.address);

    return factory.address;
}
