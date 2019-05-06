import { App, comm_u2f } from "ledger-cosmos-js"
import { createCosmosAddress } from "scripts/wallet.js"
import config from "src/config"
import semver from "semver"

// TODO: discuss TIMEOUT value
const TIMEOUT = 60 // seconds to wait for user action on Ledger

/*
HD wallet derivation path (BIP44)
DerivationPath{44, 118, account, 0, index}
*/
// TODO: add this to state when HD wallet is supported on UI
const HDPATH = [44, 118, 0, 0, 0]
const BECH32PREFIX = `cosmos`

function versionString({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`
}

const checkLedgerErrors = (
  { error_message },
  timeoutMessag = "Connection timed out. Please try again."
) => {
  switch (error_message) {
    case `U2F: Timeout`:
      throw new Error(timeoutMessag)
    case `Cosmos app does not seem to be open`:
      throw new Error(`Cosmos app is not open`)
    case `Command not allowed`:
      throw new Error(`Transaction rejected`)
    case `Unknown error code`:
      throw new Error(`Ledger's screensaver mode is on`)
    case `No errors`:
      // do nothing
      break
    default:
      throw new Error(error_message)
  }
}

const checkAppMode = (rootState, response) => {
  const { connection } = rootState
  const { device_locked, test_mode } = response

  if (
    test_mode &&
    connection &&
    connection.lastHeader &&
    connection.lastHeader.chain_id.startsWith(`cosmoshub`)
  ) {
    throw new Error(
      `DANGER: Cosmos app on test mode shouldn't be used on mainnet!`
    )
  } else if (response && device_locked) {
    throw new Error(`Ledger's screensaver mode is on`)
  }
}

export default () => {
  const emptyState = {
    error: null,
    cosmosApp: null,
    isConnected: false,
    pubKey: null, // 33 bytes; used for broadcasting signed txs and getting the address
    cosmosAppVersion: null
  }
  const state = {
    ...emptyState,
    externals: { App, comm_u2f, createCosmosAddress } // for testing
  }
  const mutations = {
    setCosmosApp(state, app) {
      state.cosmosApp = app
    },
    setCosmosAppVersion(state, version) {
      state.cosmosAppVersion = version
    },
    setLedgerPubKey(state, pubKey) {
      state.pubKey = pubKey
    },
    setLedgerConnection(state, isConnected) {
      state.isConnected = isConnected
    },
    setLedgerError(state, error) {
      state.error = error
    }
  }

  const actions = {
    resetSessionData({ rootState }) {
      rootState.ledger = {
        ...JSON.parse(JSON.stringify(emptyState)),
        externals: state.externals
      }
    },
    async pollLedgerDevice({ dispatch, state }) {
      // poll device with low timeout to check if the device is connected
      const secondsTimeout = 3 // a lower value always timeouts
      const communicationMethod = await state.externals.comm_u2f.create_async(
        secondsTimeout,
        true
      )
      const cosmosLedgerApp = new state.externals.App(communicationMethod)

      // check if ledger is connected
      const response = await cosmosLedgerApp.publicKey(HDPATH)
      checkLedgerErrors(
        response,
        "Could not find a connected and unlocked Ledger device"
      )

      // check if the version is supported
      const version = await dispatch(`getLedgerCosmosVersion`, cosmosLedgerApp)
      if (!semver.gt(version, config.requiredCosmosAppVersion)) {
        const msg = `Outdated version: please update Cosmos app to ${
          config.requiredCosmosAppVersion
        }`
        throw new Error(msg)
      }

      // check if the device is connected or on screensaver mode
      if (semver.satisfies(version, ">=1.5.0")) {
        // throws if not open
        await dispatch(`getOpenAppInfo`, cosmosLedgerApp)
        return
      }
    },
    async createLedgerAppInstance({ commit, state }) {
      const communicationMethod = await state.externals.comm_u2f.create_async(
        TIMEOUT,
        true
      )
      const cosmosLedgerApp = new state.externals.App(communicationMethod)
      commit(`setCosmosApp`, cosmosLedgerApp)
    },
    async connectLedgerApp({ commit, dispatch }) {
      await dispatch(`pollLedgerDevice`)
      await dispatch(`createLedgerAppInstance`)
      const address = await dispatch(`getLedgerAddressAndPubKey`)
      commit(`setLedgerConnection`, true)

      return address
    },
    async getOpenAppInfo(_, app) {
      const response = await app.appInfo()
      checkLedgerErrors(response)
      const { appName } = response

      if (appName !== `Cosmos`) {
        throw new Error(`Close ${appName} and open the Cosmos app`)
      }
    },
    async getLedgerCosmosVersion(
      { state, rootState, commit },
      app = state.cosmosApp
    ) {
      const response = await app.get_version()
      checkLedgerErrors(response)
      const { major, minor, patch } = response
      checkAppMode(rootState, response)
      const version = versionString({ major, minor, patch })
      commit(`setCosmosAppVersion`, version)

      return version
    },
    async getLedgerAddressAndPubKey({ commit, state }) {
      let response
      // TODO
      // if (semver.satisfies(state.cosmosAppVersion, `>=1.5.0`)) {
      //   response = await state.cosmosApp.getAddressAndPubKey(
      //     BECH32PREFIX,
      //     HDPATH
      //   )
      //   console.log(response)
      // }
      // if (semver.satisfies(state.cosmosAppVersion, `>=1.1.0 <1.5.0`)) {
      //   response = await state.cosmosApp.publicKey(HDPATH)
      // }
      response = await state.cosmosApp.publicKey(HDPATH)
      if (!response) {
        const leastVersion = config.requiredCosmosAppVersion
        const msg = `Outdated version: please update Cosmos app to ${
          leastVersion.full
        }`
        throw new Error(msg)
      }
      checkLedgerErrors(response)
      const { bech32_address, compressed_pk } = response
      const address =
        bech32_address || state.externals.createCosmosAddress(compressed_pk)
      commit(`setLedgerPubKey`, compressed_pk)
      return address
    },
    async confirmLedgerAddress({ state }) {
      const response = await state.cosmosApp.getAddressAndPubKey(
        BECH32PREFIX,
        HDPATH
      )
      checkLedgerErrors(response)
    },
    // TODO: add support on UI: https://github.com/cosmos/lunie/issues/1962
    async showAddressOnLedger({ state }) {
      const response = await state.cosmosApp.showAddress(BECH32PREFIX, HDPATH)
      checkLedgerErrors(response)
    },
    async signWithLedger({ state }, message) {
      const response = await state.cosmosApp.sign(HDPATH, message)
      checkLedgerErrors(response)
      return response.signature
    }
  }
  return {
    state,
    mutations,
    actions
  }
}
