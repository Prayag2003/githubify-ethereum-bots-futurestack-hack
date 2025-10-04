import React, { useState, useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  Node,
  Edge,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import {
  Search,
  Layers,
  Sun,
  Moon,
  RefreshCw,
  Minus,
  Plus,
  GitBranch,
  Focus,
  X,
  ArrowLeft,
  Filter,
  Minimize2,
} from "lucide-react";
import { createRepositoryService } from "@/services/repositoryService";
import { LocalStorageService } from "@/services/localStorageService";
import { useRouter, useSearchParams } from "next/navigation";

interface NodeData {
  label: string;
  category: string;
}

interface ParsedData {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

interface CategoryColor {
  bg: string;
  border: string;
  text: string;
}

const getNodeCategory = (label: string): string => {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("api") || lowerLabel.includes("backend"))
    return "api";
  if (lowerLabel.includes("frontend") || lowerLabel.includes("ui"))
    return "frontend";
  if (lowerLabel.includes("database") || lowerLabel.includes("db"))
    return "database";
  if (lowerLabel.includes("service") || lowerLabel.includes("engine"))
    return "service";
  if (
    lowerLabel.includes(".js") ||
    lowerLabel.includes(".py") ||
    lowerLabel.includes(".html")
  )
    return "file";
  if (lowerLabel.includes("package")) return "package";
  if (lowerLabel.includes("main") || lowerLabel.includes("project"))
    return "main";
  return "default";
};

const getCategoryColor = (category: string, isDark: boolean): CategoryColor => {
  const colors: Record<string, CategoryColor> = {
    main: {
      bg: isDark ? "#7c3aed" : "#a78bfa",
      border: isDark ? "#a78bfa" : "#7c3aed",
      text: "#ffffff",
    },
    api: {
      bg: isDark ? "#2563eb" : "#60a5fa",
      border: isDark ? "#60a5fa" : "#2563eb",
      text: "#ffffff",
    },
    frontend: {
      bg: isDark ? "#dc2626" : "#f87171",
      border: isDark ? "#f87171" : "#dc2626",
      text: "#ffffff",
    },
    database: {
      bg: isDark ? "#16a34a" : "#4ade80",
      border: isDark ? "#4ade80" : "#16a34a",
      text: "#ffffff",
    },
    service: {
      bg: isDark ? "#ea580c" : "#fb923c",
      border: isDark ? "#fb923c" : "#ea580c",
      text: "#ffffff",
    },
    file: {
      bg: isDark ? "#64748b" : "#cbd5e1",
      border: isDark ? "#cbd5e1" : "#64748b",
      text: isDark ? "#ffffff" : "#1e293b",
    },
    package: {
      bg: isDark ? "#0891b2" : "#22d3ee",
      border: isDark ? "#22d3ee" : "#0891b2",
      text: "#ffffff",
    },
    default: {
      bg: isDark ? "#475569" : "#e2e8f0",
      border: isDark ? "#94a3b8" : "#64748b",
      text: isDark ? "#ffffff" : "#1e293b",
    },
  };
  return colors[category] || colors.default;
};

const parseMermaidToFlow = (mermaidContent: string): ParsedData => {
  const lines = mermaidContent.split("\n").filter(line => line.trim());
  const nodes = new Map<string, Node<NodeData>>();
  const edges: Edge[] = [];


  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith("graph")) return;

    // Improved node parsing - handle various node formats
    const nodeMatches = trimmed.match(/([A-Za-z0-9_]+)\[([^\]]+)\]/g);
    if (nodeMatches) {
      nodeMatches.forEach(match => {
        const matchResult = match.match(/([A-Za-z0-9_]+)\[([^\]]+)\]/);
        if (matchResult) {
          const [, id, label] = matchResult;
          if (!nodes.has(id)) {
            nodes.set(id, {
              id,
              data: {
                label: label.trim(),
                category: getNodeCategory(label.trim()),
              },
              position: { x: 0, y: 0 },
              type: "default",
            });
          }
        }
      });
    }

    // Improved edge parsing - handle complex arrow syntax
    // Match patterns like: A -->|contains|> B, A -.->|uses|> B, etc.
    const edgeMatches = trimmed.match(/([A-Za-z0-9_]+)\s*(-->|-.->)(?:\|([^|]+)\|>)?\s*([A-Za-z0-9_]+)/g);
    if (edgeMatches) {
      edgeMatches.forEach(match => {
        const edgeResult = match.match(/([A-Za-z0-9_]+)\s*(-->|-.->)(?:\|([^|]+)\|>)?\s*([A-Za-z0-9_]+)/);
        if (edgeResult) {
          const [, source, arrow, label, target] = edgeResult;
          const isDashed = arrow.includes("-.-");

          // Only create edge if both source and target nodes exist
          if (nodes.has(source) && nodes.has(target)) {
            edges.push({
              id: `${source}-${target}-${edges.length}`,
              source,
              target,
              type: "smoothstep",
              animated: isDashed,
              style: {
                stroke: isDashed ? "#94a3b8" : "#64748b",
                strokeWidth: 2,
                strokeDasharray: isDashed ? "5,5" : "0",
              },
              label: label ? label.trim() : undefined,
              labelStyle: { fill: "#64748b", fontSize: 11, fontWeight: 500 },
              labelBgStyle: { fill: "#ffffff", fillOpacity: 0.8 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: isDashed ? "#94a3b8" : "#64748b",
              },
            });
          }
        }
      });
    }
  });


  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
};

