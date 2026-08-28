import { Wallet } from 'ethers';
import {
  EVM_AUTH_ADDRESS_PROBE_MESSAGE,
  recoverPersonalSignAddress,
} from '../../src/services/evm/signature';

describe('recoverPersonalSignAddress', () => {
  it('recovers the EOA signer address from an EVM personal signature', async () => {
    const wallet = Wallet.createRandom();
    const signature = await wallet.signMessage(EVM_AUTH_ADDRESS_PROBE_MESSAGE);

    expect(recoverPersonalSignAddress(EVM_AUTH_ADDRESS_PROBE_MESSAGE, signature)).toBe(
      wallet.address,
    );
  });
});
