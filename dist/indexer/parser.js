import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Go from "tree-sitter-go";
export function makeParser(lang, isTsx = false) {
    const parser = new Parser();
    if (lang === "python") {
        parser.setLanguage(Python);
    }
    else if (lang === "go") {
        parser.setLanguage(Go);
    }
    else {
        parser.setLanguage(isTsx ? TypeScript.tsx : TypeScript.typescript);
    }
    return parser;
}
// node-tree-sitter's parse(string) has a buffer bug above ~32KB;
// a chunked reader callback avoids it. See tree-sitter/node-tree-sitter#161.
export function parseSource(parser, source) {
    return parser.parse((index) => source.slice(index, index + 4096));
}
