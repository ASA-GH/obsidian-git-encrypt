# User Scenarios — Git Encrypt

C4 Context diagram: [`user_scenarios_context.puml`](user_scenarios.puml) — открой в IDEA для превью.

6 элементов: Desktop User, Mobile User, Plugin, Remote Repo, Repo Admin, Keychain, Key Manager.
7 связей: установка, настройка, push/pull, управление ключами, кросс-девайс флоу.

## Key Scenario Flows

### First Sync (State B — has notes, no repo)
```
Desktop User → creates repo (Repo Admin) → configures plugin → Push → encrypted blobs → First Pull → local files encrypted
```

### Cross-Device Setup
```
Desktop User: keychain → generates key → Mobile User: paste key → same repo → Pull/Push
```

### Key Loss Recovery
```
Key Manager loses key → files permanently unreadable → restore from backup or re-enter correct key
```

### Migration (State F — plain .git → encrypted)
```
Desktop User: plain .git → backup → configure plugin → Push (creates .git-encrypted/) → Pull (decrypts) → encrypted + plain backup
```

## Scenario Coverage by Context Elements

| Element | Scenarios Covered |
|---------|------------------|
| **Desktop User** | S1 (fresh install), S2–S6 (states A–F), S14 (transport switch), S15 (key source switch), S16 (SSH auto-detect), S17 (author auto-detect), S23 (local path change) |
| **Mobile User** | S7 (mobile first-time setup), S15 (forces manual key on mobile), S12 (keychain unavailable on mobile) |
| **Repository** | S1–S6 (repo creation, connection, migration), S21 (branch switch), S22 (remote name change), S4 (existing repo warning) |
| **Repository Administrator** | S1–S4 (creating repo outside plugin), S4 (not initializing with README) |
| **Keychain** | S1 (keychain/file/manual setup), S5 (restore from backup), S12 (locked/corrupted/unavailable), S15 (manual → keychain) |
| **Key Manager** | S1 (key generation and storage), S13 (wrong key), S20 (no key), S12 (keychain errors) |

---

User-facing flows for every initial state and action path in the Git Encrypt plugin. Each scenario covers **what the user sees**, **what the plugin does**, and **what happens next** — concretely, with no hand-waving.

---

## State Matrix

Before the flows, here are the initial states a user can be in:

| # | Vault | Remote Repo | Local `.git-encrypted/` | Plain `.git/` |
|---|-------|-------------|-------------------------|---------------|
| A | Fresh (no notes) | Does not exist | Absent | Absent |
| B | Has notes | Does not exist | Absent | Absent |
| C | Has notes | Exists, empty | Absent | Absent |
| D | Has notes | Exists, has data | Absent | Absent |
| E | Has notes | Exists | Present, has data | Absent |
| F | Has notes | Exists | Absent | Present (plain Git) |

Each scenario below maps to one or more rows from this matrix.

---

## 1. Fresh Install — No Repo, No Notes (State A)

**User:** Just installed the plugin. Vault is empty or has default notes. No remote repo.

### Steps the user takes:

1. **Settings → Repository connection**
   - Sees "Encrypted remote repository" info callout (always visible) — explains that the remote will contain only encrypted blobs
   - Transport dropdown: HTTPS or SSH (default: HTTPS)
   - Repository URL field: empty, placeholder shows example URL

2. **Creates repo on GitHub/GitLab** (outside the plugin)
   - User goes to github.com → New Repository → creates empty repo
   - **Important:** does NOT initialize with README, .gitignore, or any files — the plugin will create the encrypted structure

3. **Pastes URL back into plugin**
   - URL field: `https://github.com/user/my-vault.git`
   - Validates format, saves immediately on change

4. **Branch**: `main` (default, editable)

5. **Remote name**: `origin` (default, editable)

6. **Local path**: `.git-encrypted` (desktop only, editable)
   - User doesn't need to create this folder — the plugin creates it automatically on first push

7. **Authentication** (HTTPS)
   - Username: their GitHub/GitLab username
   - Personal access token: masked input, entered manually

8. **Authentication** (SSH)
   - Key source: `manual` (desktop can auto-detect from git config)
   - Private key text: paste `-----BEGIN OPENSSH PRIVATE KEY-----` block
   - Passphrase: optional, masked
   - Port: `22` (default)

