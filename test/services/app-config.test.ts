import appConfig from '../../app.json';

describe('Expo application config', () => {
  it('declares fine and coarse location as blocked Android permissions', () => {
    expect(appConfig.expo.android.blockedPermissions).toEqual([
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ]);
  });
});
