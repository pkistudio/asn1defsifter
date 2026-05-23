import './styles.css';
import { createPkiCandidateReport, type Candidate, type CandidateReport, type CandidateReportRoot, type CandidateReportSubtree } from './core/index.js';

type ViewerRoot = DocumentFragment | Element;

export type AppTheme = 'light' | 'dark';

export type Asn1DefinitionSifterAppOptions = {
  mount?: string | Element;
  theme?: AppTheme;
};

export type Asn1DefinitionSifterAppInstance = {
  readonly report: CandidateReport | null;
  readonly sourceName: string | null;
  loadBytes: (bytes: Uint8Array, sourceName?: string) => Promise<void>;
  loadHex: (hex: string, sourceName?: string) => Promise<void>;
  close: () => void;
};

type LogLevel = 'info' | 'warning' | 'error';

type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  detail?: string;
  timestamp: Date;
};

type CandidateSelection = {
  candidate: Candidate;
  context: string;
};

const MAX_LOG_ENTRIES = 200;
const DEFAULT_HEX_SOURCE = 'clipboard.hex';

declare global {
  interface Window {
    Asn1DefinitionSifter?: {
      init: typeof initAsn1DefinitionSifter;
    };
  }
}

export function initAsn1DefinitionSifter(options: Asn1DefinitionSifterAppOptions = {}): Asn1DefinitionSifterAppInstance {
  const app = resolveMount(options.mount ?? '#app');
  const state: { report: CandidateReport | null; sourceName: string | null; bytes: Uint8Array | null; logs: LogEntry[] } = {
    report: null,
    sourceName: null,
    bytes: null,
    logs: []
  };

  app.innerHTML = `
    <main class="ads-shell" data-theme="${options.theme ?? 'light'}">
      <section class="ads-workspace" aria-label="ASN.1 Definition Sifter workspace">
        <section class="ads-pane ads-input-pane" aria-label="Input bytes">
          <nav class="ads-pane-menu" aria-label="Input actions">
            <strong>Input</strong>
            <div class="ads-menu-group">
              <button id="adsLoadButton" type="button" aria-haspopup="menu" aria-expanded="false">Load</button>
              <div id="adsLoadMenu" class="ads-submenu" role="menu" hidden>
                <button id="adsLoadFileButton" type="button" role="menuitem">from File</button>
                <button id="adsLoadClipboardHexButton" type="button" role="menuitem">from Clipboard as HEX</button>
              </div>
            </div>
            <input id="adsFileInput" class="ads-hidden-input" type="file" accept=".ber,.cer,.crt,.der,.hex,.pem,application/octet-stream,application/pkix-cert" />
          </nav>
          <div id="adsHexView" class="ads-pane-content ads-hex-view" aria-label="Loaded DER bytes">No DER input loaded.</div>
          <div id="adsInputNotice" class="ads-notice" role="status">Load a DER file or paste hexadecimal DER from the clipboard.</div>
        </section>
        <section class="ads-pane ads-candidate-pane" aria-label="Candidate results">
          <header class="ads-pane-menu">
            <strong>Candidates</strong>
            <button id="adsClearButton" type="button">Clear</button>
          </header>
          <div class="ads-candidate-split">
            <div id="adsCandidateTree" class="ads-pane-content ads-tree" aria-label="Candidate tree">No candidate report yet.</div>
            <section class="ads-selected-pane" aria-label="Selected candidate details">
              <header class="ads-selected-header">
                <strong>Selected Candidate</strong>
                <span id="adsSelectedCandidateSummary">None</span>
              </header>
              <div id="adsCandidateDetail" class="ads-selected-detail">Select a candidate to inspect evidence, diagnostics, ambiguities, and matched paths.</div>
            </section>
          </div>
          <div id="adsCandidateNotice" class="ads-notice" role="status">Candidate results will appear after input is loaded.</div>
        </section>
      </section>
      <section class="ads-log-pane" aria-label="API log">
        <header class="ads-log-menu">
          <strong>API Log</strong>
          <button id="adsClearLogButton" type="button">Clear</button>
        </header>
        <div id="adsApiLog" class="ads-api-log" aria-live="polite"></div>
      </section>
    </main>
  `;

  const loadButton = getElement<HTMLButtonElement>(app, '#adsLoadButton');
  const loadMenu = getElement<HTMLElement>(app, '#adsLoadMenu');
  const loadFileButton = getElement<HTMLButtonElement>(app, '#adsLoadFileButton');
  const loadClipboardHexButton = getElement<HTMLButtonElement>(app, '#adsLoadClipboardHexButton');
  const fileInput = getElement<HTMLInputElement>(app, '#adsFileInput');
  const clearButton = getElement<HTMLButtonElement>(app, '#adsClearButton');
  const clearLogButton = getElement<HTMLButtonElement>(app, '#adsClearLogButton');
  const hexView = getElement<HTMLElement>(app, '#adsHexView');
  const inputNotice = getElement<HTMLElement>(app, '#adsInputNotice');
  const candidateTree = getElement<HTMLElement>(app, '#adsCandidateTree');
  const selectedCandidateSummary = getElement<HTMLElement>(app, '#adsSelectedCandidateSummary');
  const candidateDetail = getElement<HTMLElement>(app, '#adsCandidateDetail');
  const candidateNotice = getElement<HTMLElement>(app, '#adsCandidateNotice');
  const apiLog = getElement<HTMLElement>(app, '#adsApiLog');

  const addLog = (level: LogLevel, message: string, detail?: string): void => {
    state.logs = [{ id: createId(), level, message, detail, timestamp: new Date() }, ...state.logs].slice(0, MAX_LOG_ENTRIES);
    renderLogs(apiLog, state.logs);
  };

  const setInputNotice = (message: string): void => {
    inputNotice.textContent = message;
  };

  const setCandidateNotice = (message: string): void => {
    candidateNotice.textContent = message;
  };

  const loadBytes = async (bytes: Uint8Array, sourceName = 'input.der'): Promise<void> => {
    const startedAt = performance.now();
    state.bytes = bytes;
    state.sourceName = sourceName;
    hexView.textContent = formatHexDump(bytes);
    setInputNotice(`Loaded ${sourceName} (${bytes.byteLength} bytes).`);
    addLog('info', 'loadBytes', `${sourceName}: ${bytes.byteLength} bytes`);
    try {
      const report = await createPkiCandidateReport(bytes, {
        includeSubtrees: true,
        maxSubtreeDepth: 4,
        maxSubtreeReports: 50,
        maxResults: 8
      });
      state.report = report;
      renderCandidateTree(candidateTree, report, (selection, selectedElement) => {
        renderSelectedCandidate(candidateDetail, selectedCandidateSummary, selection);
        markSelectedTreeItem(candidateTree, selectedElement);
      });
      const rootCount = report.roots.length;
      const candidateCount = report.roots.reduce((sum, root) => sum + root.candidates.length, 0);
      const subtreeCount = report.roots.reduce((sum, root) => sum + (root.subtrees?.length ?? 0), 0);
      setCandidateNotice(`Resolved ${candidateCount} root candidate(s) across ${rootCount} root node(s); ${subtreeCount} subtree report(s).`);
      addLog('info', 'createPkiCandidateReport', `Completed in ${formatDuration(startedAt)} with ${candidateCount} root candidate(s).`);
    } catch (error) {
      state.report = null;
      candidateTree.textContent = 'No candidate report available.';
      renderSelectedCandidate(candidateDetail, selectedCandidateSummary);
      const message = getErrorMessage(error);
      setCandidateNotice(message);
      addLog('error', 'createPkiCandidateReport failed', message);
    }
  };

  const loadHex = async (hex: string, sourceName = DEFAULT_HEX_SOURCE): Promise<void> => {
    const bytes = hexToBytes(hex);
    await loadBytes(bytes, sourceName);
  };

  const clear = (): void => {
    state.report = null;
    state.sourceName = null;
    state.bytes = null;
    hexView.textContent = 'No DER input loaded.';
    candidateTree.textContent = 'No candidate report yet.';
    renderSelectedCandidate(candidateDetail, selectedCandidateSummary);
    setInputNotice('Load a DER file or paste hexadecimal DER from the clipboard.');
    setCandidateNotice('Candidate results will appear after input is loaded.');
    addLog('info', 'clear', 'Cleared input and candidate report.');
  };

  const close = (): void => {
    app.innerHTML = '';
  };

  loadButton.addEventListener('click', () => {
    const expanded = loadButton.getAttribute('aria-expanded') === 'true';
    loadButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    loadMenu.hidden = expanded;
  });

  loadFileButton.addEventListener('click', () => {
    loadMenu.hidden = true;
    loadButton.setAttribute('aria-expanded', 'false');
    fileInput.click();
  });

  loadClipboardHexButton.addEventListener('click', async () => {
    loadMenu.hidden = true;
    loadButton.setAttribute('aria-expanded', 'false');
    try {
      const text = await navigator.clipboard.readText();
      await loadHex(text, DEFAULT_HEX_SOURCE);
    } catch (error) {
      const message = getErrorMessage(error);
      setInputNotice(message);
      addLog('error', 'from Clipboard as HEX failed', message);
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await loadBytes(bytes, file.name);
    } catch (error) {
      const message = getErrorMessage(error);
      setInputNotice(message);
      addLog('error', 'from File failed', message);
    }
  });

  clearButton.addEventListener('click', clear);
  clearLogButton.addEventListener('click', () => {
    state.logs = [];
    renderLogs(apiLog, state.logs);
  });
  document.addEventListener('click', (event) => {
    if (!app.contains(event.target as Node)) return;
    if (event.target === loadButton || loadMenu.contains(event.target as Node)) return;
    loadMenu.hidden = true;
    loadButton.setAttribute('aria-expanded', 'false');
  });

  addLog('info', 'initAsn1DefinitionSifter', 'Viewer initialized.');

  return {
    get report() {
      return state.report;
    },
    get sourceName() {
      return state.sourceName;
    },
    loadBytes,
    loadHex,
    close
  };
}

