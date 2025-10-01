#!/usr/bin/env bash
set -e

GRAMMARS=(
  "vendor/tree-sitter-python"
  "vendor/tree-sitter-javascript"
  "vendor/tree-sitter-typescript/typescript"
  "vendor/tree-sitter-go"
  "vendor/tree-sitter-rust"
  "vendor/tree-sitter-java"
  "vendor/tree-sitter-c"
  "vendor/tree-sitter-c-sharp"
  "vendor/tree-sitter-bash"
  "vendor/tree-sitter-haskell"
)

for g in "${GRAMMARS[@]}"; do
  echo "🛠 Generating parser for $g"

  if [[ "$g" == "vendor/tree-sitter-typescript/typescript" ]]; then
  (
    cd vendor/tree-sitter-typescript
    npm install
    npx tree-sitter generate typescript/grammar.js
    npx tree-sitter generate tsx/grammar.js
  )
  else
    (cd "$g" && npm install && npx tree-sitter generate)
  echo "✅ Done"
  fi

done
