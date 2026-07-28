# Settings Architecture

## Component Diagram

```mermaid
graph TD
    subgraph Plugin Entry
        MP[main.ts - GitEncryptPlugin]
        LS[loadSettings()]
        LK[Load Key from Keychain]
    end

    subgraph Settings UI
        SI[index.ts - GitEncryptSettingTab]
    end

    subgraph Sections
        SR[repository.ts]
        SA[authentication.ts]
        SZ[author.ts]
        SK[masterKey.ts]
        SX[advanced.ts]
    end

    subgraph Services
        SS[systemService.ts - SystemService]
        NC[nodeContext.ts - getNativeModule, getModule<T>]
    end

    subgraph Shared
        PL[platform.ts - isMobile, isMobilePlatform]
        UI[ui.ts - createSettingGroup]
    end

    %% Plugin Entry
    MP --> LS
    LS --> LK
    LS --> SS
    MP --> SI

    %% SettingTab → Sections
    SI --> SR
    SI --> SA
    SI --> SZ
    SI --> SK
    SI --> SX

    %% Section → Services (4 sections call plugin.sys for desktop operations)
    SA -.-> SS
    SZ -.-> SS
    SK -.-> SS

    %% Services chain
    SS --> NC

    %% Shared — sections import platform.ts (isMobilePlatform) and ui.ts
    SR -.-> PL
    SA -.-> PL
    SZ -.-> PL
    SK -.-> PL
    SR -.-> UI
    SA -.-> UI
    SZ -.-> UI
    SK -.-> UI
    SX -.-> UI
```

> [!NOTE]
> All 5 sections import `createSettingGroup` from `ui.ts` directly (dashed arrows).
> `authentication.ts`, `author.ts`, `masterKey.ts` call `SystemService` via `plugin.sys` for desktop-only operations (`getGitSshKeyPath`, `getGitGlobalUser`, `saveKeyToKeychain`, `checkMasterKeyFile`).
> `author.ts`, `masterKey.ts`, `repository.ts`, `advanced.ts` do not import `types.ts`/`defaults.ts` directly — types flow through `main.ts`.
> `author.ts` additionally imports `isValidEmail` from `validators.ts`.
> `masterKey.ts` additionally imports `isValidHexKey` from `validators.ts`.
> `authentication.ts` still imports `Platform` directly from Obsidian (line 1) — violates single-import-point rule.

## Shared vs Platform-Specific

| Layer | Shared | Desktop Only | Mobile Only |
|-------|--------|-------------|-------------|
| **Repository** | URL, branch, remote, protocol | — | No local path picker |
| **Authentication** | Token field, port | SSH key file, auto-detect | SSH key text only |
| **Author** | Manual name/email | Auto-detect from git config | Manual only |
| **Master Key** | Manual hex input | Keychain (safeStorage), file source | Manual only |
| **Advanced** | All toggles, patterns, conflicts | — | — |
| **Services** | Type definitions | exec, fs, safeStorage | Guards return null |

## Data Flow: Settings Save

1. User changes a setting in any section
2. `onChange` handler mutates `plugin.settings.field` directly and calls `await plugin.saveSettings()`
3. `saveSettings()` delegates to Obsidian's `this.saveData(this.settings)` (JSON serialization)
4. On next plugin load, `loadSettings()` calls `this.loadData()` and merges with `DEFAULT_SETTINGS`

## Data Flow: Keychain (Desktop)

1. User selects "System Keychain" as master key source
2. Plugin reads the current manual key value
3. `saveKeyToKeychain()` encrypts and stores via Electron `safeStorage`
4. On next startup, `loadKeyFromKeychain()` decrypts and sets the key
5. If decryption fails, key falls back to empty (user re-enters manually)

## Platform Abstraction

| Layer | File | Export | Usage |
|-------|------|--------|-------|
| **Platform detection** | `settings/platform.ts` | `isMobile`, `isMobilePlatform` | Sections check mobile guards |
| **Module loader** | `services/nodeContext.ts` | `getNativeModule()`, `getModule<T>()` | Desktop-only Node/Electron modules |

- `platform.ts` is the single import point for `Platform.isMobile`. Sections import `isMobilePlatform` from `platform.ts`.
- `nodeContext.ts` re-exports `isMobile` from `platform.ts` and wraps it in `getNativeModule()` / `getModule<T>()` for safe Node.js module loading.
- `getModule<T>()` eliminates repetitive `as T` casts — callers specify the expected interface via the generic parameter.
- **Exception:** `authentication.ts` imports `Platform` directly from obsidian (line 1) instead of `../platform` — violates single-import-point rule (see Verification task 5).
