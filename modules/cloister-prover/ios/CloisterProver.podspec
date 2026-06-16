require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# The gomobile-built prover (Cloister.xcframework, ~62 MB) + ZK keys are NOT committed to
# git. They are fetched from a versioned, public, non-secret release artifact at `pod install`
# (verified by sha256). Local dev keeps the already-present framework; CI fetches it. This
# keeps a large native binary out of the repo while making the iOS build self-contained.
ARTIFACT_URL = 'https://github.com/joshuakrueger-dfx/cloister-prover-dist/releases/download/prover-v0.1.0/cloister-prover-0.1.0.tgz'
ARTIFACT_SHA = '31f84492e29a96fab3dee8ac43bea22673e927226d95e21c577da21479036667'

Pod::Spec.new do |s|
  s.name           = 'CloisterProver'
  s.version        = package['version'] || '0.1.0'
  s.summary        = 'On-device Cloister zero-knowledge prover (gnark, native).'
  s.description    = 'Native Groth16 prover + Poseidon2 hash for the Cloister shielded pool. Wraps the gomobile-built Cloister.xcframework.'
  s.author         = 'DFX AG'
  s.homepage       = 'https://cloister-protocol.com'
  s.license        = { :type => 'MIT', :text => 'Copyright (c) 2026 DFX AG. MIT License.' }
  s.platforms      = { :ios => '18.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  # Fetch + verify the prover artifact (framework + keys) unless it's already here (local dev).
  s.prepare_command = <<-CMD
    set -e
    if [ ! -d "Cloister.xcframework" ]; then
      echo "CloisterProver: fetching prover artifact (framework + keys)…"
      curl -fsSL -o cloister-prover.tgz "#{ARTIFACT_URL}"
      echo "#{ARTIFACT_SHA}  cloister-prover.tgz" | shasum -a 256 -c -
      tar -xzf cloister-prover.tgz
      rm -f cloister-prover.tgz
    fi
  CMD

  s.dependency 'ExpoModulesCore'

  # gomobile-built Go prover (device + simulator slices) — provided by prepare_command.
  s.vendored_frameworks = 'Cloister.xcframework'

  # Proving/verifying keys + compiled circuit, shipped in the app bundle — provided by prepare_command.
  s.resources = ['keys/pk.bin', 'keys/vk.bin', 'keys/circuit.r1cs']

  s.source_files = '*.{swift}'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
