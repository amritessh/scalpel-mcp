import fs from "node:fs";
import path from "node:path";
import { listSourceFiles } from "./file-walker.js";
import { makeParser, parseSource } from "./parser.js";
import { collectDefinitions } from "./definitions.js";
import { collectIdentifierUsages } from "./usages.js";
import { collectCalls } from "./calls.js";
import { collectImports, readGoModulePrefix } from "./imports.js";
import { collectTypeReferences } from "./type-references.js";
export function indexRepo(root, lang = "ts") {
    const files = listSourceFiles(root, lang);
    const knownFiles = new Set(files.map((absPath) => path.relative(root, absPath)));
    const goModulePrefix = lang === "go" ? readGoModulePrefix(root) : null;
    const parsed = [];
    const definitions = [];
    const definitionsByFile = new Map();
    const nameNodeOffsetsByFile = new Map();
    for (const absPath of files) {
        const relPath = path.relative(root, absPath);
        const source = fs.readFileSync(absPath, "utf8");
        const parser = makeParser(lang, absPath.endsWith(".tsx"));
        const tree = parseSource(parser, source);
        parsed.push({ relPath, tree });
        const offsets = new Set();
        const defsInFile = [];
        collectDefinitions(tree.rootNode, relPath, defsInFile, offsets, lang);
        definitions.push(...defsInFile);
        definitionsByFile.set(relPath, defsInFile);
        nameNodeOffsetsByFile.set(relPath, offsets);
    }
    const definedNames = new Set(definitions.map((d) => d.name));
    const usages = [];
    const calls = [];
    const imports = [];
    const typeReferences = [];
    for (const { relPath, tree } of parsed) {
        const raw = [];
        collectIdentifierUsages(tree.rootNode, relPath, nameNodeOffsetsByFile.get(relPath), raw, lang);
        for (const u of raw)
            if (definedNames.has(u.name))
                usages.push(u);
        collectCalls(tree.rootNode, relPath, definitionsByFile.get(relPath), calls, lang);
        collectImports(tree.rootNode, relPath, knownFiles, imports, lang, goModulePrefix);
        if (lang === "ts") {
            const rawRefs = [];
            collectTypeReferences(tree.rootNode, relPath, definitionsByFile.get(relPath), nameNodeOffsetsByFile.get(relPath), rawRefs);
            for (const r of rawRefs)
                if (definedNames.has(r.referencedName))
                    typeReferences.push(r);
        }
    }
    return { definitions, usages, calls, imports, typeReferences };
}
