"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Github,
  Menu,
  X,
  TreePine,
  Grid3X3,
  Search,
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  History,
  Plus,
  MessageCircle,
  Sparkles,
  Code,
  Layers,
  Zap,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { cn, formatDateConsistent } from "@/lib/utils";
import { LocalStorageService } from "@/services/localStorageService";
import { treeService, FileNode } from "@/services/treeService";
import DiagramViewer from "@/components/diagrams/DiagramViewer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface RepoHistory {
  id: string;
  name: string;
  url: string;
  lastAccessed: Date;
}

function VisualizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"tree" | "architecture">("tree");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src", "src/components"])
  );
  const [currentRepo, setCurrentRepo] = useState("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  // Mock repo history - in real app, this would come from localStorage or API
  const [repoHistory, setRepoHistory] = useState<RepoHistory[]>([
    {
      id: "1",
      name: "github.com/owner/project",
      url: "https://github.com/owner/project",
      lastAccessed: new Date(Date.now() - 1000 * 60 * 30),
    },
    {
      id: "2",
      name: "github.com/owner/another-repo",
      url: "https://github.com/owner/another-repo",
      lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
    {
      id: "3",
      name: "github.com/owner/third-repo",
      url: "https://github.com/owner/third-repo",
      lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 4),
    },
  ]);

  // Fetch file tree data
  const fetchFileTree = async (repoUrl: string) => {
    if (!repoUrl) return;
    
    setIsLoadingTree(true);
    setTreeError(null);
    
    try {
      const treeData = await treeService.getFileTree(repoUrl);
      setFileTree(treeData);
    } catch (error) {
      console.error('Error fetching file tree:', error);
      setTreeError(error instanceof Error ? error.message : 'Failed to load file tree');
    } finally {
      setIsLoadingTree(false);
    }
  };

  // Load file content
  const loadFileContent = async (file: FileNode) => {
    if (file.type === "folder") return;
    
    setIsLoadingFileContent(true);
    
    try {
      const content = await treeService.getFileContent(file.id);
      setSelectedFile({ ...file, content });
    } catch (error) {
      console.error('Error loading file content:', error);
      setSelectedFile({ ...file, content: `Error loading file content: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsLoadingFileContent(false);
    }
  };

  // Simple syntax highlighting function
  const highlightCode = (code: string, language: string): string => {
    // Check if this is placeholder content - don't highlight it
    if (code.includes('File content preview not available yet') || 
        code.includes('This would be fetched from the backend API')) {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    // Basic syntax highlighting for common languages
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (language === 'js' || language === 'jsx' || language === 'ts' || language === 'tsx') {
      highlighted = highlighted
        .replace(/\b(const|let|var|function|if|else|for|while|return|import|export|from|class|interface|type|enum)\b/g, '<span style="color: #569cd6;">$1</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span style="color: #569cd6;">$1</span>')
        .replace(/"([^"]*)"/g, '<span style="color: #ce9178;">"$1"</span>')
        .replace(/'([^']*)'/g, '<span style="color: #ce9178;">\'$1\'</span>')
        .replace(/\/\/.*$/gm, '<span style="color: #6a9955;">$&</span>')
        .replace(/\/\*[\s\S]*?\*\//g, '<span style="color: #6a9955;">$&</span>');
    } else if (language === 'py') {
      highlighted = highlighted
        .replace(/\b(def|class|if|else|elif|for|while|import|from|return|try|except|finally|with|as|in|and|or|not|True|False|None)\b/g, '<span style="color: #569cd6;">$1</span>')
        .replace(/"([^"]*)"/g, '<span style="color: #ce9178;">"$1"</span>')
        .replace(/'([^']*)'/g, '<span style="color: #ce9178;">\'$1\'</span>')
        .replace(/#.*$/gm, '<span style="color: #6a9955;">$&</span>');
    } else if (language === 'css') {
      highlighted = highlighted
        .replace(/([.#]?[a-zA-Z-]+)\s*\{/g, '<span style="color: #d7ba7d;">$1</span> {')
        .replace(/([a-zA-Z-]+)\s*:/g, '<span style="color: #9cdcfe;">$1</span>:')
        .replace(/(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\))/g, '<span style="color: #b5cea8;">$1</span>');
    } else if (language === 'json') {
      highlighted = highlighted
        .replace(/"([^"]*)"\s*:/g, '<span style="color: #9cdcfe;">"$1"</span>:')
        .replace(/"([^"]*)"/g, '<span style="color: #ce9178;">"$1"</span>')
        .replace(/\b(true|false|null)\b/g, '<span style="color: #569cd6;">$1</span>');
    }

    return highlighted;
  };

  useEffect(() => {
    // First try to get from localStorage
    const storedRepoData = LocalStorageService.getRepositoryData();
    if (storedRepoData) {
      setCurrentRepo(storedRepoData.github_url);
      fetchFileTree(storedRepoData.github_url);
    } else {
      // Fallback to URL params
      const repo = searchParams.get("repo");
      if (repo) {
        const decodedRepo = decodeURIComponent(repo);
        setCurrentRepo(decodedRepo);
        fetchFileTree(decodedRepo);
      }
    }
  }, [searchParams]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle sidebar with Ctrl/Cmd + B
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      // Close sidebar with Escape
      if (event.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes
      .filter(
        node =>
          debouncedSearchQuery === "" ||
          node.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      )
      .map(node => (
        <div key={node.id}>
            <div
              className={cn(
                "flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 group",
                selectedFile?.id === node.id 
                  ? "bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 shadow-lg" 
                  : "hover:bg-gray-700/50 border border-transparent hover:border-gray-600"
              )}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => {
                if (node.type === "file") {
                  loadFileContent(node);
                } else {
                  toggleFolder(node.id);
                }
              }}
            >
            {node.type === "folder" &&
              (expandedFolders.has(node.id) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              ))}
            {node.type === "folder" ? (
              <Folder className="h-4 w-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
            ) : (
              <File className="h-4 w-4 text-gray-400 group-hover:text-gray-300 transition-colors" />
            )}
            <span className="text-sm group-hover:text-white transition-colors">
              {node.name}
              {node.ext && <span className="text-xs text-gray-500 ml-1">.{node.ext}</span>}
            </span>
            {node.size && (
              <span className="text-xs text-gray-500 ml-auto group-hover:text-gray-400 transition-colors">{node.size}</span>
            )}
          </div>
          {node.type === "folder" &&
            expandedFolders.has(node.id) &&
            node.children &&
            renderFileTree(node.children, level + 1)}
        </div>
      ));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex relative">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "bg-gray-800 border-r border-gray-700 transition-all duration-500 ease-in-out flex flex-col z-50",
          sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden",
          "lg:relative lg:z-auto fixed lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                  <Github className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Codebase AI
                </span>
              </div>
              <div className="text-sm text-gray-400 mb-2">Repository</div>
              <div className="text-sm font-mono bg-gray-700 px-3 py-2 rounded-lg border border-gray-600 truncate max-w-full" title={currentRepo || "github.com/owner/project"}>
                <span className="block truncate">
                  {currentRepo || "github.com/owner/project"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
              <button
                onClick={() => router.push("/chat")}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-lg flex items-center gap-3 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="font-semibold">Analyze Codebase</span>
                <Sparkles className="h-4 w-4 ml-auto" />
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setActiveTab("tree");
                      setIsTransitioning(false);
                    }, 150);
                  }}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105",
                    activeTab === "tree"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  )}
                >
                  <TreePine className="h-4 w-4" />
                  Tree
                </button>
                <button
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setActiveTab("architecture");
                      setIsTransitioning(false);
                    }, 150);
                  }}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105",
                    activeTab === "architecture"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Diagram
                </button>
              </div>
            </div>

            {/* Repo History */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-400">
                    History ({repoHistory.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {repoHistory.map(repo => (
                    <button
                      key={repo.id}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition-all duration-200 group border border-transparent hover:border-gray-600"
                    >
                      <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                        {repo.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDateConsistent(repo.lastAccessed)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col transition-all duration-500 ease-in-out relative">
        {/* Sidebar Collapsed Indicator */}
        {!sidebarOpen && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 z-30 animate-pulse">
            <div className="bg-gray-800 border border-gray-700 rounded-r-lg p-2 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all duration-200 transform hover:scale-110 group"
                title="Show sidebar (Ctrl+B)"
              >
                <Menu className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        )}
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all duration-200 transform hover:scale-105 group"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
          </button>

          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all duration-200 transform hover:scale-105 group"
            title={sidebarOpen ? "Hide sidebar (Ctrl+B)" : "Show sidebar (Ctrl+B)"}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
            ) : (
              <Menu className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-1.5 rounded-lg">
              <Github className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Codebase AI
            </span>
          </div>

          <div className="flex items-center gap-4 ml-8">
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("tree");
                  setIsTransitioning(false);
                }, 150);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 transform hover:scale-105",
                activeTab === "tree"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              )}
            >
              <TreePine className="h-4 w-4" />
              Visualize
            </button>
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("architecture");
                  setIsTransitioning(false);
                }, 150);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 transform hover:scale-105",
                activeTab === "architecture"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              )}
            >
              <Grid3X3 className="h-4 w-4" />
              Architecture
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400 max-w-xs truncate hidden sm:block" title={currentRepo || "github.com/owner/project"}>
              repo: {currentRepo || "github.com/owner/project"}
            </div>
            <div className="text-xs text-gray-500 sm:hidden" title={currentRepo || "github.com/owner/project"}>
              {currentRepo ? currentRepo.split('/').pop() : "project"}
            </div>
            <select className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option>main</option>
            </select>
            <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm transition-colors">
              Filters
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex relative">
          {/* Transition Overlay */}
          {isTransitioning && (
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-gray-800 p-6 rounded-lg shadow-2xl flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-white font-medium">Switching view...</span>
              </div>
            </div>
          )}
          
          {activeTab === "tree" ? (
            <>
              {/* File Tree */}
              <div className="w-1/2 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search files, folders..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => currentRepo && fetchFileTree(currentRepo)}
                      disabled={isLoadingTree}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                      title="Refresh file tree"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingTree ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {isLoadingTree ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent mx-auto mb-2"></div>
                        <p className="text-sm text-gray-400">Loading file tree...</p>
                      </div>
                    </div>
                  ) : treeError ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="text-red-400 mb-2">⚠️</div>
                        <p className="text-sm text-red-400 mb-2">Failed to load file tree</p>
                        <p className="text-xs text-gray-500">{treeError}</p>
                        <button
                          onClick={() => currentRepo && fetchFileTree(currentRepo)}
                          className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : fileTree.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">📁</div>
                        <p className="text-sm text-gray-400">No files found</p>
                      </div>
                    </div>
                  ) : (
                    renderFileTree(fileTree)
                  )}
                </div>
              </div>

              <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
                <div className="px-4 py-3 border-b border-gray-700 bg-[#2d2d30]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Code className="h-4 w-4 text-blue-400" />
                      <h3 className="font-medium text-gray-200">
                        {selectedFile ? selectedFile.name : "No file selected"}
                      </h3>
                      {selectedFile && selectedFile.ext && (
                        <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded">
                          {selectedFile.ext}
                        </span>
                      )}
                    </div>
                    {selectedFile && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 mr-2">Read-only</span>
                        <button 
                          onClick={() => {
                            if (selectedFile.content) {
                              navigator.clipboard.writeText(selectedFile.content);
                            }
                          }}
                          className="bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 px-3 py-1 rounded text-xs transition-colors flex items-center gap-1"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden flex">
                  {selectedFile ? (
                    <>
                      {isLoadingFileContent ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                            <p className="text-sm text-gray-400">Loading file content...</p>
                          </div>
                        </div>
                      ) : selectedFile.content ? (
                        <>
                          {/* Line Numbers */}
                          <div className="bg-[#1e1e1e] border-r border-gray-800 px-4 py-4 text-right select-none overflow-y-auto">
                            {selectedFile.content.split('\n').map((_, i) => (
                              <div key={i} className="text-xs text-gray-600 leading-6 font-mono">
                                {i + 1}
                              </div>
                            ))}
                          </div>
                          {/* Code Content */}
                          <div className="flex-1 overflow-auto">
                            <pre className="p-4 text-sm leading-6 font-mono">
                              <code className="text-gray-300" dangerouslySetInnerHTML={{ 
                                __html: highlightCode(selectedFile.content, selectedFile.ext || '') 
                              }} />
                            </pre>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                          <div className="text-center p-8">
                            <File className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                            <h3 className="text-lg font-semibold mb-2 text-gray-300">{selectedFile.name}</h3>
                            <p className="text-sm mb-4">
                              {selectedFile.type === "folder" 
                                ? "This is a folder containing files and subfolders"
                                : `File type: ${selectedFile.ext || 'unknown'}`}
                            </p>
                            <button
                              onClick={() => loadFileContent(selectedFile)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                            >
                              Load File Content
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                      <div className="text-center p-8">
                        <div className="bg-[#2d2d30] p-8 rounded-lg border border-gray-700">
                          <File className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                          <h3 className="text-lg font-semibold mb-2 text-gray-300">No file selected</h3>
                          <p className="text-sm">Select a file from the tree to view its contents</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Architecture Diagram */
            <div className="flex-1 relative">
      <DiagramViewer />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VisualizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading visualization...</p>
          </div>
        </div>
      }
    >
      <VisualizeContent />
    </Suspense>
  );
}