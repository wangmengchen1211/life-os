'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, GitBranch, Plus, Minus, Maximize2, X } from 'lucide-react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { getGraphData, type GraphNode, type GraphEdge } from '@/lib/storage/knowledge-store';
import { safeText } from '@/lib/utils/safe-text';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeGraphProps {
  onSelectNode?: (itemId: number) => void;
  onBack?: () => void;
}

interface SimNode extends SimulationNodeDatum {
  id: number;
  title: string;
  type: string;
  primaryCategory?: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  relationType: string;
  aiReason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_RADIUS = 20;
const FOCUS_NODE_RADIUS = 28;
const MAX_NODES = 50;
const MAX_TICKS = 300;
const ZOOM_EXTENT: [number, number] = [0.3, 3];

const RELATION_STYLES: Record<string, { color: string; dash: string; label: string }> = {
  deepen:     { color: '#c8d8e4', dash: 'none',    label: '深化' },
  apply:      { color: '#d4a574', dash: '6,3',     label: '应用' },
  supplement: { color: '#a8c5a0', dash: '3,3',     label: '补充' },
  oppose:     { color: '#b8a0c8', dash: '8,4,2,4', label: '对立' },
  source:     { color: '#9ab0c0', dash: '2,4',     label: '来源' },
};


const CATEGORY_COLORS: Record<string, string> = {
  '认知与思维': '#7ecfc0',
  '学习与教育': '#66bb6a',
  '科学与技术': '#42a5f5',
  '人文与社科': '#ab47bc',
  '商业与职业': '#ffa726',
  '创意与表达': '#ef5350',
  '生活与健康': '#26c6da',
  '关系与沟通': '#ec407a',
  '财富与资源': '#ffca28',
  '兴趣与爱好': '#8d6e63',
  '社会与人文': '#78909c',
  '信念与内在': '#5c6bc0',
};
const DEFAULT_NODE_COLOR = '#999999';

// Filter toggle definitions
const FILTER_TOGGLES: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'deepen', label: '深化', defaultOn: true },
  { key: 'apply', label: '应用', defaultOn: true },
  { key: 'supplement', label: '补充', defaultOn: true },
  { key: 'oppose', label: '对立', defaultOn: true },
  { key: 'source', label: '来源', defaultOn: true },
];

function getEdgeStyle(relationType: string) {
  return RELATION_STYLES[relationType] || RELATION_STYLES['supplement'];
}

function getNodeColor(primaryCategory?: string): string {
  if (!primaryCategory) return DEFAULT_NODE_COLOR;
  return CATEGORY_COLORS[primaryCategory] || DEFAULT_NODE_COLOR;
}

function getRelationFilterKey(relationType: string): string {
  return RELATION_STYLES[relationType] ? relationType : 'supplement';
}

