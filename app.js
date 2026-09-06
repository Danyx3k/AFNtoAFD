/**
 * AFN -> AFD Studio
 * Conversor por Construcción de Subconjuntos & Simulador Gráfico Interactivo
 */

// State Management
const state = {
  alphabet: ['a', 'b'],
  states: ['q0', 'q1', 'q2'],
  initialState: 'q0',
  finalStates: ['q2'],
  transitions: {
    'q0,a': ['q0', 'q1'],
    'q0,b': ['q0'],
    'q1,b': ['q2']
  },
  afdResult: null,
  activeGraphView: 'afd', // 'afd' or 'afn'
  visNetwork: null,
  visData: { nodes: null, edges: null },
  physicsEnabled: true,
  // Simulator State
  sim: {
    string: 'ab',
    currentIndex: 0,
    currentState: null,
    history: [],
    isFinished: false,
    timer: null
  }
};

// DOM Elements
const elements = {
  inputAlphabet: document.getElementById('input-alphabet'),
  inputStates: document.getElementById('input-states'),
  inputInitial: document.getElementById('input-initial'),
  inputFinals: document.getElementById('input-finals'),
  matrixHeaderRow: document.getElementById('matrix-header-row'),
  matrixBody: document.getElementById('matrix-body'),
  btnModeMatrix: document.getElementById('btn-mode-matrix'),
  btnModeList: document.getElementById('btn-mode-list'),
  matrixContainer: document.getElementById('matrix-container'),
  listContainer: document.getElementById('list-container'),
  quickOrigin: document.getElementById('quick-origin'),
  quickSymbol: document.getElementById('quick-symbol'),
  quickDestinations: document.getElementById('quick-destinations'),
  btnAddTransition: document.getElementById('btn-add-transition'),
  transitionsChips: document.getElementById('transitions-chips'),
  btnConvert: document.getElementById('btn-convert'),
  networkContainer: document.getElementById('automaton-network'),
  btnShowAfdGraph: document.getElementById('btn-show-afd-graph'),
  btnShowAfnGraph: document.getElementById('btn-show-afn-graph'),
  btnFitGraph: document.getElementById('btn-fit-graph'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnPhysicsGraph: document.getElementById('btn-physics-graph'),
  physicsStatusText: document.getElementById('physics-status-text'),
  btnDownloadGraph: document.getElementById('btn-download-graph'),
  afdTableHeader: document.getElementById('afd-table-header'),
  afdTableBody: document.getElementById('afd-table-body'),
  btnCopyAfdTable: document.getElementById('btn-copy-afd-table'),
  formalDefContent: document.getElementById('formal-def-content'),
  traceStepsContainer: document.getElementById('trace-steps-container'),
  // Simulator
  simInputString: document.getElementById('sim-input-string'),
  btnSimRun: document.getElementById('btn-sim-run'),
  btnSimStep: document.getElementById('btn-sim-step'),
  btnSimReset: document.getElementById('btn-sim-reset'),
  simTapeCells: document.getElementById('sim-tape-cells'),
  simCurrentStateVal: document.getElementById('sim-current-state-val'),
  simVerdictBadge: document.getElementById('sim-verdict-badge'),
  simLogList: document.getElementById('sim-log-list'),
  btnClearAll: document.getElementById('btn-clear-all')
};

// Robust list parser
function parseList(str) {
  if (!str) return [];
  let items = [];
  if (str.includes(',') || str.includes(';')) {
    items = str.replace(/;/g, ',').split(',');
  } else if (str.trim().includes(' ')) {
    items = str.trim().split(/\s+/);
  } else {
    items = [str.trim()];
  }
  return items.map(s => s.trim()).filter(s => s.length > 0);
}

function formatSubset(setArray) {
  if (!setArray || setArray.length === 0) return 'Ø';
  const sorted = [...setArray].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return '{' + sorted.join(',') + '}';
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Sync current inputs from DOM table into state.transitions & prune invalid keys
function syncMatrixDOMToState() {
  const alphabet = parseList(elements.inputAlphabet.value);
  const statesList = parseList(elements.inputStates.value);

  // 1. Read values from all current DOM inputs
  const inputs = document.querySelectorAll('.matrix-cell-input');
  inputs.forEach(input => {
    const st = input.getAttribute('data-state');
    const sym = input.getAttribute('data-sym');
    const val = input.value.trim();
    const key = `${st},${sym}`;
    if (val && val !== '-' && val !== 'Ø') {
      state.transitions[key] = parseList(val);
    } else {
      delete state.transitions[key];
    }
  });

  // 2. Prune any orphaned keys whose symbol is not in alphabet or state is not in statesList
  Object.keys(state.transitions).forEach(key => {
    const [st, sym] = key.split(',');
    if (!alphabet.includes(sym) || !statesList.includes(st)) {
      delete state.transitions[key];
    }
  });
}

// Compact Matrix Table UI Builder
function updateMatrixUI() {
  syncMatrixDOMToState();

  const alphabet = parseList(elements.inputAlphabet.value);
  const statesList = parseList(elements.inputStates.value);
  const initial = elements.inputInitial.value.trim();
  const finals = parseList(elements.inputFinals.value);

  elements.matrixHeaderRow.innerHTML = '<th class="col-state">Estado</th>' + 
    alphabet.map(sym => `<th>${sym}</th>`).join('');

  elements.matrixBody.innerHTML = '';

  if (statesList.length === 0) {
    elements.matrixBody.innerHTML = '<tr><td colspan="' + (alphabet.length + 1) + '" style="text-align:center;color:var(--text-dim);padding:0.75rem;">Ingrese estados arriba para generar la matriz.</td></tr>';
    updateChipsUI();
    return;
  }

  statesList.forEach(st => {
    const isInit = (st === initial);
    const isFin = finals.includes(st);
    let mark = '';
    if (isInit) mark += '<span class="initial-mark">➔ </span>';
    if (isFin) mark += '<span class="final-mark">* </span>';

    const tr = document.createElement('tr');
    
    let cellsHtml = `<td class="cell-state-label"><span class="state-badge">${mark}${st}</span></td>`;
    
    alphabet.forEach(sym => {
      const key = `${st},${sym}`;
      const existingDests = state.transitions[key] || [];
      const val = existingDests.join(', ');
      cellsHtml += `<td>
        <input type="text" 
               class="matrix-cell-input" 
               data-state="${st}" 
               data-sym="${sym}" 
               value="${val}" 
               placeholder="-"
               autocomplete="off">
      </td>`;
    });

    tr.innerHTML = cellsHtml;
    elements.matrixBody.appendChild(tr);
  });

  document.querySelectorAll('.matrix-cell-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const st = e.target.getAttribute('data-state');
      const sym = e.target.getAttribute('data-sym');
      const destinations = parseList(e.target.value);
      const key = `${st},${sym}`;
      if (destinations.length > 0) {
        state.transitions[key] = destinations;
      } else {
        delete state.transitions[key];
      }
      updateChipsUI();
    });
  });

  updateChipsUI();
}

