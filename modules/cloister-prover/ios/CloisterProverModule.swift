// Copyright (c) 2026 DFX AG. All rights reserved. Proprietary and confidential.

import ExpoModulesCore
import Cloister
import os.log

private let cloisterLog = OSLog(subsystem: "swiss.cloister.prover", category: "prove")

// CloisterProverModule exposes the on-device gnark prover (Cloister.xcframework,
// built via gomobile) to JavaScript. All heavy work runs on Expo's async queue, so
// proving never blocks the UI thread.
//
// NOTE: gomobile emits C functions (FOUNDATION_EXPORT ... NSError**), which Swift
// does NOT auto-bridge to `throws`. We therefore pass an explicit error pointer and
// translate a non-nil NSError into an Expo Exception.
//
// JS surface (see index.ts):
//   initProver(): Promise<boolean>
//   isReady(): boolean
//   hash(itemsJSON: string): Promise<string>
//   prove(witnessInputJSON: string): Promise<string>
public class CloisterProverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CloisterProver")

    AsyncFunction("initProver") { () -> Bool in
      try Self.ensureInitialized()
      return MobileReady()
    }

    Function("isReady") { () -> Bool in
      return MobileReady()
    }

    AsyncFunction("hash") { (itemsJSON: String) -> String in
      var err: NSError?
      let out = MobileHash(itemsJSON, &err)
      if let e = err {
        throw Exception(name: "CloisterHashError", description: e.localizedDescription)
      }
      return out
    }

    AsyncFunction("prove") { (witnessInputJSON: String) -> String in
      try Self.ensureInitialized()
      var err: NSError?
      let start = DispatchTime.now()
      let out = MobileProve(witnessInputJSON, &err)
      let ms = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
      if let e = err {
        throw Exception(name: "CloisterProveError", description: e.localizedDescription)
      }
      // authoritative on-device timing (capture via: log stream --device --predicate
      // 'subsystem == "swiss.cloister.prover"')
      os_log("CLOISTER_PROVE_MS=%.1f", log: cloisterLog, type: .info, ms)
      return out
    }
  }

  // Idempotently load circuit + keys. MobileInit itself is a no-op once loaded.
  private static func ensureInitialized() throws {
    if MobileReady() { return }
    guard let dir = keysDir() else {
      throw Exception(name: "CloisterKeysMissing",
                      description: "Bundled prover keys (pk.bin/vk.bin/circuit.r1cs) not found in app bundle.")
    }
    var err: NSError?
    MobileInit(dir, &err)
    if let e = err {
      throw Exception(name: "CloisterInitError", description: e.localizedDescription)
    }
  }

  // Resolve the directory that holds the three key files. CocoaPods `s.resources`
  // copy them into the main app bundle; we locate pk.bin and use its parent dir so
  // the layout matches prover.Load(keysDir) on the Go side.
  private static func keysDir() -> String? {
    let candidates: [Bundle] = [Bundle.main, Bundle(for: CloisterProverModule.self)]
    for bundle in candidates {
      if let url = bundle.url(forResource: "pk", withExtension: "bin") {
        return url.deletingLastPathComponent().path
      }
    }
    return nil
  }
}