function truncateTitle(title: unknown, maxLen = 6): string {
  const str = safeText(title);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeGraph({ onSelectNode, onBack }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const dimensionsRef = useRef({ width: 600, height: 400 });
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Filter state
  const [visibleRelations, setVisibleRelations] = useState<Set<string>>(
    () => new Set(FILTER_TOGGLES.filter((t) => t.defaultOn).map((t) => t.key))
  );

  // Focus mode state
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);

  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const mountedRef = useRef(true);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── ResizeObserver ──────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          dimensionsRef.current = { width, height };
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Zoom Setup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || loading || nodes.length === 0) return;

    const svgSelection = select<SVGSVGElement, unknown>(svgEl);

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM_EXTENT)
      .filter((event: Event) => {
        if (event.type === 'wheel') return true;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const target = event.target as Element;
          const isNode = target.closest('[data-node]');
          return !isNode;
        }
        return true;
      })
      .on('zoom', (event) => {
        const gEl = gRef.current;
        if (gEl) {
          gEl.setAttribute('transform', event.transform.toString());
        }
      });

    svgSelection.call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, [loading, nodes.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Data Fetch & Simulation ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getGraphData();

        if (cancelled || !mountedRef.current) return;

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          setLoading(false);
          return;
        }

        const limitedNodes: GraphNode[] = data.nodes.slice(0, MAX_NODES);
        const nodeIds = new Set(limitedNodes.map((n) => n.id));

        const limitedEdges: GraphEdge[] = data.edges.filter(
          (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );

        if (limitedNodes.length === 0) {
          if (mountedRef.current && !cancelled) setLoading(false);
          return;
        }

        const { width, height } = dimensionsRef.current;

        const simNodes: SimNode[] = limitedNodes.map((n) => ({
          id: n.id,
          title: n.title,
          type: n.type,
          primaryCategory: n.primaryCategory,
          x: width / 2 + (Math.random() - 0.5) * 100,
          y: height / 2 + (Math.random() - 0.5) * 100,
        }));

        const simLinks: SimLink[] = limitedEdges.map((e) => ({
          source: e.source as unknown as SimNode,
          target: e.target as unknown as SimNode,
          relationType: e.relationType,
          aiReason: e.aiReason,
        }));

        const sim = forceSimulation<SimNode>(simNodes)
          .force(
            'link',
            forceLink<SimNode, SimLink>(simLinks)
              .id((d) => d.id)
              .distance(100)
          )
          .force('charge', forceManyBody().strength(-200))
          .force('center', forceCenter(width / 2, height / 2))
          .force('collide', forceCollide(30))
          .alphaMin(0.01);

        simulationRef.current = sim;

        let tickCount = 0;
        sim.on('tick', () => {
          tickCount++;
          if (tickCount >= MAX_TICKS) {
            sim.stop();
          }
          if (mountedRef.current && !cancelled) {
            setNodes([...simNodes]);
            setLinks([...simLinks]);
          }
        });

        sim.on('end', () => {
          if (mountedRef.current && !cancelled) {
            setNodes([...simNodes]);
            setLinks([...simLinks]);
          }
        });

        if (mountedRef.current && !cancelled) setLoading(false);
      } catch (err) {
        console.error('Failed to load graph data:', err);
        if (mountedRef.current && !cancelled) {
          setError('加载知识图谱失败');
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Computed: filtered & focus ───────────────────────────────────────────────

  const { visibleNodes, visibleLinks } = useMemo(() => {
    // Step 1: filter links by relation type (only valid relation types)
    const filteredLinks = links.filter((link) => {
      const key = getRelationFilterKey(link.relationType);
      return visibleRelations.has(key);
    });

    // Step 2: get connected node IDs from filtered links
    const connectedNodeIds = new Set<number>();
    for (const link of filteredLinks) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (typeof src === 'object') connectedNodeIds.add(src.id);
      if (typeof tgt === 'object') connectedNodeIds.add(tgt.id);
    }

    // Filter nodes to only those connected by visible edges
    let filteredNodes = nodes.filter((n) => connectedNodeIds.has(n.id));

    // Step 3: apply focus mode
    if (focusNodeId !== null) {
      // Build adjacency from filtered links
      const adj = new Map<number, Set<number>>();
      for (const link of filteredLinks) {
        const srcId = (link.source as SimNode).id;
        const tgtId = (link.target as SimNode).id;
        if (!adj.has(srcId)) adj.set(srcId, new Set());
        if (!adj.has(tgtId)) adj.set(tgtId, new Set());
        adj.get(srcId)!.add(tgtId);
        adj.get(tgtId)!.add(srcId);
      }

      // BFS 2-step
      const focusVisible = new Set<number>();
      focusVisible.add(focusNodeId);
      const step1 = adj.get(focusNodeId) || new Set();
      for (const nid of step1) {
        focusVisible.add(nid);
        const step2 = adj.get(nid) || new Set();
        for (const nid2 of step2) {
          focusVisible.add(nid2);
        }
      }

      filteredNodes = filteredNodes.filter((n) => focusVisible.has(n.id));
      const focusNodeIdSet = new Set(filteredNodes.map((n) => n.id));
      return {
        visibleNodes: filteredNodes,
        visibleLinks: filteredLinks.filter((link) => {
          const srcId = (link.source as SimNode).id;
          const tgtId = (link.target as SimNode).id;
          return focusNodeIdSet.has(srcId) && focusNodeIdSet.has(tgtId);
        }),
      };
    }

    return { visibleNodes: filteredNodes, visibleLinks: filteredLinks };
  }, [nodes, links, visibleRelations, focusNodeId]);

  // ─── Zoom controls ─────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgEl || !zoomBehavior) return;
    const svgSelection = select<SVGSVGElement, unknown>(svgEl);
    zoomBehavior.scaleBy(svgSelection, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgEl || !zoomBehavior) return;
    const svgSelection = select<SVGSVGElement, unknown>(svgEl);
    zoomBehavior.scaleBy(svgSelection, 0.7);
  }, []);

  const handleZoomReset = useCallback(() => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomRef.current;
    if (!svgEl || !zoomBehavior) return;
    const svgSelection = select<SVGSVGElement, unknown>(svgEl);
    zoomBehavior.transform(svgSelection, zoomIdentity);
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      if (focusNodeId === nodeId) {
        // Exit focus mode
        setFocusNodeId(null);
      } else {
        // Enter focus mode
        setFocusNodeId(nodeId);
      }
      onSelectNode?.(nodeId);
    },
    [onSelectNode, focusNodeId]
  );

  const handleExitFocus = useCallback(() => {
    setFocusNodeId(null);
  }, []);

  const handleNodeHover = useCallback((node: SimNode, event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 30,
      text: node.title,
    });
  }, []);

  const handleLinkHover = useCallback((link: SimLink, event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const style = getEdgeStyle(link.relationType);
    if (!style) return;
    const text = link.aiReason
      ? `${style.label}: ${link.aiReason}`
      : style.label;
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 30,
      text,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const toggleRelation = useCallback((key: string) => {
    setVisibleRelations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function getNodeX(node: SimNode | number): number {
    if (typeof node === 'number') return 0;
    return node.x ?? 0;
  }

  function getNodeY(node: SimNode | number): number {
    if (typeof node === 'number') return 0;
    return node.y ?? 0;
  }

  // Set of visible node IDs for quick opacity check
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );
  const visibleLinkKeys = useMemo(
    () =>
      new Set(
        visibleLinks.map(
          (l) => `${(l.source as SimNode).id}-${(l.target as SimNode).id}`
        )
      ),
    [visibleLinks]
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isEmpty = !loading && nodes.length === 0 && !error;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <GitBranch size={16} style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            思维蛛网
          </h2>
        </div>
      </div>

      {/* Graph Area */}
      <div
        ref={containerRef}
        className="flex-1 relative mx-3 mb-3 rounded-xl overflow-hidden bg-white/40 backdrop-blur-sm"
        style={{ minHeight: 300 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              加载中...
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <p className="text-sm text-center text-red-500">{error}</p>
          </div>
        )}

        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              蛛丝还未织就，添加更多知识后，关联自然浮现
            </p>
          </div>
        )}

        {!loading && !error && nodes.length > 0 && (
          <>
            {/* Filter Controls */}
            <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-1.5 max-w-[280px]">
              {FILTER_TOGGLES.map((toggle) => {
                const active = visibleRelations.has(toggle.key);
                const style = RELATION_STYLES[toggle.key];
                return (
                  <button
                    key={toggle.key}
                    onClick={() => toggleRelation(toggle.key)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 border"
                    style={{
                      backgroundColor: active ? `${style.color}30` : 'rgba(0,0,0,0.4)',
                      borderColor: active ? style.color : 'rgba(255,255,255,0.15)',
                      color: active ? style.color : 'rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {toggle.label}
                  </button>
                );
              })}
            </div>

            {/* Focus Mode Exit Button */}
            {focusNodeId !== null && (
              <div className="absolute top-3 left-3 z-10">
                <button
                  onClick={handleExitFocus}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)',
                    color: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <X size={12} />
                  退出聚焦
                </button>
              </div>
            )}

            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="w-full h-full"
              style={{ cursor: 'grab' }}
            >
              <g ref={gRef}>
                {/* Edges */}
                {links.map((link, i) => {
                  const linkKey = `${(link.source as SimNode).id}-${(link.target as SimNode).id}`;
                  const isVisible = visibleLinkKeys.has(linkKey);
                  const style = getEdgeStyle(link.relationType);
                  if (!style) return null;
                  return (
                    <line
                      key={`edge-${i}`}
                      x1={getNodeX(link.source as SimNode)}
                      y1={getNodeY(link.source as SimNode)}
                      x2={getNodeX(link.target as SimNode)}
                      y2={getNodeY(link.target as SimNode)}
                      stroke={style.color}
                      strokeOpacity={isVisible ? 0.7 : 0.05}
                      strokeWidth={isVisible ? 1.5 : 0.5}
                      strokeDasharray={style.dash === 'none' ? undefined : style.dash}
                      onMouseEnter={(e) => handleLinkHover(link, e)}
                      onMouseLeave={handleMouseLeave}
                      className="cursor-pointer transition-opacity duration-300"
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isVisible = visibleNodeIds.has(node.id);
                  const isFocused = focusNodeId === node.id;
                  const nodeColor = getNodeColor(node.primaryCategory);
                  const radius = isFocused ? FOCUS_NODE_RADIUS : NODE_RADIUS;
                  return (
                    <g
                      key={`node-${node.id}`}
                      data-node="true"
                      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={(e) => handleNodeHover(node, e)}
                      onMouseLeave={handleMouseLeave}
                      className="cursor-pointer transition-opacity duration-300"
                      opacity={isVisible ? 1 : 0.08}
                    >
                      {/* Glow effect for focused node */}
                      {isFocused && (
                        <circle
                          r={radius + 6}
                          fill="none"
                          stroke={nodeColor}
                          strokeWidth={2}
                          strokeOpacity={0.5}
                          className="animate-pulse"
                        />
                      )}
                      <circle
                        r={radius}
                        fill={nodeColor}
                        fillOpacity={isVisible ? 0.85 : 0.3}
                        stroke={nodeColor}
                        strokeWidth={isFocused ? 3 : 2}
                        strokeOpacity={isVisible ? 0.6 : 0.15}
                      />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        className="text-xs pointer-events-none select-none"
                        fill="white"
                        fillOpacity={isVisible ? 1 : 0.3}
                        fontSize={isFocused ? 11 : 10}
                      >
                        {truncateTitle(node.title)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Zoom Controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg shadow-sm transition-colors"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  color: 'rgba(255,255,255,0.8)',
                }}
                title="放大"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg shadow-sm transition-colors"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  color: 'rgba(255,255,255,0.8)',
                }}
                title="缩小"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1.5 rounded-lg shadow-sm transition-colors"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  color: 'rgba(255,255,255,0.8)',
                }}
                title="重置视角"
              >
                <Maximize2 size={14} />
              </button>
            </div>

            {/* Legend */}
            <div
              className="absolute bottom-3 left-3 z-10 px-2.5 py-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <p className="text-[9px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                关系类型
              </p>
              <div className="flex flex-col gap-1">
                {FILTER_TOGGLES.filter((t) => visibleRelations.has(t.key)).map((toggle) => {
                  const style = RELATION_STYLES[toggle.key];
                  return (
                    <div key={toggle.key} className="flex items-center gap-1.5">
                      <svg width="20" height="6">
                        <line
                          x1="0"
                          y1="3"
                          x2="20"
                          y2="3"
                          stroke={style.color}
                          strokeWidth="1.5"
                          strokeDasharray={style.dash === 'none' ? undefined : style.dash}
                        />
                      </svg>
                      <span className="text-[9px]" style={{ color: style.color }}>
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-800 text-white text-xs rounded px-2 py-1 max-w-[200px] truncate z-20"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translateX(-50%)',
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
