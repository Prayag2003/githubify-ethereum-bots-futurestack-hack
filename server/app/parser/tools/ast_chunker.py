import logging
from typing import List, Dict, Optional
from tree_sitter import Language, Parser
import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_java
import tree_sitter_go
import tree_sitter_c
import tree_sitter_cpp
import tree_sitter_rust
import tree_sitter_ruby
import tree_sitter_php
import tree_sitter_swift

logger = logging.getLogger(__name__)

class ASTChunker:
    """
    Advanced AST-based chunking that extracts meaningful code structures
    for all supported programming languages.
    """
    
    def __init__(self):
        self.parsers = self._init_parsers()
        logger.info("ASTChunker initialized with %d language parsers", len(self.parsers))
    
    def _init_parsers(self) -> Dict[str, Parser]:
        """Initialize tree-sitter parsers for all supported languages."""
        parsers = {}
        
        # Language mappings
        language_configs = [
            ('.py', tree_sitter_python, 'python'),
            ('.js', tree_sitter_javascript, 'javascript'),
            ('.jsx', tree_sitter_javascript, 'javascript'),
            ('.ts', tree_sitter_typescript, 'typescript'),
            ('.tsx', tree_sitter_typescript, 'typescript'),
            ('.java', tree_sitter_java, 'java'),
            ('.go', tree_sitter_go, 'go'),
            ('.c', tree_sitter_c, 'c'),
            ('.cpp', tree_sitter_cpp, 'cpp'),
            ('.cc', tree_sitter_cpp, 'cpp'),
            ('.cxx', tree_sitter_cpp, 'cpp'),
            ('.h', tree_sitter_c, 'c'),
            ('.hpp', tree_sitter_cpp, 'cpp'),
            ('.rs', tree_sitter_rust, 'rust'),
            ('.rb', tree_sitter_ruby, 'ruby'),
            ('.php', tree_sitter_php, 'php'),
            ('.swift', tree_sitter_swift, 'swift'),
        ]
        
        for ext, module, lang_name in language_configs:
            try:
                language = Language(module.language())
                parser = Parser(language)
                parsers[ext] = parser
                logger.debug("Initialized parser for %s (%s)", ext, lang_name)
            except Exception as e:
                logger.warning("Could not initialize parser for %s (%s): %s", ext, lang_name, e)
        
        return parsers
    
    def chunk(self, content: str, file_extension: str) -> List[str]:
        """
        Extract meaningful code chunks using AST parsing.
        
        Args:
            content: Source code content
            file_extension: File extension to determine language
            
        Returns:
            List of meaningful code chunks
        """
        if not content.strip():
            return []
        
        # Use AST parser if available
        if file_extension in self.parsers:
            try:
                return self._chunk_with_ast(content, file_extension)
            except Exception as e:
                logger.warning("AST parsing failed for %s, using fallback: %s", file_extension, e)
                return self._chunk_with_fallback(content, file_extension)
        else:
            logger.debug("No AST parser for %s, using fallback", file_extension)
            return self._chunk_with_fallback(content, file_extension)
    
    def _chunk_with_ast(self, content: str, file_extension: str) -> List[str]:
        """Chunk using AST parsing."""
        parser = self.parsers[file_extension]
        tree = parser.parse(bytes(content, "utf8"))
        
        chunks = []
        root_node = tree.root_node
        
        # Extract different types of meaningful structures
        structures = self._extract_structures(root_node, content, file_extension)
        
        # Group structures by type and create chunks
        for structure_type, structures_list in structures.items():
            for structure in structures_list:
                if structure['text'].strip():
                    # Add context information
                    chunk = self._format_chunk(structure, structure_type, file_extension)
                    chunks.append(chunk)
        
        # If no meaningful structures found, create fallback chunks
        if not chunks:
            logger.debug("No meaningful AST structures found for %s, using fallback", file_extension)
            return self._chunk_with_fallback(content, file_extension)
        
        logger.debug("AST chunking created %d chunks for %s", len(chunks), file_extension)
        return chunks
    
    def _extract_structures(self, node, content: str, file_extension: str) -> Dict[str, List[Dict]]:
        """Extract different types of code structures from AST."""
        structures = {
            'functions': [],
            'classes': [],
            'modules': [],
            'interfaces': [],
            'enums': [],
            'constants': [],
            'imports': [],
            'comments': []
        }
        
        def traverse(node, depth=0):
            if depth > 10:  # Prevent deep recursion
                return
            
            # Extract different structure types based on language
            structure_type = self._get_structure_type(node, file_extension)
            
            if structure_type and structure_type in structures:
                text = content[node.start_byte:node.end_byte]
                if text.strip():
                    structures[structure_type].append({
                        'type': node.type,
                        'text': text,
                        'start_line': node.start_point[0] + 1,
                        'end_line': node.end_point[0] + 1,
                        'start_byte': node.start_byte,
                        'end_byte': node.end_byte
                    })
            
            # Recursively traverse children
            for child in node.children:
                traverse(child, depth + 1)
        
        traverse(node)
        return structures
    
    def _get_structure_type(self, node, file_extension: str) -> Optional[str]:
        """Determine the type of code structure based on node type and language."""
        node_type = node.type
        
        # Language-specific structure mappings
        if file_extension in ['.py']:
            return self._get_python_structure_type(node_type)
        elif file_extension in ['.js', '.jsx', '.ts', '.tsx']:
            return self._get_javascript_structure_type(node_type)
        elif file_extension in ['.java']:
            return self._get_java_structure_type(node_type)
        elif file_extension in ['.go']:
            return self._get_go_structure_type(node_type)
        elif file_extension in ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp']:
            return self._get_c_structure_type(node_type)
        elif file_extension in ['.rs']:
            return self._get_rust_structure_type(node_type)
        elif file_extension in ['.rb']:
            return self._get_ruby_structure_type(node_type)
        elif file_extension in ['.php']:
            return self._get_php_structure_type(node_type)
        elif file_extension in ['.swift']:
            return self._get_swift_structure_type(node_type)
        
        return None
    
    def _get_python_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Python."""
        if node_type in ['function_definition', 'async_function_definition']:
            return 'functions'
        elif node_type in ['class_definition']:
            return 'classes'
        elif node_type in ['import_statement', 'import_from_statement']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['module']:
            return 'modules'
        return None
    
    def _get_javascript_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for JavaScript/TypeScript."""
        if node_type in ['function_declaration', 'function_expression', 'arrow_function', 'method_definition']:
            return 'functions'
        elif node_type in ['class_declaration', 'class_expression']:
            return 'classes'
        elif node_type in ['interface_declaration']:
            return 'interfaces'
        elif node_type in ['enum_declaration']:
            return 'enums'
        elif node_type in ['import_statement', 'export_statement']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['program']:
            return 'modules'
        return None
    
    def _get_java_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Java."""
        if node_type in ['method_declaration', 'constructor_declaration']:
            return 'functions'
        elif node_type in ['class_declaration', 'interface_declaration', 'enum_declaration']:
            return 'classes'
        elif node_type in ['import_declaration']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['program']:
            return 'modules'
        return None
    
    def _get_go_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Go."""
        if node_type in ['function_declaration', 'method_declaration']:
            return 'functions'
        elif node_type in ['type_declaration', 'struct_type', 'interface_type']:
            return 'classes'
        elif node_type in ['import_declaration']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['source_file']:
            return 'modules'
        return None
    
    def _get_c_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for C/C++."""
        if node_type in ['function_definition', 'method_definition']:
            return 'functions'
        elif node_type in ['class_specifier', 'struct_specifier', 'union_specifier']:
            return 'classes'
        elif node_type in ['preproc_include', 'preproc_import']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['translation_unit']:
            return 'modules'
        return None
    
    def _get_rust_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Rust."""
        if node_type in ['function_item', 'impl_item']:
            return 'functions'
        elif node_type in ['struct_item', 'enum_item', 'trait_item', 'impl_item']:
            return 'classes'
        elif node_type in ['use_declaration']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['source_file']:
            return 'modules'
        return None
    
    def _get_ruby_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Ruby."""
        if node_type in ['method', 'singleton_method']:
            return 'functions'
        elif node_type in ['class', 'module']:
            return 'classes'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['program']:
            return 'modules'
        return None
    
    def _get_php_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for PHP."""
        if node_type in ['method_declaration', 'function_definition']:
            return 'functions'
        elif node_type in ['class_declaration', 'interface_declaration', 'trait_declaration']:
            return 'classes'
        elif node_type in ['use_declaration']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['program']:
            return 'modules'
        return None
    
    def _get_swift_structure_type(self, node_type: str) -> Optional[str]:
        """Get structure type for Swift."""
        if node_type in ['function_declaration', 'initializer_declaration']:
            return 'functions'
        elif node_type in ['class_declaration', 'struct_declaration', 'protocol_declaration', 'enum_declaration']:
            return 'classes'
        elif node_type in ['import_declaration']:
            return 'imports'
        elif node_type in ['comment']:
            return 'comments'
        elif node_type in ['source_file']:
            return 'modules'
        return None
    
    def _format_chunk(self, structure: Dict, structure_type: str, file_extension: str) -> str:
        """Format a code structure into a meaningful chunk."""
        lines = structure['text'].split('\n')
        
        # Add header with structure information
        header = f"// {structure_type.upper()}: Lines {structure['start_line']}-{structure['end_line']}\n"
        
        # Add the actual code
        code = structure['text']
        
        # Add footer with metadata
        footer = f"\n// End of {structure_type} (AST chunk)"
        
        return header + code + footer
    
    def _chunk_with_fallback(self, content: str, file_extension: str) -> List[str]:
        """Fallback chunking when AST parsing fails."""
        # Simple line-based chunking as fallback
        lines = content.split('\n')
        chunks = []
        current_chunk = []
        max_lines = 50  # Maximum lines per fallback chunk
        
        for line in lines:
            current_chunk.append(line)
            if len(current_chunk) >= max_lines:
                chunk_text = '\n'.join(current_chunk)
                if chunk_text.strip():
                    chunks.append(f"// Fallback chunk for {file_extension}\n{chunk_text}")
                current_chunk = []
        
        # Add remaining lines
        if current_chunk:
            chunk_text = '\n'.join(current_chunk)
            if chunk_text.strip():
                chunks.append(f"// Fallback chunk for {file_extension}\n{chunk_text}")
        
        return chunks if chunks else [content]
