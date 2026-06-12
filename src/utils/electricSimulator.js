// Simple electrical simulation utilities for the Ignite Lab ElectricalPanel
// This implementation is intentionally lightweight and aims to demonstrate voltage propagation
// across a directed graph of nodes (batteries, resistors, motors, switches, LEDs).

/**
 * Calculate the current through a resistor given voltage across it using Ohm's law.
 * @param {number} voltage - Voltage across the resistor (V)
 * @param {number} resistance - Resistance value (Ω)
 * @returns {number} current (A)
 */
export function calculateCurrent(voltage, resistance) {
  if (!resistance || resistance <= 0) return 0;
  return voltage / resistance;
}

/**
 * Propagate voltage from sources (batteries) through edges to downstream nodes.
 * Returns a map of nodeId => { voltage, current, active }
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 */
export function propagateVoltage(nodes, edges) {
  const nodeMap = {};
  nodes.forEach((n) => {
    nodeMap[n.id] = { ...n, voltage: 0, current: 0, active: false };
  });

  // Build adjacency list (source -> target)
  const adjacency = {};
  edges.forEach((e) => {
    const src = e.source;
    const tgt = e.target;
    if (!adjacency[src]) adjacency[src] = [];
    adjacency[src].push(tgt);
  });

  const visited = new Set();
  const queue = [];

  // Initialise queue with battery nodes (voltage sources)
  nodes.forEach((n) => {
    if (n.type === 'battery' && n.data?.voltage) {
      nodeMap[n.id].voltage = parseFloat(n.data.voltage);
      nodeMap[n.id].active = true;
      queue.push(n.id);
      visited.add(n.id);
    }
  });

  while (queue.length) {
    const curId = queue.shift();
    const curNode = nodeMap[curId];
    const outIds = adjacency[curId] || [];

    outIds.forEach((tgtId) => {
      const tgtNode = nodeMap[tgtId];
      if (!tgtNode) return;

      // Handle Switch: if open, voltage does not propagate
      if (curNode.type === 'switch' && curNode.data?.closed === false) {
        tgtNode.voltage = 0;
        tgtNode.current = 0;
        tgtNode.active = false;
      } else if (curNode.type === 'resistor' && curNode.data?.resistance) {
        // Resistor drops voltage
        const res = parseFloat(curNode.data.resistance);
        const current = calculateCurrent(curNode.voltage, res);
        curNode.current = current;
        curNode.active = current > 0.01;
        
        tgtNode.voltage = Math.max(0, curNode.voltage - current * res);
        tgtNode.current = current;
        tgtNode.active = current > 0.01;
      } else if (curNode.type === 'battery') {
        // Battery passes voltage directly
        tgtNode.voltage = curNode.voltage;
        tgtNode.current = curNode.current;
        tgtNode.active = true;
      } else {
        // Regular propagation
        tgtNode.voltage = curNode.voltage;
        tgtNode.current = curNode.current;
        tgtNode.active = curNode.voltage > 0.1;
      }

      if (!visited.has(tgtId)) {
        visited.add(tgtId);
        queue.push(tgtId);
      }
    });
  }

  // Update load states based on terminal voltage
  Object.keys(nodeMap).forEach((id) => {
    const n = nodeMap[id];
    if (n.type === 'motor') {
      // Motor draws current based on voltage & internal resistance (assume 10 ohms)
      n.current = calculateCurrent(n.voltage, 10);
      n.active = n.voltage >= 3.0; // requires at least 3V to spin
    } else if (n.type === 'led') {
      n.active = n.voltage >= 1.8; // standard LED forward voltage
      n.current = n.active ? 0.02 : 0; // nominal 20mA when on
    } else if (n.type === 'switch') {
      n.active = n.data?.closed && n.voltage > 0.1;
    }
  });

  // Return simple map of id -> { voltage, current, active }
  const result = {};
  Object.entries(nodeMap).forEach(([id, n]) => {
    result[id] = { voltage: n.voltage, current: n.current, active: n.active };
  });
  return result;
}

/**
 * Very basic circuit validation – checks for missing voltage sources, short circuits, safety flags.
 * Returns a string message or empty string.
 */
export function validateCircuit(nodes, edges) {
  const hasSource = nodes.some((n) => n.type === 'battery' && n.data?.voltage > 0);
  if (!hasSource) return '⚠️ No voltage source detected. Drag in a Battery node to power up!';

  // Detect isolated nodes (no edges in or out)
  const connected = new Set();
  edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });
  const isolated = nodes.filter((n) => !connected.has(n.id));
  if (isolated.length) {
    return `⚠️ ${isolated.length} isolated component(s) detected. Connect them to route signals.`;
  }

  // Check if a battery is short-circuited (directly connected to itself, or to ground/negative)
  // Since we have a simple directed graph, we'll check if a battery is directly connected to a load with 0 ohm resistance
  const zeroResistors = nodes.filter(n => n.type === 'resistor' && (!n.data?.resistance || parseFloat(n.data.resistance) === 0));
  if (zeroResistors.length > 0) {
    return `🚨 Short Circuit Warning! A resistor is set to 0Ω. Danger of overcurrent.`;
  }

  return '⚡ System nominal. Circuit active and telemetry flowing.';
}
