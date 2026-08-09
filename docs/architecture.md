# Application Architecture — Git Encrypt

C4 model diagrams (PlantUML) for the Git Encrypt Obsidian plugin.
Open `docs/architecture.puml` in IDEA — содержит Context + Container диаграммы.
`Ctrl+Shift+A` → "PlantUML Preview".

---

## Context Diagram

**File:** [`architecture.puml`](architecture.puml) (1 блок `@startuml`)

**Scope:** external systems and users that interact with the plugin ecosystem.
Covers: Obsidian runtime, remote repositories, keychain/credentials, and the human operator.

5 elements: User, Obsidian, Remote Git Repository, System Keychain.
5 relationships: user → Obsidian, Obsidian → plugin, plugin → repo, user → repo, plugin → keychain.

---

## Container Diagram

**File:** [`architecture.puml`](architecture.puml) (2 блок `@startuml`)

**Scope:** internal structure of the Git Encrypt plugin.
Covers: entry point, settings tab with its 5 sections, ribbon menu, and the system service layer.

12 containers across 3 boundaries (Settings UI, Services, UI).
16 relationships between entry point, sections, services, and ribbon.

---

## Architecture Notes

### Module Map

| Path | Exports | Purpose |
|------|---------|---------|
| `src/main.ts` | `GitEncryptPlugin` class | Entry point, lifecycle, settings persistence, keychain fallback |
| `src/settings/index.ts` | `GitEncryptSettingTab`, re-exports types/defaults | Settings tab orchestrator; barrel for types and defaults |
| `src/settings/types.ts` | `GitEncryptSettings`, `TransportType`, `ConflictAction` | Configuration interface and domain types |
| `src/settings/defaults.ts` | `DEFAULT_SETTINGS` | Default config values |
| `src/settings/ui.ts` | `createSettingGroup`, `renderCallout`, `renderWarningCallout` | Shared UI helpers for settings sections |
| `src/settings/platform.ts` | `isMobile`, `isMobilePlatform` | Single import point for `Platform.isMobile` |
| `src/settings/sections/repository.ts` | `renderRepositorySection` | Transport protocol, repo URL, branch, remote, local path |
| `src/settings/sections/authentication.ts` | `renderAuthenticationSection` | HTTPS auth, SSH key source/credentials/port |
| `src/settings/sections/author.ts` | `renderAuthorSection` | Author name/email, git config auto-detect |
| `src/settings/sections/masterKey.ts` | `renderMasterKeySection` | Key source (keychain/file/manual), generation, validation |
| `src/settings/sections/advanced.ts` | `renderAdvancedSection` | Auto pull/push, sync interval, exclude patterns, conflicts |
| `src/services/systemService.ts` | `SystemService` class, result types | All desktop-native operations (shell, fs, keychain, git) |
| `src/services/cryptoGitService.ts` | `CryptoGitService` class, result types | git-remote-crypto integration: cryptoPull/cryptoPush/cryptoStatus/cryptoCommit |
| `src/services/nodeContext.ts` | `getNativeModule`, `getModule<T>`, `isMobile` | Safe Node/Electron module loading with mobile guards |
| `src/ui/ribbon.ts` | `GitRibbon` class | Sidebar ribbon icon + context menu with Git operations |

### Data Flow

#### Plugin Lifecycle

```
1. Obsidian activates plugin → GitEncryptPlugin.onload()
2. loadSettings():
   a. this.loadData() — load from Obsidian's data.json
   b. merge with DEFAULT_SETTINGS
   c. if masterKeySource === "keychain":
      → sys.loadKeyFromKeychain() → decrypt from safeStorage
      → on failure: fall back to manual, show Notice
3. sys = new SystemService(this)
4. cryptoSvc = new CryptoGitService(this)
5. ribbon = new GitRibbon(this); ribbon.register() → adds ribbon icon
6. settingsTab = new GitEncryptSettingTab() → addSettingTab()
```

#### Settings Save

```
1. User changes a setting in any section
2. onChange handler → this.plugin.settings.field = newValue
                → await this.plugin.saveSettings()
3. saveSettings() → this.saveData(this.settings) (JSON to data.json)
4. On reload: loadSettings() reads data.json, merges with defaults
```

#### Git Operations (Ribbon Menu)

```
User clicks ribbon icon → showGitMenu() → creates Menu with 5 items:

  Status    → cryptoSvc.cryptoStatus()   → show summary count
  Commit    → cryptoSvc.cryptoCommit()   → git add -A + git commit
  Merge     → sys.gitMerge(branch)       → git merge <branch>
  Pull      → cryptoSvc.cryptoPull()     → git-remote-crypto pull
  Push      → cryptoSvc.cryptoPush()     → git-remote-crypto push

All use runGitOp() wrapper → try/catch → Notice(output)
```

### Platform Abstraction

| Layer | File | Key Exports | Desktop | Mobile |
|-------|------|-------------|---------|--------|
| Platform detection | `settings/platform.ts` | `isMobile` | `false` | `true` |
| Module loader | `services/nodeContext.ts` | `getNativeModule()`, `getModule<T>()` | loads Node modules | returns null |

Every service method checks `isMobile` as its first guard:
- `SystemService` methods return `null` / safe defaults on mobile
- Settings sections hide platform-incompatible controls (file picker, keychain, git config auto-detect, SSH key path)
