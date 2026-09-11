import fs from "node:fs";
import path from "node:path";
function stripQuotes(text) {
    return text.slice(1, -1);
}
// Bare specifiers (no leading "." or "/") are always classified "external" --
// this includes npm packages AND sibling packages in a monorepo referenced by
// package name. We deliberately don't try to resolve into node_modules or
// workspace symlinks to find them; that boundary is the explicit choice, not
// an oversight.
function resolveTsLocalImport(fromFile, source, knownFiles) {
    if (!source.startsWith("."))
        return null;
    const fromDir = path.dirname(fromFile);
    const base = path.normalize(path.join(fromDir, source)).replace(/\.(js|jsx|ts|tsx)$/, "");
    const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
    for (const c of candidates) {
        if (knownFiles.has(c))
            return c;
    }
    return null;
}
function collectTsImports(root, relPath, knownFiles, importsOut) {
    function visit(node) {
        if (node.type === "import_statement" || node.type === "export_statement") {
            const sourceNode = node.childForFieldName("source");
            if (sourceNode && sourceNode.type === "string") {
                const source = stripQuotes(sourceNode.text);
                const resolvedFile = resolveTsLocalImport(relPath, source, knownFiles);
                importsOut.push({
                    file: relPath,
                    source,
                    resolvedFile,
                    kind: !source.startsWith(".") ? "external" : resolvedFile ? "local" : "unresolved",
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
// A Python "module path" (e.g. "foo.bar") maps to either foo/bar.py or a
// package foo/bar/__init__.py -- try both.
function pyModuleCandidates(basePath) {
    return [`${basePath}.py`, path.join(basePath, "__init__.py")];
}
// Absolute `import`/`from` module paths resolve from the indexed root (an
// approximation of sys.path's project root, since we don't have real
// interpreter/venv info) -- not from the importing file's own directory.
function resolvePyAbsoluteModule(dottedPath, knownFiles) {
    const basePath = dottedPath.split(".").join(path.sep);
    for (const c of pyModuleCandidates(basePath))
        if (knownFiles.has(c))
            return c;
    return null;
}
// `from . import x` / `from ..pkg import y`: dotCount=1 means "this file's own
// package directory", each extra dot climbs one more directory up, then an
// optional dotted suffix (e.g. "pkg.sub") appends subdirectories.
function resolvePyRelativeModule(fromFile, dotCount, dottedSuffix, knownFiles) {
    let dir = path.dirname(fromFile);
    for (let i = 1; i < dotCount; i++)
        dir = path.dirname(dir);
    if (!dottedSuffix) {
        // Bare "from . import x" with no module path -- the referenced "module"
        // is this directory's own package init; per-imported-name (x) resolution
        // isn't attempted, matching the file-level (not symbol-level) grain of
        // TS's import tracking.
        const initPath = path.join(dir, "__init__.py");
        return knownFiles.has(initPath) ? initPath : null;
    }
    const basePath = path.join(dir, dottedSuffix.split(".").join(path.sep));
    for (const c of pyModuleCandidates(basePath))
        if (knownFiles.has(c))
            return c;
    return null;
}
function collectPythonImports(root, relPath, knownFiles, importsOut) {
    function pushAbsolute(dottedPath) {
        const resolvedFile = resolvePyAbsoluteModule(dottedPath, knownFiles);
        importsOut.push({
            file: relPath,
            source: dottedPath,
            resolvedFile,
            kind: resolvedFile ? "local" : "external",
        });
    }
    function visit(node) {
        if (node.type === "import_statement") {
            // `import a, b` / `import a as f` -- childrenForFieldName("name") gives
            // one entry per comma-separated target, each a dotted_name or an
            // aliased_import wrapping one.
            for (const nameNode of node.childrenForFieldName("name")) {
                const dotted = nameNode.type === "aliased_import" ? nameNode.childForFieldName("name") : nameNode;
                if (dotted)
                    pushAbsolute(dotted.text);
            }
        }
        else if (node.type === "import_from_statement") {
            const moduleNode = node.childForFieldName("module_name");
            if (moduleNode?.type === "relative_import") {
                const prefix = moduleNode.namedChildren.find((c) => c.type === "import_prefix");
                const suffix = moduleNode.namedChildren.find((c) => c.type === "dotted_name");
                const dotCount = prefix ? prefix.text.length : 1;
                const resolvedFile = resolvePyRelativeModule(relPath, dotCount, suffix?.text ?? null, knownFiles);
                const source = (prefix?.text ?? ".") + (suffix?.text ?? "");
                importsOut.push({ file: relPath, source, resolvedFile, kind: resolvedFile ? "local" : "unresolved" });
            }
            else if (moduleNode?.type === "dotted_name") {
                pushAbsolute(moduleNode.text);
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
// Go import paths are module-relative ("github.com/gin-gonic/gin/render"),
// not file-relative like TS's "./foo" or dotted like Python's "a.b" -- they
// only resolve to something *in this repo* by stripping the module's own
// declared prefix (from go.mod's `module ...` line) off the front. Without
// that prefix every import looks identical to a third-party one.
export function readGoModulePrefix(root) {
    try {
        const text = fs.readFileSync(path.join(root, "go.mod"), "utf8");
        const match = text.match(/^module\s+(\S+)/m);
        return match ? match[1] : null;
    }
    catch {
        return null;
    }
}
// Import paths resolve to a PACKAGE (a directory that may hold several
// files), not a single file the way TS/Python imports do -- there's no
// single "the" file an import resolves to without picking one arbitrarily.
// `resolvedFile` holds the package's repo-relative directory path instead
// (or "." for the module root) when it's known to exist among the indexed
// files; this is a coarser grain than TS/Python's per-file resolution,
// disclosed here rather than silently treated as equivalent.
function resolveGoImport(importPath, modulePrefix, knownDirs) {
    if (!modulePrefix || !(importPath === modulePrefix || importPath.startsWith(`${modulePrefix}/`))) {
        return { resolvedFile: null, kind: "external" };
    }
    const rel = importPath === modulePrefix ? "." : importPath.slice(modulePrefix.length + 1);
    if (knownDirs.has(rel))
        return { resolvedFile: rel, kind: "local" };
    return { resolvedFile: null, kind: "unresolved" };
}
function collectGoImports(root, relPath, knownFiles, modulePrefix, importsOut) {
    const knownDirs = new Set(["."]);
    for (const f of knownFiles)
        knownDirs.add(path.dirname(f));
    function visit(node) {
        if (node.type === "import_spec") {
            const pathNode = node.childForFieldName("path");
            if (pathNode) {
                const importPath = stripQuotes(pathNode.text);
                const { resolvedFile, kind } = resolveGoImport(importPath, modulePrefix, knownDirs);
                importsOut.push({ file: relPath, source: importPath, resolvedFile, kind });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
export function collectImports(root, relPath, knownFiles, importsOut, lang = "ts", goModulePrefix = null) {
    if (lang === "python") {
        collectPythonImports(root, relPath, knownFiles, importsOut);
    }
    else if (lang === "go") {
        collectGoImports(root, relPath, knownFiles, goModulePrefix, importsOut);
    }
    else {
        collectTsImports(root, relPath, knownFiles, importsOut);
    }
}
