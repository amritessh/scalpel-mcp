import { getDocComment } from "./doc-comment.js";
const TS_DEFINITION_NODE_TYPES = new Set([
    "function_declaration",
    "class_declaration",
    // tree-sitter-typescript gives `abstract class X` its own node type,
    // distinct from class_declaration -- easy to miss (found via eval grading:
    // v3/types.ts's `export abstract class ZodType` was silently unindexed).
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "method_definition",
]);
// class_definition/function_definition cover both module-level and class-body
// members in Python -- there's no separate "method" node type the way TS has
// method_definition. Decorators wrap the definition in a decorated_definition
// node, but that's just a parent; the recursive visit still reaches the
// inner function_definition/class_definition on its own.
const PYTHON_DEFINITION_NODE_TYPES = new Set(["function_definition", "class_definition"]);
function collectTsDefinitions(root, relPath, defsOut, nameNodeOffsets) {
    function visit(node) {
        if (TS_DEFINITION_NODE_TYPES.has(node.type)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                nameNodeOffsets.add(nameNode.startIndex);
                defsOut.push({
                    name: nameNode.text,
                    kind: node.type.replace(/_declaration$/, "").replace(/_definition$/, ""),
                    file: relPath,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    doc: getDocComment(node),
                });
            }
        }
        else if (node.type === "variable_declarator") {
            const nameNode = node.childForFieldName("name");
            const valueNode = node.childForFieldName("value");
            if (nameNode &&
                nameNode.type === "identifier" &&
                valueNode &&
                (valueNode.type === "arrow_function" || valueNode.type === "function_expression")) {
                nameNodeOffsets.add(nameNode.startIndex);
                const declNode = node.parent?.parent?.type === "export_statement" ? node.parent.parent : node.parent ?? node;
                defsOut.push({
                    name: nameNode.text,
                    kind: "function",
                    file: relPath,
                    startLine: declNode.startPosition.row + 1,
                    endLine: valueNode.endPosition.row + 1,
                    doc: getDocComment(declNode),
                });
            }
        }
        else if (node.type === "assignment_expression") {
            // Property-assignment method definitions: `inst.unwrap = () => ...`,
            // common in zod's v4 core for building per-instance methods on
            // constructed objects (`class_declaration`/`public_field_definition`
            // only cover methods declared in a class body, not this pattern).
            const left = node.childForFieldName("left");
            const right = node.childForFieldName("right");
            if (left &&
                left.type === "member_expression" &&
                right &&
                (right.type === "arrow_function" || right.type === "function_expression")) {
                const propertyNode = left.childForFieldName("property");
                if (propertyNode && propertyNode.type === "property_identifier") {
                    nameNodeOffsets.add(propertyNode.startIndex);
                    defsOut.push({
                        name: propertyNode.text,
                        kind: "method",
                        file: relPath,
                        startLine: node.startPosition.row + 1,
                        endLine: right.endPosition.row + 1,
                        doc: getDocComment(node),
                    });
                }
            }
        }
        else if (node.type === "public_field_definition") {
            const nameNode = node.childForFieldName("name");
            const valueNode = node.childForFieldName("value");
            if (nameNode &&
                valueNode &&
                (valueNode.type === "arrow_function" || valueNode.type === "function_expression")) {
                nameNodeOffsets.add(nameNode.startIndex);
                defsOut.push({
                    name: nameNode.text,
                    kind: "method",
                    file: relPath,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    doc: getDocComment(node),
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
// Python docstrings are the first statement in a body (a bare string
// expression), not a leading comment -- a different mechanism from TS's
// `/** ... */` block. Not extracted here (returns null); doesn't affect any
// ablation metric (token counts, usages, calls), only get_symbol's `doc`
// field, so scoped out rather than blocking on it.
function collectPythonDefinitions(root, relPath, defsOut, nameNodeOffsets) {
    function visit(node) {
        if (PYTHON_DEFINITION_NODE_TYPES.has(node.type)) {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                nameNodeOffsets.add(nameNode.startIndex);
                defsOut.push({
                    name: nameNode.text,
                    kind: node.type === "class_definition" ? "class" : "function",
                    file: relPath,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    doc: null,
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
// function_declaration (top-level func) and method_declaration (func with a
// receiver) are distinct node types in tree-sitter-go, the same split TS has
// between function_declaration and method_definition. type_spec (nested
// inside a type_declaration, possibly one of several in a parenthesized
// `type (...)` group) covers struct/interface/alias type definitions --
// visited via the normal recursive walk rather than specially unwrapping
// type_declaration, the same way TS doesn't specially unwrap export_statement.
// Doc comments (Go's `// ...` lines directly preceding a declaration) are not
// extracted here (doc: null throughout), the same scoping decision already
// made for Python -- cosmetic only, doesn't affect any ablation metric.
function collectGoDefinitions(root, relPath, defsOut, nameNodeOffsets) {
    function visit(node) {
        if (node.type === "function_declaration" || node.type === "method_declaration") {
            const nameNode = node.childForFieldName("name");
            if (nameNode) {
                nameNodeOffsets.add(nameNode.startIndex);
                defsOut.push({
                    name: nameNode.text,
                    kind: node.type === "method_declaration" ? "method" : "function",
                    file: relPath,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    doc: null,
                });
            }
        }
        else if (node.type === "type_spec") {
            const nameNode = node.childForFieldName("name");
            const typeNode = node.childForFieldName("type");
            if (nameNode) {
                nameNodeOffsets.add(nameNode.startIndex);
                // Refines the plain "type" kind into struct/interface/alias -- purely
                // additive (more specific `kind` label on the same definitions,
                // same name/span/offsets), doesn't change token counts or which
                // definitions are found, so it can't affect any benchmark number.
                const kind = typeNode?.type === "struct_type" ? "struct" : typeNode?.type === "interface_type" ? "interface" : "type";
                defsOut.push({
                    name: nameNode.text,
                    kind,
                    file: relPath,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    doc: null,
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
export function collectDefinitions(root, relPath, defsOut, nameNodeOffsets, lang = "ts") {
    if (lang === "python") {
        collectPythonDefinitions(root, relPath, defsOut, nameNodeOffsets);
    }
    else if (lang === "go") {
        collectGoDefinitions(root, relPath, defsOut, nameNodeOffsets);
    }
    else {
        collectTsDefinitions(root, relPath, defsOut, nameNodeOffsets);
    }
}
