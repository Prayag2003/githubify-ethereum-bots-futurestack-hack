import re
import logging
from typing import List
from tree_sitter import Language, Parser
import tree_sitter_python
import tree_sitter_javascript

logger = logging.getLogger(__name__)

class FixedSizeChunker:
    """Chunks text into fixed-size overlapping chunks."""
    
    def __init__(self, chunk_size: int = 2000, overlap: int = 200):
        self.chunk_size = chunk_size
        self.overlap = overlap
        logger.info(f"FixedSizeChunker initialized with chunk_size={chunk_size}, overlap={overlap}")
    
    def chunk(self, text: str) -> List[str]:
        """
        Splits text into fixed-size chunks with overlap.
        
        Args:
            text: The text to chunk
        
        Returns:
            List of text chunks
        """
        if not text:
            return []
        
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + self.chunk_size
            chunk = text[start:end]
            
            # Try to break at newline if possible
            if end < text_length and '\n' in chunk:
                last_newline = chunk.rfind('\n')
                if last_newline > self.chunk_size // 2:  # Only if newline is in latter half
                    chunk = chunk[:last_newline]
                    end = start + last_newline
            
            chunks.append(chunk)
            start = end - self.overlap if end < text_length else text_length
        
        logger.debug(f"Fixed chunking created {len(chunks)} chunks")
        return chunks


