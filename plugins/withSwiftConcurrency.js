const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that patches the Podfile to suppress Swift 6 strict
 * concurrency errors via compiler flags. This is needed because Xcode 26
 * defaults to Swift 6 which treats concurrency issues as errors.
 */
module.exports = function withSwiftConcurrency(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf-8');

      const patch = `
    # [DFX] Suppress Swift 6 strict concurrency errors (Xcode 26+)
    installer.pods_project.build_configurations.each do |bc|
      bc.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      flags = bc.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'
      unless flags.include?('-strict-concurrency')
        bc.build_settings['OTHER_SWIFT_FLAGS'] = flags + ' -Xfrontend -strict-concurrency=minimal'
      end
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        flags = bc.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'
        unless flags.include?('-strict-concurrency')
          bc.build_settings['OTHER_SWIFT_FLAGS'] = flags + ' -Xfrontend -strict-concurrency=minimal'
        end
      end
    end
  end
end`;

      podfile = podfile.replace(/    \)\n  end\nend\n?$/, '    )\n' + patch + '\n');

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
