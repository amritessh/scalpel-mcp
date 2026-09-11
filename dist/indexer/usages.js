// TS has a separate type_identifier node type for type-position names; Python
// uses plain `identifier` even inside a `type` annotation wrapper, so no
// second node type is needed there. Go has both a type_identifier (type
// positions: struct/interface/var-type names) AND a field_identifier (struct
// field access and method names in selector expressions, e.g. `w.Greet(...)`
// -- the same token kind method_declaration's own `name` field uses) --
// method usages would be invisible without including it.
const IDENTIFIER_NODE_TYPES = {
    ts: new Set(["identifier", "type_identifier"]),
    python: new Set(["identifier"]),
    go: new Set(["identifier", "type_identifier", "field_identifier"]),
};
export function collectIdentifierUsages(root, relPath, nameNodeOffsets, usagesOut, lang = "ts") {
    const identifierTypes = IDENTIFIER_NODE_TYPES[lang];
    function visit(node) {
        if (identifierTypes.has(node.type) && !nameNodeOffsets.has(node.startIndex)) {
            usagesOut.push({ name: node.text, file: relPath, line: node.startPosition.row + 1 });
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