function updateChipsUI() {
  elements.transitionsChips.innerHTML = '';
  const alphabet = parseList(elements.inputAlphabet.value);
  const statesList = parseList(elements.inputStates.value);

  // Filter entries to only valid alphabet and states
  const validEntries = Object.entries(state.transitions).filter(([key]) => {
    const [st, sym] = key.split(',');
    return alphabet.includes(sym) && statesList.includes(st);
  });

  if (validEntries.length === 0) {
    elements.transitionsChips.innerHTML = '<span class="text-dim text-sm">Sin transiciones configuradas. Escriba los destinos en las celdas de la matriz.</span>';
    return;
  }

  validEntries.forEach(([key, dests]) => {
    const [st, sym] = key.split(',');
    const chip = document.createElement('div');
    chip.className = 'trans-chip';
    chip.innerHTML = `
      <span>&delta;(<strong>${st}</strong>, ${sym}) &rarr; {${dests.join(', ')}}</span>
      <span class="delete-chip" title="Eliminar">&times;</span>
    `;
    chip.querySelector('.delete-chip').addEventListener('click', () => {
      delete state.transitions[key];
      updateMatrixUI();
    });
    elements.transitionsChips.appendChild(chip);
  });
}

// Read Current AFN from Form with Strict Filtering
function getAFNFromUI() {
  syncMatrixDOMToState();

  const alphabet = parseList(elements.inputAlphabet.value);
  const statesList = parseList(elements.inputStates.value);
  const initial = elements.inputInitial.value.trim();
  const finals = parseList(elements.inputFinals.value);

  if (alphabet.length === 0) throw new Error("Debe especificar al menos un símbolo en el alfabeto.");
  if (statesList.length === 0) throw new Error("Debe especificar al menos un estado.");
  if (!initial) throw new Error("Debe especificar el estado inicial.");
  if (finals.length === 0) throw new Error("Debe especificar al menos un estado final/aceptación.");

  // Build clean transitions map strictly matching current alphabet & states
  const cleanTransitions = {};
  statesList.forEach(st => {
    alphabet.forEach(sym => {
      const key = `${st},${sym}`;
      if (state.transitions[key] && state.transitions[key].length > 0) {
        // filter destinations to valid states
        const validDests = state.transitions[key].filter(d => statesList.includes(d));
        if (validDests.length > 0) {
          cleanTransitions[key] = validDests;
        }
      }
    });
  });

  return {
    alphabet,
    states: statesList,
    initial,
    finals,
    transitions: cleanTransitions
  };
}

