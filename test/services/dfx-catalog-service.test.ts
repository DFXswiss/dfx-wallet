import { dfxApi } from '../../src/features/dfx-backend/services/api';
import { dfxAssetService } from '../../src/features/dfx-backend/services/asset-service';
import { dfxFiatService } from '../../src/features/dfx-backend/services/fiat-service';

describe('DFX catalog services', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    dfxAssetService.reset();
    dfxFiatService.reset();
  });

  it('does not keep a rejected asset catalog request cached', async () => {
    const getPublic = jest
      .spyOn(dfxApi, 'getPublic')
      .mockRejectedValueOnce(new Error('Cannot GET /v1/v1/asset'))
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'BTC',
          uniqueName: 'BTC',
          blockchain: 'Bitcoin',
          category: 'PublicAsset',
          type: 'Coin',
          buyable: true,
          sellable: true,
        },
      ]);

    await expect(dfxAssetService.list()).rejects.toThrow('Cannot GET /v1/v1/asset');
    await expect(dfxAssetService.list()).resolves.toHaveLength(1);
    expect(getPublic).toHaveBeenCalledTimes(2);
  });

  it('does not keep a rejected fiat catalog request cached', async () => {
    const getPublic = jest
      .spyOn(dfxApi, 'getPublic')
      .mockRejectedValueOnce(new Error('Cannot GET /v1/v1/fiat'))
      .mockResolvedValueOnce([{ id: 1, name: 'CHF', buyable: true, sellable: true }]);

    await expect(dfxFiatService.list()).rejects.toThrow('Cannot GET /v1/v1/fiat');
    await expect(dfxFiatService.list()).resolves.toHaveLength(1);
    expect(getPublic).toHaveBeenCalledTimes(2);
  });
});
