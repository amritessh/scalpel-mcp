export function getDocComment(node) {
    const anchor = node.parent?.type === "export_statement" ? node.parent : node;
    const prev = anchor.previousSibling;
    if (prev && prev.type === "comment" && prev.text.startsWith("/**")) {
        return prev.text
            .replace(/^\/\*\*/, "")
            .replace(/\*\/$/, "")
            .split("\n")
            .map((l) => l.trim().replace(/^\*\s?/, ""))
            .join("\n")
            .trim();
    }
    return null;
}