// Subset Construction Algorithm (AFN -> AFD)
function convertAFNtoAFD(afn) {
  const trace = [];
  const initialSubset = [afn.initial];
  const initialName = formatSubset(initialSubset);

  const queue = [initialSubset];
  const visitedSubsets = [initialSubset];
  const subsetToName = new Map();
  subsetToName.set(initialSubset.slice().sort().join(','), initialName);

  const afdTransitions = {};
  const afdStates = [initialName];
  const afdFinals = [];

  function findVisited(subset) {
    const key = subset.slice().sort().join(',');
    return subsetToName.get(key);
  }

  while (queue.length > 0) {
    const currentSubset = queue.shift();
    const currentName = findVisited(currentSubset);
    
    const isFinal = currentSubset.some(s => afn.finals.includes(s));
    if (isFinal && !afdFinals.includes(currentName)) {
      afdFinals.push(currentName);
    }

    const stepInfo = {
      stateName: currentName,
      subset: currentSubset,
      isFinal: isFinal,
      isInitial: (currentName === initialName),
      moves: []
    };

    afn.alphabet.forEach(sym => {
      const destSet = new Set();
      currentSubset.forEach(st => {
        const key = `${st},${sym}`;
        const targets = afn.transitions[key] || [];
        targets.forEach(t => destSet.add(t));
      });

      const destArray = Array.from(destSet).sort();
      const destName = formatSubset(destArray);
      afdTransitions[`${currentName},${sym}`] = destName;

      let isNew = false;
      const key = destArray.join(',');
      if (!subsetToName.has(key)) {
        subsetToName.set(key, destName);
        visitedSubsets.push(destArray);
        queue.push(destArray);
        if (!afdStates.includes(destName)) {
          afdStates.push(destName);
        }
        isNew = true;
      }

      stepInfo.moves.push({
        symbol: sym,
        destinations: destArray,
        destName: destName,
        isNew: isNew
      });
    });

    trace.push(stepInfo);
  }

  if (afdStates.includes('Ø') && !afdFinals.includes('Ø') && afn.finals.includes('Ø')) {
    afdFinals.push('Ø');
  }

  return {
    alphabet: afn.alphabet,
    states: afdStates,
    initial: initialName,
    finals: afdFinals,
    transitions: afdTransitions,
    trace: trace
  };
}

