import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useEdgesState,
  useNodesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { propagateVoltage, validateCircuit } from '../utils/electricSimulator';

// ==========================================
// CUSTOM REACT FLOW NODE TYPES
// ==========================================

const CustomBatteryNode = ({ id, data }) => {
  const handleChange = (e) => {
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { voltage: parseFloat(e.target.value) || 0 });
    }
  };

  return (
    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-white w-40 font-mono text-[10px] pointer-events-auto">
      <div className="flex items-center justify-between mb-1.5 border-b border-cyan-950 pb-1">
        <span className="flex items-center gap-1 font-bold text-cyan-400">
          <span>🔋</span> BATTERY
        </span>
        <span className="text-[8px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded-full border border-cyan-800/30">SOURCE</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/40">VOLTAGE:</span>
          <input 
            type="number" 
            min="0" 
            max="24" 
            value={data.voltage ?? 12} 
            onChange={handleChange}
            className="w-16 bg-slate-900 border border-cyan-500/20 text-cyan-400 font-bold text-[10px] px-1 rounded focus:outline-none focus:border-cyan-400 text-right"
          />
        </div>
        <div className="text-[8px] text-cyan-400/60 text-right mt-1">Status: Active</div>
      </div>
      {/* Port connection point indicator */}
      <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 border border-white rounded-full"></div>
    </div>
  );
};

const CustomResistorNode = ({ id, data }) => {
  const handleChange = (e) => {
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { resistance: parseFloat(e.target.value) || 0 });
    }
  };

  return (
    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.15)] text-white w-40 font-mono text-[10px] pointer-events-auto">
      <div className="flex items-center justify-between mb-1.5 border-b border-green-950 pb-1">
        <span className="flex items-center gap-1 font-bold text-green-400">
          <span>⚡</span> RESISTOR
        </span>
        <span className="text-[8px] bg-green-950 text-green-400 px-1.5 py-0.5 rounded-full border border-green-800/30">LOAD</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/40">RESISTANCE:</span>
          <input 
            type="number" 
            min="1" 
            max="10000" 
            value={data.resistance ?? 100} 
            onChange={handleChange}
            className="w-16 bg-slate-900 border border-green-500/20 text-green-400 font-bold text-[10px] px-1 rounded focus:outline-none focus:border-green-400 text-right"
          />
        </div>
        <div className="flex justify-between text-[8px] text-white/30 pt-0.5">
          <span>V-DROP:</span>
          <span className="text-green-400/80 font-bold">{(data.voltage ?? 0).toFixed(1)}V</span>
        </div>
      </div>
      <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
      <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 border border-white rounded-full"></div>
    </div>
  );
};

