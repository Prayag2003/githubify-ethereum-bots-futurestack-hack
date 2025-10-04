import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
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
  X
} from 'lucide-react';

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
  if (lowerLabel.includes('api') || lowerLabel.includes('backend')) return 'api';
  if (lowerLabel.includes('frontend') || lowerLabel.includes('ui')) return 'frontend';
  if (lowerLabel.includes('database') || lowerLabel.includes('db')) return 'database';
  if (lowerLabel.includes('service') || lowerLabel.includes('engine')) return 'service';
  if (lowerLabel.includes('.js') || lowerLabel.includes('.py') || lowerLabel.includes('.html')) return 'file';
  if (lowerLabel.includes('package')) return 'package';
  if (lowerLabel.includes('main') || lowerLabel.includes('project')) return 'main';
  return 'default';
};

const getCategoryColor = (category: string, isDark: boolean): CategoryColor => {
  const colors: Record<string, CategoryColor> = {
    main: { 
      bg: isDark ? '#7c3aed' : '#a78bfa', 
      border: isDark ? '#a78bfa' : '#7c3aed',
      text: '#ffffff'
    },
    api: { 
      bg: isDark ? '#2563eb' : '#60a5fa', 
      border: isDark ? '#60a5fa' : '#2563eb',
      text: '#ffffff'
    },
    frontend: { 
      bg: isDark ? '#dc2626' : '#f87171', 
      border: isDark ? '#f87171' : '#dc2626',
      text: '#ffffff'
    },
    database: { 
      bg: isDark ? '#16a34a' : '#4ade80', 
      border: isDark ? '#4ade80' : '#16a34a',
      text: '#ffffff'
    },
    service: { 
      bg: isDark ? '#ea580c' : '#fb923c', 
      border: isDark ? '#fb923c' : '#ea580c',
      text: '#ffffff'
    },
    file: { 
      bg: isDark ? '#64748b' : '#cbd5e1', 
      border: isDark ? '#cbd5e1' : '#64748b',
      text: isDark ? '#ffffff' : '#1e293b'
    },
    package: { 
      bg: isDark ? '#0891b2' : '#22d3ee', 
      border: isDark ? '#22d3ee' : '#0891b2',
      text: '#ffffff'
    },
    default: { 
      bg: isDark ? '#475569' : '#e2e8f0', 
      border: isDark ? '#94a3b8' : '#64748b',
      text: isDark ? '#ffffff' : '#1e293b'
    },
  };
  return colors[category] || colors.default;
};

const parseMermaidToFlow = (mermaidContent: string): ParsedData => {
  const lines = mermaidContent.split('\n').filter(line => line.trim());
  const nodes = new Map<string, Node<NodeData>>();
  const edges: Edge[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('graph')) return;

    const nodeMatch = trimmed.match(/(\w+)\[([^\]]+)\]/g);
    if (nodeMatch) {
      nodeMatch.forEach(match => {
        const matchResult = match.match(/(\w+)\[([^\]]+)\]/);
        if (matchResult) {
          const [, id, label] = matchResult;
          if (!nodes.has(id)) {
            nodes.set(id, {
              id,
              data: { label: label.trim(), category: getNodeCategory(label.trim()) },
              position: { x: 0, y: 0 },
              type: 'default',
            });
          }
        }
      });
    }

    const arrowMatch = trimmed.match(/(\w+)\s*(-->|-.->(?:\|[^|]+\|->)?)\s*(\w+)/);
    if (arrowMatch) {
      const [, source, arrow, target] = arrowMatch;
      const isDashed = arrow.includes('-.-');
      
      let label = '';
      const labelMatch = arrow.match(/\|([^|]+)\|/);
      if (labelMatch) {
        label = labelMatch[1];
      }

      edges.push({
        id: `${source}-${target}-${edges.length}`,
        source,
        target,
        type: 'smoothstep',
        animated: isDashed,
        style: { 
          stroke: isDashed ? '#94a3b8' : '#64748b',
          strokeWidth: 2,
          strokeDasharray: isDashed ? '5,5' : '0',
        },
        label: label || undefined,
        labelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDashed ? '#94a3b8' : '#64748b',
        },
      });
    }
  });

  return { 
    nodes: Array.from(nodes.values()), 
    edges
  };
};