// Render AFD Transition Table
function renderAFDTable(afd) {
  elements.afdTableHeader.innerHTML = '<th>Estado AFD</th>' + 
    afd.alphabet.map(sym => `<th>${sym}</th>`).join('');

  elements.afdTableBody.innerHTML = '';
  afd.states.forEach(st => {
    const isInit = (st === afd.initial);
    const isFin = afd.finals.includes(st);
    
    let tagClass = 'afd-state-tag';
    if (isInit) tagClass += ' is-initial';
    if (isFin) tagClass += ' is-final';
    if (st === 'Ø') tagClass = 'trap-tag';

    let mark = '';
    if (isInit) mark += '<span class="initial-mark">➔ </span>';
    if (isFin) mark += '<span class="final-mark">* </span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="${tagClass}">${mark}${st}</span></td>` + 
      afd.alphabet.map(sym => {
        const dest = afd.transitions[`${st},${sym}`] || 'Ø';
        const isDestTrap = (dest === 'Ø');
        const isDestFin = afd.finals.includes(dest);
        const isDestInit = (dest === afd.initial);
        let destClass = isDestTrap ? 'trap-tag' : 'afd-state-tag';
        if (isDestFin) destClass += ' is-final';
        if (isDestInit) destClass += ' is-initial';
        return `<td><span class="${destClass}">${dest}</span></td>`;
      }).join('');
    elements.afdTableBody.appendChild(tr);
  });

  // Render Formal Definition
  elements.formalDefContent.innerHTML = `
    <div class="formal-item">
      <strong>Estados (Q')</strong>
      <span>{ ${afd.states.join(', ')} }</span>
    </div>
    <div class="formal-item">
      <strong>Alfabeto (&Sigma;)</strong>
      <span>{ ${afd.alphabet.join(', ')} }</span>
    </div>
    <div class="formal-item">
      <strong>Estado Inicial (q'<sub>0</sub>)</strong>
      <span>${afd.initial}</span>
    </div>
    <div class="formal-item">
      <strong>Estados Finales (F')</strong>
      <span>{ ${afd.finals.join(', ') || '&empty;'} }</span>
    </div>
  `;
}

// Render Step-by-Step Trace
function renderTrace(trace) {
  elements.traceStepsContainer.innerHTML = '';
  trace.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'trace-step-card';
    
    let stateTags = '';
    if (step.isInitial) stateTags += '<span class="legend-badge initial-badge">Inicial</span> ';
    if (step.isFinal) stateTags += '<span class="legend-badge final-badge">Aceptación</span> ';

    card.innerHTML = `
      <div class="trace-step-header">
        <div>
          <span class="step-num-badge">Paso ${idx + 1}</span>
          <span class="trace-state-name" style="margin-left: 0.5rem;">${step.stateName}</span>
        </div>
        <div>${stateTags}</div>
      </div>
      <div class="trace-sub-moves">
        ${step.moves.map(m => `
          <div class="move-row">
            <span class="move-symbol">&delta;'(${step.stateName}, ${m.symbol})</span>
            <span class="move-arrow">&rarr;</span>
            <span class="move-dest">${m.destName}</span>
            ${m.isNew ? '<span class="new-state-tag"><i data-lucide="sparkles" style="width:12px;height:12px;display:inline;"></i> Nuevo Estado</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;
    elements.traceStepsContainer.appendChild(card);
  });
  refreshIcons();
}

