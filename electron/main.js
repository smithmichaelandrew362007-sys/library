/**
 * LibraVault - Electron Main Process
 * Launches Flask server as a child process and opens a BrowserWindow.
 */

const { app, BrowserWindow } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

// Disable hardware acceleration to fix blank screen issues on some Windows systems/VMs
app.disableHardwareAcceleration();

// Force a clean user data path to fix corrupted quota/service worker DBs
app.setPath('userData', path.join(app.getPath('appData'), 'LibraVaultApp_v2'));

let mainWindow;
let flaskProcess;

const FLASK_PORT = 5000;
const FLASK_URL = `http://127.0.0.1:${FLASK_PORT}`;
const PROJECT_ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');

// ─── Find Python executable ────────────────────────────────
function findPython() {
    const candidates = process.platform === 'win32'
        ? ['python', 'python3', 'py']
        : ['python3', 'python'];

    for (const cmd of candidates) {
        try {
            execSync(`${cmd} --version`, { stdio: 'pipe' });
            return cmd;
        } catch (e) {
            // try next
        }
    }
    return null;
}

// ─── Start Flask Server ────────────────────────────────────
function startFlask() {
    const pythonCmd = findPython();
    if (!pythonCmd) {
        console.error('ERROR: Python not found. Please install Python 3.10+');
        return false;
    }

    const appPath = path.join(PROJECT_ROOT, 'app.py');
    console.log(`Starting Flask with: ${pythonCmd} ${appPath}`);
    console.log(`Working directory: ${PROJECT_ROOT}`);

    // Check if we are running the packaged executable
    const exePath = path.join(process.resourcesPath || PROJECT_ROOT, 'libravault-server', 'libravault-server.exe');
    const fs = require('fs');
    if (fs.existsSync(exePath)) {
        console.log(`Starting packaged Flask executable: ${exePath}`);
        flaskProcess = spawn(exePath, [], {
            cwd: PROJECT_ROOT,
            env: {
                ...process.env,
                FLASK_DEBUG: 'False',
                PYTHONUNBUFFERED: '1',
                PYTHONIOENCODING: 'utf-8'
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true
        });
    } else {
        flaskProcess = spawn(pythonCmd, [appPath], {
            cwd: PROJECT_ROOT,
            env: {
                ...process.env,
                FLASK_DEBUG: 'False',
                PYTHONUNBUFFERED: '1',
                PYTHONIOENCODING: 'utf-8'
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true
        });
    }


    flaskProcess.stdout.on('data', (data) => {
        console.log(`[Flask stdout] ${data.toString().trim()}`);
    });

    flaskProcess.stderr.on('data', (data) => {
        console.log(`[Flask stderr] ${data.toString().trim()}`);
    });

    flaskProcess.on('error', (err) => {
        console.error(`[Flask ERROR] Failed to start: ${err.message}`);
    });

    flaskProcess.on('close', (code) => {
        console.log(`[Flask] Process exited with code ${code}`);
        flaskProcess = null;
    });

    return true;
}

// ─── Wait for Flask to be ready ────────────────────────────
function waitForFlask(maxRetries = 30) {
    return new Promise((resolve, reject) => {
        let retries = 0;

        function tryConnect() {
            const req = http.get(FLASK_URL, (res) => {
                resolve(true);
            });

            req.on('error', () => {
                retries++;
                if (retries < maxRetries) {
                    setTimeout(tryConnect, 1000);
                } else {
                    reject(new Error('Flask server did not start in time'));
                }
            });

            req.setTimeout(2000, () => {
                req.destroy();
                retries++;
                if (retries < maxRetries) {
                    setTimeout(tryConnect, 1000);
                } else {
                    reject(new Error('Flask server timed out'));
                }
            });
        }

        // Wait 1.5s before first try to give Flask time to initialize
        setTimeout(tryConnect, 1500);
    });
}

// ─── Create Electron Window ────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'LibraVault - Library Management System',
        backgroundColor: '#0a0e17',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        show: false,
    });

    // Show window when content is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// ─── Show error page ───────────────────────────────────────
function showErrorPage(win, errorMsg) {
    const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Error</title></head>
    <body style="background:#0a0e17;color:#f1f5f9;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
    <div style="max-width:500px;padding:40px;">
        <div style="font-size:3rem;margin-bottom:16px;">!</div>
        <h1 style="font-size:1.5rem;margin-bottom:12px;">Connection Failed</h1>
        <p style="color:#94a3b8;margin-bottom:8px;">${errorMsg}</p>
        <p style="color:#64748b;font-size:0.85rem;">Make sure Python and MySQL are running, then restart the app.</p>
    </div>
    </body>
    </html>`;

    // Write to a temp file and load it
    const fs = require('fs');
    const errorPath = path.join(app.getPath('temp'), 'libravault-error.html');
    fs.writeFileSync(errorPath, errorHtml, 'utf8');
    win.loadFile(errorPath);
    win.show();
}

// ─── App Lifecycle ─────────────────────────────────────────

app.whenReady().then(async () => {
    console.log('=== LibraVault Desktop Starting ===');
    console.log(`Electron: ${process.versions.electron}`);
    console.log(`Node: ${process.versions.node}`);
    console.log(`Project: ${PROJECT_ROOT}`);

    const win = createWindow();

    // Start Flask
    const flaskStarted = startFlask();
    if (!flaskStarted) {
        showErrorPage(win, 'Python was not found on your system.');
        return;
    }

    // Wait for Flask to be ready, then load
    try {
        await waitForFlask(30);
        console.log('[Flask] Server is ready!');
        
        // Bypassing clearStorageData to prevent hangs on corrupted Quota Databases
        await win.loadURL(FLASK_URL);
        
        // Debugging injection to check why the screen is black
        win.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[Renderer] ${message}`);
        });

        win.webContents.executeJavaScript(`
            setTimeout(() => {
                const bodyRect = document.body.getBoundingClientRect();
                const loginEl = document.querySelector('.login-page');
                const loginRect = loginEl ? loginEl.getBoundingClientRect() : null;
                const bodyStyle = window.getComputedStyle(document.body);
                const loginStyle = loginEl ? window.getComputedStyle(loginEl) : null;
                console.log('Body Rect:', JSON.stringify(bodyRect));
                console.log('Login Rect:', JSON.stringify(loginRect));
                console.log('Body bg:', bodyStyle.backgroundColor, 'color:', bodyStyle.color, 'opacity:', bodyStyle.opacity, 'visibility:', bodyStyle.visibility);
                if (loginStyle) {
                    console.log('Login bg:', loginStyle.backgroundColor, 'color:', loginStyle.color, 'opacity:', loginStyle.opacity, 'visibility:', loginStyle.visibility);
                }
            }, 1000);
        `);
    } catch (err) {
        console.error(`[Flask] ${err.message}`);
        showErrorPage(win, 'Could not connect to Flask server on port 5000.');
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    killFlask();
    app.quit();
});

app.on('before-quit', () => {
    killFlask();
});

function killFlask() {
    if (flaskProcess && !flaskProcess.killed) {
        console.log('[Flask] Stopping server...');
        try {
            if (process.platform === 'win32') {
                // On Windows, kill the process tree
                spawn('taskkill', ['/pid', String(flaskProcess.pid), '/f', '/t'], {
                    stdio: 'ignore',
                    windowsHide: true
                });
            } else {
                flaskProcess.kill('SIGTERM');
            }
        } catch (e) {
            console.error('[Flask] Kill error:', e.message);
        }
        flaskProcess = null;
    }
}
