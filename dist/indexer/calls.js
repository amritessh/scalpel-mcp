const MAX_CALLEE_TEXT = 60;
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
function collectTsCalls(root, relPath, defsInFile, callsOut) {
    function visit(node) {
        if (node.type === "call_expression") {
            const callee = node.childForFieldName("function");
            if (callee) {
                let calleeName;
                let resolved;
                // Anchor line: `node.startPosition` is the start of the whole call
                // expression, which for a multi-line fluent chain (z.array(...)
                // .nonempty()\n  .parse(...)) is the RECEIVER's line, not the line
                // ".parse(" actually appears on. Anchor on the property-name token
                // itself for member-expression callees so callLine is where the
                // call literally reads.
                let anchor = node;
                if (callee.type === "identifier") {
                    calleeName = callee.text;
                    resolved = true;
                    anchor = callee;
                }
                else if (callee.type === "member_expression") {
                    const prop = callee.childForFieldName("property");
                    if (prop && prop.type === "property_identifier") {
                        calleeName = prop.text;
                        resolved = true;
                        anchor = prop;
                    }
                    else {
                        // computed member access, e.g. obj[fn]() -- dynamic dispatch, don't guess
                        calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                        resolved = false;
                    }
                }
                else {
                    // callee is itself a call/parenthesized/other expression -- dynamic dispatch
                    calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                    resolved = false;
                }
                const line = anchor.startPosition.row + 1;
                const enclosing = findEnclosingDefinition(defsInFile, line);
                callsOut.push({
                    callerName: enclosing?.name ?? null,
                    callerFile: relPath,
                    callerStartLine: enclosing?.startLine ?? null,
                    callerEndLine: enclosing?.endLine ?? null,
                    calleeName,
                    callLine: line,
                    resolved,
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
function collectPythonCalls(root, relPath, defsInFile, callsOut) {
    function visit(node) {
        if (node.type === "call") {
            const callee = node.childForFieldName("function");
            if (callee) {
                let calleeName;
                let resolved;
                let anchor = node;
                if (callee.type === "identifier") {
                    calleeName = callee.text;
                    resolved = true;
                    anchor = callee;
                }
                else if (callee.type === "attribute") {
                    // obj.method(...) -- attribute field is the outermost accessed
                    // name, e.g. for os.path.join, attribute="join".
                    const attr = callee.childForFieldName("attribute");
                    if (attr && attr.type === "identifier") {
                        calleeName = attr.text;
                        resolved = true;
                        anchor = attr;
                    }
                    else {
                        calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                        resolved = false;
                    }
                }
                else {
                    // callee is itself a call/subscript/other expression -- dynamic dispatch
                    calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                    resolved = false;
                }
                const line = anchor.startPosition.row + 1;
                const enclosing = findEnclosingDefinition(defsInFile, line);
                callsOut.push({
                    callerName: enclosing?.name ?? null,
                    callerFile: relPath,
                    callerStartLine: enclosing?.startLine ?? null,
                    callerEndLine: enclosing?.endLine ?? null,
                    calleeName,
                    callLine: line,
                    resolved,
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
function collectGoCalls(root, relPath, defsInFile, callsOut) {
    function visit(node) {
        if (node.type === "call_expression") {
            const callee = node.childForFieldName("function");
            if (callee) {
                let calleeName;
                let resolved;
                let anchor = node;
                if (callee.type === "identifier") {
                    calleeName = callee.text;
                    resolved = true;
                    anchor = callee;
                }
                else if (callee.type === "selector_expression") {
                    // pkg.Func(...) or receiver.Method(...) -- both are syntactically a
                    // selector_expression in Go, indistinguishable without full type
                    // resolution (which this project deliberately doesn't do, per the
                    // same naive name-based matching limitation TS's member_expression
                    // and Python's attribute handling already have). `field` is the
                    // field_identifier for either case.
                    const field = callee.childForFieldName("field");
                    if (field && field.type === "field_identifier") {
                        calleeName = field.text;
                        resolved = true;
                        anchor = field;
                    }
                    else {
                        calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                        resolved = false;
                    }
                }
                else {
                    // callee is itself a call/index/other expression -- dynamic dispatch
                    calleeName = callee.text.slice(0, MAX_CALLEE_TEXT);
                    resolved = false;
                }
                const line = anchor.startPosition.row + 1;
                const enclosing = findEnclosingDefinition(defsInFile, line);
                callsOut.push({
                    callerName: enclosing?.name ?? null,
                    callerFile: relPath,
                    callerStartLine: enclosing?.startLine ?? null,
                    callerEndLine: enclosing?.endLine ?? null,
                    calleeName,
                    callLine: line,
                    resolved,
                });
            }
        }
        for (const child of node.namedChildren)
            visit(child);
    }
    visit(root);
}
export function collectCalls(root, relPath, defsInFile, callsOut, lang = "ts") {
    if (lang === "python") {
        collectPythonCalls(root, relPath, defsInFile, callsOut);
    }
    else if (lang === "go") {
        collectGoCalls(root, relPath, defsInFile, callsOut);
    }
    else {
        collectTsCalls(root, relPath, defsInFile, callsOut);
    }
}
