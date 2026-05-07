/**
 * Configuration for `@tetherto/wdk-worklet-bundler`.
 *
 * The bundler reads this file to assemble the WDK worklet bundle that runs
 * inside the Bare runtime. It only ships the wallet modules listed here,
 * keeping the binary lean compared to `@tetherto/pear-wrk-wdk`'s prototype
 * bundle (which used to bundle every chain).
 *
 * Run `npm run bundle:wdk` after changing this file.
 */
module.exports = {
  networks: {
    ethereum: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    arbitrum: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    polygon: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    base: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    plasma: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    sepolia: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    spark: { package: '@tetherto/wdk-wallet-spark' },
    bitcoin: { package: '@tetherto/wdk-wallet-btc' },
  },
  output: {
    // Put the bundle inside `.wdk/` so the generated `.wdk/index.js`'s
    // relative `require('./wdk-worklet.bundle.js')` actually resolves.
    // The bundler default puts the bundle in `.wdk-bundle/` instead, which
    // breaks the generated entry — looks like a known v1.0.0-beta.3 quirk.
    bundle: './.wdk/wdk-worklet.bundle.js',
    types: './.wdk/index.d.ts',
  },
};
