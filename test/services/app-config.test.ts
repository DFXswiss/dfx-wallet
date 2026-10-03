import appConfig from '../../app.json';

describe('Expo application config', () => {
  it('blocks Android location permissions reintroduced by BLE dependencies', () => {
    expect(appConfig.expo.android.blockedPermissions).toEqual([
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ]);
  });
});
