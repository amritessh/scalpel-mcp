# scalpel

Symbol-level codebase retrieval MCP server. Give an agent `get_symbol(name)` instead of a whole file — it returns just the definition and its usages.

## Install

```bash
npm install -g @amritessh/scalpel

# index a repo (lang: ts | python | go, default ts)
scalpel-index /path/to/repo /path/to/repo/.scalpel/index.db [lang]

# run the MCP server over stdio
scalpel /path/to/repo /path/to/repo/.scalpel/index.db
```

Point an MCP client at it (stdio transport, args: `<repoPath> <dbPath>`).

## Background

This tool grew out of a research study on symbol-level code retrieval for AI coding agents — token cost, real dollar cost, and task-completion effects, tested across multiple languages and 57 real historical bugs. The frozen research artifact (raw data, benchmark harness, full writeup) lives at [amritessh/scalpel-fse2027-artifact](https://github.com/amritessh/scalpel-fse2027-artifact).

This repository is the maintained, installable product — its source is developed separately from the research artifact above.
