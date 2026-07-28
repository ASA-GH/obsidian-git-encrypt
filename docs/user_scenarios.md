# User Scenarios

User-facing flows for every settings category in the Git Encrypt plugin. Each scenario describes **who**, **what**, and **how it differs by platform**.

---

## 1. Repository Configuration

### Desktop
- User opens settings → selects transport protocol (HTTPS / SSH)
- User enters repo URL, branch, remote name
- User optionally picks a local path for the bare repo
- ~~**UI redraws** when switching between HTTPS and SSH~~ — **BUG**: dropdown onChange calls `refreshSettingsTab()` but visual change not confirmed (see Verification task #2)

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
- **Info callout rendered when `repositoryUrl` is empty** (repository.ts:53-71) — explains encrypted remote concept, links to documentation
- Placeholder text on URL field includes 2-step setup guidance (create repo → paste URL)

**Remaining gap:** Callout only shows when `repositoryUrl` is empty — users with a saved URL see nothing. Consider showing it persistently or as a collapsible section.

**Platform note:** Same for all platforms — no platform-specific difference here.

---

### Scenario 7b: "What is an encrypted remote?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection`

**What the user expects to understand:**
- The remote repo on GitHub/GitLab will contain **only encrypted files** (blobs of gibberish), not human-readable markdown
- Their vault notes are safe on the server because they are encrypted with the master key the user controls
- The local `.git-encrypted` directory replaces the traditional `.git` directory

**Current behavior:**
- Info callout rendered when `repositoryUrl` is empty (repository.ts:53-71) — explains that remote will contain only encrypted blobs
- Placeholder text on URL field includes 2-step setup guidance

**Remaining gap:** Callout is hidden once the user enters a URL. Users who paste a URL first never see the explanation. Consider a persistent or collapsible section.

---

### Scenario 7c: "Where do I create the remote repo?"

**Path:** `Obsidian → Settings → Git Encrypt → Repository connection`

**User types:** A URL like `https://github.com/myuser/my-vault.git`

**Questions:**
- "Do I go to github.com → New Repository → create it → then paste the URL?"
- "Should I initialize the repo with a README or .gitignore?"
- "What if I'm using GitLab / Gitea / self-hosted?"

**Current behavior:**
- Placeholder shows example URL format
- Info callout (when visible) links to README explaining encryption
- URL field description includes step-by-step: "1. Create a repo on GitHub/GitLab → 2. Paste the URL"

**Remaining gap:** No explicit link to a setup guide or step-by-step tutorial. Placeholder text is brief. No platform-specific guidance.

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

**Mobile note:** ✅ Fixed — local path field is now conditionally rendered with `if (!isMobilePlatform)` guard (repository.ts:155).

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
- Advanced settings now includes a "How sync works" callout (advanced.ts:22-26) — explains that `git-remote-crypto` encrypts on push and decrypts on pull
- Callout mentions the remote will contain only ciphertext and warns about backing up before first sync

**Remaining gap:** The callout is at the top of the Advanced section, not near the push/pull toggles where the anxiety point is. The plugin has no UI for push/pull triggers (ribbon icon is empty — task #25).

---

### Scenario 8b: "What about my first pull?"

**Path:** `Obsidian → Settings → Git Encrypt → Advanced → Auto pull on start`

**User questions:**
- "If I push first, then open on another device, what gets pulled?"
- "Will pulling decrypt files automatically?"
- "What if the remote is empty (fresh repo)?"

**Current behavior:**
- Toggle says "Auto pull on start" but doesn't explain *what* it pulls or from where
- "How sync works" callout in Advanced section explains pull decryption
- No handling of empty remote (first pull into empty repo)

**Remaining gap:** Same educational gap as push — the callout is not near the toggle itself, so a user focused on the pull toggle might not see it.

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
- Info callout rendered at top of master key section (masterKey.ts:25-29) — explains zero-knowledge model
- Dropdown options now describe benefits:
  - Keychain: "stored in your OS's encrypted credential vault (macOS Keychain / Windows Credential Manager / Linux Secret Service)"
  - File: "read from an external file on your computer"
  - Manual: "type or paste the hex key directly"

**Remaining gap:** No explicit "recommended" indicator for keychain. No link to security documentation.

---

### Scenario 9b: "Which source should I pick?"

**Path:** `Obsidian → Settings → Git Encrypt → Master Key → Keychain dropdown`

**User sees:**
- Keychain: "System Keychain" — no description of what this means
- File: "File" — no explanation of where the file goes
- Manual: "Manual" — no reassurance about security

**Current behavior:**
- Dropdown options now include benefit descriptions (masterKey.ts:61-73):
  - Keychain: "System Keychain — stored in your OS's encrypted credential vault (macOS Keychain / Windows Credential Manager / Linux Secret Service)"
  - File: "Key File — read from an external file on your computer"
  - Manual: "Enter Manually — type or paste the hex key directly"
- "How encryption works" callout above explains zero-knowledge model

**Remaining gap:** No "recommended" indicator. No comparison table. On mobile, only Manual is available but no explanation why (no keychain on mobile).

---

## 10. Migration: Unencrypted Repository → Encrypted

### Scenario 10a: "I already have a repo with notes — how do I migrate it to encrypted format?"

**Path:** `Obsidian → Settings → Git Encrypt`

**Context:** The user already has a Git repository (on GitHub/GitLab or self-hosted) containing plain-text notes. They installed Git Encrypt and want all future push/pull operations to be encrypted.

**User questions:**
- "Will my notes on the server stay in plain text? Will anyone be able to read them?"
- "If I push, will the notes be encrypted on the server while remaining plain on my machine?"
- "How do I encrypt the existing notes on the server?"
- "Can I undo if I encrypt the wrong thing?"

**What actually happens:**

| Step | Action | Result |
|------|--------|--------|
| 1 | Configure URL → `https://github.com/user/existing-repo.git`, enter master key | Settings saved |
| 2 | First **push** | All local notes are **encrypted** and sent to the server. Server stores encrypted files. **Local notes remain in plain text** — this is not a `commit`, it's a push of encrypted blobs via `git-remote-crypto` |
| 3 | First **pull** (from another device, or after push) | Server sends encrypted files → `git-remote-crypto` **decrypts** → local notes become encrypted versions |

**Problem:** After step 2 the user is in an inconsistent state:
- Locally — plain notes
- On server — encrypted notes
- Next pull on the same device — plain notes overwritten by encrypted ones (merge conflict)

**Current behavior:**
- Conflict resolution dropdown (Section 5): `ask` / `abort` / `theirs` / `ours` — but the user doesn't know which to pick
- No migration warning in settings UI
- No instructions on "how to safely migrate an existing repo to encrypted format"

**Recommended workflow (should be shown in UI):**
1. Make a backup of the local vault
2. Run `git pull` on the existing repo — download all notes locally in plain text
3. Configure Git Encrypt (URL, auth, master key)
4. Run `git push` — notes are encrypted and sent to the server
5. On a new device: configure Git Encrypt → `git pull` — notes download as encrypted files and are automatically decrypted
6. **Result:** both local and server — encrypted files

**Remaining gap:** No step-by-step migration wizard in the interface. No warning: "If you connect an existing repository, your local files may be overwritten on pull." No button to "Migrate existing repo to encrypted format."

---

### Scenario 10b: "I have plain notes locally and an empty repo — what happens on first push?"

**Path:** `Obsidian → Settings → Git Encrypt`

**Context:** The user has a new Obsidian vault with plain notes. On GitHub they created an empty repository and connected it in Git Encrypt.

**User questions:**
- "Will my notes be encrypted on the server?"
- "Will my notes stay plain on my computer?"
- "Will I see encrypted files in my file manager?"
- "If I open a note on my phone, will it decrypt automatically?"

**What actually happens:**

| Step | Action | Result |
|------|--------|--------|
| 1 | Configure: URL of empty repo, master key generated | Settings saved |
| 2 | **Push** (first) | All local `.md` files are encrypted → encrypted blobs sent to server. Local files **do not change** — remain plain `.md`. Server stores encrypted versions |
| 3 | **Pull** (on the same device) | Server sends encrypted files → `git-remote-crypto` decrypts → overwrites local files with encrypted versions |
| 4 | **Pull** (on a new device) | Encrypted files download → automatically decrypted → notes are readable |

**Key understanding for the user:**
- Locally, files **change from plain to encrypted after the first pull**
- On the server, files are **always encrypted** (handled by `git-remote-crypto` at the Git transport layer)
- File manager will show encrypted binary content instead of markdown
- On phone, notes are **readable** only if the key is loaded in keychain or entered manually

**Current behavior:**
- Callout "How sync works" (advanced.ts) explains encrypt-on-push / decrypt-on-pull
- Callout "How encryption works" (masterKey.ts) explains zero-knowledge
- No warning that local files **will become encrypted** after pull
- No visual hint: "After pull your .md files will become unreadable — this is normal"

**Remaining gap:** No explicit warning: "Your vault will be encrypted — local files will become unreadable without the key. Make sure the key is saved." After pull, the user may panic seeing binary files instead of markdown.

---

## Coverage Summary

| Scenario | Status | Where in document |
|----------|--------|-------------------|
| HTTPS setup | ✅ | Section 1, 2 |
| SSH setup (desktop/mobile) | ✅ | Section 2 |
| Auto-detect author from Git | ✅ | Section 3 |
| Three key sources (keychain/file/manual) | ✅ | Section 4, 9 |
| Keychain migration | ✅ | Section 4, 9 |
| Desktop → Mobile transition | ✅ | Platform Transition section |
| "What happens on first push?" | ✅ | Section 8a |
| "What happens on first pull?" | ✅ | Section 8b |
| "Existing repo with data — how to encrypt?" | ⬜ | **Scenario 10a (new)** |
| "Plain notes + empty repo — what happens?" | ⬜ | **Scenario 10b (new)** |