if (typeof window !== 'undefined') {
  window.Asn1DefinitionSifter = { init: initAsn1DefinitionSifter };
}

function renderCandidateTree(container: HTMLElement, report: CandidateReport, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): void {
  container.innerHTML = '';
  if (report.roots.length === 0) {
    container.textContent = 'No root TLV nodes were parsed.';
    return;
  }
  let firstSelection: { selection: CandidateSelection; selectedElement: HTMLElement } | undefined;
  for (const root of report.roots) {
    const subtrees = sortSubtreesByBestScore(root.subtrees ?? []);
    for (const candidate of sortCandidatesByScore(root.candidates)) {
      const candidateNode = createRootCandidateNode(candidate, root, subtrees, selectCandidate);
      firstSelection ??= { selection: { candidate, context: `Root ${root.index}` }, selectedElement: getTreeSummary(candidateNode) };
      container.append(candidateNode);
    }
    if (root.candidates.length === 0) container.append(createEmptyRootNode(root, subtrees, selectCandidate));
  }
  if (firstSelection) selectCandidate(firstSelection.selection, firstSelection.selectedElement);
}

function createRootCandidateNode(candidate: Candidate, root: CandidateReportRoot, subtrees: CandidateReportSubtree[], selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'ads-tree-node ads-candidate-node';
  const summary = createSummary(formatCandidateName(candidate), `Root ${root.index} · ${formatScore(candidate.score)} · ${candidate.confidence}`);
  summary.addEventListener('click', () => selectCandidate({ candidate, context: `Root ${root.index}` }, summary));
  details.append(summary);
  if (subtrees.length > 0) {
    const list = document.createElement('div');
    list.className = 'ads-tree-children';
    for (const subtree of subtrees) list.append(createSubtreeNode(subtree, selectCandidate));
    details.append(list);
  }
  return details;
}