const CustomSwitchNode = ({ id, data }) => {
  const handleToggle = () => {
    if (data.onUpdateNode) {
      data.onUpdateNode(id, { closed: !data.closed });
    }
  };

  return (
    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] text-white w-40 font-mono text-[10px] pointer-events-auto">
      <div className="flex items-center justify-between mb-1.5 border-b border-amber-950 pb-1">
        <span className="flex items-center gap-1 font-bold text-amber-400">
          <span>🔌</span> SWITCH
        </span>
        <span className="text-[8px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-800/30">TOGGLE</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-white/40">STATE:</span>
          <button 
            onClick={handleToggle}
            className={`px-2.5 py-0.5 rounded font-bold text-[8px] tracking-wider transition-all border ${
              data.closed 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}
          >
            {data.closed ? '● CLOSED' : '○ OPEN'}
          </button>
        </div>
        <div className="flex justify-between text-[8px] text-white/30">
          <span>INPUT:</span>
          <span className="text-amber-400/80">{(data.voltage ?? 0).toFixed(1)}V</span>
        </div>
      </div>
      <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 border border-white rounded-full"></div>
      <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 border border-white rounded-full"></div>
    </div>
  );
};

const CustomMotorNode = ({ data }) => {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)] text-white w-40 font-mono text-[10px]">
      <div className="flex items-center justify-between mb-1.5 border-b border-purple-950 pb-1">
        <span className="flex items-center gap-1 font-bold text-purple-400">
          <span>⚙️</span> ACTUATOR
        </span>
        <span className="text-[8px] bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded-full border border-purple-800/30">MOTOR</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/40">SPIN RATE:</span>
          <span className={`font-bold transition-all ${data.active ? 'text-purple-400 animate-pulse' : 'text-white/30'}`}>
            {data.active ? '🔄 SPINNING' : '■ STATIC'}
          </span>
        </div>
        <div className="flex justify-between text-[8px] text-white/30">
          <span>VOLTAGE:</span>
          <span className="text-purple-400 font-bold">{(data.voltage ?? 0).toFixed(1)}V</span>
        </div>
        <div className="flex justify-between text-[8px] text-white/30">
          <span>CURRENT:</span>
          <span className="text-purple-300">{(data.current ?? 0).toFixed(2)}A</span>
        </div>
      </div>
      <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 border border-white rounded-full"></div>
    </div>
  );
};

const CustomLedNode = ({ data }) => {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.15)] text-white w-40 font-mono text-[10px]">
      <div className="flex items-center justify-between mb-1.5 border-b border-pink-950 pb-1">
        <span className="flex items-center gap-1 font-bold text-pink-400">
          <span>💡</span> DIODE
        </span>
        <span className="text-[8px] bg-pink-950 text-pink-400 px-1.5 py-0.5 rounded-full border border-pink-800/30">LED</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-white/40">ILLUM:</span>
          <span className={`font-bold text-[9px] transition-all px-1.5 rounded flex items-center gap-1 ${
            data.active 
              ? 'text-pink-400 bg-pink-500/10 shadow-[0_0_10px_rgba(236,72,153,0.3)] animate-pulse' 
              : 'text-white/20 bg-white/2'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.active ? 'bg-pink-400 shadow-[0_0_5px_#ec4899]' : 'bg-white/20'}`}></span>
            {data.active ? 'GLOWING' : 'OFF'}
          </span>
        </div>
        <div className="flex justify-between text-[8px] text-white/30">
          <span>VOLTAGE:</span>
          <span className="text-pink-400 font-bold">{(data.voltage ?? 0).toFixed(1)}V</span>
        </div>
      </div>
      <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-pink-500 border border-white rounded-full"></div>
    </div>
  );
};

const nodeTypes = {
  battery: CustomBatteryNode,
  resistor: CustomResistorNode,
  switch: CustomSwitchNode,
  motor: CustomMotorNode,
  led: CustomLedNode,
};

// Default starter nodes
const defaultNodes = [
  { id: 'battery-1', type: 'battery', position: { x: 50, y: 150 }, data: { voltage: 12 } },
  { id: 'switch-1', type: 'switch', position: { x: 260, y: 150 }, data: { closed: true } },
  { id: 'motor-1', type: 'motor', position: { x: 470, y: 150 }, data: {} },
];

const defaultEdges = [
  { id: 'e-1', source: 'battery-1', target: 'switch-1', type: 'smoothstep', animated: true },
  { id: 'e-2', source: 'switch-1', target: 'motor-1', type: 'smoothstep', animated: true },
];

export default function ElectricalPanel() {
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

  // Safely update node data properties without causing infinite loops
  const handleUpdateNode = useCallback((id, updatedData) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, ...updatedData } };
        }
        return n;
      })
    );
  }, [setNodes]);

  // Compute simulation results on the fly without changing state
  const simulationResult = useMemo(() => {
    return propagateVoltage(nodes, edges);
  }, [nodes, edges]);

  // Map simulated values onto our React Flow nodes for display
  const nodesWithTelemetry = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        ...simulationResult[n.id],
        onUpdateNode: handleUpdateNode,
      },
    }));
  }, [nodes, simulationResult, handleUpdateNode]);

  // Generate schematic alert messages
  const circuitWarning = useMemo(() => {
    return validateCircuit(nodes, edges);
  }, [nodes, edges]);

  // Handle new edge connections
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
    [setEdges]
  );

  // Component Builders
  const addComponent = (type) => {
    const id = `${type}-${Date.now()}`;
    const defaultData = 
      type === 'battery' ? { voltage: 12 } :
      type === 'resistor' ? { resistance: 100 } :
      type === 'switch' ? { closed: false } : {};

    const newNode = {
      id,
      type,
      position: { x: 150, y: 100 },
      data: defaultData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const clearCircuit = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#070b14] border-l border-white/5 text-white">
      {/* Top Workspace Header */}
      <div className="p-4 border-b border-white/5 bg-[#0a0f1c] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xs font-bold font-mono tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Schematic Workstation
          </h2>
          <p className="text-[9px] text-white/30 uppercase tracking-tighter mt-0.5">Drag to route power & signal nodes</p>
        </div>
        <button 
          onClick={clearCircuit}
          className="px-2 py-1 rounded text-[8px] font-bold font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
        >
          🗑️ Reset Board
        </button>
      </div>

      {/* Component Library Builder Toolbar */}
      <div className="p-3 bg-[#080d19] border-b border-white/5 flex flex-wrap gap-2 shrink-0">
        <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider block w-full mb-1 font-mono">Component Library</span>
        {[
          { type: 'battery', label: '🔋 SOURCE (Battery)' },
          { type: 'resistor', label: '⚡ RESISTOR' },
          { type: 'switch', label: '🔌 SWITCH' },
          { type: 'motor', label: '⚙️ MOTOR' },
          { type: 'led', label: '💡 LED LIGHT' },
        ].map((item) => (
          <button
            key={item.type}
            onClick={() => addComponent(item.type)}
            className="px-2.5 py-1.5 rounded-lg bg-white/2 border border-white/5 text-[9px] font-bold font-mono tracking-wide text-white/60 hover:text-white hover:bg-white/5 hover:border-white/10 transition-all flex items-center gap-1.5"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* React Flow Schematic Canvas */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodesWithTelemetry}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          className="pointer-events-auto"
        >
          <MiniMap 
            className="!bg-slate-950/90 !border !border-white/5 !rounded-lg"
            nodeColor={(n) => {
              if (n.type === 'battery') return 'rgba(6,182,212,0.3)';
              if (n.type === 'resistor') return 'rgba(34,197,94,0.3)';
              if (n.type === 'switch') return 'rgba(245,158,11,0.3)';
              if (n.type === 'motor') return 'rgba(168,85,247,0.3)';
              return 'rgba(236,72,153,0.3)';
            }}
            maskColor="rgba(0,0,0,0.4)"
          />
          <Controls className="!bg-slate-950/90 !border !border-white/5 !rounded-lg !text-white" />
          <Background color="#161e33" gap={12} size={1} />
        </ReactFlow>
      </div>

      {/* Telemetry Console & Warnings */}
      <div className="p-4 border-t border-white/5 bg-[#090d18] shrink-0 font-mono text-[9px] space-y-1.5">
        <div className="text-white/40 font-bold uppercase text-[8px] tracking-wider mb-0.5">Telemetry Feed</div>
        <div className={`p-2.5 rounded-lg border text-left flex items-start gap-2 ${
          circuitWarning.includes('🚨') 
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
            : circuitWarning.includes('⚠️')
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
        }`}>
          <span className="mt-0.5 text-xs">ℹ</span>
          <span className="leading-normal">{circuitWarning}</span>
        </div>
      </div>
    </div>
  );
}
