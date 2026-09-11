function findEnclosingDefinition(defsInFile, line) {
    let best = null;
    for (const def of defsInFile) {
        if (def.startLine <= line && line <= def.endLine) {
            if (!best || def.endLine - def.startLine < best.endLine - best.startLine) {
                best = def;
            }
        }
    }
    return best;
}
// TS-only (see RawTypeReference doc). Two sources of type-level references:
//
// 1. `type_identifier` nodes generically -- covers interface extends,
//    implements clauses, type annotations, generic type arguments, and type
//    alias members. TS's grammar already gives these their own node type,
//    distinct from value-position `identifier`.
// 2. `class X extends Y` specifically: verified by parsing a sample (see
//    commit history) that this clause's value is a plain `identifier`, NOT
//    `type_identifier` -- because JS's grammar allows an arbitrary
//    expression there (`class X extends someFactory()`), TS reuses the same
//    expression-position slot rather than a dedicated type slot. Handled as
//    an explicit special case so base-class dependencies (a load-bearing
//    "what breaks if I change this" relationship) aren't silently missed,
//    same pattern as the earlier abstract_class_declaration fix.
export function collectTypeReferences(root, relPath, defsInFile, nameNodeOffsets, refsOut) {
    function pushRef(nameNode) {
        const line = nameNode.startPosition.row + 1;
        const enclosing = findEnclosingDefinition(defsInFile, line);
        refsOut.push({
            referencerName: enclosing?.name ?? null,
            referencerFile: relPath,
            referencerStartLine: enclosing?.startLine ?? null,
            referencerEndLine: enclosing?.endLine ?? null,
            referencedName: nameNode.text,
            referenceLine: line,
        });
    }
    function visit(node) {
        if (node.type === "type_identifier" && !nameNodeOffsets.has(node.startIndex)) {
            pushRef(node);
        }
        else if (node.type === "class_declaration") {
            const heritage = node.namedChildren.find((c) => c.type === "class_heritage");
            const extendsClause = heritage?.namedChildren.find((c) => c.type === "extends_clause");
            const value = extendsClause?.childForFieldName("value");
            if (value && value.type === "identifier" && !nameNodeOffsets.has(value.startIndex)) {
                pushRef(value);
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
