/**
 * Copyright Clave - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */
import type { AddressKey } from '@getclave/constants';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Wallet } from 'zksync-web3';

import { contractNames } from './helpers/fully-qualified-contract-names';
import type { ReleaseType } from './helpers/release';
import { loadAddress, updateAddress } from './helpers/release';

export default async function (
    hre: HardhatRuntimeEnvironment,
    releaseType?: ReleaseType,
    batchCallerAddress?: string,
): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const privateKey = process.env.PRIVATE_KEY!;
    const wallet = new Wallet(privateKey);
    const deployer = new Deployer(hre, wallet);
    const chainId = await deployer.zkWallet.getChainId();

    const BATCH_CALLER_ADDRESS =
        batchCallerAddress || (await loadAddress(releaseType, 'BATCH_CALLER'));

    console.log(
        `Used batch caller address ${BATCH_CALLER_ADDRESS} to deploy implementation`,
    );

    const claveImplArtifact = await deployer.loadArtifact(
        'ClaveImplementation',
    );

    const claveImpl = await deployer.deploy(
        claveImplArtifact,
        [BATCH_CALLER_ADDRESS],
        undefined,
        [],
    );

    console.log(`Implementation address: ${claveImpl.address}`);

    if (chainId === 0x118) {
        try {
            const verificationId = await hre.run('verify:verify', {
                address: claveImpl.address,
                contract: contractNames.implementation,
                constructorArguments: [BATCH_CALLER_ADDRESS],
            });
            console.log(`Verification ID: ${verificationId}`);
        } catch (e) {
            console.log(e);
        }
    }

    if (releaseType != null) {
        const key: AddressKey = 'IMPLEMENTATION';
        updateAddress(releaseType, key, claveImpl.address);
    }

    return claveImpl.address;
}
