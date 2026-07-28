# FlowerKey

![FlowerKey Logo](透明蓝钥匙白天.png)

**A local-first password, bookmark, and encrypted notes manager.**

![version](https://img.shields.io/badge/version-0.4.2-blue?style=flat-square)
![license](https://img.shields.io/badge/license-GPL--3.0-green?style=flat-square)
![crypto](https://img.shields.io/badge/crypto-AES--256--GCM-purple?style=flat-square)
![PBKDF2](https://img.shields.io/badge/PBKDF2-600k%20iterations-orange?style=flat-square)

[中文](README.md) | English

---

FlowerKey is a backend-free, local-first, end-to-end encrypted multi-platform tool for deterministic password generation, encrypted password storage, bookmark collection, and encrypted note management. Its cryptography, data model, and synchronization engine live in a shared core package, with dedicated clients for browser extensions, mobile, desktop, and a lightweight userscript.

## Product Focus

- Local-first: data is stored locally by default; master passwords and derived keys are never uploaded to a server.
- Deterministic password generation: the same master password, identity secret, codename, mode, and length produce the same password across devices.
- Encrypted storage: fixed passwords, bookmark metadata, notes, and other sensitive fields are encrypted with AES-256-GCM.
- Multi-device sync: encrypted operation logs are synchronized through WebDAV; mobile also supports iCloud sync.
- Autofill: the browser extension provides in-page password filling, and Android integrates with AutofillService.

## Feature Overview

### Deterministic Password Generation

FlowerKey derives a master key with PBKDF2, then generates password bytes with `HMAC-SHA256(masterKey, codename)`. This mode is designed for users who do not want to store actual site passwords.

### Stored Password Mode

For passwords that cannot be regenerated from a codename, such as bank PINs or legacy account passwords, users can explicitly store a fixed password. The `storedPassword` field is encrypted before it is written to local storage.

### Bookmarks

The browser extension can save the current page with one click. Bookmark titles and descriptions can be encrypted depending on the user's bookmark encryption setting.

### Encrypted Notes

The extension, mobile app, and desktop app all expose note management. Note content is treated as a sensitive field and encrypted at rest.

### File Reference Model

The shared data model includes a `file_ref` entry type for file names, source URLs, and related metadata. This is currently a core-model capability rather than the primary navigation surface in every client.

### Synchronization

The sync engine uses encrypted OpLog files, a short-lived sync lock, snapshot compaction, and Last-Write-Wins conflict resolution.

### Autofill

Chrome and Edge extensions provide in-page filling. Android uses the system AutofillService and matches either web domains or native app package names.

### Recovery Code

FlowerKey can generate a recovery code that encrypts the original master password. If the master password is forgotten, the recovery code restores that same password and unlocks the vault without creating a new master password or changing any historical deterministic password.

## Platform Support

### Browser Extension

- Chrome and Edge Manifest V3 extension.
- Popup for quick actions.
- Side Panel for full management.
- Background service worker for unlock state, context menus, generation, and filling.
- Content Script for floating action button, inline generation, password-field overlay, and Shadow DOM isolation.

### Mobile App

- Capacitor 7 application for Android and iOS.
- SQLite local storage via `@capacitor-community/sqlite`.
- WebDAV sync through a native backend.
- iCloud sync for iOS-device workflows.
- Android AutofillService with inline suggestions on supported versions.

### Desktop App

- Tauri 2 application for Windows and macOS.
- Password, bookmark, note, and settings management.
- WebDAV sync, original-master-password recovery, backup import/export, and browser bookmark import.

### Userscript

- Single-file Tampermonkey/Via userscript.
- Lightweight password generation, copy, and page filling.
- If “remember master password” is enabled, the master password is stored in userscript local storage; this has a weaker security model than the official clients.

## Security Design

Official FlowerKey clients are built around one boundary: the master password stays local, and derived keys only live in memory while the app is unlocked. Generated passwords are not stored. Stored-mode passwords are encrypted only when the user explicitly chooses to save them.

### Key Derivation

```text
master password
    |
    |-- PBKDF2(masterPwd, "flowerkey_verify_" + verifySalt)
    |   `-- verifyHash: local master-password verification, not reversible
    |
    |-- PBKDF2(masterPwd, "flowerkey_identity_wrap_" + randomWrapSalt)
    |   `-- identityWrapKey: wraps the local identity secret with AES-256-GCM and is never persisted
    |
    |-- PBKDF2(masterPwd, NFC(identitySecret))
    |   `-- masterKey: deterministic password generation, never persisted
    |
    `-- PBKDF2(masterPwd, "flowerkey_dbenc_" + identitySecret)
        `-- dbKey: sensitive field encryption, cleared on lock
```

Parameters: PBKDF2, SHA-256, 600,000 iterations, 256-bit key length.

After initialization, local storage contains only the random wrapping salt, format version, and encrypted identity-secret envelope; it never contains the identity secret in plaintext. Strict mode creates no persistent quick-unlock device package. The master password and unwrapped identity secret exist only in the unlocked process memory and are cleared on lock. Because both inputs determine every historical generated password, official clients do not offer ordinary master-password or identity-secret changes.

### Password Generation

```text
masterKey      = PBKDF2(masterPwd, NFC(identitySecret))
normalizedCode = ASCII_LOWER(NFC(TRIM(codename)))
rawBytes       = HMAC-SHA256(masterKey, normalizedCode)
password  = encode(rawBytes, charset, length)
```

If the master password, identity secret, codename, charset, and length are unchanged, every device generates the same password. ASCII letters in codenames are case-insensitive.

### Field Encryption Boundary

Encrypted fields:

- `codename`
- `title`
- `description`
- `fileName`
- `sourceUrl`
- `storedPassword`
- `content`

Plaintext fields:

- `id`
- `type`
- `folder`
- `tags`
- `url`
- `favicon`
- `encrypted`
- `appPackage`
- `createdAt`
- `updatedAt`
- `lastUsedAt`

`url` and `appPackage` are intentionally stored in plaintext for browser hostname matching and Android AutofillService package-name matching. Bookmark title and description encryption depends on the user's bookmark encryption setting.

### Encryption Format

```text
[version 1B] + [random IV 12B] + [AES-256-GCM ciphertext + auth tag]
```

Random IVs prevent identical plaintext from producing identical ciphertext. The GCM authentication tag detects tampering.

### Threat Model

FlowerKey is designed to protect against:

- WebDAV providers or network intermediaries reading synchronized files.
- Local database or remote sync-folder leakage.
- Tampered encrypted sync files that fail authenticated decryption.
- Untrusted generic cloud-storage infrastructure.

FlowerKey does not claim to protect against:

- Malware reading process memory while the device is unlocked.
- Weak master passwords that are cheap to brute-force.
- Forgotten master passwords without a saved recovery code.
- The additional risk introduced by userscript local storage when “remember master password” is enabled.

Save your recovery code and use a reliable sync or backup strategy. FlowerKey has no centralized account system and cannot recover a lost master password or missing local data on behalf of the user.

## Synchronization

WebDAV is the shared sync backend for official clients. The default remote layout is:

```text
/FlowerKey/
├── sync.lock
├── vault.enc
└── oplog/
    └── {deviceId}_{timestamp}.enc
```

Sync flow:

1. Acquire `sync.lock` to avoid concurrent writes.
2. Serialize local unsynced ChangeLog records into an OpLog.
3. Encrypt the OpLog with `dbKey` and write it to WebDAV.
4. Pull new OpLogs from other devices and apply them in timestamp order.
5. Resolve conflicts with Last-Write-Wins using `updatedAt`.
6. Compact accumulated OpLogs into `vault.enc` snapshots when the threshold is reached.

Mobile additionally supports an iCloud backend, primarily for syncing between iOS devices via iCloud Drive.

## Project Structure

```text
packages/
├── core/       Cryptography, data models, Dexie data layer, sync engine
├── ui/         Shared Vue components, Pinia stores, forms, and pages
├── extension/  Browser extension: Popup, Side Panel, Background, Content Script
├── mobile/     Capacitor app, SQLite adapter, Android Autofill
├── desktop/    Tauri desktop app
└── via/        Userscript for lightweight generation and filling
scripts/
└── sync-version.js
```

## Technology Stack

- Language and framework: TypeScript, Vue 3
- State management: Pinia
- Build and workspace: Vite 6, pnpm workspace
- Styling: Tailwind CSS 3
- Cryptography: Web Crypto API, PBKDF2, HMAC-SHA256, AES-256-GCM
- Browser storage: Dexie.js / IndexedDB
- Mobile storage: `@capacitor-community/sqlite`
- Sync: WebDAV, iCloud on mobile
- Browser extension: Chrome/Edge Manifest V3
- Mobile: Capacitor 7
- Desktop: Tauri 2

## Quick Start

Requirements: Node.js, pnpm, and the platform-specific toolchains for Android Studio, Xcode, or Rust/Tauri when building those clients.

```bash
# Install dependencies.
pnpm install

# Run the browser extension development build in watch mode.
pnpm dev:extension

# Build the shared core package.
pnpm build:core

# Build the browser extension into packages/extension/dist.
pnpm build:extension
```

The root `pnpm build` runs build scripts recursively across workspace packages that define them. `@flowerkey/ui` is currently a shared source package and does not have a standalone build artifact.

## Per-Client Build Commands

### Build Browser Extension

```bash
pnpm --filter @flowerkey/extension build
```

The output is written to `packages/extension/dist/`. Load that folder in Chrome or Edge as an unpacked extension.

### Build Mobile App

```bash
pnpm --filter @flowerkey/mobile build
pnpm --filter @flowerkey/mobile sync
pnpm --filter @flowerkey/mobile android
pnpm --filter @flowerkey/mobile ios
```

For Android Release APK builds, see the Gradle command documented in the project CLAUDE.md. On Windows, run `gradlew.bat` from PowerShell.

### Build Desktop App

```bash
pnpm --filter @flowerkey/desktop tauri:dev
pnpm --filter @flowerkey/desktop tauri:build
```

Tauri bundle targets include NSIS and macOS app.

## Version Management

Update the root `package.json` `version`, then run:

```bash
pnpm version:sync
```

The script syncs package versions for core, ui, extension, mobile, and desktop. It also updates the desktop Cargo/Tauri configuration, browser extension manifest, and Android versionCode/versionName. `packages/via/flowerkey.user.js` is a non-workspace single-file userscript and should be checked separately.

## Data and Backup Guidance

- The master password is not uploaded to WebDAV, iCloud, or any third-party service.
- The identity secret is encrypted locally with a separate wrapping key derived from the master password; it is not stored in plaintext configuration.
- Generated-mode passwords depend on the master password, identity secret, and codename; losing any of them means the original password cannot be regenerated.
- Stored-mode passwords, bookmarks, and notes depend on local database state and synchronized backups.
- Enable WebDAV or iCloud sync, and keep the recovery code offline.
- The master password and identity secret are immutable after setup. A recovery code restores the original master password; back up or synchronize before migrating devices or clearing local data.

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