// Visual Graph Renderer with Strict Alphabet Filtering & Perfect Self-Loops
function renderGraph(isAfdView = true) {
  if (!window.vis) return;

  const nodes = [];
  const edges = [];
  const edgeMap = new Map();

  if (isAfdView && state.afdResult) {
    const afd = state.afdResult;
    
    afd.states.forEach(st => {
      const isInit = (st === afd.initial);
      const isFin = afd.finals.includes(st);
      const isTrap = (st === 'Ø');

      let color = {
        background: '#1a1b3a',
        border: '#6366f1',
        highlight: { background: '#2e2b68', border: '#38bdf8' }
      };

      if (isTrap) {
        color = {
          background: '#231118',
          border: '#f43f5e',
          highlight: { background: '#3b1219', border: '#fb7185' }
        };
      } else if (isFin) {
        color = {
          background: '#064e3b',
          border: '#10b981',
          highlight: { background: '#065f46', border: '#34d399' }
        };
      }

      nodes.push({
        id: st,
        label: isInit ? `➔ ${st}` : st,
        shape: isFin ? 'dot' : 'box',
        size: isFin ? 34 : undefined,
        margin: 14,
        color: color,
        fixed: false,
        font: { color: '#ffffff', face: 'JetBrains Mono', size: 15, bold: true },
        borderWidth: isFin ? 4 : 2,
        shadow: { enabled: true, color: color.border, size: 8 }
      });
    });

    afd.states.forEach(st => {
      afd.alphabet.forEach(sym => {
        const dest = afd.transitions[`${st},${sym}`];
        if (dest) {
          const key = `${st}->${dest}`;
          if (!edgeMap.has(key)) {
            edgeMap.set(key, { from: st, to: dest, symbols: [] });
          }
          edgeMap.get(key).symbols.push(sym);
        }
      });
    });

  } else {
    // AFN View - STRICTLY iterate only over current alphabet & states!
    const afn = getAFNFromUI();
    
    afn.states.forEach(st => {
      const isInit = (st === afn.initial);
      const isFin = afn.finals.includes(st);

      let color = {
        background: '#162238',
        border: '#38bdf8',
        highlight: { background: '#1e293b', border: '#60a5fa' }
      };

      if (isFin) {
        color = {
          background: '#064e3b',
          border: '#10b981',
          highlight: { background: '#065f46', border: '#34d399' }
        };
      }

      nodes.push({
        id: st,
        label: isInit ? `➔ ${st}` : st,
        shape: isFin ? 'dot' : 'circle',
        size: isFin ? 32 : 28,
        margin: 12,
        color: color,
        fixed: false,
        font: { color: '#ffffff', face: 'JetBrains Mono', size: 15, bold: true },
        borderWidth: isFin ? 4 : 2,
        shadow: { enabled: true, color: color.border, size: 6 }
      });
    });

    // ONLY loop through current states and current alphabet!
    afn.states.forEach(st => {
      afn.alphabet.forEach(sym => {
        const key = `${st},${sym}`;
        const dests = (afn.transitions[key] || []).filter(d => afn.states.includes(d));
        dests.forEach(dest => {
          const edgeKey = `${st}->${dest}`;
          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, { from: st, to: dest, symbols: [] });
          }
          if (!edgeMap.get(edgeKey).symbols.includes(sym)) {
            edgeMap.get(edgeKey).symbols.push(sym);
          }
        });
      });
    });
  }

  // Build Edge Objects
  edgeMap.forEach(item => {
    const isSelf = (item.from === item.to);
    const edgeId = `${item.from}->${item.to}`;

    if (isSelf) {
      edges.push({
        id: edgeId,
        from: item.from,
        to: item.to,
        label: ` ${item.symbols.join(', ')} `,
        selfReference: {
          size: 42,
          angle: Math.PI / 4,
          renderBehindTheNode: false
        },
        arrows: {
          to: { enabled: true, scaleFactor: 1.2 }
        },
        font: {
          color: '#fef08a',
          face: 'JetBrains Mono',
          size: 16,
          bold: true,
          strokeWidth: 2,
          strokeColor: '#000000',
          background: '#0b1329',
          align: 'horizontal',
          vadjust: -6
        },
        color: {
          color: '#818cf8',
          highlight: '#facc15',
          hover: '#38bdf8'
        },
        width: 2.5
      });
    } else {
      edges.push({
        id: edgeId,
        from: item.from,
        to: item.to,
        label: ` ${item.symbols.join(', ')} `,
        arrows: {
          to: { enabled: true, scaleFactor: 1.2 }
        },
        font: {
          color: '#fef08a',
          face: 'JetBrains Mono',
          size: 16,
          bold: true,
          strokeWidth: 2,
          strokeColor: '#000000',
          background: '#0b1329',
          align: 'middle'
        },
        color: {
          color: '#818cf8',
          highlight: '#facc15',
          hover: '#38bdf8'
        },
        smooth: { type: 'curvedCW', roundness: 0.22 },
        width: 2.5
      });
    }
  });

  state.visData = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };

  const options = {
    physics: {
      enabled: state.physicsEnabled,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -280,
        centralGravity: 0.003,
        springLength: 260,
        springConstant: 0.03,
        damping: 0.5,
        avoidOverlap: 1
      },
      stabilization: {
        enabled: true,
        iterations: 120,
        updateInterval: 25
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 120,
      zoomView: true,
      dragView: true,
      dragNodes: true,
      selectConnectedEdges: true
    }
  };

  if (state.visNetwork) {
    state.visNetwork.setData(state.visData);
    state.visNetwork.setOptions(options);
  } else {
    state.visNetwork = new vis.Network(elements.networkContainer, state.visData, options);
  }
}

