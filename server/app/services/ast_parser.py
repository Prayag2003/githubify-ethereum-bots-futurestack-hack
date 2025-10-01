# server/app/services/ast_parser.py
import os
import json
from tree_sitter import Language, Parser

# Path to the shared library you built
LIB_PATH = os.path.join(os.path.dirname(__file__), '..', 'build', 'all-lang-parser.so')
print("LIB_PATH", LIB_PATH)

# Map file extensions -> tree-sitter language names
EXT_LANG_MAP = {
    '.py': 'python',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.h': 'c',
    # '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.cs': 'c_sharp',
    '.sh': 'bash',
    '.bash': 'bash',
    '.md': 'markdown',
    'README': 'markdown',  # special-case README no-ext
    '.hs': 'haskell',
}

# Load all languages from the shared library
LANGUAGE_MAP = {
    lang: Language(LIB_PATH, lang)
    for lang in (
        'python', 'javascript', 'typescript', 'go', 'rust',
        'java', 'c', 'c_sharp', 'bash', 'haskell'
    )
}

# Helper to detect language from file path
def detect_language_from_path(path: str):
    base = os.path.basename(path)
    name, ext = os.path.splitext(base)
    if base.upper().startswith('README'):
        return 'markdown'
    return EXT_LANG_MAP.get(ext.lower())

# Extract text from a node
def node_text(src_bytes, node):
    return src_bytes[node.start_byte:node.end_byte].decode('utf8')

# Walk AST and collect functions, classes, imports
def extract_symbols(tree, src_bytes, language: str):
    root = tree.root_node
    functions, classes, imports = [], [], []

    def walk(node):
        # Python
        if language == 'python':
            if node.type == 'function_definition':
                name = node.child_by_field_name('name')
                functions.append({'name': node_text(src_bytes, name) if name else '<anon>',
                                  'start_line': node.start_point[0] + 1})
            if node.type == 'class_definition':
                name = node.child_by_field_name('name')
                classes.append({'name': node_text(src_bytes, name) if name else '<anon>',
                                'start_line': node.start_point[0] + 1})
            if node.type in ('import_statement', 'import_from_statement'):
                imports.append(node_text(src_bytes, node).strip())

        # JavaScript / TypeScript
        elif language in ('javascript', 'typescript'):
            if node.type in ('function_declaration', 'method_definition', 'function'):
                idn = node.child_by_field_name('name') or node.child_by_field_name('identifier')
                if idn:
                    functions.append({'name': node_text(src_bytes, idn), 'start_line': node.start_point[0] + 1})
            if node.type in ('class_declaration', 'class'):
                idn = node.child_by_field_name('name')
                classes.append({'name': node_text(src_bytes, idn) if idn else '<anon>', 'start_line': node.start_point[0] + 1})
            if node.type in ('import_statement', 'import_clause', 'import'):
                imports.append(node_text(src_bytes, node).strip())

        # Go
        elif language == 'go':
            if node.type == 'function_declaration':
                idn = node.child_by_field_name('name')
                functions.append({'name': node_text(src_bytes, idn) if idn else '<anon>', 'start_line': node.start_point[0] + 1})
            if node.type == 'type_declaration':
                classes.append({'name': node_text(src_bytes, node), 'start_line': node.start_point[0] + 1})
            if node.type == 'import_declaration':
                imports.append(node_text(src_bytes, node).strip())

        # C / C++ / Java / Rust / C#
        elif language in ('c', 'cpp', 'java', 'rust', 'c_sharp'):
            if node.type in ('function_definition', 'function_declaration', 'method_declaration'):
                for ch in node.children:
                    if ch.type == 'identifier':
                        functions.append({'name': node_text(src_bytes, ch), 'start_line': node.start_point[0] + 1})
                        break
            if node.type in ('class_specifier', 'class_declaration', 'struct_specifier'):
                for ch in node.children:
                    if ch.type in ('type_identifier', 'identifier'):
                        classes.append({'name': node_text(src_bytes, ch), 'start_line': node.start_point[0] + 1})
                        break
            if node.type in ('using_directive', 'import_declaration', 'use_declaration', 'extern_crate_declaration'):
                imports.append(node_text(src_bytes, node).strip())

        # Bash
        elif language == 'bash':
            if node.type == 'function_definition':
                idn = node.child_by_field_name('name')
                functions.append({'name': node_text(src_bytes, idn) if idn else '<anon>', 'start_line': node.start_point[0] + 1})
            if node.type == 'command':
                txt = node_text(src_bytes, node)
                if txt.strip().startswith(('source ', '. ')):
                    imports.append(txt.strip())

        # Markdown
        elif language == 'markdown':
            if node.type in ('atx_heading', 'setext_heading'):
                heading = node_text(src_bytes, node)
                imports.append(heading.strip())

        # Recurse
        for c in node.children:
            walk(c)

    walk(root)
    return {'functions': functions, 'classes': classes, 'imports': imports}

# Parse a single file
def parse_file(path: str):
    lang_key = detect_language_from_path(path)
    if not lang_key:
        return None
    language = LANGUAGE_MAP.get(lang_key)
    if not language:
        return None

    parser = Parser()
    parser.set_language(language)
    with open(path, 'rb') as f:
        src_bytes = f.read()
    tree = parser.parse(src_bytes)
    symbols = extract_symbols(tree, src_bytes, lang_key)

    return {
        'file_path': path,
        'language': lang_key,
        'functions': symbols['functions'],
        'classes': symbols['classes'],
        'imports': symbols['imports'],
        'ast_sexp': tree.root_node.sexp(),
        'size_bytes': len(src_bytes),
    }

# Parse entire repo and save JSON files
def parse_repo_to_json(repo_id: str, repo_path: str, out_dir='parsed_repos'):
    out_base = os.path.join(out_dir, repo_id, 'files')
    os.makedirs(out_base, exist_ok=True)
    all_meta = []

    for root, _, files in os.walk(repo_path):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, repo_path)
            meta = parse_file(full)
            if not meta:
                continue

            out_path = os.path.join(out_base, rel + '.json')
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, 'w', encoding='utf8') as fh:
                json.dump(meta, fh, indent=2)
            all_meta.append({'rel_path': rel, 'meta_path': out_path})

    # Write top-level metadata
    top_meta = {'repo_id': repo_id, 'file_count': len(all_meta)}
    with open(os.path.join(out_dir, repo_id, 'metadata.json'), 'w', encoding='utf8') as fh:
        json.dump(top_meta, fh, indent=2)

    return all_meta