function createEmptyRootNode(root: CandidateReportRoot, subtrees: CandidateReportSubtree[], selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'ads-tree-node';
  details.open = true;
  details.append(createSummary(`Root ${root.index}`, 'No candidates'));
  if (subtrees.length > 0) {
    const list = document.createElement('div');
    list.className = 'ads-tree-children';
    for (const subtree of subtrees) list.append(createSubtreeNode(subtree, selectCandidate));
    details.append(list);
  }
  return details;
}

function createSubtreeNode(subtree: CandidateReportSubtree, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'ads-tree-node ads-subtree-node';
  const best = subtree.summary.bestCandidate;
  details.append(createSummary(`Subtree ${subtree.path}`, best ? `${formatCandidateName(best)} · ${formatScore(best.score)} · ${best.confidence}` : `${subtree.summary.candidateCount} candidate(s)`));
  const list = document.createElement('div');
  list.className = 'ads-tree-children';
  for (const candidate of sortCandidatesByScore(subtree.candidates)) list.append(createCandidateNode(candidate, `Subtree ${subtree.path}`, selectCandidate));
  details.append(list);
  return details;
}

function createCandidateNode(candidate: Candidate, context: string, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const item = document.createElement('button');
  item.className = 'ads-tree-item ads-candidate-item';
  item.type = 'button';
  item.append(createTreeLabel(formatCandidateName(candidate)), createTreeNote(`${formatScore(candidate.score)} · ${candidate.confidence}`));
  item.addEventListener('click', () => selectCandidate({ candidate, context }, item));
  return item;
}

