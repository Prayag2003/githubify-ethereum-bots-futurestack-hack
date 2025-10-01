#!/usr/bin/env python3
import os
from tree_sitter import Language

# paths
BUILD_DIR = "build"
os.makedirs(BUILD_DIR, exist_ok=True)
LIB_PATH = os.path.join(BUILD_DIR, "all-lang-parser.so")

# list of tree-sitter grammar repos you have cloned
LANG_REPOS = [
    "vendor/tree-sitter-python",
    "vendor/tree-sitter-javascript",
    "vendor/tree-sitter-typescript/typescript",
    "vendor/tree-sitter-go",
    "vendor/tree-sitter-rust",
    "vendor/tree-sitter-java",
    "vendor/tree-sitter-c",
    "vendor/tree-sitter-c-sharp",
    "vendor/tree-sitter-bash",
    "vendor/tree-sitter-haskell",
]

print("Building Tree-sitter shared library...")
Language.build_library(
    # output path
    LIB_PATH,
    LANG_REPOS
)
print(f"✅ Built shared lib at {LIB_PATH}")
