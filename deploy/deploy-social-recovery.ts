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
import { type ReleaseType, updateAddress } from './helpers/release';

export default async function (
    hre: HardhatRuntimeEnvironment,
    releaseType?: ReleaseType,
): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const privateKey = process.env.PRIVATE_KEY!;
    const wallet = new Wallet(privateKey);
    const deployer = new Deployer(hre, wallet);
    const chainId = await deployer.zkWallet.getChainId();

    const SRMArtifact = await deployer.loadArtifact('SocialRecoveryModule');

    const SRM = await deployer.deploy(
        SRMArtifact,
        ['srm', '1', 0, 0],
        undefined,
        [],
    );

    console.log(`Social Recovery address: ${SRM.address}`);

    if (chainId === 0x118) {
        try {
            const verificationId = await hre.run('verify:verify', {
                address: SRM.address,
                contract: contractNames.socialRecovery,
                constructorArguments: ['srm', '1', 0, 0],
            });
            console.log(`Verification ID: ${verificationId}`);
        } catch (e) {
            console.log(e);
        }
    }

    if (releaseType != null) {
        const key: AddressKey = 'SOCIAL_RECOVERY';
        updateAddress(releaseType, key, SRM.address);
    }

    return SRM.address;
}
