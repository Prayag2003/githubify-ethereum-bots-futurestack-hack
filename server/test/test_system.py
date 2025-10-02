#!/usr/bin/env python3
"""
Comprehensive test suite for the GitHubify codebase processing system.
Tests all components: chunking, load balancing, vector storage, and API endpoints.
"""

import os
import sys
import json
import tempfile
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Any

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.parser.ast_parser import load_codebase_as_chunked_docs
from app.parser.tools.chunking import FixedSizeChunker, SemanticChunker
from app.parser.tools.ast_chunker import ASTChunker
from app.parser.tools.indexing_tool import index_repository
from app.vector_db.vector_store import PineconeVectorStore

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestSystem:
    """Comprehensive test suite for the entire system."""
    
    def __init__(self):
        self.test_repo_path = None
        self.test_documents = []
        self.test_results = {}
        
    def setup_test_repository(self) -> str:
        """Create a test repository with various file types."""
        logger.info("🏗️  Setting up test repository...")
        
        # Create temporary directory
        self.test_repo_path = tempfile.mkdtemp(prefix="test_repo_")
        logger.info("📁 Test repository created at: %s", self.test_repo_path)
        
        # Create test files with different languages and structures
        test_files = {
            "main.py": """
import os
import logging
from typing import List, Dict, Optional

class DataProcessor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    def process_data(self, data: List[Dict]) -> List[Dict]:
        \"\"\"Process the input data and return processed results.\"\"\"
        results = []
        for item in data:
            processed = self._transform_item(item)
            results.append(processed)
        return results
    
    def _transform_item(self, item: Dict) -> Dict:
        \"\"\"Transform a single item.\"\"\"
        return {
            'id': item.get('id'),
            'processed': True,
            'timestamp': os.time()
        }

def main():
    processor = DataProcessor({'debug': True})
    data = [{'id': 1, 'name': 'test'}]
    result = processor.process_data(data)
    print(f"Processed {len(result)} items")

if __name__ == "__main__":
    main()
""",
            "utils.js": """
const fs = require('fs');
const path = require('path');

class FileManager {
    constructor(options = {}) {
        this.options = options;
        this.cache = new Map();
    }
    
    async readFile(filePath) {
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath);
        }
        
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            this.cache.set(filePath, content);
            return content;
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw error;
        }
    }
    
    async writeFile(filePath, content) {
        try {
            await fs.promises.writeFile(filePath, content, 'utf8');
            this.cache.set(filePath, content);
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    }
}

module.exports = { FileManager };
""",
            "config.json": """
{
    "database": {
        "host": "localhost",
        "port": 5432,
        "name": "test_db"
    },
    "api": {
        "version": "1.0.0",
        "endpoints": [
            "/users",
            "/posts",
            "/comments"
        ]
    },
    "logging": {
        "level": "INFO",
        "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    }
}
""",
            "README.md": """
# Test Repository

This is a test repository for the GitHubify system.

## Features

- Python data processing
- JavaScript file management
- JSON configuration
- Multiple file types

## Usage

```bash
python main.py
node utils.js
```

## Testing

Run the test suite to verify all functionality.
""",
            "src/helpers.ts": """
interface User {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
}

interface UserService {
    createUser(userData: Partial<User>): Promise<User>;
    getUserById(id: number): Promise<User | null>;
    updateUser(id: number, updates: Partial<User>): Promise<User>;
    deleteUser(id: number): Promise<boolean>;
}

class UserServiceImpl implements UserService {
    private users: Map<number, User> = new Map();
    private nextId = 1;
    
    async createUser(userData: Partial<User>): Promise<User> {
        const user: User = {
            id: this.nextId++,
            name: userData.name || '',
            email: userData.email || '',
            createdAt: new Date()
        };
        
        this.users.set(user.id, user);
        return user;
    }
    
    async getUserById(id: number): Promise<User | null> {
        return this.users.get(id) || null;
    }
    
    async updateUser(id: number, updates: Partial<User>): Promise<User> {
        const user = this.users.get(id);
        if (!user) {
            throw new Error(`User with id ${id} not found`);
        }
        
        const updatedUser = { ...user, ...updates };
        this.users.set(id, updatedUser);
        return updatedUser;
    }
    
    async deleteUser(id: number): Promise<boolean> {
        return this.users.delete(id);
    }
}

export { User, UserService, UserServiceImpl };
"""
        }
        
        # Create files
        for file_path, content in test_files.items():
            full_path = os.path.join(self.test_repo_path, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        logger.info("✅ Test repository setup complete with %d files", len(test_files))
        return self.test_repo_path
    
    def test_chunking_methods(self) -> Dict[str, Any]:
        """Test all three chunking methods."""
        logger.info("🧪 Testing chunking methods...")
        
        results = {
            'fixed_chunker': {'status': 'failed', 'chunks': 0, 'error': None},
            'semantic_chunker': {'status': 'failed', 'chunks': 0, 'error': None},
            'ast_chunker': {'status': 'failed', 'chunks': 0, 'error': None}
        }
        
        # Test with Python file
        test_file = os.path.join(self.test_repo_path, "main.py")
        with open(test_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Test Fixed-Size Chunking
        try:
            logger.info("  🔧 Testing Fixed-Size Chunking...")
            fixed_chunker = FixedSizeChunker(chunk_size=500, overlap=100)
            fixed_chunks = fixed_chunker.chunk(content)
            results['fixed_chunker'] = {
                'status': 'success',
                'chunks': len(fixed_chunks),
                'error': None
            }
            logger.info("    ✅ Fixed-Size: %d chunks created", len(fixed_chunks))
        except Exception as e:
            results['fixed_chunker']['error'] = str(e)
            logger.error("    ❌ Fixed-Size failed: %s", e)
        
        # Test Semantic Chunking
        try:
            logger.info("  🧠 Testing Semantic Chunking...")
            semantic_chunker = SemanticChunker()
            semantic_chunks = semantic_chunker.chunk(content, '.py')
            results['semantic_chunker'] = {
                'status': 'success',
                'chunks': len(semantic_chunks),
                'error': None
            }
            logger.info("    ✅ Semantic: %d chunks created", len(semantic_chunks))
        except Exception as e:
            results['semantic_chunker']['error'] = str(e)
            logger.error("    ❌ Semantic failed: %s", e)
        
        # Test AST Chunking
        try:
            logger.info("  🌳 Testing AST Chunking...")
            ast_chunker = ASTChunker()
            ast_chunks = ast_chunker.chunk(content, '.py')
            results['ast_chunker'] = {
                'status': 'success',
                'chunks': len(ast_chunks),
                'error': None
            }
            logger.info("    ✅ AST: %d chunks created", len(ast_chunks))
        except Exception as e:
            results['ast_chunker']['error'] = str(e)
            logger.error("    ❌ AST failed: %s", e)
        
        return results
    
    def test_codebase_processing(self) -> Dict[str, Any]:
        """Test the complete codebase processing pipeline."""
        logger.info("🧪 Testing codebase processing pipeline...")
        
        try:
            # Process the test repository
            documents = load_codebase_as_chunked_docs(self.test_repo_path)
            
            if not documents:
                return {
                    'status': 'failed',
                    'error': 'No documents generated',
                    'document_count': 0,
                    'chunk_breakdown': {}
                }
            
            # Analyze chunk types
            chunk_breakdown = {}
            total_chunks = 0
            
            for doc in documents:
                chunk_type = doc.metadata.get('chunk_type', 'unknown')
                chunk_breakdown[chunk_type] = chunk_breakdown.get(chunk_type, 0) + 1
                total_chunks += 1
            
            logger.info("  ✅ Generated %d total chunks", total_chunks)
            logger.info("  📊 Chunk breakdown: %s", chunk_breakdown)
            
            self.test_documents = documents
            
            return {
                'status': 'success',
                'document_count': len(documents),
                'total_chunks': total_chunks,
                'chunk_breakdown': chunk_breakdown,
                'error': None
            }
            
        except Exception as e:
            logger.error("  ❌ Codebase processing failed: %s", e)
            return {
                'status': 'failed',
                'error': str(e),
                'document_count': 0,
                'chunk_breakdown': {}
            }
    
    def test_indexing_tool(self) -> Dict[str, Any]:
        """Test the indexing tool."""
        logger.info("🧪 Testing indexing tool...")
        
        try:
            documents = index_repository(self.test_repo_path)
            
            if not documents:
                return {
                    'status': 'failed',
                    'error': 'No documents generated by indexing tool',
                    'document_count': 0
                }
            
            logger.info("  ✅ Indexing tool generated %d documents", len(documents))
            
            return {
                'status': 'success',
                'document_count': len(documents),
                'error': None
            }
            
        except Exception as e:
            logger.error("  ❌ Indexing tool failed: %s", e)
            return {
                'status': 'failed',
                'error': str(e),
                'document_count': 0
            }
    
    def test_vector_store(self) -> Dict[str, Any]:
        """Test vector store operations (if Pinecone is configured)."""
        logger.info("🧪 Testing vector store...")
        
        # Check if Pinecone is configured
        if not os.getenv('PINECONE_API_KEY'):
            logger.warning("  ⚠️  PINECONE_API_KEY not set, skipping vector store test")
            return {
                'status': 'skipped',
                'reason': 'PINECONE_API_KEY not configured',
                'error': None
            }
        
        try:
            # Create vector store
            vector_store = PineconeVectorStore("test-repo-123")
            
            # Test with a few documents
            test_docs = self.test_documents[:5] if self.test_documents else []
            
            if not test_docs:
                return {
                    'status': 'failed',
                    'error': 'No test documents available',
                    'vectors_stored': 0
                }
            
            # Add documents to vector store
            result = vector_store.add_documents(test_docs)
            
            if result.get('success'):
                logger.info("  ✅ Vector store test successful: %d vectors stored", result['count'])
                return {
                    'status': 'success',
                    'vectors_stored': result['count'],
                    'index_name': result['index_name'],
                    'namespace': result['namespace'],
                    'error': None
                }
            else:
                return {
                    'status': 'failed',
                    'error': result.get('error', 'Unknown error'),
                    'vectors_stored': 0
                }
                
        except Exception as e:
            logger.error("  ❌ Vector store test failed: %s", e)
            return {
                'status': 'failed',
                'error': str(e),
                'vectors_stored': 0
            }
    
    def test_load_balancing(self) -> Dict[str, Any]:
        """Test load balancing across indexes."""
        logger.info("🧪 Testing load balancing...")
        
        if not os.getenv('PINECONE_API_KEY'):
            logger.warning("  ⚠️  PINECONE_API_KEY not set, skipping load balancing test")
            return {
                'status': 'skipped',
                'reason': 'PINECONE_API_KEY not configured',
                'error': None
            }
        
        try:
            # Test different repository IDs to see load balancing
            test_repo_ids = [
                "repo-abc123",
                "repo-def456", 
                "repo-ghi789",
                "repo-jkl012"
            ]
            
            index_assignments = {}
            
            for repo_id in test_repo_ids:
                vector_store = PineconeVectorStore(repo_id)
                index_assignments[repo_id] = vector_store.index_name
                logger.info("  📊 %s → %s", repo_id, vector_store.index_name)
            
            # Check distribution
            index_counts = {}
            for index_name in index_assignments.values():
                index_counts[index_name] = index_counts.get(index_name, 0) + 1
            
            logger.info("  📈 Load distribution: %s", index_counts)
            
            return {
                'status': 'success',
                'assignments': index_assignments,
                'distribution': index_counts,
                'error': None
            }
            
        except Exception as e:
            logger.error("  ❌ Load balancing test failed: %s", e)
            return {
                'status': 'failed',
                'error': str(e),
                'assignments': {},
                'distribution': {}
            }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return comprehensive results."""
        logger.info("🚀 Starting comprehensive system tests...")
        
        # Setup
        self.setup_test_repository()
        
        # Run tests
        test_results = {
            'chunking_methods': self.test_chunking_methods(),
            'codebase_processing': self.test_codebase_processing(),
            'indexing_tool': self.test_indexing_tool(),
            'vector_store': self.test_vector_store(),
            'load_balancing': self.test_load_balancing()
        }
        
        # Calculate overall status
        failed_tests = [name for name, result in test_results.items() 
                       if result.get('status') == 'failed']
        skipped_tests = [name for name, result in test_results.items() 
                        if result.get('status') == 'skipped']
        
        overall_status = 'success' if not failed_tests else 'failed'
        
        # Summary
        logger.info("🎉 Test suite completed!")
        logger.info("📊 Results summary:")
        logger.info("  ✅ Overall status: %s", overall_status.upper())
        logger.info("  ❌ Failed tests: %s", failed_tests if failed_tests else "None")
        logger.info("  ⏭️  Skipped tests: %s", skipped_tests if skipped_tests else "None")
        
        return {
            'overall_status': overall_status,
            'failed_tests': failed_tests,
            'skipped_tests': skipped_tests,
            'test_results': test_results,
            'test_repo_path': self.test_repo_path
        }
    
    def cleanup(self):
        """Clean up test resources."""
        if self.test_repo_path and os.path.exists(self.test_repo_path):
            shutil.rmtree(self.test_repo_path)
            logger.info("🧹 Cleaned up test repository: %s", self.test_repo_path)

def main():
    """Main test runner."""
    print("🧪 GitHubify System Test Suite")
    print("=" * 50)
    
    tester = TestSystem()
    
    try:
        results = tester.run_all_tests()
        
        # Print detailed results
        print("\n📊 Detailed Results:")
        print("-" * 30)
        
        for test_name, result in results['test_results'].items():
            status = result.get('status', 'unknown')
            status_emoji = "✅" if status == 'success' else "❌" if status == 'failed' else "⏭️"
            print(f"{status_emoji} {test_name}: {status.upper()}")
            
            if result.get('error'):
                print(f"   Error: {result['error']}")
            elif status == 'success':
                if 'chunks' in result:
                    print(f"   Chunks: {result['chunks']}")
                if 'document_count' in result:
                    print(f"   Documents: {result['document_count']}")
                if 'vectors_stored' in result:
                    print(f"   Vectors: {result['vectors_stored']}")
        
        print(f"\n🎯 Overall Status: {results['overall_status'].upper()}")
        
        # Save results to file
        results_file = "./test/test_results1.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"📄 Results saved to: {results_file}")
        
        return 0 if results['overall_status'] == 'success' else 1
        
    except Exception as e:
        logger.error("💥 Test suite failed with exception: %s", e)
        return 1
        
    finally:
        tester.cleanup()

if __name__ == "__main__":
    exit(main())