9. **Commit author**
   - Desktop: can auto-detect from `git config --global user.name/email` or enter manually
   - Mobile: manual entry only
   - Default: `Obsidian User / user@obsidian.md`

10. **Master key**
    - **Desktop:**
      - Select "System Keychain" → click "Generate & save to keychain"
      - Plugin generates 32 random bytes → base64-encodes → saves via `electron.safeStorage.encryptString()`
      - `encryptedMasterKey` setting is populated; `masterKeyHex` is cleared
    - **Alternative (desktop):**
      - Select "Key File" → enter path → click "Generate new key file"
      - Plugin creates file with 64-char hex key, mode 0o600
    - **Manual (all platforms):**
      - Click "Generate key" → 32 random bytes → 64-char hex → fills input
      - Or type/paste a 64-char hex key manually

11. **Advanced settings**
    - Auto pull on startup: OFF (default)
    - Auto push on exit: OFF (default)
    - Sync interval: 0 (disabled)
    - Exclude patterns: `.obsidian`, `.trash`, `temp.*` (default)
    - Conflict action: `ask` (default)

12. **Ready to push**

**Result:** Settings saved. Nothing has been pushed or pulled yet. The vault is unchanged — all notes are still in plain text locally.

---

## 2. Fresh Install — Has Notes, No Repo (State B)

**User:** Has an Obsidian vault with real notes. No remote repo. Never used Git Encrypt before.

### Steps the user takes:

Steps 1-10 are identical to Scenario 1 (create repo on GitHub/GitLab, configure URL, auth, key, author).

**The difference starts at step 11:**

### First Push (State B → encrypted on remote)

1. User clicks ribbon icon → "Push (Encrypt)"
2. Plugin executes `git push origin main`
3. `git-remote-crypto` transport intercepts:
   - Reads every `.md` file from the vault
   - Encrypts each file with the master key
   - Pushes encrypted blobs to the remote
4. **Local files do NOT change** — they remain in plain text
5. User sees Notice: "Pushed encrypted to remote."

### First Pull (same device)

1. User clicks ribbon icon → "Pull (Decrypt)"
2. Plugin executes `git pull origin main`
3. `git-remote-crypto` transport intercepts:
   - Downloads encrypted blobs from the remote
   - Decrypts each file with the master key
   - **Overwrites local `.md` files with encrypted content**
4. **Local files become encrypted** — `.md` files now contain binary gibberish in the OS file manager
5. In Obsidian, files are decrypted on-the-fly and remain readable (requires the master key to be set)
6. User sees Notice: "Pulled and decrypted from remote."

> [!WARNING]
> After the first pull, local `.md` files contain encrypted binary data. In the OS file manager, they look like corrupted binary files. This is normal — Obsidian decrypts them in-memory when the master key is loaded.

### What if the user forgets the key?

