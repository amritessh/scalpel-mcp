import fs from "node:fs";
import path from "node:path";
const SKIP_DIRS = {
    ts: new Set(["node_modules", ".git", "dist", "build", "coverage"]),
    python: new Set(["__pycache__", ".git", "venv", ".venv", "build", "dist", ".tox", ".mypy_cache", ".pytest_cache"]),
    go: new Set(["vendor", ".git", "testdata"]),
};
const FILE_PATTERN = {
    ts: /\.(ts|tsx)$/,
    python: /\.py$/,
    go: /\.go$/,
};
export function listSourceFiles(root, lang = "ts") {
    const skipDirs = SKIP_DIRS[lang];
    const pattern = FILE_PATTERN[lang];
    const out = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (skipDirs.has(entry.name))
                continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
            }
            else if (pattern.test(entry.name) && !entry.name.endsWith(".d.ts")) {
                out.push(full);
            }
        }
    }
    return out;
}