// Toggle Physics function
function togglePhysics() {
  state.physicsEnabled = !state.physicsEnabled;
  const btn = elements.btnPhysicsGraph;
  const statusText = elements.physicsStatusText;

  if (state.physicsEnabled) {
    btn.className = 'btn-physics-toggle physics-on';
    statusText.textContent = 'Física: Activa';
  } else {
    btn.className = 'btn-physics-toggle physics-off';
    statusText.textContent = 'Física: Libre (Arrastre Libre)';
  }

  if (state.visNetwork) {
    if (state.visData && state.visData.nodes) {
      const currentNodes = state.visData.nodes.get();
      currentNodes.forEach(n => {
        state.visData.nodes.update({ id: n.id, fixed: false });
      });
    }
    state.visNetwork.setOptions({ physics: { enabled: state.physicsEnabled } });
  }
}

// Convert Action Handler
function handleConvert() {
  try {
    const afn = getAFNFromUI();
    const afd = convertAFNtoAFD(afn);
    state.afdResult = afd;

    renderAFDTable(afd);
    renderTrace(afd.trace);
    renderGraph(state.activeGraphView === 'afd');
    initSimulator();

    const btn = elements.btnConvert;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check"></i> ¡Conversión Exitosa!';
    refreshIcons();
    setTimeout(() => {
      btn.innerHTML = originalText;
      refreshIcons();
    }, 1800);

  } catch (err) {
    alert("Error en los datos del AFN: " + err.message);
  }
}

// String Simulator Logic
function initSimulator() {
  const afd = state.afdResult;
  if (!afd) return;

  state.sim.string = elements.simInputString.value.trim();
  state.sim.currentIndex = 0;
  state.sim.currentState = afd.initial;
  state.sim.history = [];
  state.sim.isFinished = false;
  if (state.sim.timer) clearInterval(state.sim.timer);

  renderSimulatorTape();
  updateSimulatorBanner();
  elements.simLogList.innerHTML = `<div class="sim-log-item muted">Estado inicial configurado en: <strong>${afd.initial}</strong></div>`;
  highlightGraphNodeAndEdge(afd.initial, null);
}

function renderSimulatorTape() {
  elements.simTapeCells.innerHTML = '';
  const str = state.sim.string;
  if (str.length === 0) {
    elements.simTapeCells.innerHTML = '<div class="tape-cell active">&epsilon;</div>';
    return;
  }
  for (let i = 0; i < str.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'tape-cell';
    if (i === state.sim.currentIndex && !state.sim.isFinished) {
      cell.classList.add('active');
    } else if (i < state.sim.currentIndex) {
      cell.classList.add('processed');
    }
    cell.textContent = str[i];
    elements.simTapeCells.appendChild(cell);
  }
}

function updateSimulatorBanner() {
  elements.simCurrentStateVal.textContent = state.sim.currentState || '-';
  const badge = elements.simVerdictBadge;
  badge.className = 'sim-verdict-badge';

  if (!state.sim.isFinished) {
    badge.textContent = `Procesando símbolo ${state.sim.currentIndex + 1} de ${state.sim.string.length}...`;
  } else {
    const isAccepted = state.afdResult.finals.includes(state.sim.currentState);
    if (isAccepted) {
      badge.textContent = '✅ Cadena ACEPTADA';
      badge.classList.add('accepted');
    } else {
      badge.textContent = '❌ Cadena RECHAZADA';
      badge.classList.add('rejected');
    }
  }
}

