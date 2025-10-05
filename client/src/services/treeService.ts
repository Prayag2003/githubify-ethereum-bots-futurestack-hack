/**
 * Service for fetching file tree data from the backend API
 */

export interface TreeNode {
  name: string;
  type: "file" | "folder";
  ext?: string;
  children?: TreeNode[];
}

export interface TreeResponse {
  status: string;
  message: string;
  data: {
    repo_id: string;
    tree: TreeNode;
  };
}

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  size?: string;
  ext?: string;
}

class TreeService {
  private baseUrl = process.env.NEXT_PUBLIC_SERVER_URL;

  /**
   * Convert API tree structure to component-friendly format
   */
  private convertTreeToFileNodes(treeNode: TreeNode, parentPath: string = ""): FileNode[] {
    if (!treeNode.children) return [];

    return treeNode.children.map((child, index) => {
      const currentPath = parentPath ? `${parentPath}/${child.name}` : child.name;
      const id = currentPath;

      const fileNode: FileNode = {
        id,
        name: child.name,
        type: child.type,
        ext: child.ext,
        size: child.type === "file" ? "1 file" : `${child.children?.length || 0} files`,
      };

      if (child.type === "folder" && child.children) {
        fileNode.children = this.convertTreeToFileNodes(child, currentPath);
      }

      return fileNode;
    });
  }

  /**
   * Find the correct repository in the nested structure
   */
  private findRepositoryInTree(tree: TreeNode, repoId: string): TreeNode | null {
    if (!tree.children) return null;

    // Look for the repository by matching the repo_id or by name pattern
    for (const child of tree.children) {
      if (child.name === repoId || child.name.includes(repoId)) {
        return child;
      }
      // Recursively search in nested folders
      if (child.type === "folder" && child.children) {
        const found = this.findRepositoryInTree(child, repoId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Fetch file tree data for a repository
   */
  async getFileTree(githubUrl: string): Promise<FileNode[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tree/code-tree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          github_url: githubUrl
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TreeResponse = await response.json();

      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to fetch tree data');
      }

      // Extract the repo_id from the response
      const repoId = data.data.repo_id;

      // If repo_id is empty or not found, use the first available repository
      if (!repoId || repoId === '') {
        if (data.data.tree.children && data.data.tree.children.length > 0) {
          return this.convertTreeToFileNodes(data.data.tree.children[0]);
        }
        return [];
      }

      // Find the correct repository in the nested structure
      const repositoryNode = this.findRepositoryInTree(data.data.tree, repoId);

      if (!repositoryNode) {
        // If we can't find the specific repo, use the first available one
        if (data.data.tree.children && data.data.tree.children.length > 0) {
          return this.convertTreeToFileNodes(data.data.tree.children[0]);
        }
        return [];
      }

      // Convert the found repository to our component format
      return this.convertTreeToFileNodes(repositoryNode);
    } catch (error) {
      console.error('Error fetching file tree:', error);
      throw error;
    }
  }

  /**
   * Get file content (placeholder - would need separate API endpoint)
   */
  async getFileContent(filePath: string): Promise<string> {
    // This would need a separate API endpoint to fetch file content
    // For now, return a placeholder with file info
    const fileName = filePath.split('/').pop() || filePath;
    const fileExt = fileName.split('.').pop() || 'unknown';

    return `// File: ${fileName}
// Path: ${filePath}
// Type: ${fileExt}

// File content preview not available yet
// This would be fetched from the backend API

// Example content based on file type:
${this.getFileTypePlaceholder(fileExt)}`;
  }

  /**
   * Get placeholder content based on file type
   */
  private getFileTypePlaceholder(ext: string): string {
    switch (ext.toLowerCase()) {
      case 'tsx':
      case 'jsx':
        return `import React from 'react';

export default function Component() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}`;
      case 'ts':
      case 'js':
        return `// TypeScript/JavaScript file
export function example() {
  console.log('Hello World');
}`;
      case 'py':
        return `# Python file
def example():
    print("Hello World")

if __name__ == "__main__":
    example()`;
      case 'css':
        return `/* CSS file */
.example {
  color: blue;
  font-size: 16px;
}`;
      case 'json':
        return `{
  "name": "example",
  "version": "1.0.0"
}`;
      case 'md':
        return `# Markdown File

This is a markdown file.

## Features
- Feature 1
- Feature 2`;
      default:
        return `// ${ext.toUpperCase()} file
// Content preview not available`;
    }
  }
}

export const treeService = new TreeService();
