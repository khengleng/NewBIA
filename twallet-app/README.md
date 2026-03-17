<h1 align="center">
  <br>
  <img src="./assets/images/t-wallet.png" alt="Cambobia Mobile" width="200">
  <br>
  Cambobia Mobile
  <br>
  <p align="center">
    <img src="https://img.shields.io/badge/contributions-welcome-orange.svg" alt="Contributions welcome">
    <img src="https://img.shields.io/badge/flutter-3.3.0-informational" alt="Flutter">
    <img src="https://img.shields.io/badge/License-BSD%203--Clause-blue.svg" alt="License">
  </p>
</h1>

<h4 align="center">Native mobile companion for Cambobia investors and SME owners across the core platform and trading platform.</h4>

## Cambobia Mobile

### What It Includes

- Account access for Cambobia platform users
- Portfolio, holdings, and trading-linked wallet capabilities
- SME owner mobile access for issuer-side workflows on cambobia.com
- DApp browser support for Cambobia-linked web experiences

### What Is A Digital Wallet

***From wikipedia:***

> A digital wallet also known as "e-Wallet" refers to an electronic device, online service, or software program that allows one party to make electronic transactions with another party bartering digital currency units for goods and services. This can include purchasing items on-line with a computer or using a smartphone to purchase something at a store. Money can be deposited in the digital wallet prior to any transactions or, in other cases, an individual's bank account can be linked to the digital wallet. Users might also have their driver's license, health card, loyalty card(s) and other ID documents stored within the wallet. The credentials can be passed to a merchant's terminal wirelessly via near field communication (NFC). Increasingly, digital wallets are being made not just for basic financial transactions but to also authenticate the holder's credentials. For example, a digital wallet could verify the age of the buyer to the store while purchasing alcohol. The system has already gained popularity in Japan, where digital wallets are known as "wallet mobiles". A cryptocurrency wallet is a digital wallet where private keys are stored for cryptocurrencies like bitcoin.

### What Is DID (Decentralized Identifiers)

***From wikipedia:***

> Decentralized identifiers (DIDs) are a type of identifier that enables a verifiable, decentralized digital identity. They are based on the Self-sovereign identity paradigm. A DID identifies any subject (e.g., a person, organization, thing, data model, abstract entity, etc.) that the controller of the DID decides that it identifies. These identifiers are designed to enable the controller of a DID to prove control over it and to be implemented independently of any centralized registry, identity provider, or certificate authority. DIDs are URLs that associate a DID subject with a DID document allowing trustable interactions associated with that subject. Each DID document can express cryptographic material, verification methods, or service endpoints, which provide a set of mechanisms enabling a DID controller to prove control of the DID. Service endpoints enable trusted interactions associated with the DID subject. A DID document might contain semantics about the subject that it identifies. A DID document might contain the DID subject itself (e.g. a data model).

### What Is A DApp

***From wikipedia:***

> A decentralized application (DApp, dApp, Dapp, or dapp) is a computer application that runs on a distributed computing system. DApps have been popularized by distributed ledger technologies (DLT) such as the Ethereum Blockchain, where DApps are often referred to as smart contracts.

### What is a DApp Browser

> A decentralized app (DApp) browser is a combination of a messaging interface and a UX that enables users to interact with decentralized applications.

## User Guide

### How To Try The App

Use the GitHub Actions build artifacts for internal testing, or install the native release builds that are generated for App Store / Play Store submission.

### Welcome Feedbacks

Submit issues and product feedback through this repository so the mobile app stays aligned with cambobia.com and trade.cambobia.com.

## For Developers

### Quick Start

1. make sure you have ```flutter --version``` installed
```
Flutter 3.3.1 • channel stable • https://github.com/flutter/flutter.git
Framework • revision 4f9d92fbbd (11 days ago) • 2022-09-06 17:54:53 -0700
Engine • revision 3efdf03e73
Tools • Dart 2.18.0 • DevTools 2.15.0
```

2. `flutter doctor` to check your `flutter` environment and find which device you can use to build the app

3. `flutter pub get` install all dependencies if it is the first time

4. `flutter test` run all tests

5. `flutter run -d <device>` run the project in specific device. please run `flutter emulators` first if you want to launch a emulator instead of a device.

### Contributing

If you have read up till here, then 🎉🎉🎉. There are couple of ways in which you can contribute to
this growing project.

- Pick up any issue marked with labels
- Propose any feature, enhancement
- Report a bug
- Fix a bug
- Participate in a discussion and help in decision making
- Send in a Pull Request :-)

## Release note

<p style="color: darkred;">Do not publish this app to the stores until Cambobia-owned signing keys, Firebase configs, and production credentials are provisioned.</p>