function stepSimulator() {
  const afd = state.afdResult;
  if (!afd) return;

  if (state.sim.isFinished) {
    initSimulator();
    return;
  }

  const str = state.sim.string;
  if (state.sim.currentIndex >= str.length) {
    state.sim.isFinished = true;
    renderSimulatorTape();
    updateSimulatorBanner();
    highlightGraphNodeAndEdge(state.sim.currentState, null);
    return;
  }

  const sym = str[state.sim.currentIndex];
  const prevState = state.sim.currentState;
  const nextState = afd.transitions[`${prevState},${sym}`] || 'Ø';

  state.sim.currentState = nextState;
  state.sim.currentIndex++;

  const logItem = document.createElement('div');
  logItem.className = 'sim-log-item';
  logItem.innerHTML = `<span>&delta;'(<strong>${prevState}</strong>, '<span style="color:#facc15;font-weight:bold;">${sym}</span>') &rarr; <strong>${nextState}</strong></span>`;
  elements.simLogList.appendChild(logItem);
  elements.simLogList.scrollTop = elements.simLogList.scrollHeight;

  if (state.sim.currentIndex >= str.length) {
    state.sim.isFinished = true;
  }

  renderSimulatorTape();
  updateSimulatorBanner();
  highlightGraphNodeAndEdge(nextState, `${prevState}->${nextState}`);
}

function runSimulatorFull() {
  initSimulator();
  const str = state.sim.string;
  while (!state.sim.isFinished) {
    stepSimulator();
  }
}