- Files in the vault are encrypted with the master key
- Without the key, files are permanently unreadable
- The plugin cannot recover the key from the keychain (it's cleared after save) or from the remote (only encrypted blobs exist)
- **The user must back up the key** — the "Save your key before syncing" warning in the Master Key section

---

## 3. Fresh Install — Has Notes, Empty Remote (State C)

**User:** Has notes locally. Created an empty remote repo on GitHub/GitLab. Connected it in the plugin.

### Identical to Scenario 2 (Fresh Install — Has Notes, No Repo)

The remote being "empty" is the expected state for a new repo. The flow is:

1. **Push** → all local notes encrypted → pushed to remote → remote now has encrypted files
2. **Pull** → encrypted files downloaded → decrypted → overwrite local notes → local vault now has encrypted files
3. After this sequence, both local and remote are in sync with encrypted data

**No difference from Scenario 2** — the plugin doesn't check if the remote is empty before pushing. It just pushes whatever is in the local vault.

---

## 4. Fresh Install — Has Notes, Remote Has Data (State D)

**User:** Has notes locally. The remote repo was initialized with a README or .gitignore (or has data from a previous user/setup).

### Warning shown

When `repositoryUrl` is non-empty in settings, repository.ts renders a **warning callout**:

> **"Existing repository detected"**
> You are connecting to a repository that already contains data. Your local vault files may be overwritten on the next pull. Make a backup of your vault before proceeding.

### What happens on first Pull

1. Plugin executes `git pull origin main`
2. `git-remote-crypto` downloads encrypted files from remote
3. **Merge conflict** between local plain-text files and remote encrypted files
4. Conflict resolution strategy determines the outcome:

| Strategy | Behavior |
|----------|----------|
| `ask` | Git opens a merge conflict. The user must manually resolve each file. |
| `abort` | Pull is cancelled. Local files unchanged. |
| `theirs` | Remote encrypted files overwrite local plain-text files. Local vault becomes encrypted. |
| `ours` | Local plain-text files are kept. Remote encrypted files discarded. |

> [!WARNING]
> Picking `theirs` on the first pull will replace ALL local notes with encrypted binary data. The user should only do this if they trust the remote data and have a backup.

### What happens on first Push

1. Plugin executes `git push origin main`
2. `git-remote-crypto` tries to push
3. **Remote has data that local doesn't** → push rejected with "non-fast-forward" error
4. User must pull first (resolve conflicts), then push

### Recommended flow for State D

1. **Make a backup** of the vault (copy to another location)
2. **Decide:** do you want the local vault to become encrypted, or do you want to merge?
3. If you want encrypted: `Pull` → choose `theirs` → local vault becomes encrypted
4. Then `Push` → encrypted files sent to remote
5. Result: both local and remote are encrypted

---

## 5. Restore from Backup — Vault with `.git-encrypted/` (State E)

**User:** Had a working Git Encrypt setup. Restored from a backup. The vault contains a `.git-encrypted/` folder with an existing encrypted Git repository.

### What the plugin sees

- `repositoryUrl` is set (from saved settings)
- `.git-encrypted/` folder exists with a valid Git repository
- Master key may be in keychain (if restored), manual, or file

### What happens

1. **Ribbon → Status** → `git status --short` runs against `.git-encrypted/` → shows changes
2. **Ribbon → Pull** → `git pull` decrypts files into the vault
3. **Ribbon → Push** → `git push` encrypts files to the remote

**No special handling** — the plugin works with whatever `.git-encrypted/` path is configured. If the backup includes both the vault files and the `.git-encrypted/` folder, everything should work as-is.

> [!NOTE]
> If the backup was made before the first push (no `.git-encrypted/` folder yet), see Scenario 2.

---

## 6. Migration — Plain `.git/` to Encrypted (State F)

**User:** Has an existing Obsidian vault with a plain-text `.git/` directory. Wants to migrate to encrypted Git using Git Encrypt.

### What the plugin sees

- No `.git-encrypted/` folder (unless one was created)
- `.git/` folder exists with plain-text Git history
- `repositoryUrl` may or may not be set

### What happens

**Git Encrypt does NOT manage `.git/`** — it uses a separate directory (`.git-encrypted/` by default). The plain `.git/` remains untouched.

### Migration steps

1. **Configure the plugin** (URL, auth, key, author) — same as Scenario 1
2. **Decide:** keep the existing `.git/` or replace it?

   **Option A: Keep `.git/`, add `.git-encrypted/`**
   - The plugin creates `.git-encrypted/` on first push
   - The vault now has two Git directories: `.git/` (plain) and `.git-encrypted/` (encrypted)
   - This is safe but confusing — the user should `.gitignore` one of them

   **Option B: Replace `.git/` with `.git-encrypted/`**
   - Rename `.git/` → `.git/plain-backup` (backup)
   - Set local path to `.git/` (the plugin will recreate it on first push)
   - **Risk:** if the first push fails, the plain-text history is gone

   **Option C: Keep `.git/` for plain commits, use `.git-encrypted/` only for encrypted sync**
   - Push to plain `.git/` for readable commits
   - Use Git Encrypt ribbon for encrypted push/pull to `.git-encrypted/`
   - Requires two separate remotes

### The "sane" migration path

1. Make a backup of the vault
2. Run `git pull` on the plain `.git/` repo — download all notes locally in plain text
3. Rename `.git/` → `.git/plain-backup`
4. Configure Git Encrypt with the same repo URL
5. First Push → creates `.git-encrypted/`, pushes encrypted files
6. First Pull on same device → decrypts files into vault
7. Result: encrypted `.git-encrypted/` + backup of plain `.git/`

---

## 7. First Setup on Mobile (States A, B, C)

**User:** Installs Git Encrypt on mobile (Android/iOS). No desktop setup done yet.

### Platform-specific constraints

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Keychain storage | Yes (safeStorage) | No — falls back to manual |
| Key file storage | Yes (fs access) | No — falls back to manual |
| SSH key from git config | Yes (auto-detect) | No — falls back to manual |
| SSH key file path | Yes (input field) | No — falls back to manual |
| Author from git config | Yes (auto-detect) | No — falls back to manual |
| Local path picker | Yes (`.git-encrypted`) | No — hidden |

### Mobile flow

1. **Repository connection** — same as desktop (URL, branch, remote, protocol)
2. **Authentication**
   - HTTPS: username + token
   - SSH: paste key text (no file picker, no auto-detect)
3. **Author** — manual entry only (name + email)
4. **Master key**
   - Only "Enter Manually" option is available
   - Click "Generate key" → 32 random bytes → 64-char hex
   - Or paste a key generated on desktop
   - **No "Move to keychain" button** (not available on mobile)
5. **Advanced settings** — same as desktop (all toggles, patterns, conflicts)

**Note:** If the user previously set up on desktop with keychain, they must copy the key from desktop and paste it on mobile. The key is never transmitted between devices — it's user-mediated.

---

## 8. Auto-Pull on Startup (All States)

**Trigger:** `autoPullOnStart: true` in settings.

### What the plugin does

The plugin does **NOT** have auto-pull logic implemented in `onload()`. The setting exists in `DEFAULT_SETTINGS` and is rendered in the Advanced settings section, but no code executes a pull on startup.

### Current state

- The toggle exists in the UI
- The value is saved to settings
- **Nothing happens on startup** — auto-pull is a no-op until implemented

### Future behavior (when implemented)

1. Plugin loads settings
2. If `autoPullOnStart` is true:
   - Check if master key is available (keychain loaded, or manual entry)
   - If key unavailable → show Notice, skip pull
   - If key available → execute `sys.gitPull()`
   - If merge conflict → resolve per `conflictAction` setting

---

## 9. Auto-Push on Exit (All States)

**Trigger:** `autoPushOnClose: true` in settings.

### What the plugin does

The plugin does **NOT** have auto-push logic implemented. The setting exists but no code executes a push on exit.

### Current state

- The toggle exists in the UI
- The value is saved to settings
- **Nothing happens on exit** — auto-push is a no-op until implemented

### Future behavior (when implemented)

1. Obsidian closes (or vault switches)
2. If `autoPushOnClose` is true:
   - Check if master key is available
   - Execute `sys.gitPush()`
   - Show Notice with result (success/fail)

---

## 10. Background Sync (Sync Interval)

**Trigger:** `syncIntervalMinutes > 0` in settings.

### What the plugin does

**Nothing.** The setting exists but no interval timer is implemented.

### Future behavior (when implemented)

1. After plugin load, start a timer for `syncIntervalMinutes`
2. Every interval: execute pull (decrypt) + push (encrypt)
3. Skip if key is unavailable → log to console, show Notice on next UI interaction

---

## 11. Merge Conflict During Pull

**Trigger:** `git pull` detects conflicting changes between local and remote.

### Current code behavior

The plugin calls `sys.gitPull()` which runs `git pull origin <branch>`. Git itself handles the conflict resolution based on the `conflictAction` setting:

| Setting | Git behavior |
|---------|-------------|
| `ask` | Merge conflict left for user to resolve manually |
| `abort` | Pull aborted, local files unchanged |
| `theirs` | Remote version wins, local overwritten |
| `ours` | Local version wins, remote discarded |

**The plugin does NOT intercept or customize this behavior.** It just runs the git command and shows the raw output as a Notice.

### User-facing flow

1. User clicks "Pull (Decrypt)" in ribbon
2. `runGitOp()` wraps `gitPull()` in try/catch
3. On conflict:
   - `git pull` exits with non-zero → error thrown
   - `runGitOp()` catches the error → shows Notice: `"Pull failed: <error message>"`
4. User must manually resolve conflicts in their file manager, then re-run

> [!NOTE]
> If `conflictAction` is set to `theirs` or `ours`, git applies the resolution automatically and the pull succeeds (or fails for other reasons).

---

## 12. Keychain Errors (Desktop)

### Keychain locked (State: desktop session locked/locked screen)

1. User loads plugin with `masterKeySource: "keychain"`
2. `loadSettings()` calls `sys.loadKeyFromKeychain()`
3. `safeStorage.decryptString()` fails with error containing "lock" or "unlock"
4. `classifyKeychainError()` → returns `{ success: false, error: "locked" }`
5. **Result:**
   - `masterKeySource` set to `"manual"`
   - `masterKeyHex` cleared to `""`
   - `saveSettings()` called
   - Notice: "System keychain is locked. Unlock your OS login/session and restart Obsidian..."

6. User must either:
   - Unlock OS session and restart Obsidian (keychain will auto-load), OR
   - Go to settings → Master Key → enter key manually

### Keychain corrupted (State: keychain data encrypted with different key)

1. Same flow as above
2. Error contains "decrypt", "corrupt", "invalid", "malformed", or "mismatch"
3. Notice: "The keychain data is corrupted... Switching to manual entry — you'll need to re-save your key to the keychain after entering it manually."
4. User enters key manually → "Move to keychain" button → re-encrypts and saves

### Keychain unavailable (State: mobile or Electron module missing)

1. `getModule<ElectronModule>("electron")` returns `null`
2. `loadKeyFromKeychain()` → `{ success: false, error: "unknown", details: "Electron module unavailable" }`
3. Same fallback: manual entry required

### Keychain save failure

1. User clicks "Generate & save to keychain" or "Move to keychain"
2. `saveKeyToKeychain()` fails (e.g., encryption not available)
3. Setting description updated to: "Failed to access system secure storage: <error>"
4. Key remains in manual entry field — not saved

---

## 13. Wrong Master Key (All States)

**User:** Enters a master key that is different from the one used to encrypt files on the remote.

### What happens

1. `isValidHexKey()` validates the input — 64 hex chars → passes
2. Key is saved to `masterKeyHex`
3. User clicks "Pull (Decrypt)"
4. `git pull` downloads encrypted blobs
5. `git-remote-crypto` attempts to decrypt each file with the wrong key
6. **Result depends on `git-remote-crypto`:**
   - Files may be corrupted (partial decryption)
   - Files may be unreadable binary
   - Pull may fail with decryption error
7. User sees the corrupted files in Obsidian (if decrypted) or an error Notice (if pull fails)

### Recovery

1. User must re-enter the correct key in settings
2. Re-run "Pull (Decrypt)"
3. Files are re-decrypted with the correct key

> [!WARNING]
> The plugin cannot detect a wrong key before pulling. The user must verify the key is correct before their first pull.

---

## 14. Transport Protocol Switch (HTTPS ↔ SSH)

**Trigger:** User changes transport dropdown in settings.

### What the code does

1. `transportType` updated in settings
2. `saveSettings()` called
3. `refreshSettingsTab()` — re-renders the entire settings tab
4. `updateProtocolVisuals()` — updates the URL field placeholder and description in-place (without full re-render)
5. Authentication section re-renders with the new protocol's fields:
   - **HTTPS:** username + token fields
   - **SSH:** key source dropdown, key text/path, passphrase, port

### Side effect

All settings fields are re-rendered from saved state. No data is lost — all values are read from `plugin.settings` and restored.

---

## 15. Master Key Source Switch

### Manual → Keychain (Desktop)

1. User changes dropdown to "System Keychain"
2. Settings tab re-renders
3. Keychain section shows: "System credential storage" with "Generate & save to keychain" button
4. User clicks button → generates new random key → encrypts → saves to keychain
5. `encryptedMasterKey` populated, `masterKeyHex` cleared
6. Settings tab re-renders — manual entry section still shows (empty key field)

### Manual → File (Desktop)

1. User changes dropdown to "Key File"
2. Settings tab re-renders
3. File section shows: path input + "Validate file" + "Generate new key file" buttons
4. User can enter a path, validate it, or generate a new key

### Keychain/File → Manual (Desktop)

1. User changes dropdown to "Enter Manually"
2. Settings tab re-renders
3. Keychain/File sections hidden
4. Manual entry section shows — key field is empty (key was cleared when switching to keychain/file)
5. User must re-enter or generate a key

### Any → Manual (Mobile)

1. Mobile always forces `masterKeySource: "manual"`
2. If user was on desktop with keychain and switches to mobile:
   - `renderMasterKeySection()` checks `isMobilePlatform`
   - Forces `masterKeySource` to `"manual"`
   - Saves settings
   - Only manual entry section is shown

---

## 16. SSH Key Auto-Detect Failure (Desktop)

### SSH key source = "Use key from Git"

1. `renderAuthenticationSection()` renders SSH section
2. `plugin.sys.getGitSshKeyPath()` is called:
   - Checks `git config --global core.sshCommand` for `-i <path>`
   - Falls back to `~/.ssh/id_rsa`, `id_ed25519`, `id_ecdsa` (checks existence with `fs.access`)
3. If no key found:
   - Setting description shows: "Failed to detect key path. Please select manual input or verify Git configuration."
   - User can click "Check" to retry
   - User can switch to "Enter key manually"

---

## 17. Author Auto-Detect Failure (Desktop)

### Author data source = "Use global Git config"

1. `renderAuthorSection()` renders author section
2. `plugin.sys.getGitGlobalUser()` calls:
   - `git config --global user.name` → trimmed → shown in read-only field
   - `git config --global user.email` → trimmed → shown in read-only field
3. If Git config not set:
   - Name field: empty (read-only)
   - Email field: empty (read-only)
   - "Refresh from Git" button to retry
4. User can switch to "Enter manually" to type values

---

## 18. Exclude Patterns

**User:** Wants to exclude certain files from encryption (e.g., `.obsidian/`, `temp.*`).

### What the code does

- `excludePatterns` is saved as a string in settings
- Comma-separated or newline-separated patterns
- Default: `.obsidian\n.trash\temp.*`
- **The plugin does NOT implement exclusion logic** — the setting is saved but `git-remote-crypto` is responsible for actually applying exclusions during push/pull

---

## 19. Ribbon Icon — No Config Set

**User:** Installs plugin, opens ribbon icon before configuring any settings.

### What the user sees

Ribbon menu opens with 5 items:

| Item | Behavior when no config set |
|------|---------------------------|
| Status | Shows `git status --short` output (may be empty if no `.git-encrypted/` yet) |
| Stage & Commit | Runs `git add -A` + `git commit` — may fail if no Git repo initialized |
| Merge Branch | Runs `git merge main` — may fail if no commits exist |
| Pull (Decrypt) | Runs `git pull origin main` — fails with "no remote" error if no URL configured |
| Push (Encrypt) | Runs `git push origin main` — fails with "no remote" error if no URL configured |

**All operations use `runGitOp()` wrapper:**
- Success → Notice with output (truncated to 50 chars for commit)
- No output → Notice: "Operation completed (no output)."
- Error → Notice: "Operation failed: <error message>" (shown for 10s)

---

## 20. Error — No Key Set, Attempt Pull/Push

**User:** Configured URL but hasn't set a master key yet.

### Pull without key

1. Ribbon → Pull
2. `git pull` downloads encrypted blobs
3. `git-remote-crypto` tries to decrypt — fails because no key is configured
4. Error thrown → Notice: "Pull failed: <decryption error>"

### Push without key

1. Ribbon → Push
2. `git push` encrypts files — fails because no key is configured
3. Error thrown → Notice: "Push failed: <encryption error>"

---

## 21. Branch Switch

**User:** Changes the branch field from `main` to `feature-branch`.

### What happens

1. `branch` setting updated and saved
2. All future ribbon operations use the new branch:
   - Pull → `git pull origin feature-branch`
   - Push → `git push origin feature-branch`
   - Merge → `git merge feature-branch`

**No validation** — the branch doesn't need to exist yet. Git will create it on first push (if configured for upstream).

---

## 22. Remote Name Change

**User:** Changes remote name from `origin` to `upstream`.

### What happens

1. `remoteName` setting updated and saved
2. All future operations use the new remote name:
   - Pull → `git pull upstream main`
   - Push → `git push upstream main`

**No validation** — the remote doesn't need to exist in the local Git config. Git commands will fail if the remote is not configured.

---

## 23. Local Path Change (Desktop)

**User:** Changes local path from `.git-encrypted` to `.my-vault-encrypted`.

### What happens

1. `localPath` setting updated and saved
2. **The plugin does NOT move the existing `.git-encrypted/` folder** — it remains on disk at the old location
3. Future operations target the new path:
   - If the new path doesn't exist, `git push` will fail (no Git repo to push from)
   - First push will create a new Git repo at the new path
4. User should manually delete the old folder if no longer needed

---

## 24. Settings Reset (Implicit)

**Trigger:** Plugin updates, or settings are cleared.

### What happens

1. `loadSettings()` merges loaded data with `DEFAULT_SETTINGS`
2. Missing fields are filled with defaults:
   - `transportType: "https"`
   - `branch: "main"`
   - `remoteName: "origin"`
   - `localPath: ".git-encrypted"`
   - `authorName: "Obsidian User"`, `authorEmail: "user@obsidian.md"`
   - `masterKeySource: "manual"`, `masterKeyHex: ""`
   - `conflictAction: "ask"`
   - `syncIntervalMinutes: 0`
   - `excludePatterns: ".obsidian\n.trash\temp.*"`

### What is NOT reset

- Fields that were saved retain their values
- Only missing fields get defaults
- If a field was previously set and then removed from `data.json`, it gets the default value

---

## Coverage Summary

| Scenario | State | Covered |
|----------|-------|---------|
| Fresh install, no notes, no repo | A | Section 1 |
| Fresh install, has notes, no repo | B | Section 2 |
| Fresh install, has notes, empty remote | C | Section 3 |
| Fresh install, has notes, remote has data | D | Section 4 |
| Restore from backup, .git-encrypted exists | E | Section 5 |
| Migration: plain .git → encrypted | F | Section 6 |
| Mobile first-time setup | B (mobile) | Section 7 |
| Auto-pull on startup | All | Section 8 |
| Auto-push on exit | All | Section 9 |
| Background sync interval | All | Section 10 |
| Merge conflict during pull | D, E | Section 11 |
| Keychain locked | All (desktop) | Section 12 (locked) |
| Keychain corrupted | All (desktop) | Section 12 (corrupted) |
| Keychain unavailable | Mobile / headless | Section 12 (unavailable) |
| Wrong master key | All | Section 13 |
| HTTPS ↔ SSH switch | All | Section 14 |
| Manual ↔ Keychain/File switch | A-D (desktop) | Section 15 |
| SSH auto-detect fails | B (desktop) | Section 16 |
| Author auto-detect fails | B (desktop) | Section 17 |
| Exclude patterns | All | Section 18 |
| Ribbon before config | All | Section 19 |
| Pull/push without key | All | Section 20 |
| Branch change | All | Section 21 |
| Remote name change | All | Section 22 |
| Local path change | All (desktop) | Section 23 |
| Settings reset / merge with defaults | All | Section 24 |

---

## Code Audit (2026-08-09)

Full audit results in [TASKS.md#bugs](TASKS.md#--bugs).

### Mismatches tracked in TASKS.md

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| A1 | Manual entry always rendered | MEDIUM | ⬜ Next: hide when keychain/file active |
| A2 | "Move to keychain" generic error | LOW | ⬜ Next: map error codes to messages |
| A3 | No "Move to file" button | MISSING | ⏳ Deferred |
| A4 | Local path change no warning | MEDIUM | ⬜ Next: add warning callout |
| A6 | Author auto-detect no guidance | MEDIUM | ⬜ Next: show "no config" message |
| A8 | conflictAction not applied | MEDIUM | ⬜ Next: verify crypto fallback |
| A5 | Migration link broken | ✅ | Fixed → `#6-migration` in repository.ts:28 |
