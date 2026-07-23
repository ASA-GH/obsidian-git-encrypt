# User Scenarios

User-facing flows for every settings category in the Git Encrypt plugin. Each scenario describes **who**, **what**, and **how it differs by platform**.

---

## 1. Repository Configuration

### Desktop
- User opens settings → selects transport protocol (HTTPS / SSH)
- User enters repo URL, branch, remote name
- User optionally picks a local path for the bare repo
- **UI redraws** when switching between HTTPS and SSH

### Mobile
- Same as desktop but with fewer path-related options
- No local path picker (uses Obsidian data directory)

---

## 2. Authentication

### HTTPS Transport
- User enters username and personal access token
- Token field is masked (password input)
- Input trimmed and validated

### SSH Transport (Desktop)
- User can auto-detect SSH key path from `git config --global core.sshCommand`
- Or manually enter key text / pick key file
- Optional passphrase (masked)
- Port configuration

### SSH Transport (Mobile)
- SSH key must be pasted as text (no file picker)
- No auto-detection

---

## 3. Author Configuration

### Desktop
- User name and email fields with auto-detect from `git config`
- Manual refresh button to re-read Git config

### Mobile
- Manual entry only (no Git config access)

---

## 4. Master Key

### Keychain Source (Desktop Only)
- User selects "System Keychain" as key source
- Plugin saves/loads encrypted key via Electron `safeStorage`
- On startup, plugin attempts to decrypt and load key automatically
- **This is the recommended desktop flow**

### File Source (Desktop Only)
- User selects "File" as key source
- Plugin validates the key file exists and contains a valid 64-char hex key
- "Generate & Save" button creates a secure 32-byte (64 hex) key file
- Example path uses `Vault#configDir` for dynamic resolution

### Manual Entry (All Platforms)
- User pastes or types the 64-char hex key
- Key field is masked
- Validation: length (64 chars), hex characters only, whitespace trimmed
- Mobile users **always** use this method

---

## 5. Advanced Settings

### Auto Sync (All Platforms)
- Toggle: auto pull on vault open
- Toggle: auto push on file change
- Configurable sync interval (minutes)

### Exclude Patterns (All Platforms)
- Text area for glob patterns (one per line)
- Default patterns for Obsidian system files

### Conflict Resolution (All Platforms)
- Dropdown: keep both / keep local / keep remote
- Conflict file extension configuration

---

## Platform Transition Scenario

User starts on **Desktop**, configures everything (keychain, SSH auto-detect, etc.), then opens the vault on **Mobile**:

1. Settings tab renders with mobile-only options
2. Keychain and file sources are hidden; master key falls back to manual entry
3. SSH auto-detect buttons are hidden; key must be pasted as text
4. Git author auto-detect is hidden; name/email entered manually
5. Repository and advanced settings are unchanged (platform-agnostic)

**Goal:** zero-knowledge — the key is never transmitted; the user must re-enter it on each platform.

---

## 7. First-Time Setup — Understanding the Encrypted Repo

**Context:** The user just installed Git Encrypt for the first time. They are opening the Obsidian settings and clicking into the plugin's settings tab. They have never used Git, `git-remote-crypto`, or encrypted remotes before.

### Scenario 7a: "Does my remote need to exist first?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection`

**What the user sees:**
1. Transport protocol dropdown (HTTPS / SSH)
2. Repository URL field (empty, with placeholder examples)
3. Branch / Remote name fields
4. Local path field (desktop only)

**User questions:**
- "Do I need to create a GitHub repo before entering the URL here, or will the plugin create it?"
- "The URL is empty — is that normal, or is something wrong?"
- "What does the `git@github.com:…` placeholder mean?"

**Current behavior:**
- Settings tab shows empty `repositoryUrl` with static placeholder text
- No indication that the remote must pre-exist
- No link to documentation explaining the encrypted remote concept
- No "Help me set up" flow

**Gap:** User has no guidance that they must create a *regular* (unencrypted) Git remote first, then configure the plugin to encrypt traffic to it. The settings tab is silent about this prerequisite.

**Platform note:** Same for all platforms — no platform-specific difference here.

---

### Scenario 7b: "What is an encrypted remote?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection`

**What the user expects to understand:**
- The remote repo on GitHub/GitLab will contain **only encrypted files** (blobs of gibberish), not human-readable markdown
- Their vault notes are safe on the server because they are encrypted with the master key the user controls
- The local `.git-encrypted` directory replaces the traditional `.git` directory

**Current behavior:**
- No explanation of what `git-remote-crypto` does
- No visual hint that the remote will look different from a normal GitHub repo
- `createSettingGroup` shows only the title — no collapsible "how it works" section

**Gap:** Zero educational content in the UI. A user unfamiliar with `git-remote-crypto` will not understand why the remote contains unreadable files.