const getLayoutedElements = (nodes: Node<NodeData>[], edges: Edge[], direction = 'TB', isDark = false) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 150,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const category = node.data.category || 'default';
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
        borderRadius: '8px',
        padding: '12px',
        fontSize: '13px',
        fontWeight: '600',
        color: colors.text,
        width: 200,
        boxShadow: isDark 
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Twinkling Stars Component
const TwinklingStars: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [stars, setStars] = useState<Array<{ x: number; y: number; size: number; delay: number }>>([]);

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
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layout, setLayout] = useState<string>('TB');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const demoContent = `graph TD
    A[Project GITHUBIFY] --> B[Main Modules]
    B --> C[Advance Chat Engine]
    B --> D[Backend]
    B --> E[Frontend]
    B --> F[Langchain]
    B --> G[Videocall-webRTC]
    C --> CA[Advance Chat Engine Backend]
    C --> CB[Advance Chat Engine Frontend]
    CA --> CAA[package.json]
    CA --> CAB[index.js]
    CB --> CBA[package.json]
    CB --> CBC[index.html]
    CB --> CBD[src]
    D --> DA[main.py]
    D --> DB[requirements.txt]
    E --> EA[package.json]
    E --> EB[index.html]
    EA -.->|uses|-> OpenAI_API
    DA -.->|uses|-> Langchain_API
    CA -.->|communicates with|-> CB
    D -.->|provides data to|-> E`;

    const { nodes: parsedNodes, edges: parsedEdges } = parseMermaidToFlow(demoContent);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      parsedNodes,
      parsedEdges,
      layout,
      isDark
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 50);
  }, []);

  useEffect(() => {
    if (nodes.length > 0) {
      const { nodes: relayoutedNodes } = getLayoutedElements(
        nodes,
        edges,
        layout,
        isDark
      );
      setNodes(relayoutedNodes);
    }
  }, [isDark, layout]);

  const handleLayoutChange = (newLayout: string) => {
    setLayout(newLayout);
  };

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<NodeData>) => {
    const x = node.position.x + 100;
    const y = node.position.y + 25;
    setCenter(x, y, { zoom: 1.5, duration: 400 });
  }, [setCenter]);

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    return nodes.filter(node => 
      node.data.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term && filteredNodes.length > 0) {
      const firstNode = filteredNodes[0];
      const x = firstNode.position.x + 100;
      const y = firstNode.position.y + 25;
      setCenter(x, y, { zoom: 1.5, duration: 400 });
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fitView({ padding: 0.2, duration: 400 });
  };

  const handleReset = () => {
    setSearchTerm('');
    fitView({ padding: 0.2, duration: 400 });
  };

  return (
    <div className={`w-full h-screen relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <TwinklingStars isDark={isDark} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background 
          color={isDark ? '#374151' : '#e2e8f0'} 
          gap={16} 
          size={1}
          style={{ backgroundColor: isDark ? '#1f2937' : '#f8fafc' }}
        />
        <Controls className={isDark ? 'bg-gray-800 border-gray-700' : ''} />
        <MiniMap 
          nodeColor={isDark ? '#4b5563' : '#3b82f6'}
          maskColor={isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)'}
          style={{ 
            background: isDark ? '#1f2937' : '#f8fafc',
            border: isDark ? '1px solid #374151' : '1px solid #e2e8f0'
          }}
        />
        
        <Panel position="top-right" className="flex flex-col gap-2">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg p-2 flex gap-2 border`}>
            <button
              onClick={() => handleLayoutChange('TB')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                layout === 'TB' 
                  ? 'bg-blue-500 text-white' 
                  : `${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
              }`}
            >
              ↓ Vertical
            </button>
            <button
              onClick={() => handleLayoutChange('LR')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                layout === 'LR' 
                  ? 'bg-blue-500 text-white' 
                  : `${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
              }`}
            >
              → Horizontal
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                isDark ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg p-2 flex gap-2 border`}>
            <button
              onClick={handleReset}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomIn({ duration: 200 })}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomOut({ duration: 200 })}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </Panel>

        <Panel position="top-left" className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg p-3 max-w-xs border`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                Architecture Diagram
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Interactive view
              </p>
            </div>
          </div>
          
          <div className="relative mb-2">
            <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className={`w-full pl-8 pr-8 py-1.5 rounded text-xs ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} flex items-center gap-1.5`}>
            <Focus className="w-3 h-3" />
            Click • Drag • Zoom
          </div>
        </Panel>

        <Panel position="bottom-right" className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-lg px-3 py-1.5 border`}>
          <div className="flex items-center gap-2">
            <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {nodes.length} nodes • {edges.length} edges
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