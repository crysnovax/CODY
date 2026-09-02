// ============================================================
// PANEL CONNECTOR API — Full Code
// Goes in crysnovax/CRYSNOVA_AI/panel-connector.js
// CODY calls this to see EVERYTHING in your panel
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const app = express();
app.use(express.json());

// ============ CONFIG ============
let ROOT_PATH, PORT;

try {
    const config = require('./settings/config');
    ROOT_PATH = config.panelRoot || process.env.PANEL_ROOT || process.cwd();
    PORT = process.env.PORT || config.panelApiPort || process.env.PANEL_API_PORT || 9000;
} catch (e) {
    ROOT_PATH = process.env.PANEL_ROOT || process.cwd();
    PORT = process.env.PORT || process.env.PANEL_API_PORT || 9000;
}

// ============ AUTH MIDDLEWARE ============
const PANEL_SECRET = process.env.PANEL_SECRET;
app.use('/api', (req, res, next) => {
    const auth = req.headers['authorization'];
    if (!PANEL_SECRET || auth !== `Bearer ${PANEL_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// ============ HEALTH ============
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: os.platform(),
        nodeVersion: process.version,
        cwd: process.cwd()
    });
});

// ============ FILE SYSTEM ============

app.get('/api/files', (req, res) => {
    try {
        const dir = req.query.path || ROOT_PATH;
        const fullPath = path.resolve(dir);
        
        if (!fullPath.startsWith(ROOT_PATH)) {
            return res.status(403).json({ error: 'Path outside root' });
        }

        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: item.isFile() ? fs.statSync(path.join(fullPath, item.name)).size : 0,
            path: path.join(fullPath, item.name).replace(ROOT_PATH, '')
        }));

        res.json({ path: fullPath.replace(ROOT_PATH, ''), items: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/file', (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Missing path' });

        const fullPath = path.resolve(ROOT_PATH, filePath.startsWith('/') ? filePath.slice(1) : filePath);
        
        if (!fullPath.startsWith(ROOT_PATH)) {
            return res.status(403).json({ error: 'Path outside root' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const stats = fs.statSync(fullPath);

        res.json({
            path: fullPath.replace(ROOT_PATH, ''),
            content: content,
            size: stats.size,
            lines: content.split('\n').length,
            lastModified: stats.mtime
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/search', (req, res) => {
    try {
        const pattern = req.query.q || '';
        const dir = req.query.path || ROOT_PATH;
        const fullPath = path.resolve(dir);

        if (!fullPath.startsWith(ROOT_PATH)) {
            return res.status(403).json({ error: 'Path outside root' });
        }

        const results = [];
        const skipDirs = ['node_modules', '.git', '.wrangler', 'data', 'temp', 'tmp'];
        
        function searchDir(currentPath, depth = 0) {
            if (depth > 10) return;
            try {
                const items = fs.readdirSync(currentPath, { withFileTypes: true });
                for (const item of items) {
                    const itemPath = path.join(currentPath, item.name);
                    if (item.name.includes(pattern)) {
                        results.push({
                            name: item.name,
                            path: itemPath.replace(ROOT_PATH, ''),
                            type: item.isDirectory() ? 'directory' : 'file'
                        });
                    }
                    if (item.isDirectory() && !skipDirs.includes(item.name) && !item.name.startsWith('.')) {
                        searchDir(itemPath, depth + 1);
                    }
                }
            } catch (e) {}
        }
        searchDir(fullPath);
        res.json({ pattern, results: results.slice(0, 100) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/file', (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'Missing path or content' });
        }

        const fullPath = path.resolve(ROOT_PATH, filePath.startsWith('/') ? filePath.slice(1) : filePath);
        
        if (!fullPath.startsWith(ROOT_PATH)) {
            return res.status(403).json({ error: 'Path outside root' });
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        res.json({ success: true, path: fullPath.replace(ROOT_PATH, '') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/file', (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'Missing path' });

        const fullPath = path.resolve(ROOT_PATH, filePath.startsWith('/') ? filePath.slice(1) : filePath);
        
        if (!fullPath.startsWith(ROOT_PATH)) {
            return res.status(403).json({ error: 'Path outside root' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(fullPath);
        res.json({ success: true, path: fullPath.replace(ROOT_PATH, '') });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ CONSOLE / LOGS ============

app.get('/api/logs', (req, res) => {
    try {
        const lines = parseInt(req.query.lines) || 50;
        const logFile = path.join(ROOT_PATH, 'console.log');
        
        if (!fs.existsSync(logFile)) {
            return res.json({ logs: [], message: 'No console.log file found' });
        }

        const content = fs.readFileSync(logFile, 'utf-8');
        const logLines = content.split('\n').filter(Boolean).slice(-lines);
        res.json({ logs: logLines, total: content.split('\n').filter(Boolean).length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ BOT STATUS ============

app.get('/api/status', (req, res) => {
    try {
        const stats = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: os.loadavg(),
            totalMem: os.totalmem(),
            freeMem: os.freemem(),
            nodeVersion: process.version,
            platform: os.platform(),
            botRunning: true
        };

        try {
            const botStats = global.crysStats || {};
            stats.botMessages = botStats.messages || 0;
            stats.botCommands = botStats.commands || 0;
        } catch {}

        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ NODE MODULES EXPLORER ============

app.get('/api/modules', (req, res) => {
    try {
        const modulesPath = path.join(ROOT_PATH, 'node_modules');
        
        if (!fs.existsSync(modulesPath)) {
            return res.json({ error: 'node_modules not found', packages: [] });
        }

        const packages = [];
        const items = fs.readdirSync(modulesPath, { withFileTypes: true });
        
        for (const item of items) {
            if (!item.isDirectory() || item.name.startsWith('.') || item.name.startsWith('@')) continue;
            
            try {
                const pkgPath = path.join(modulesPath, item.name);
                const pkgJsonPath = path.join(pkgPath, 'package.json');
                
                if (fs.existsSync(pkgJsonPath)) {
                    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                    const mainFile = pkgJson.main || 'index.js';
                    const mainPath = path.join(pkgPath, mainFile);
                    
                    const functions = [];
                    if (fs.existsSync(mainPath)) {
                        const content = fs.readFileSync(mainPath, 'utf-8');
                        const exportRegex = /exports\.(\w+)\s*=/g;
                        const moduleExportMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
                        
                        let match;
                        while ((match = exportRegex.exec(content)) !== null) {
                            if (!functions.includes(match[1])) functions.push(match[1]);
                        }
                        
                        if (moduleExportMatch) {
                            const names = moduleExportMatch[1].split(',').map(n => n.trim().replace(/['"]/g, ''));
                            names.forEach(n => {
                                const clean = n.split(':')[0].trim();
                                if (clean && !functions.includes(clean)) functions.push(clean);
                            });
                        }
                    }
                    
                    packages.push({
                        name: item.name,
                        version: pkgJson.version || 'unknown',
                        description: (pkgJson.description || '').slice(0, 100),
                        main: mainFile,
                        functions: functions,
                        functionCount: functions.length
                    });
                }
            } catch (e) {}
        }
        
        const scopedDirs = items.filter(i => i.isDirectory() && i.name.startsWith('@'));
        for (const scope of scopedDirs) {
            const scopePath = path.join(modulesPath, scope.name);
            try {
                const scopedItems = fs.readdirSync(scopePath, { withFileTypes: true });
                
                for (const item of scopedItems) {
                    if (!item.isDirectory()) continue;
                    try {
                        const pkgPath = path.join(scopePath, item.name);
                        const pkgJsonPath = path.join(pkgPath, 'package.json');
                        
                        if (fs.existsSync(pkgJsonPath)) {
                            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
                            const mainFile = pkgJson.main || 'index.js';
                            const mainPath = path.join(pkgPath, mainFile);
                            
                            const functions = [];
                            if (fs.existsSync(mainPath)) {
                                const content = fs.readFileSync(mainPath, 'utf-8');
                                const exportRegex = /exports\.(\w+)\s*=/g;
                                let match;
                                while ((match = exportRegex.exec(content)) !== null) {
                                    if (!functions.includes(match[1])) functions.push(match[1]);
                                }
                            }
                            
                            packages.push({
                                name: `${scope.name}/${item.name}`,
                                version: pkgJson.version || 'unknown',
                                description: (pkgJson.description || '').slice(0, 100),
                                main: mainFile,
                                functions: functions,
                                functionCount: functions.length
                            });
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }

        res.json({
            totalPackages: packages.length,
            totalFunctions: packages.reduce((sum, p) => sum + p.functionCount, 0),
            packages: packages.sort((a, b) => a.name.localeCompare(b.name))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/modules/search', (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query || query.length < 2) return res.json({ error: 'Query too short (min 2 chars)', results: [] });
        
        const modulesPath = path.join(ROOT_PATH, 'node_modules');
        const specificPackage = req.query.pkg || '';

        if (!fs.existsSync(modulesPath)) {
            return res.json({ error: 'node_modules not found', results: [] });
        }

        const results = [];
        const searchPath = specificPackage ? path.join(modulesPath, specificPackage) : modulesPath;

        if (specificPackage && !fs.existsSync(searchPath)) {
            return res.json({ error: `Package "${specificPackage}" not found`, results: [] });
        }

        function searchDir(currentPath, depth = 0) {
            if (depth > 4 || results.length >= 100) return;
            try {
                const items = fs.readdirSync(currentPath, { withFileTypes: true });
                for (const item of items) {
                    if (results.length >= 100) break;
                    const itemPath = path.join(currentPath, item.name);
                    if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.json') || item.name.endsWith('.ts') || item.name.endsWith('.md'))) {
                        try {
                            const content = fs.readFileSync(itemPath, 'utf-8');
                            const lines = content.split('\n');
                            for (let i = 0; i < lines.length && results.length < 100; i++) {
                                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                                    const relPath = itemPath.replace(modulesPath, '').replace(/^\//, '');
                                    results.push({
                                        package: relPath.split('/')[0],
                                        file: relPath,
                                        line: i + 1,
                                        content: lines[i].trim().slice(0, 200)
                                    });
                                }
                            }
                        } catch (e) {}
                    }
                    if (item.isDirectory() && !item.name.startsWith('.') && depth < 4) {
                        searchDir(itemPath, depth + 1);
                    }
                }
            } catch (e) {}
        }
        searchDir(searchPath);

        const byPackage = {};
        results.forEach(r => {
            if (!byPackage[r.package]) byPackage[r.package] = [];
            byPackage[r.package].push(r);
        });

        res.json({
            query,
            totalResults: results.length,
            results: results.slice(0, 100),
            byPackage: Object.keys(byPackage).sort()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ COMMAND TESTER ============

app.post('/api/test', (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

        const fullPath = path.resolve(ROOT_PATH, filePath.startsWith('/') ? filePath.slice(1) : filePath);
        
        if (!fs.existsSync(fullPath)) {
            return res.json({ success: false, error: 'File not found' });
        }

        delete require.cache[require.resolve(fullPath)];
        const cmd = require(fullPath);

        const validation = {
            exists: true,
            isArray: Array.isArray(cmd),
            commandCount: Array.isArray(cmd) ? cmd.length : 0,
            commands: []
        };

        if (Array.isArray(cmd)) {
            cmd.forEach((c, i) => {
                validation.commands.push({
                    index: i,
                    name: c.name || 'missing',
                    alias: c.alias || [],
                    hasExecute: typeof c.execute === 'function',
                    hasCategory: !!c.category,
                    hasReactions: !!c.reactions,
                    valid: !!(c.name && typeof c.execute === 'function')
                });
            });
        }

        res.json({ success: true, validation });
    } catch (e) {
        res.json({ success: false, error: e.message, line: e.stack?.split('\n')[1]?.trim() });
    }
});

// ============ RUN SHELL COMMAND ============

app.post('/api/run', (req, res) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Missing command' });

        const dangerous = ['rm -rf', 'format', 'shutdown', 'reboot', 'kill', 'sudo'];
        if (dangerous.some(d => command.toLowerCase().includes(d))) {
            return res.status(403).json({ error: 'Dangerous command blocked' });
        }

        exec(command, { cwd: ROOT_PATH, timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            res.json({
                success: !err,
                stdout: stdout.slice(0, 5000),
                stderr: stderr.slice(0, 5000),
                error: err ? err.message : null
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ GIT INFO ============

app.get('/api/git', (req, res) => {
    try {
        const gitPath = path.join(ROOT_PATH, '.git');
        if (!fs.existsSync(gitPath)) {
            return res.json({ error: 'Not a git repository' });
        }

        exec('git log -1 --format="%H|%an|%ae|%s|%ci" && git branch --show-current && git remote -v', 
            { cwd: ROOT_PATH, timeout: 5000 }, 
            (err, stdout) => {
                if (err) return res.json({ error: err.message });
                
                const lines = stdout.trim().split('\n').filter(Boolean);
                const lastCommit = lines[0]?.split('|') || [];
                const branch = lines[1] || 'unknown';
                const remotes = lines.slice(2).join(', ') || 'none';

                res.json({
                    branch,
                    lastCommit: {
                        hash: lastCommit[0] || 'unknown',
                        author: lastCommit[1] || 'unknown',
                        email: lastCommit[2] || 'unknown',
                        message: lastCommit[3] || 'unknown',
                        date: lastCommit[4] || 'unknown'
                    },
                    remotes
                });
            });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`ᯤ Panel Connector API running on port ${PORT}`);
    console.log(`ᯤ Root: ${ROOT_PATH}`);
    console.log(`ᯤ No authentication — open access`);
    console.log(`ᯤ 14 endpoints ready for CODY`);
});

module.exports = app;
