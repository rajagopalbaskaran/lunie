# A browser extension for Lunie.io

The Lunie browser extension will allow you to easily interact with the Cosmos blockchain and Lunie.io using [Chrome](https://www.google.com/chrome/) and [Brave](https://brave.com/) browsers. Support for other networks coming soon.

Easily create a new address, recover an existing one from backup code (seed phrase), manage your accounts and sign transactions from Lunie.io. This is a non-custodial extension, you will always maintain control of your accounts and keys. 

Lunie browser extension provides added security given the fact that browser extension data are isolated from the browser and other extensions.

How to get started:

- Install the Lunie browser extension from [here](https://chrome.google.com/webstore/detail/lunie-browser-extension/hbaijkfbhhdhhjdfbpdafkjimohblhgf)
- Click “Create a new address” or “Recover with backup code”
- Head over to https://lunie.io to start staking!

# Develop

## Clone

```bash
$ git clone https://github.com/luniehq/lunie-browser-extension.git
$ cd lunie-browser-extension
```

## Prepare

This repository uses Lunie core as a dependency. Install the submodule via:

```bash
$ git submodule init
$ git submodule update
```

Note: To reference components easily some aliases are set to the submodule in the webpack config.

## Install dependencies

```bash
$ yarn install
```

## Develop (with hot reload)

```bash
$ yarn watch:dev
```

## Build

```bash
$ yarn run build
```

## Test in Chrome

1. Go to chrome://extensions/ and check the box for Developer mode in the top right.
2. Click the Load unpacked extension button in the top left and select the build folder `lunie-browser-extension/dist/` to install it.

# Third-party Integration

If you would like to integrate your website with the Lunie Browser Extension, enabling your users to securely sign transactions, please follow these instructions.

To communicate with the extension we internally use the browser messaging API. Thankfully this is done for you. Please copy the code from the `https://github.com/luniehq/lunie/blob/master/src/scripts/extension-utils.js` to your own website. This code exports functions that you may use through out your website to send and receive messages from the extension.

We use Vue.js to create Lunie and our extension utils assumes the use of Vuex.

There are 3 main functions:

## `listenToExtensionMessages(store)`
Calling `listenToExtensionMessages` and passing it a Vuex store will enable your Vue instance to commit and dispatch messages to your app.

It's not essential that it be Vuex, but the store object must have equivalent dispatch and commmit methods. When initialising they are called with the following arguments:

- `store.commit("setExtensionAvailable")`
- `store.dispatch("getAddressesFromExtension")`

## `getAccountsFromExtension()`
Used to retrieve the current addresses registered in the extension.

The store utilised when initialising your website will send a commit message with an argument of `setExtensionAccounts` and include the accounts object.

- `store.commit("setExtensionAccounts", payload)`

## `signWithExtension(messageToSign, senderAddress)`
This will pass pass the transaction message and a sender address to the extension, and return an object shaped as follows:

```
  {
    signature: Buffer,
    publicKey: Buffer
  }
```

The final step would be to request your website domain is added to the allowed list of domains that the extension will accept.

## Internal Note
- Export the `extension-utils.js` functionality to a package users can install.
- Potentiallty might need to filter messages by domain.