function renderSelectedCandidate(container: HTMLElement, summary: HTMLElement, selection?: CandidateSelection): void {
  container.innerHTML = '';
  if (!selection) {
    summary.textContent = 'None';
    container.textContent = 'Select a candidate to inspect evidence, diagnostics, ambiguities, and matched paths.';
    return;
  }
  const { candidate, context } = selection;
  summary.textContent = `${context} · ${formatCandidateName(candidate)} · ${formatScore(candidate.score)} · ${candidate.confidence}`;
  container.append(createKeyValue('Evidence', candidate.evidence.slice(0, 8).join('\n') || 'No evidence.'));
  container.append(createKeyValue('Diagnostics', candidate.diagnostics.slice(0, 8).map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`).join('\n') || 'No diagnostics.'));
  container.append(createKeyValue('Ambiguities', candidate.ambiguities.slice(0, 8).join('\n') || 'No ambiguities.'));
  container.append(createKeyValue('Matched paths', candidate.matchedPaths.slice(0, 12).map((path) => `${path.nodePath} -> ${path.schemaPath}`).join('\n') || 'No matched paths.'));
}

function createSummary(label: string, note: string): HTMLElement {
  const summary = document.createElement('summary');
  summary.append(createTreeLabel(label), createTreeNote(note));
  return summary;
}

function createTreeLabel(label: string): HTMLElement {
  const labelElement = document.createElement('span');
  labelElement.className = 'ads-tree-label';
  labelElement.textContent = label;
  return labelElement;
}

function createTreeNote(note: string): HTMLElement {
  const noteElement = document.createElement('span');
  noteElement.className = 'ads-tree-note';
  noteElement.textContent = note;
  return noteElement;
}

function markSelectedTreeItem(container: HTMLElement, selectedElement: HTMLElement): void {
  for (const element of container.querySelectorAll('.ads-tree-selected')) element.classList.remove('ads-tree-selected');
  selectedElement.classList.add('ads-tree-selected');
}

function getTreeSummary(node: HTMLElement): HTMLElement {
  const summary = node.querySelector<HTMLElement>('summary');
  if (!summary) throw new Error('Candidate tree node is missing a summary.');
  return summary;
}

function createKeyValue(label: string, value: string): HTMLElement {
  const block = document.createElement('section');
  block.className = 'ads-key-value';
  const heading = document.createElement('h3');
  heading.textContent = label;
  const content = document.createElement('pre');
  content.textContent = value;
  block.append(heading, content);
  return block;
}

function renderLogs(container: HTMLElement, logs: LogEntry[]): void {
  container.innerHTML = '';
  if (logs.length === 0) {
    container.textContent = 'No API log entries.';
    return;
  }
  for (const log of logs) {
    const row = document.createElement('div');
    row.className = `ads-log-entry ads-log-${log.level}`;
    const timestamp = document.createElement('span');
    timestamp.textContent = log.timestamp.toLocaleTimeString();
    const message = document.createElement('strong');
    message.textContent = log.message;
    const detail = document.createElement('span');
    detail.textContent = log.detail ?? '';
    row.append(timestamp, message, detail);
    container.append(row);
  }
}

function formatHexDump(bytes: Uint8Array): string {
  if (bytes.length === 0) return '(empty input)';
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const address = offset.toString(16).padStart(8, '0');
    const hex = Array.from(chunk, (byte) => byte.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = Array.from(chunk, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join('');
    rows.push(`${address}  ${hex}  ${ascii}`);
  }
  return rows.join('\n');
}

function hexToBytes(text: string): Uint8Array {
  const normalized = text.replace(/(?:0x|[^0-9a-fA-F])/g, '');
  if (normalized.length === 0) throw new Error('Clipboard does not contain hexadecimal input.');
  if (normalized.length % 2 !== 0) throw new Error('Hexadecimal input must contain an even number of digits.');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function formatCandidateName(candidate: Pick<Candidate, 'typeName' | 'moduleName'>): string {
  return candidate.moduleName ? `${candidate.moduleName}.${candidate.typeName}` : candidate.typeName;
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function sortCandidatesByScore(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((left, right) => right.score - left.score || formatCandidateName(left).localeCompare(formatCandidateName(right)));
}

function sortSubtreesByBestScore(subtrees: CandidateReportSubtree[]): CandidateReportSubtree[] {
  return [...subtrees].sort((left, right) => getBestSubtreeScore(right) - getBestSubtreeScore(left) || left.path.localeCompare(right.path));
}

function getBestSubtreeScore(subtree: CandidateReportSubtree): number {
  return Math.max(...subtree.candidates.map((candidate) => candidate.score), 0);
}

function formatDuration(startedAt: number): string {
  return `${Math.round(performance.now() - startedAt)} ms`;
}

function getElement<T extends Element>(root: ViewerRoot, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing app element: ${selector}`);
  return element;
}

function resolveMount(mount: string | Element): Element {
  if (typeof mount !== 'string') return mount;
  const element = document.querySelector(mount);
  if (!element) throw new Error(`Mount element not found: ${mount}`);
  return element;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}