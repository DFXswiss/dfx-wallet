require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CloisterProver'
  s.version        = package['version'] || '0.1.0'
  s.summary        = 'On-device Cloister zero-knowledge prover (gnark, native).'
  s.description    = 'Native Groth16 prover + Poseidon2 hash for the Cloister shielded pool. Wraps the gomobile-built Cloister.xcframework.'
  s.author         = 'DFX AG'
  s.homepage       = 'https://cloister.dfx.swiss'
  s.license        = { :type => 'Proprietary', :text => 'Copyright (c) 2026 DFX AG. All rights reserved.' }
  s.platforms      = { :ios => '18.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # gomobile-built Go prover (device + simulator slices)
  s.vendored_frameworks = 'Cloister.xcframework'

  # Proving/verifying keys + compiled circuit, shipped in the app bundle.
  s.resources = ['keys/pk.bin', 'keys/vk.bin', 'keys/circuit.r1cs']

  s.source_files = '*.{swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