function highlightGraphNodeAndEdge(nodeId, activeEdgeId) {
  if (!state.visData || !state.visData.nodes) return;
  try {
    const nodes = state.visData.nodes.get();
    nodes.forEach(n => {
      if (n.id === nodeId) {
        state.visData.nodes.update({
          id: n.id,
          color: { background: '#f59e0b', border: '#fbbf24' },
          font: { color: '#ffffff', face: 'JetBrains Mono', size: 16, bold: true },
          shadow: { enabled: true, color: '#f59e0b', size: 16 }
        });
      } else {
        const isTrap = (n.id === 'Ø');
        const isFin = state.afdResult ? state.afdResult.finals.includes(n.id) : false;
        let bg = isTrap ? '#231118' : (isFin ? '#064e3b' : '#1a1b3a');
        let border = isTrap ? '#f43f5e' : (isFin ? '#10b981' : '#6366f1');
        state.visData.nodes.update({
          id: n.id,
          color: { background: bg, border: border },
          font: { color: '#ffffff', face: 'JetBrains Mono', size: 15, bold: true },
          shadow: { enabled: true, color: border, size: 8 }
        });
      }
    });

    if (state.visData.edges) {
      const edges = state.visData.edges.get();
      edges.forEach(e => {
        const isSelf = (e.from === e.to);
        if (activeEdgeId && e.id === activeEdgeId) {
          state.visData.edges.update({
            id: e.id,
            color: { color: '#f59e0b', highlight: '#facc15' },
            width: 4.5,
            font: {
              color: '#ffffff',
              background: '#b45309',
              size: 17,
              bold: true,
              align: isSelf ? 'horizontal' : 'middle'
            }
          });
        } else {
          state.visData.edges.update({
            id: e.id,
            color: { color: '#818cf8', highlight: '#facc15' },
            width: 2.5,
            font: {
              color: '#fef08a',
              background: '#0b1329',
              size: 16,
              bold: true,
              align: isSelf ? 'horizontal' : 'middle'
            }
          });
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
}

// Clean and Reset all Form Fields
function clearAll() {
  elements.inputAlphabet.value = 'a, b';
  elements.inputStates.value = 'q0, q1, q2';
  elements.inputInitial.value = 'q0';
  elements.inputFinals.value = 'q2';
  state.transitions = {};
  updateMatrixUI();
  handleConvert();
}

// Copy Table
function copyAFDTable() {
  if (!state.afdResult) return;
  const afd = state.afdResult;
  let text = 'Estado AFD\t| ' + afd.alphabet.join('\t| ') + '\n';
  text += '-'.repeat(40) + '\n';
  afd.states.forEach(st => {
    let mark = '';
    if (st === afd.initial) mark += '->';
    if (afd.finals.includes(st)) mark += '*';
    text += `${mark}${st}\t| ` + afd.alphabet.map(sym => afd.transitions[`${st},${sym}`] || 'Ø').join('\t| ') + '\n';
  });
  navigator.clipboard.writeText(text).then(() => {
    alert('¡Tabla del AFD copiada al portapapeles!');
  });
}

// Event Listeners Registration
function registerEventListeners() {
  ['inputAlphabet', 'inputStates', 'inputInitial', 'inputFinals'].forEach(id => {
    elements[id].addEventListener('input', updateMatrixUI);
  });

  elements.btnModeMatrix.addEventListener('click', () => {
    elements.btnModeMatrix.classList.add('active');
    elements.btnModeList.classList.remove('active');
    elements.matrixContainer.classList.remove('hidden');
    elements.listContainer.classList.add('hidden');
  });

  elements.btnModeList.addEventListener('click', () => {
    elements.btnModeList.classList.add('active');
    elements.btnModeMatrix.classList.remove('active');
    elements.matrixContainer.classList.add('hidden');
    elements.listContainer.classList.remove('hidden');
  });

  elements.btnAddTransition.addEventListener('click', () => {
    const o = elements.quickOrigin.value.trim();
    const s = elements.quickSymbol.value.trim();
    const d = parseList(elements.quickDestinations.value);
    if (!o || !s || d.length === 0) {
      alert("Ingrese origen, símbolo y al menos un destino.");
      return;
    }
    state.transitions[`${o},${s}`] = d;
    elements.quickOrigin.value = '';
    elements.quickSymbol.value = '';
    elements.quickDestinations.value = '';
    updateMatrixUI();
  });

  elements.btnConvert.addEventListener('click', handleConvert);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.getAttribute('data-tab'));
      if (target) target.classList.add('active');
      if (btn.getAttribute('data-tab') === 'tab-graphs' && state.visNetwork) {
        state.visNetwork.fit();
      }
    });
  });

  elements.btnShowAfdGraph.addEventListener('click', () => {
    elements.btnShowAfdGraph.classList.add('active');
    elements.btnShowAfnGraph.classList.remove('active');
    state.activeGraphView = 'afd';
    renderGraph(true);
  });

  elements.btnShowAfnGraph.addEventListener('click', () => {
    elements.btnShowAfnGraph.classList.add('active');
    elements.btnShowAfdGraph.classList.remove('active');
    state.activeGraphView = 'afn';
    renderGraph(false);
  });

  elements.btnFitGraph.addEventListener('click', () => {
    if (state.visNetwork) state.visNetwork.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  });

  elements.btnZoomIn.addEventListener('click', () => {
    if (!state.visNetwork) return;
    const scale = state.visNetwork.getScale();
    state.visNetwork.moveTo({ scale: scale * 1.25, animation: { duration: 200 } });
  });

  elements.btnZoomOut.addEventListener('click', () => {
    if (!state.visNetwork) return;
    const scale = state.visNetwork.getScale();
    state.visNetwork.moveTo({ scale: scale * 0.8, animation: { duration: 200 } });
  });

  elements.btnPhysicsGraph.addEventListener('click', togglePhysics);

  elements.btnDownloadGraph.addEventListener('click', () => {
    if (!state.visNetwork) return;
    const canvas = elements.networkContainer.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `automata_${state.activeGraphView}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  elements.btnSimRun.addEventListener('click', runSimulatorFull);
  elements.btnSimStep.addEventListener('click', stepSimulator);
  elements.btnSimReset.addEventListener('click', initSimulator);
  elements.simInputString.addEventListener('input', initSimulator);

  elements.btnCopyAfdTable.addEventListener('click', copyAFDTable);
  elements.btnClearAll.addEventListener('click', clearAll);
}

window.addEventListener('DOMContentLoaded', () => {
  refreshIcons();
  registerEventListeners();
  updateMatrixUI();
  handleConvert();
});
