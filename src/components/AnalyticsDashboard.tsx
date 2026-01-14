/**
 * Analytics Dashboard Component
 * Provides comprehensive metrics and visualization of IFC data
 */

import { useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GraphNode, GraphEdge } from '@/types/graph';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { findFloatingNodes } from '@/lib/floatingNodeAnalyzer';

interface AnalyticsDashboardProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode) => void;
  graphLoD?: 1 | 2 | 3 | 4 | 5;
}

export function AnalyticsDashboard({ nodes, edges, onNodeSelect, graphLoD }: AnalyticsDashboardProps) {
  // Performance: Only process first 5000 nodes for large datasets to avoid browser freeze
  const safeNodes = nodes.slice(0, 5000);
  const safeEdges = edges.filter(e => 
    nodes.some(n => n.id === e.source) && 
    nodes.some(n => n.id === e.target)
  );
  
  // Find floating nodes
  const floatingNodes = useMemo(() => {
    return findFloatingNodes(safeNodes, safeEdges);
  }, [safeNodes, safeEdges]);

  // Debug: Log nodes by IFC type to console when dashboard opens (LoD5 only)
  useEffect(() => {
    // Only log at LoD5 for advanced users
    if (graphLoD !== 5) return;
    
    // Count all nodes by IFC type
    const byIFCType: Record<string, number> = {};
    safeNodes.forEach(node => {
      byIFCType[node.ifcType] = (byIFCType[node.ifcType] || 0) + 1;
    });

    // Sort by count descending
    const sorted = Object.entries(byIFCType)
      .sort(([, a], [, b]) => b - a);

    console.group('%c📊 ENTITIES BY IFC TYPE (LoD5 Full Graph)', 'color: #74c0fc; font-weight: bold; font-size: 12px');
    console.log(`%cTotal Entities: ${safeNodes.length}`, 'color: #ffa94d; font-weight: bold');
    console.log('%cBreakdown by IFC Type:', 'color: #74c0fc; font-weight: bold');
    
    // Format output like user showed
    sorted.forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    
    // Also show as table
    console.table(Object.fromEntries(sorted));
    
    console.groupEnd();
  }, [safeNodes, graphLoD]);

  // Physical building elements distribution (novice-friendly)
  const physicalElementsDistribution = useMemo(() => {
    // Filter only physical building elements that students care about
    const physicalTypes = new Set([
      'IFCWALL', 'IFCWALLSTANDARDCASE',
      'IFCSLAB',
      'IFCDOOR',
      'IFCWINDOW',
      'IFCSTAIR', 'IFCSTAIRFLIGHT',
      'IFCROOF',
      'IFCCOLUMN',
      'IFCBEAM',
      'IFCRAILING',
      'IFCCURTAINWALL',
      'IFCFURNISHINGELEMENT',
      'IFCBUILDINGELEMENTPROXY'
    ]);
    
    const distribution: Record<string, number> = {};
    safeNodes.forEach(node => {
      const type = node.ifcType.toUpperCase();
      if (physicalTypes.has(type)) {
        // Simplify names for display
        let displayName = type.replace('IFC', '').replace('STANDARDCASE', '');
        // Merge wall types
        if (type.includes('WALL')) displayName = 'WALL';
        if (type.includes('STAIR')) displayName = 'STAIR';
        
        distribution[displayName] = (distribution[displayName] || 0) + 1;
      }
    });
    
    return Object.entries(distribution)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [safeNodes]);

  // Node type distribution
  const nodeTypeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    safeNodes.forEach(node => {
      distribution[node.type] = (distribution[node.type] || 0) + 1;
    });
    return Object.entries(distribution).map(([type, count]) => ({ type, count }));
  }, [safeNodes]);

  // Relationship type distribution
  const relationshipDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    safeEdges.forEach(edge => {
      distribution[edge.type] = (distribution[edge.type] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [safeEdges]);

  // Property completeness
  const propertyCompleteness = useMemo(() => {
    let totalProps = 0;
    let filledProps = 0;

    safeNodes.forEach(node => {
      const props = Object.keys(node.properties || {});
      totalProps += props.length;
      filledProps += props.filter(p => node.properties[p] !== null && node.properties[p] !== undefined && node.properties[p] !== '').length;
    });

    return totalProps > 0 ? Math.round((filledProps / totalProps) * 100) : 0;
  }, [safeNodes]);

  // Connectivity metrics
  const connectivityMetrics = useMemo(() => {
    const nodeOutdegree: Record<string, number> = {};
    const nodeIndegree: Record<string, number> = {};

    safeNodes.forEach(node => {
      nodeOutdegree[node.id] = 0;
      nodeIndegree[node.id] = 0;
    });

    safeEdges.forEach(edge => {
      nodeOutdegree[edge.source] = (nodeOutdegree[edge.source] || 0) + 1;
      nodeIndegree[edge.target] = (nodeIndegree[edge.target] || 0) + 1;
    });

    const outdegrees = Object.values(nodeOutdegree);
    const indegrees = Object.values(nodeIndegree);

    return {
      avgOutdegree: outdegrees.length > 0 ? (outdegrees.reduce((a, b) => a + b, 0) / outdegrees.length).toFixed(2) : '0',
      maxOutdegree: outdegrees.length > 0 ? Math.max(...outdegrees) : 0,
      avgIndegree: indegrees.length > 0 ? (indegrees.reduce((a, b) => a + b, 0) / indegrees.length).toFixed(2) : '0',
      maxIndegree: indegrees.length > 0 ? Math.max(...indegrees) : 0,
      isolated: safeNodes.filter(n => (nodeOutdegree[n.id] || 0) === 0 && (nodeIndegree[n.id] || 0) === 0).length,
    };
  }, [safeNodes, safeEdges]);

  // Entity category breakdown
  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, number> = {
      spatial: 0,
      element: 0,
      property: 0,
      relationship: 0,
      other: 0,
    };

    safeNodes.forEach(node => {
      if (node.type === 'building' || node.type === 'space') categories.spatial++;
      else if (node.type === 'element') categories.element++;
      else if (node.type === 'property') categories.property++;
      else if (node.type === 'relationship') categories.relationship++;
      else categories.other++;
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [safeNodes]);

  // Schema compliance
  const schemaCompliance = useMemo(() => {
    const withGuid = safeNodes.filter(n => n.properties?.GlobalId).length;
    const withName = safeNodes.filter(n => n.properties?.Name).length;
    const withDescription = safeNodes.filter(n => n.properties?.Description).length;

    return {
      guid: safeNodes.length > 0 ? Math.round((withGuid / safeNodes.length) * 100) : 0,
      name: safeNodes.length > 0 ? Math.round((withName / safeNodes.length) * 100) : 0,
      description: safeNodes.length > 0 ? Math.round((withDescription / safeNodes.length) * 100) : 0,
    };
  }, [safeNodes]);

  const COLORS = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="w-full space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{edges.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Property Completeness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{propertyCompleteness}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Charts */}
      <Tabs defaultValue="elements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="elements">Building Elements</TabsTrigger>
          <TabsTrigger value="spaces">Spaces</TabsTrigger>
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
        </TabsList>

        {/* Physical Building Elements */}
        <TabsContent value="elements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Physical Building Elements</CardTitle>
              <CardDescription>Walls, Slabs, Doors, Windows, Stairs, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={physicalElementsDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spaces */}
        <TabsContent value="spaces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Spatial Structure</CardTitle>
              <CardDescription>Building hierarchy and spaces</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={nodeTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.type}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {nodeTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connectivity */}
        <TabsContent value="connectivity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Graph Connectivity</CardTitle>
              <CardDescription>How building elements are connected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Average Connections</div>
                  <div className="text-3xl font-bold">{connectivityMetrics.avgOutdegree}</div>
                  <p className="text-xs text-muted-foreground">per element</p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Most Connected</div>
                  <div className="text-3xl font-bold">{connectivityMetrics.maxOutdegree}</div>
                  <p className="text-xs text-muted-foreground">relationships</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