const getLayoutedElements = (
  nodes: Node<NodeData>[],
  edges: Edge[],
  direction = "TB",
  isDark = false,
  isCompact = false
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isCompact ? 50 : 100,
    ranksep: isCompact ? 80 : 150,
    marginx: isCompact ? 20 : 50,
    marginy: isCompact ? 20 : 50,
  });

  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: 200, height: 50 });
  });

  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const category = node.data.category || "default";
    const colors = getCategoryColor(category, isDark);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 25,
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "12px",
        fontSize: "13px",
        fontWeight: "600",
        color: colors.text,
        width: 200,
        boxShadow: isDark
          ? "0 4px 6px -1px rgba(0, 0, 0, 0.5)"
          : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const TwinklingStars: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [stars, setStars] = useState<
    { x: number; y: number; size: number; delay: number }[]
  >([]);

  useEffect(() => {
    const generateStars = () => {
      const newStars = [];
      for (let i = 0; i < 50; i++) {
        newStars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 2 + 1,
          delay: Math.random() * 3,
        });
      }
      setStars(newStars);
    };
    generateStars();
  }, []);

  if (!isDark) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${2 + star.delay}s`,
            animationDelay: `${star.delay}s`,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
};

const DiagramViewerInner: React.FC = () => {
  const [allNodes, setAllNodes] = useState<Node<NodeData>[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layout, setLayout] = useState<string>("TB");
  const [isDark, setIsDark] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [showSimplified, setShowSimplified] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const { setCenter, zoomIn, zoomOut } = useReactFlow();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRepo = searchParams.get("repo");

  const categories = useMemo(() => {
    const cats = new Set(allNodes.map(node => node.data.category));
    return ['all', ...Array.from(cats)];
  }, [allNodes]);

  const filteredData = useMemo(() => {
    let filteredNodes = allNodes;
    let filteredEdges = allEdges;

    // Apply simplified view
    if (showSimplified) {
      filteredNodes = allNodes.filter(node =>
        ['main', 'api', 'service', 'database'].includes(node.data.category)
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = allEdges.filter(
        edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }

    // Apply category filter
    if (!selectedCategories.includes('all')) {
      filteredNodes = filteredNodes.filter(node =>
        selectedCategories.includes(node.data.category)
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(
        edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }

    // Apply search filter
    if (searchTerm) {
      filteredNodes = filteredNodes.filter(node =>
        node.data.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(
        edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [allNodes, allEdges, showSimplified, selectedCategories, searchTerm]);

  useEffect(() => {
    const loadDiagram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const storedRepoData = LocalStorageService.getRepositoryData();
        const repoId = storedRepoData?.github_url || currentRepo;

        if (!repoId) {
          setError("No repository ID found. Please go back and select a repository.");
          setIsLoading(false);
          return;
        }

        const repositoryService = createRepositoryService();
        const result = await repositoryService.generateDiagram(repoId);

        if (result.success && result.data.diagram) {
          const { nodes: parsedNodes, edges: parsedEdges } =
            parseMermaidToFlow(result.data.diagram);

          setAllNodes(parsedNodes);
          setAllEdges(parsedEdges);

          const { nodes: layoutedNodes, edges: layoutedEdges } =
            getLayoutedElements(parsedNodes, parsedEdges, layout, isDark, isCompact);

          setNodes(layoutedNodes);
          setEdges(layoutedEdges);

          setTimeout(() => {
            fitView({ padding: 0.2 });
          }, 50);
        } else {
          setError(result.error || "Failed to generate diagram");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    loadDiagram();
  }, []);

  useEffect(() => {
    if (filteredData.nodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        filteredData.nodes,
        filteredData.edges,
        layout,
        isDark,
        isCompact
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      // setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    }
  }, [filteredData, isDark, layout, isCompact]);

  const handleLayoutChange = (newLayout: string) => {
    setLayout(newLayout);
  };

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      const x = node.position.x + 100;
      const y = node.position.y + 25;
      setCenter(x, y, { zoom: 1.5, duration: 400 });
    },
    [setCenter]
  );

  const handleClearSearch = () => {
    setSearchTerm("");
    fitView({ padding: 0.2, duration: 400 });
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedCategories(['all']);
    setShowSimplified(false);
    fitView({ padding: 0.2, duration: 400 });
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  const toggleCategory = (category: string) => {
    if (category === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const filtered = prev.filter(c => c !== 'all');
        if (filtered.includes(category)) {
          const newCategories = filtered.filter(c => c !== category);
          return newCategories.length === 0 ? ['all'] : newCategories;
        } else {
          return [...filtered, category];
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping"></div>
          </div>
          <p className="text-white text-lg font-semibold mb-2">
            Generating Architecture Diagram
          </p>
          <p className="text-gray-400 text-sm">
            Analyzing your codebase structure...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
            <h3 className="text-red-400 font-semibold text-lg mb-2">
              Failed to Load Diagram
            </h3>
            <p className="text-red-300/80 text-sm mb-4">{error}</p>
            <button
              onClick={handleBackToHome}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-300 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-screen relative ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <TwinklingStars isDark={isDark} />

      <button
        onClick={handleBackToHome}
        className={`absolute top-4 left-4 z-50 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${isDark
          ? "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
          : "bg-white hover:bg-gray-100 text-gray-900 border border-gray-200"
          }`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          color={isDark ? "#374151" : "#e2e8f0"}
          gap={16}
          size={1}
          style={{ backgroundColor: isDark ? "#1f2937" : "#f8fafc" }}
        />
        <Controls className={isDark ? "bg-gray-800 border-gray-700" : ""} />
        <MiniMap
          nodeColor={isDark ? "#4b5563" : "#3b82f6"}
          maskColor={isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(0, 0, 0, 0.1)"}
          style={{
            background: isDark ? "#1f2937" : "#f8fafc",
            border: isDark ? "1px solid #374151" : "1px solid #e2e8f0",
          }}
        />

        <Panel position="top-right" className="flex flex-col gap-2">
          <div
            className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-lg shadow-lg p-2 flex gap-2 border`}
          >
            <button
              onClick={() => handleLayoutChange("TB")}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${layout === "TB"
                ? "bg-blue-500 text-white"
                : `${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }`}
            >
              ↓ Vertical
            </button>
            <button
              onClick={() => handleLayoutChange("LR")}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${layout === "LR"
                ? "bg-blue-500 text-white"
                : `${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }`}
            >
              → Horizontal
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isDark
                ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div
            className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-lg shadow-lg p-2 flex gap-2 border`}
          >
            <button
              onClick={() => setIsCompact(!isCompact)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isCompact
                ? "bg-blue-500 text-white"
                : `${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }`}
              title="Compact view"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isDark
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomIn({ duration: 200 })}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isDark
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomOut({ duration: 200 })}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${isDark
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </Panel>

        <Panel
          position="top-left"
          className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-lg shadow-lg p-3 max-w-xs border`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2
                className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-800"}`}
              >
                Architecture Diagram
              </h2>
              <p
                className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Interactive view
              </p>
            </div>
          </div>

          <div className="relative mb-3">
            <Search
              className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
            />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-8 pr-8 py-1.5 rounded text-xs ${isDark
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500"
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"} transition-colors`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className={`w-3 h-3 ${isDark ? "text-gray-400" : "text-gray-600"}`} />
              <span className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Filters
              </span>
            </div>

            <button
              onClick={() => setShowSimplified(!showSimplified)}
              className={`w-full mb-2 px-2 py-1.5 rounded text-xs font-medium transition-colors ${showSimplified
                ? "bg-purple-500 text-white"
                : `${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }`}
            >
              {showSimplified ? "Show All" : "Simplified View"}
            </button>

            <div className="flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${selectedCategories.includes(cat)
                    ? "bg-blue-500 text-white"
                    : `${isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"} flex items-center gap-1.5`}
          >
            <Focus className="w-3 h-3" />
            Click • Drag • Zoom
          </div>
        </Panel>

        <Panel
          position="bottom-right"
          className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} rounded-lg shadow-lg px-3 py-1.5 border`}
        >
          <div className="flex items-center gap-2">
            <Layers
              className={`w-3.5 h-3.5 ${isDark ? "text-blue-400" : "text-blue-500"}`}
            />
            <span
              className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              {nodes.length} / {allNodes.length} nodes • {edges.length} / {allEdges.length} edges
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DiagramViewerInner />
    </ReactFlowProvider>
  );
};

export default App;