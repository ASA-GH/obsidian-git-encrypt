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
        NC[nodeContext.ts - getNativeModule]
    end

    subgraph Shared
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

    %% Section → Services (only these 3 call plugin.sys)
    SA --> SS
    SZ --> SS
    SK --> SS

    %% Services chain
    SS --> NC

    %% Shared utilities — all sections import ui.ts directly
    SR -.-> UI
    SA -.-> UI
    SZ -.-> UI
    SK -.-> UI
    SX -.-> UI
```

> [!NOTE]
> All 5 sections import `createSettingGroup` from `ui.ts` directly (dashed arrows).
> `authentication.ts` does not call `SystemService` — UI only.
> `author.ts`, `masterKey.ts`, `repository.ts`, `advanced.ts` do not import `types.ts`/`defaults.ts` directly — types flow through `main.ts`.

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
2. Change handler calls `this.loadData().then(s => { s.field = value; this.saveData(s) })`
3. `saveData()` serializes to `data.json`
4. On next plugin load, `loadSettings()` merges saved data with `DEFAULT_SETTINGS`

## Data Flow: Keychain (Desktop)

1. User selects "System Keychain" as master key source
2. Plugin reads the current manual key value
3. `saveKeyToKeychain()` encrypts and stores via Electron `safeStorage`
4. On next startup, `loadKeyFromKeychain()` decrypts and sets the key
5. If decryption fails, key falls back to empty (user re-enters manually)
