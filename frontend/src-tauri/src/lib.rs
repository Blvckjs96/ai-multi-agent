use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, State};

// portable-pty trait objects are not Send by their trait definitions, but the
// native Unix/Windows implementations underneath are thread-safe. We wrap them
// in newtypes and assert Send so they can be stored inside the Mutex<HashMap>.
struct MasterHandle(Box<dyn portable_pty::MasterPty>);
// SAFETY: UnixMasterPty / WinConPty hold a file descriptor / HANDLE and are
// safe to use from any thread — the OS serialises concurrent fd operations.
unsafe impl Send for MasterHandle {}
unsafe impl Sync for MasterHandle {}

struct WriterHandle(Box<dyn Write + Send>);
unsafe impl Send for WriterHandle {}

struct ChildHandle(Box<dyn portable_pty::Child>);
// SAFETY: UnixChild / WinConChild hold a pid/HANDLE that is safe to use from any thread.
unsafe impl Send for ChildHandle {}

struct PtySession {
    writer: Mutex<WriterHandle>,
    master: MasterHandle,
}

#[derive(Default)]
struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

#[derive(serde::Serialize, Clone)]
struct PtyOutputPayload {
    id: String,
    data: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Spawn a PTY session and stream its output as `pty-output` events.
#[tauri::command]
async fn pty_spawn(
    id: String,
    cmd: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cols: u16,
    rows: u16,
    state: State<'_, PtyState>,
    app: AppHandle,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let master = pair.master;
    let slave = pair.slave;

    let mut builder = CommandBuilder::new(&cmd);
    builder.args(&args);
    for (k, v) in &env {
        builder.env(k, v);
    }

    let child = ChildHandle(slave.spawn_command(builder).map_err(|e| e.to_string())?);
    let reader = master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = master.take_writer().map_err(|e| e.to_string())?;

    let session = PtySession {
        writer: Mutex::new(WriterHandle(writer)),
        master: MasterHandle(master),
    };
    state.sessions.lock().unwrap().insert(id.clone(), session);

    // Background thread: read PTY output → emit events; then reap child.
    let id_clone = id.clone();
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut child = child;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    app_clone
                        .emit("pty-output", PtyOutputPayload { id: id_clone.clone(), data })
                        .ok();
                }
            }
        }
        let _ = child.0.wait();
        app_clone.emit("pty-exit", serde_json::json!({ "id": id_clone })).ok();
    });

    Ok(())
}

/// Write raw bytes (user keystrokes) into the PTY.
#[tauri::command]
fn pty_write(id: String, data: String, state: State<'_, PtyState>) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&id).ok_or_else(|| format!("PTY session '{id}' not found"))?;
    let mut w = session.writer.lock().unwrap();
    w.0.write_all(data.as_bytes()).map_err(|e| e.to_string())
}

/// Notify the PTY of a terminal resize (rows/cols).
#[tauri::command]
fn pty_resize(id: String, cols: u16, rows: u16, state: State<'_, PtyState>) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&id).ok_or_else(|| format!("PTY session '{id}' not found"))?;
    session
        .master
        .0
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

/// Kill and remove a PTY session. Dropping the master closes the fd → SIGHUP.
#[tauri::command]
fn pty_kill(id: String, state: State<'_, PtyState>) -> Result<(), String> {
    state.sessions.lock().unwrap().remove(&id);
    Ok(())
}

// ── Git worktree commands ─────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
struct WorktreeInfo {
    path: String,
    branch: String,
    head: String,
    is_bare: bool,
    is_main: bool,
}

/// Create a new git worktree for a task branch.
#[tauri::command]
fn git_worktree_create(cwd: String, path: String, branch: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["worktree", "add", "-b", &branch, &path])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(path)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// List all git worktrees in a repo.
#[tauri::command]
fn git_worktree_list(cwd: String) -> Result<Vec<WorktreeInfo>, String> {
    let output = std::process::Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut worktrees = Vec::new();
    let mut current: Option<(String, String, String, bool)> = None;
    for line in text.lines() {
        if line.starts_with("worktree ") {
            if let Some((p, h, b, bare)) = current.take() {
                let is_main = worktrees.is_empty();
                worktrees.push(WorktreeInfo { path: p, branch: b, head: h, is_bare: bare, is_main });
            }
            current = Some((line[9..].to_string(), String::new(), String::new(), false));
        } else if line.starts_with("HEAD ") {
            if let Some(ref mut c) = current { c.1 = line[5..].to_string(); }
        } else if line.starts_with("branch ") {
            if let Some(ref mut c) = current {
                c.2 = line[7..].replace("refs/heads/", "");
            }
        } else if line == "bare" {
            if let Some(ref mut c) = current { c.3 = true; }
        }
    }
    if let Some((p, h, b, bare)) = current {
        let is_main = worktrees.is_empty();
        worktrees.push(WorktreeInfo { path: p, branch: b, head: h, is_bare: bare, is_main });
    }
    Ok(worktrees)
}

/// Remove a git worktree (force if needed).
#[tauri::command]
fn git_worktree_remove(cwd: String, path: String, force: bool) -> Result<(), String> {
    let mut args = vec!["worktree", "remove"];
    if force { args.push("--force"); }
    args.push(&path);
    let output = std::process::Command::new("git")
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Return the absolute path to the `claude` binary, or null if not found.
///
/// Tries in order:
/// 1. Static absolute paths (Homebrew, system)
/// 2. Home-relative paths (npm global, volta, .local/bin)
/// 3. `which claude` via standard PATH
/// 4. Login-shell probe (`zsh -l` / `bash -l`) — needed for packaged .app
///    bundles that launch without a login shell and have a stripped PATH.
#[tauri::command]
fn find_claude_path() -> Option<String> {
    // Static install locations
    let static_candidates = [
        "/usr/local/bin/claude",
        "/opt/homebrew/bin/claude",
        "/usr/bin/claude",
        "/home/linuxbrew/.linuxbrew/bin/claude",
    ];
    for path in &static_candidates {
        if std::path::Path::new(path).exists() {
            return Some((*path).to_string());
        }
    }

    // Home-relative locations (npm global, volta, fnm, .local/bin)
    if let Ok(home) = std::env::var("HOME") {
        let home_candidates = [
            format!("{}/.local/bin/claude", home),
            format!("{}/.npm-global/bin/claude", home),
            format!("{}/.volta/bin/claude", home),
            // macOS: npm prefix under Library when installed via node
            format!("{}/Library/Application Support/npm/bin/claude", home),
        ];
        for path in &home_candidates {
            if std::path::Path::new(path).exists() {
                return Some(path.clone());
            }
        }
    }

    // Standard PATH lookup — works in dev/terminal context.
    if let Some(path) = std::process::Command::new("which")
        .arg("claude")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        return Some(path);
    }

    // Login-shell probe: sources .zshrc/.bashrc so nvm/volta/fnm shims are active.
    for shell in &["zsh", "bash"] {
        if let Some(path) = std::process::Command::new(shell)
            .args(["-l", "-c", "which claude 2>/dev/null"])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            return Some(path);
        }
    }

    None
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            find_claude_path,
            git_worktree_create,
            git_worktree_list,
            git_worktree_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Argo");
}