class SemanticChunker:
    """Chunks code semantically based on language structure."""
    
    def __init__(self):
        self.parsers = self._init_parsers()
        logger.info("SemanticChunker initialized")
    
    def _init_parsers(self) -> dict:
        """Initialize tree-sitter parsers for different languages."""
        parsers = {}
        
        try:
            # Python parser
            PY_LANGUAGE = Language(tree_sitter_python.language())
            py_parser = Parser(PY_LANGUAGE)
            parsers['.py'] = py_parser
            logger.info("Python parser initialized")
        except Exception as e:
            logger.warning(f"Could not initialize Python parser: {e}")
        
        try:
            # JavaScript/TypeScript parser
            JS_LANGUAGE = Language(tree_sitter_javascript.language())
            js_parser = Parser(JS_LANGUAGE)
            for ext in ['.js', '.jsx', '.ts', '.tsx']:
                parsers[ext] = js_parser
            logger.info("JavaScript parser initialized")
        except Exception as e:
            logger.warning(f"Could not initialize JavaScript parser: {e}")
        
        return parsers
    
    def chunk(self, text: str, file_extension: str) -> List[str]:
        """
        Semantically chunk code based on language structure.
        
        Args:
            text: The code text to chunk
            file_extension: File extension to determine language
        
        Returns:
            List of semantic chunks
        """
        # Use tree-sitter parser if available
        if file_extension in self.parsers:
            try:
                return self._chunk_with_parser(text, file_extension)
            except Exception as e:
                logger.warning(f"Parser failed for {file_extension}, falling back to regex: {e}")
        
        # Fallback to regex-based chunking
        return self._chunk_with_regex(text, file_extension)
    
    def _chunk_with_parser(self, text: str, file_extension: str) -> List[str]:
        """Chunk using tree-sitter parser."""
        parser = self.parsers[file_extension]
        tree = parser.parse(bytes(text, "utf8"))
        
        chunks = []
        root_node = tree.root_node
        
        # Extract top-level definitions (functions, classes, etc.)
        for child in root_node.children:
            if child.type in ['function_definition', 'class_definition', 
                             'function_declaration', 'class_declaration',
                             'method_definition', 'export_statement']:
                chunk_text = text[child.start_byte:child.end_byte]
                if chunk_text.strip():
                    chunks.append(chunk_text)
        
        # If no meaningful chunks found, fall back to regex
        if not chunks:
            logger.debug("No top-level definitions found with parser, using regex fallback")
            return self._chunk_with_regex(text, file_extension)
        
        logger.debug(f"Parser created {len(chunks)} semantic chunks")
        return chunks
    
    def _chunk_with_regex(self, text: str, file_extension: str) -> List[str]:
        """Chunk using regex patterns for different languages."""
        
        if file_extension == '.py':
            return self._chunk_python(text)
        elif file_extension in ['.js', '.jsx', '.ts', '.tsx']:
            return self._chunk_javascript(text)
        elif file_extension in ['.java', '.cs', '.cpp', '.c']:
            return self._chunk_c_style(text)
        elif file_extension == '.md':
            return self._chunk_markdown(text)
        else:
            return self._chunk_generic(text)
    
    def _chunk_python(self, text: str) -> List[str]:
        """Chunk Python code by functions and classes."""
        pattern = r'^(?:class|def|async def)\s+\w+.*?(?=^(?:class|def|async def)|\Z)'
        chunks = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
        
        if not chunks:
            return self._chunk_generic(text)
        
        logger.debug(f"Python regex chunking created {len(chunks)} chunks")
        return [c.strip() for c in chunks if c.strip()]
    
    def _chunk_javascript(self, text: str) -> List[str]:
        """Chunk JavaScript/TypeScript code by functions and classes."""
        pattern = r'(?:^|\n)(?:export\s+)?(?:function|class|const|let|var)\s+\w+.*?(?=\n(?:export\s+)?(?:function|class|const|let|var)|\Z)'
        chunks = re.findall(pattern, text, re.DOTALL)
        
        if not chunks:
            return self._chunk_generic(text)
        
        logger.debug(f"JavaScript regex chunking created {len(chunks)} chunks")
        return [c.strip() for c in chunks if c.strip()]
    
    def _chunk_c_style(self, text: str) -> List[str]:
        """Chunk C-style languages by functions and classes."""
        # Match function/method definitions
        pattern = r'(?:^|\n)(?:\w+\s+)*\w+\s+\w+\s*\([^)]*\)\s*\{[^}]*\}'
        chunks = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
        
        if not chunks or len(chunks) < 2:
            return self._chunk_generic(text)
        
        logger.debug(f"C-style regex chunking created {len(chunks)} chunks")
        return [c.strip() for c in chunks if c.strip()]
    
    def _chunk_markdown(self, text: str) -> List[str]:
        """Chunk Markdown by sections (headers)."""
        # Split by headers
        pattern = r'^#{1,6}\s+.+$'
        sections = re.split(pattern, text, flags=re.MULTILINE)
        headers = re.findall(pattern, text, flags=re.MULTILINE)
        
        chunks = []
        for i, section in enumerate(sections):
            if i > 0 and i - 1 < len(headers):
                chunk = headers[i - 1] + '\n' + section
            else:
                chunk = section
            
            if chunk.strip():
                chunks.append(chunk.strip())
        
        if not chunks:
            return self._chunk_generic(text)
        
        logger.debug(f"Markdown chunking created {len(chunks)} chunks")
        return chunks
    
    def _chunk_generic(self, text: str) -> List[str]:
        """Generic chunking by paragraphs or logical breaks."""
        # Split by double newlines (paragraphs) or logical breaks
        chunks = re.split(r'\n\s*\n', text)
        chunks = [c.strip() for c in chunks if c.strip()]
        
        # If chunks are too small, combine them
        if chunks and len(chunks) > 1:
            combined_chunks = []
            current_chunk = ""
            
            for chunk in chunks:
                if len(current_chunk) + len(chunk) < 1500:
                    current_chunk += "\n\n" + chunk if current_chunk else chunk
                else:
                    if current_chunk:
                        combined_chunks.append(current_chunk)
                    current_chunk = chunk
            
            if current_chunk:
                combined_chunks.append(current_chunk)
            
            chunks = combined_chunks
        
        # If still no good chunks, split by lines
        if not chunks or len(chunks) == 1 and len(chunks[0]) > 2000:
            lines = text.split('\n')
            chunks = []
            current_chunk = ""
            
            for line in lines:
                if len(current_chunk) + len(line) < 1000:
                    current_chunk += "\n" + line if current_chunk else line
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = line
            
            if current_chunk:
                chunks.append(current_chunk)
        
        logger.debug(f"Generic chunking created {len(chunks)} chunks")
        return chunks if chunks else [text]