---

### Scenario 7c: "Where do I create the remote repo?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection`

**User types:** A URL like `https://github.com/myuser/my-vault.git`

**Questions:**
- "Do I go to github.com → New Repository → create it → then paste the URL?"
- "Should I initialize the repo with a README or .gitignore?"
- "What if I'm using GitLab / Gitea / self-hosted?"

**Current behavior:**
- Placeholder shows example URL format but doesn't explain where to create the repo
- No link to a setup guide
- No differentiation between platforms (GitHub vs GitLab vs self-hosted)

**Gap:** The settings UI assumes the user already knows how to create a Git remote. No guidance for Git beginners or for platform-specific repo creation.

---

### Scenario 7d: "Local path — what is `.git-encrypted`?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection → Local path`

**What the user sees:**
- Label: "Local path"
- Description: "Folder inside the vault where the encrypted Git repository will be located."
- Default value: `.git-encrypted`

**User questions:**
- "What does `.git-encrypted` mean? Is this like `.git`?"
- "Do I need to create this folder manually?"
- "Can I put it anywhere in my vault?"
- "What happens if I change this after my first push?"

**Current behavior:**
- Description explains *what* the folder is for, but doesn't explain *how* the plugin creates/manages it
- No warning that the folder must stay inside the vault
- No explanation that `.git-encrypted` replaces `.git`

**Gap:** The description is accurate but assumes familiarity with Git internals. A user won't understand that the plugin manages this folder automatically.

**Mobile note:** Currently shown on mobile (known bug — task #24). Mobile should hide this entirely since Obsidian manages the data directory.

---

## 8. First Push — "Will my notes be safe?"

**Context:** User has configured all settings (URL, auth, key, branch). They are now in the settings tab and want to understand what happens next.

### Scenario 8a: "What happens on my first push?"

**Path:** `Obsidian → Settings → Git Encrypt → Advanced → Auto push on close` (or manual push later)

**User questions:**
- "What will happen when I push for the first time?"
- "Will my unencrypted notes be sent to the server?"
- "Will the server repo be overwritten?"
- "Can I see the encrypted files before I commit?"

**Current behavior:**
- No explanation in settings about what push/pull does
- No mention that `git-remote-crypto` encrypts on push and decrypts on pull
- No "first-time warning" or educational banner
- The plugin has no UI for push/pull triggers (ribbon icon is empty — task #25)

**Gap:** The user has no idea that every file in the vault will be encrypted during transit. This is the most anxiety-inducing moment for a new user.

---

### Scenario 8b: "What about my first pull?"

**Path:** `Obsidian → Settings → Git Encrypt → Advanced → Auto pull on start`

**User questions:**
- "If I push first, then open on another device, what gets pulled?"
- "Will pulling decrypt files automatically?"
- "What if the remote is empty (fresh repo)?"

**Current behavior:**
- Toggle says "Auto pull on start" but doesn't explain *what* it pulls or from where
- No mention that the pull direction also decrypts
- No handling of empty remote (first pull into empty repo)

**Gap:** Same educational gap as push — the user doesn't know that the remote-side transport layer handles encryption transparently.

---

## 9. First-Time Setup — Master Key Anxiety

**Context:** The user has set up the repository. Now they are at the Master Key section and see multiple options (keychain/file/manual).

### Scenario 9a: "Why do I need a master key?"

**Path:** `Obsidian → Settings → Git Encrypt → Master Key`

**User questions:**
- "What is a master key?"
- "What happens if I lose it?"
- "Can the plugin creator or server admin read my notes?"
- "Why are there three different sources?"

**Current behavior:**
- Dropdown shows "Keychain / File / Manual" but no explanation of *why*
- "Zero-knowledge" concept is not mentioned anywhere in the UI
- No link to security documentation
- The most secure option (keychain) is described by technical term ("System Keychain") not by benefit ("encrypted by your OS, never exposed")

**Gap:** Critical trust-building information is missing. The user needs to understand the security model before creating/entering a key.

---

### Scenario 9b: "Which source should I pick?"

**Path:** `Obsidian → Settings → Git Encrypt → Master Key → Keychain dropdown`

**User sees:**
- Keychain: "System Keychain" — no description of what this means
- File: "File" — no explanation of where the file goes
- Manual: "Manual" — no reassurance about security

**Current behavior:**
- Dropdown options are technical labels, not user-friendly descriptions
- No "recommended" indicator
- No comparison table or decision guidance

**Gap:** The three options should be presented with clear benefits/trade-offs:
- Keychain: "Most secure — stored in your OS's encrypted vault"
- File: "Portable — stored as a file in your vault"
- Manual: "Always available — you type it each time"

**Mobile note:** On mobile, only Manual is available. The dropdown is hidden. User should understand *why* (no keychain on mobile).
