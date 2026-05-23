import './styles.css';
import PkiStudio from '@pkistudio/pkistudiojs/viewer';
import PkiStudioOidResolver from '@pkistudio/pkistudiojs/oid-resolver';
import { clampScore, confidenceFromScore, createPkiCandidateReport, type Candidate, type CandidateConfidence, type CandidateReport, type CandidateReportRoot, type CandidateReportSubtree, type TlvNode } from './core/index.js';

type ViewerRoot = DocumentFragment | Element;

export type AppTheme = 'light' | 'dark';

export type Asn1DefinitionSifterAppOptions = {
  mount?: string | Element;
  theme?: AppTheme;
  viewer?: {
    oidResolver?: PkiStudioOidResolverApi | ((oid: string) => string);
    newWindowUrl?: string;
  };
};

export type Asn1DefinitionSifterAppInstance = {
  readonly report: CandidateReport | null;
  readonly sourceName: string | null;
  loadBytes: (bytes: Uint8Array, sourceName?: string) => Promise<void>;
  loadHex: (hex: string, sourceName?: string) => Promise<void>;
  close: () => void;
};

type LogLevel = 'info' | 'success' | 'warning' | 'error';

type LogEntry = {
  level: LogLevel;
  label: string;
  detail?: string;
  timestamp: Date;
};

type PkiStudioViewerApi = {
  version?: string;
  init: (options: {
    mount: string | Element;
    oidResolver?: PkiStudioOidResolverApi | ((oid: string) => string);
    oidNames?: Record<string, string>;
    oidUrl?: string;
    newWindowUrl?: string;
    shadowRoot?: boolean;
    fullscreen?: boolean;
    editable?: boolean;
  }) => PkiStudioViewerInstance;
};

type PkiStudioViewerInstance = {
  close?: () => void;
  getNodeBytes?: (nodeId: string) => Uint8Array;
  loadBytes: (bytes: Uint8Array, notice?: string) => void;
  root?: DocumentFragment | Element;
  setEditable?: (editable: boolean) => void;
};

type PkiStudioOidResolverApi = {
  names: Record<string, string>;
  resolve: (oid: string) => string;
  create: (extraNames?: Record<string, string>) => PkiStudioOidResolverApi;
};

type CandidateSelection = {
  candidate?: Candidate;
  context: string;
  bytes?: Uint8Array;
  displayScore?: number;
  displayConfidence?: CandidateConfidence;
  hexOnly?: boolean;
  hexSummary?: string;
};

type TreeIconKind = 'branch' | 'leaf';

type SubtreeDisplayNode = {
  subtree: CandidateReportSubtree;
  children: SubtreeDisplayNode[];
};

const MAX_LOG_ENTRIES = 80;
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
  const state: { report: CandidateReport | null; sourceName: string | null; bytes: Uint8Array | null; logs: LogEntry[]; selectedRootCandidates: Map<number, string>; selectedSubtreeCandidates: Map<string, string> } = {
    report: null,
    sourceName: null,
    bytes: null,
    logs: [],
    selectedRootCandidates: new Map(),
    selectedSubtreeCandidates: new Map()
  };

  app.innerHTML = `
    <main class="ads-shell" data-theme="${options.theme ?? 'light'}">
      <nav class="ads-toolbar" aria-label="Application toolbar">
        <strong>ASN.1 Definition Sifter</strong>
        <button id="adsAboutButton" type="button">About</button>
      </nav>
      <section class="ads-workspace" aria-label="ASN.1 Definition Sifter workspace">
        <section class="ads-viewer-pane" aria-label="Read-only PkiStudioJS viewer">
          <div id="adsInputViewer" class="ads-input-viewer"></div>
        </section>
        <section class="ads-pane ads-candidate-pane" aria-label="Candidate results">
          <header class="ads-pane-menu">
            <strong>Candidates</strong>
          </header>
          <div class="ads-candidate-split">
            <div id="adsCandidateTree" class="ads-pane-content ads-tree" aria-label="Candidate tree">No candidate report yet.</div>
          </div>
          <div id="adsCandidateNotice" class="ads-notice" role="status">Candidate results will appear after input is loaded.</div>
        </section>
      </section>
      <section class="ads-selected-pane" aria-label="Selected candidate details">
        <header class="ads-selected-header">
          <strong>Selected Candidate</strong>
          <span id="adsSelectedCandidateSummary">None</span>
        </header>
        <div id="adsCandidateDetail" class="ads-selected-detail">Select a candidate to inspect evidence, diagnostics, ambiguities, matched paths, and bytes.</div>
      </section>
      <div id="adsApiLogResizer" class="ads-api-log-resizer" role="separator" aria-label="Resize API log" aria-orientation="horizontal" tabindex="0"></div>
      <section class="ads-log-pane" aria-label="API log">
        <header class="ads-log-menu">
          <button id="adsClearLogButton" type="button">Clear</button>
        </header>
        <ol id="adsApiLog" class="ads-api-log" aria-live="polite"></ol>
      </section>
      <dialog id="adsAboutDialog" class="ads-about-dialog">
        <section class="ads-about-panel">
          <div>
            <div class="ads-about-name">ASN.1 Definition Sifter</div>
            <div class="ads-about-module">@pkistudio/asn1defsifter</div>
          </div>
          <p>Rank ASN.1 definition candidates for DER and TLV fragments with explainable evidence.</p>
          <form method="dialog">
            <button id="adsCloseAboutButton" type="button">Close</button>
          </form>
        </section>
      </dialog>
    </main>
  `;

  const aboutButton = getElement<HTMLButtonElement>(app, '#adsAboutButton');
  const aboutDialog = getElement<HTMLDialogElement>(app, '#adsAboutDialog');
  const closeAboutButton = getElement<HTMLButtonElement>(app, '#adsCloseAboutButton');
  const clearLogButton = getElement<HTMLButtonElement>(app, '#adsClearLogButton');
  const inputViewerMount = getElement<HTMLElement>(app, '#adsInputViewer');
  const candidateTree = getElement<HTMLElement>(app, '#adsCandidateTree');
  const selectedCandidateSummary = getElement<HTMLElement>(app, '#adsSelectedCandidateSummary');
  const candidateDetail = getElement<HTMLElement>(app, '#adsCandidateDetail');
  const candidateNotice = getElement<HTMLElement>(app, '#adsCandidateNotice');
  const apiLog = getElement<HTMLElement>(app, '#adsApiLog');
  const apiLogResizer = getElement<HTMLElement>(app, '#adsApiLogResizer');
  const inputViewer = (PkiStudio as PkiStudioViewerApi).init({
    mount: inputViewerMount,
    oidResolver: options.viewer?.oidResolver ?? (PkiStudioOidResolver as PkiStudioOidResolverApi),
    newWindowUrl: options.viewer?.newWindowUrl ?? 'viewer.html',
    editable: false
  });
  inputViewer.setEditable?.(false);
  inputViewer.root?.addEventListener('click', () => window.setTimeout(() => disableInputViewerEditContextActions(inputViewer)));
  inputViewer.root?.addEventListener('pointerover', () => disableInputViewerEditContextActions(inputViewer));
  inputViewer.root?.addEventListener('focusin', () => disableInputViewerEditContextActions(inputViewer));

  initializeApiLogResizer(getElement<HTMLElement>(app, '.ads-shell'), apiLogResizer);

  const addLog = (level: LogLevel, label: string, detail?: string): void => {
    state.logs.push({ level, label, detail, timestamp: new Date() });
    if (state.logs.length > MAX_LOG_ENTRIES) state.logs.splice(0, state.logs.length - MAX_LOG_ENTRIES);
    renderLogs(apiLog, state.logs);
  };

  const setCandidateNotice = (message: string): void => {
    candidateNotice.textContent = message;
  };

  const loadBytes = async (bytes: Uint8Array, sourceName = 'input.der', renderInViewer = true): Promise<void> => {
    const startedAt = performance.now();
    state.bytes = bytes;
    state.sourceName = sourceName;
    if (renderInViewer) {
      inputViewer.loadBytes(bytes, `Opened ${sourceName} in the read-only ASN.1 viewer.`);
      inputViewer.setEditable?.(false);
    }
    addLog('info', 'loadBytes', `${sourceName}: ${bytes.byteLength} bytes`);
    try {
      const report = await createPkiCandidateReport(bytes, {
        includeSubtrees: true,
        includeEmptySubtrees: true,
        includeNodes: true,
        maxSubtreeDepth: 4,
        maxSubtreeReports: 50,
        maxResults: 8
      });
      state.report = report;
      state.selectedRootCandidates = new Map();
      state.selectedSubtreeCandidates = new Map();
      renderCandidateTree(candidateTree, report, bytes, state.selectedRootCandidates, state.selectedSubtreeCandidates, (selection, selectedElement) => {
        renderSelectedCandidate(candidateDetail, selectedCandidateSummary, selection);
        markSelectedTreeItem(candidateTree, selectedElement);
      });
      const rootCount = report.roots.length;
      const candidateCount = report.roots.reduce((sum, root) => sum + root.candidates.length, 0);
      const subtreeCount = report.roots.reduce((sum, root) => sum + (root.subtrees?.length ?? 0), 0);
      setCandidateNotice(`Resolved ${candidateCount} root candidate(s) across ${rootCount} root node(s); ${subtreeCount} subtree report(s).`);
      addLog('success', 'createPkiCandidateReport', `Completed in ${formatDuration(startedAt)} with ${candidateCount} root candidate(s).`);
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

  const resetCandidateState = (detail: string): void => {
    state.report = null;
    state.sourceName = null;
    state.bytes = null;
    state.selectedRootCandidates = new Map();
    state.selectedSubtreeCandidates = new Map();
    candidateTree.textContent = 'No candidate report yet.';
    renderSelectedCandidate(candidateDetail, selectedCandidateSummary);
    setCandidateNotice('Candidate results will appear after input is loaded.');
    addLog('success', 'PkiStudioJS.viewer.close', detail);
  };

  const close = (): void => {
    document.removeEventListener('click', handleDocumentClick);
    viewerObserver.disconnect();
    inputViewer.close?.();
    app.innerHTML = '';
  };

  aboutButton.addEventListener('click', () => {
    if (typeof aboutDialog.showModal === 'function') {
      aboutDialog.showModal();
    } else {
      aboutDialog.setAttribute('open', '');
    }
  });

  closeAboutButton.addEventListener('click', () => aboutDialog.close());

  clearLogButton.addEventListener('click', () => {
    state.logs = [];
    renderLogs(apiLog, state.logs);
  });
  const handleDocumentClick = (event: MouseEvent): void => {
    if (!app.contains(event.target as Node)) return;
    if (!(event.target as HTMLElement).closest('.ads-tree-alternatives')) closeAlternativeMenus();
  };
  document.addEventListener('click', handleDocumentClick);

  const synchronizeFromInputViewer = (): void => {
    if (!inputViewer.getNodeBytes) return;
    let bytes: Uint8Array;
    try {
      bytes = getInputViewerDocumentBytes(inputViewer);
    } catch {
      if (state.bytes && isInputViewerEmpty(inputViewer)) resetCandidateState('Cleared candidate report after the viewer was closed.');
      return;
    }
    if (state.bytes && bytesEqual(state.bytes, bytes)) return;
    void loadBytes(bytes, 'PkiStudioJS viewer', false);
  };
  const viewerObserver = new MutationObserver(() => window.setTimeout(synchronizeFromInputViewer));
  if (inputViewer.root) viewerObserver.observe(inputViewer.root, { childList: true, subtree: true, characterData: true });

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

function renderCandidateTree(container: HTMLElement, report: CandidateReport, sourceBytes: Uint8Array, selectedRootCandidates: Map<number, string>, selectedSubtreeCandidates: Map<string, string>, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): void {
  const openNodeKeys = collectOpenTreeNodeKeys(container);
  container.innerHTML = '';
  if (report.roots.length === 0) {
    container.textContent = 'No root TLV nodes were parsed.';
    return;
  }
  let firstSelection: { selection: CandidateSelection; selectedElement: HTMLElement } | undefined;
  for (const root of report.roots) {
    const subtrees = buildSubtreeTree(root.subtrees ?? []);
    for (const candidate of getVisibleRootCandidates(root, selectedRootCandidates)) {
      const candidateNode = createRootCandidateNode(candidate, root, sourceBytes, subtrees, selectedRootCandidates, selectedSubtreeCandidates, () => renderCandidateTree(container, report, sourceBytes, selectedRootCandidates, selectedSubtreeCandidates, selectCandidate), selectCandidate);
      firstSelection ??= { selection: createRootSelection(candidate, root, sourceBytes, calculateRootDisplayScore(candidate, subtrees, selectedSubtreeCandidates)), selectedElement: getTreeSummary(candidateNode) };
      container.append(candidateNode);
    }
    if (root.candidates.length === 0) container.append(createEmptyRootNode(root, subtrees, selectedSubtreeCandidates, () => renderCandidateTree(container, report, sourceBytes, selectedRootCandidates, selectedSubtreeCandidates, selectCandidate), selectCandidate));
  }
  restoreOpenTreeNodeKeys(container, openNodeKeys);
  if (firstSelection) selectCandidate(firstSelection.selection, firstSelection.selectedElement);
}

function createRootCandidateNode(candidate: Candidate, root: CandidateReportRoot, sourceBytes: Uint8Array, subtrees: SubtreeDisplayNode[], selectedRootCandidates: Map<number, string>, selectedSubtreeCandidates: Map<string, string>, rerenderTree: () => void, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'ads-tree-node ads-candidate-node';
  const displayScore = calculateRootDisplayScore(candidate, subtrees, selectedSubtreeCandidates);
  const displayConfidence = confidenceFromScore(displayScore);
  const summary = createSummary(formatCandidateName(candidate), `Root ${root.index} · ${formatScore(displayScore)} · ${displayConfidence}`, {
    hasChildren: subtrees.length > 0
  });
  summary.dataset.treeKind = 'root';
  summary.dataset.rootIndex = String(root.index);
  summary.dataset.candidateKey = candidateKey(candidate);
  bindSummarySelection(summary, () => selectCandidate(createRootSelection(candidate, root, sourceBytes, displayScore), summary));
  const icon = summary.querySelector<HTMLElement>('.ads-tree-icon');
  const alternatives = createRootAlternativeList(root, selectedRootCandidates, (alternative) => {
    selectedRootCandidates.set(root.index, candidateKey(alternative));
    rerenderTree();
    const selectedSummary = findTreeSummary('root', String(root.index), candidateKey(alternative));
    selectCandidate(createRootSelection(alternative, root, sourceBytes, calculateRootDisplayScore(alternative, subtrees, selectedSubtreeCandidates)), selectedSummary ?? summary);
  });
  if (alternatives.childElementCount > 0) {
    icon?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAlternativeMenus(alternatives);
      const shouldShow = alternatives.hidden;
      alternatives.hidden = !shouldShow;
    });
    summary.append(alternatives);
  }
  details.append(summary);
  if (subtrees.length > 0) {
    const list = document.createElement('div');
    list.className = 'ads-tree-children';
    for (const subtree of subtrees) list.append(createSubtreeNode(subtree, selectedSubtreeCandidates, rerenderTree, selectCandidate));
    details.append(list);
  }
  return details;
}

function getVisibleRootCandidates(root: CandidateReportRoot, selectedRootCandidates: Map<number, string>): Candidate[] {
  const selectedKey = selectedRootCandidates.get(root.index);
  const selectedCandidate = root.candidates.find((candidate) => candidateKey(candidate) === selectedKey);
  if (selectedCandidate) return [selectedCandidate];
  const candidates = sortCandidatesByScore(root.candidates);
  const bestScore = candidates[0]?.score;
  if (bestScore === undefined) return [];
  return candidates.filter((candidate) => scoresTie(candidate.score, bestScore));
}

function createEmptyRootNode(root: CandidateReportRoot, subtrees: SubtreeDisplayNode[], selectedSubtreeCandidates: Map<string, string>, rerenderTree: () => void, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const details = document.createElement('details');
  details.className = 'ads-tree-node';
  details.open = true;
  details.append(createSummary(`Root ${root.index}`, 'No candidates', { hasChildren: subtrees.length > 0 }));
  if (subtrees.length > 0) {
    const list = document.createElement('div');
    list.className = 'ads-tree-children';
    for (const subtree of subtrees) list.append(createSubtreeNode(subtree, selectedSubtreeCandidates, rerenderTree, selectCandidate));
    details.append(list);
  }
  return details;
}

function createSubtreeNode(node: SubtreeDisplayNode, selectedSubtreeCandidates: Map<string, string>, rerenderTree: () => void, selectCandidate: (selection: CandidateSelection, selectedElement: HTMLElement) => void): HTMLElement {
  const { subtree } = node;
  const selectedCandidate = getSelectedSubtreeCandidate(subtree, selectedSubtreeCandidates);
  const details = document.createElement('details');
  details.className = 'ads-tree-node ads-subtree-node';
  const displayScore = selectedCandidate ? calculateSubtreeDisplayScore(node, selectedSubtreeCandidates, selectedCandidate) : undefined;
  const displayConfidence = displayScore === undefined ? undefined : confidenceFromScore(displayScore);
  const summary = selectedCandidate ? createSummary(formatCandidateName(selectedCandidate), `${subtree.path} · ${formatScore(displayScore ?? selectedCandidate.score)} · ${displayConfidence ?? selectedCandidate.confidence}`, {
    hasChildren: node.children.length > 0
  }) : createSummary(formatHexOnlyLabel(subtree), `${subtree.path} · ${subtree.features.tagName} · ${formatByteCount(getBinaryPayloadBytes(subtree.node)?.byteLength ?? 0)}`, {
    hasChildren: node.children.length > 0
  });
  if (selectedCandidate) {
    summary.dataset.treeKind = 'subtree';
    summary.dataset.path = subtree.path;
    summary.dataset.candidateKey = candidateKey(selectedCandidate);
    bindSummarySelection(summary, () => selectCandidate(createSubtreeSelection(selectedCandidate, subtree, displayScore), summary));
    const icon = summary.querySelector<HTMLElement>('.ads-tree-icon');
    const alternatives = createAlternativeList(subtree, selectedSubtreeCandidates, (candidate, selectedElement) => {
      selectedSubtreeCandidates.set(subtree.path, candidateKey(candidate));
      rerenderTree();
      const selectedSummary = findTreeSummary('subtree', subtree.path, candidateKey(candidate));
      selectCandidate(createSubtreeSelection(candidate, subtree, calculateSubtreeDisplayScore(node, selectedSubtreeCandidates, candidate)), selectedSummary ?? selectedElement);
    });
    icon?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAlternativeMenus(alternatives);
      const shouldShow = alternatives.hidden;
      alternatives.hidden = !shouldShow;
    });
    summary.append(alternatives);
  } else {
    bindSummarySelection(summary, () => selectCandidate(createHexOnlySelection(subtree), summary));
  }
  details.append(summary);
  const list = document.createElement('div');
  list.className = 'ads-tree-children';
  for (const child of node.children) list.append(createSubtreeNode(child, selectedSubtreeCandidates, rerenderTree, selectCandidate));
  details.append(list);
  return details;
}

function createAlternativeList(subtree: CandidateReportSubtree, selectedSubtreeCandidates: Map<string, string>, selectAlternative: (candidate: Candidate, selectedElement: HTMLElement) => void): HTMLElement {
  const list = document.createElement('div');
  list.className = 'ads-tree-alternatives';
  list.setAttribute('role', 'menu');
  list.hidden = true;
  for (const candidate of sortCandidatesByScore(subtree.candidates)) list.append(createCandidateNode(candidate, subtree, selectedSubtreeCandidates, selectAlternative));
  return list;
}

function createRootAlternativeList(root: CandidateReportRoot, selectedRootCandidates: Map<number, string>, selectAlternative: (candidate: Candidate) => void): HTMLElement {
  const list = document.createElement('div');
  list.className = 'ads-tree-alternatives';
  list.setAttribute('role', 'menu');
  list.hidden = true;
  const visibleKeys = new Set(getVisibleRootCandidates(root, selectedRootCandidates).map(candidateKey));
  for (const candidate of sortCandidatesByScore(root.candidates).filter((item) => !visibleKeys.has(candidateKey(item)))) {
    list.append(createRootCandidateItem(candidate, selectAlternative));
  }
  return list;
}

function createRootCandidateItem(candidate: Candidate, selectAlternative: (candidate: Candidate) => void): HTMLElement {
  const item = document.createElement('button');
  item.className = 'ads-tree-item ads-candidate-item';
  item.type = 'button';
  item.setAttribute('role', 'menuitem');
  item.dataset.candidateKey = candidateKey(candidate);
  item.append(createTreeLabel(formatCandidateName(candidate)), createTreeNote(formatScore(candidate.score)));
  item.prepend(createCheckmark(false));
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectAlternative(candidate);
  });
  return item;
}

function createCandidateNode(candidate: Candidate, subtree: CandidateReportSubtree, selectedSubtreeCandidates: Map<string, string>, selectAlternative: (candidate: Candidate, selectedElement: HTMLElement) => void): HTMLElement {
  const item = document.createElement('button');
  item.className = 'ads-tree-item ads-candidate-item';
  item.type = 'button';
  item.setAttribute('role', 'menuitemradio');
  item.dataset.candidateKey = candidateKey(candidate);
  const selectedCandidate = getSelectedSubtreeCandidate(subtree, selectedSubtreeCandidates);
  item.setAttribute('aria-checked', selectedCandidate && candidateKey(candidate) === candidateKey(selectedCandidate) ? 'true' : 'false');
  item.append(createTreeLabel(formatCandidateName(candidate)), createTreeNote(formatScore(candidate.score)));
  item.prepend(createCheckmark(Boolean(selectedCandidate && candidateKey(candidate) === candidateKey(selectedCandidate))));
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectAlternative(candidate, item);
  });
  return item;
}

function closeAlternativeMenus(except?: HTMLElement): void {
  for (const menu of document.querySelectorAll<HTMLElement>('.ads-tree-alternatives')) {
    if (menu !== except) menu.hidden = true;
  }
}

function buildSubtreeTree(subtrees: CandidateReportSubtree[]): SubtreeDisplayNode[] {
  const nodes = new Map(subtrees.map((subtree) => [subtree.path, { subtree, children: [] as SubtreeDisplayNode[] }]));
  const roots: SubtreeDisplayNode[] = [];
  for (const node of [...nodes.values()].sort((left, right) => left.subtree.path.localeCompare(right.subtree.path))) {
    const parent = nodes.get(parentPath(node.subtree.path));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  for (const node of nodes.values()) node.children = sortSubtreeNodes(node.children);
  return sortSubtreeNodes(roots.flatMap(pruneDisplayNode));
}

function pruneDisplayNode(node: SubtreeDisplayNode): SubtreeDisplayNode[] {
  const children = sortSubtreeNodes(node.children.flatMap(pruneDisplayNode));
  const displayNode = { ...node, children };
  if (hasCandidateSubtree(node.subtree) || isHexOnlySubtree(node.subtree, children)) return [displayNode];
  return children;
}

function hasCandidateSubtree(subtree: CandidateReportSubtree): boolean {
  return subtree.candidates.length > 0;
}

function isHexOnlySubtree(subtree: CandidateReportSubtree, visibleChildren: SubtreeDisplayNode[]): boolean {
  return subtree.candidates.length === 0 && visibleChildren.length === 0 && isBinaryPrimitive(subtree.node);
}

function isBinaryPrimitive(node: TlvNode | undefined): boolean {
  return Boolean(node && !node.constructed && node.tagClass === 'universal' && (node.tagNumber === 3 || node.tagNumber === 4));
}

function sortSubtreeNodes(nodes: SubtreeDisplayNode[]): SubtreeDisplayNode[] {
  return [...nodes].sort((left, right) => compareSubtreePath(left.subtree.path, right.subtree.path));
}

function compareSubtreePath(leftPath: string, rightPath: string): number {
  const leftIndexes = pathIndexes(leftPath);
  const rightIndexes = pathIndexes(rightPath);
  const length = Math.max(leftIndexes.length, rightIndexes.length);
  for (let index = 0; index < length; index += 1) {
    const left = leftIndexes[index];
    const right = rightIndexes[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left !== right) return left - right;
  }
  return leftPath.localeCompare(rightPath);
}

function pathIndexes(path: string): number[] {
  return path.split('.').slice(1).map((part) => Number.parseInt(part, 10));
}

function parentPath(path: string): string {
  const index = path.lastIndexOf('.');
  return index > 0 ? path.slice(0, index) : '';
}

function getSelectedSubtreeCandidate(subtree: CandidateReportSubtree, selectedSubtreeCandidates: Map<string, string>): Candidate | undefined {
  const selectedKey = selectedSubtreeCandidates.get(subtree.path);
  return subtree.candidates.find((candidate) => candidateKey(candidate) === selectedKey) ?? sortCandidatesByScore(subtree.candidates)[0];
}

function calculateRootDisplayScore(candidate: Candidate, subtrees: SubtreeDisplayNode[], selectedSubtreeCandidates: Map<string, string>): number {
  if (!hasSelectedSubtree(subtrees, selectedSubtreeCandidates)) return candidate.score;
  return calculateDisplayScore(candidate.score, collectChildDisplayScores(subtrees, selectedSubtreeCandidates));
}

function calculateSubtreeDisplayScore(node: SubtreeDisplayNode, selectedSubtreeCandidates: Map<string, string>, candidate = getSelectedSubtreeCandidate(node.subtree, selectedSubtreeCandidates)): number | undefined {
  if (!candidate) return undefined;
  if (!hasSelectedSubtree(node.children, selectedSubtreeCandidates)) return candidate.score;
  return calculateDisplayScore(candidate.score, collectChildDisplayScores(node.children, selectedSubtreeCandidates));
}

function collectChildDisplayScores(nodes: SubtreeDisplayNode[], selectedSubtreeCandidates: Map<string, string>): number[] {
  return nodes.flatMap((node) => {
    const score = calculateSubtreeDisplayScore(node, selectedSubtreeCandidates);
    return score === undefined ? [] : [score];
  });
}

function calculateDisplayScore(baseScore: number, childScores: number[]): number {
  if (childScores.length === 0) return baseScore;
  const total = childScores.reduce((sum, score) => sum + score, baseScore);
  return clampScore(total / (childScores.length + 1));
}

function hasSelectedSubtree(nodes: SubtreeDisplayNode[], selectedSubtreeCandidates: Map<string, string>): boolean {
  return nodes.some((node) => selectedSubtreeCandidates.has(node.subtree.path) || hasSelectedSubtree(node.children, selectedSubtreeCandidates));
}

function findTreeSummary(kind: 'root' | 'subtree', pathOrIndex: string, key: string): HTMLElement | undefined {
  for (const summary of document.querySelectorAll<HTMLElement>(`summary[data-tree-kind="${kind}"]`)) {
    const sameTarget = kind === 'root' ? summary.dataset.rootIndex === pathOrIndex : summary.dataset.path === pathOrIndex;
    if (sameTarget && summary.dataset.candidateKey === key) return summary;
  }
  return undefined;
}

function collectOpenTreeNodeKeys(container: HTMLElement): Set<string> {
  const keys = new Set<string>();
  for (const details of container.querySelectorAll<HTMLDetailsElement>('details[open]')) {
    const summary = details.querySelector<HTMLElement>(':scope > summary[data-tree-kind]');
    const key = summary ? openTreeNodeKey(summary) : undefined;
    if (key) keys.add(key);
  }
  return keys;
}

function restoreOpenTreeNodeKeys(container: HTMLElement, keys: Set<string>): void {
  for (const summary of container.querySelectorAll<HTMLElement>('summary[data-tree-kind]')) {
    const details = summary.parentElement instanceof HTMLDetailsElement ? summary.parentElement : undefined;
    if (details && keys.has(openTreeNodeKey(summary) ?? '')) details.open = true;
  }
}

function openTreeNodeKey(summary: HTMLElement): string | undefined {
  if (summary.dataset.treeKind === 'root' && summary.dataset.rootIndex !== undefined) return `root:${summary.dataset.rootIndex}`;
  if (summary.dataset.treeKind === 'subtree' && summary.dataset.path) return `subtree:${summary.dataset.path}`;
  return undefined;
}

function candidateKey(candidate: Candidate): string {
  return `${candidate.moduleName ?? ''}\u0000${candidate.typeName}`;
}

function createCheckmark(checked: boolean): HTMLElement {
  const checkmark = document.createElement('span');
  checkmark.className = 'ads-tree-checkmark';
  checkmark.textContent = checked ? '✓' : '';
  checkmark.setAttribute('aria-hidden', 'true');
  return checkmark;
}

function createRootSelection(candidate: Candidate, root: CandidateReportRoot, sourceBytes: Uint8Array, displayScore?: number): CandidateSelection {
  return {
    candidate,
    context: `Root ${root.index}`,
    bytes: root.index === 0 ? sourceBytes : getNodeBytes(root.node),
    displayScore,
    displayConfidence: displayScore === undefined ? undefined : confidenceFromScore(displayScore)
  };
}

function createSubtreeSelection(candidate: Candidate, subtree: CandidateReportSubtree, displayScore?: number): CandidateSelection {
  return {
    candidate,
    context: `Subtree ${subtree.path}`,
    bytes: getNodeBytes(subtree.node),
    displayScore,
    displayConfidence: displayScore === undefined ? undefined : confidenceFromScore(displayScore)
  };
}

function createHexOnlySelection(subtree: CandidateReportSubtree): CandidateSelection {
  const bytes = getBinaryPayloadBytes(subtree.node) ?? getNodeBytes(subtree.node);
  return {
    context: `Subtree ${subtree.path}`,
    bytes,
    hexOnly: true,
    hexSummary: formatHexOnlyLabel(subtree)
  };
}

function renderSelectedCandidate(container: HTMLElement, summary: HTMLElement, selection?: CandidateSelection): void {
  container.innerHTML = '';
  if (!selection) {
    summary.textContent = 'None';
    container.textContent = 'Select a candidate to inspect evidence, diagnostics, ambiguities, matched paths, and bytes.';
    return;
  }
  const { candidate, context } = selection;
  if (!candidate) {
    summary.textContent = `${context} · ${selection.hexSummary ?? 'HEX data'}`;
    container.append(createKeyValue('Binary data', 'No ASN.1 type candidate matched this value. The item is shown as raw hexadecimal bytes.'));
    container.append(createKeyValue('Selected bytes', formatSelectedBytes(selection)));
    return;
  }
  const displayScore = selection.displayScore ?? candidate.score;
  const displayConfidence = selection.displayConfidence ?? candidate.confidence;
  summary.textContent = `${context} · ${formatCandidateName(candidate)} · ${formatScore(displayScore)} · ${displayConfidence}`;
  container.append(createKeyValue('Evidence', candidate.evidence.slice(0, 8).join('\n') || 'No evidence.'));
  container.append(createKeyValue('Diagnostics', candidate.diagnostics.slice(0, 8).map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`).join('\n') || 'No diagnostics.'));
  container.append(createKeyValue('Ambiguities', candidate.ambiguities.slice(0, 8).join('\n') || 'No ambiguities.'));
  container.append(createKeyValue('Matched paths', candidate.matchedPaths.slice(0, 12).map((path) => `${path.nodePath} -> ${path.schemaPath}`).join('\n') || 'No matched paths.'));
  container.append(createKeyValue('Selected bytes', formatSelectedBytes(selection)));
}

function formatSelectedBytes(selection: CandidateSelection): string {
  if (!selection.bytes || selection.bytes.length === 0) {
    return `${selection.context}: encoded bytes are not available from the parser output.`;
  }
  return bytesToCompactHex(selection.bytes);
}

function bytesToCompactHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createSummary(label: string, note: string, options: { hasChildren: boolean }): HTMLElement {
  const summary = document.createElement('summary');
  if (!options.hasChildren) summary.classList.add('ads-tree-leaf');
  summary.append(createDisclosure(options.hasChildren), createTreeIcon(options.hasChildren ? 'branch' : 'leaf'), createTreeLabel(label), createTreeNote(note));
  return summary;
}

function bindSummarySelection(summary: HTMLElement, select: () => void): void {
  summary.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('.ads-disclosure')) return;
    event.preventDefault();
    select();
  });
}

function createDisclosure(hasChildren: boolean): HTMLElement {
  const disclosure = document.createElement('span');
  disclosure.className = 'ads-disclosure';
  if (!hasChildren) disclosure.classList.add('ads-disclosure-hidden');
  disclosure.setAttribute('aria-hidden', 'true');
  return disclosure;
}

function createTreeIcon(kind: TreeIconKind): HTMLElement {
  const icon = document.createElement('span');
  icon.className = `ads-tree-icon ads-tree-icon-${kind}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
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
  for (const log of logs) {
    const row = document.createElement('li');
    row.className = `ads-api-log-entry ${log.level}`;

    const timestamp = document.createElement('time');
    timestamp.dateTime = log.timestamp.toISOString();
    timestamp.textContent = formatLogTimestamp(log.timestamp);

    const label = document.createElement('span');
    label.className = 'ads-api-log-operation';
    label.textContent = log.label;

    const detail = document.createElement('span');
    detail.className = 'ads-api-log-detail';
    detail.textContent = log.detail ?? '';

    row.append(timestamp, label, detail);
    container.append(row);
  }
  container.scrollTop = container.scrollHeight;
}

function formatLogTimestamp(date: Date): string {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function formatHexOnlyLabel(subtree: CandidateReportSubtree): string {
  const bytes = getBinaryPayloadBytes(subtree.node) ?? new Uint8Array();
  return `HEX ${formatHexPreview(bytes)}`;
}

function formatHexPreview(bytes: Uint8Array): string {
  const preview = Array.from(bytes.slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  return bytes.byteLength > 12 ? `${preview} ...` : preview || '(empty)';
}

function formatByteCount(length: number): string {
  return `${length} byte${length === 1 ? '' : 's'}`;
}

function getBinaryPayloadBytes(node: TlvNode | undefined): Uint8Array | undefined {
  if (!node?.valueBytes) return undefined;
  if (node.tagClass === 'universal' && node.tagNumber === 3) return node.valueBytes.slice(1);
  return node.valueBytes;
}

function getNodeBytes(node: TlvNode | undefined): Uint8Array | undefined {
  if (!node) return undefined;
  return encodeTlvNode(node) ?? node.encodedBytes ?? node.valueBytes;
}

function encodeTlvNode(node: TlvNode): Uint8Array | undefined {
  if (node.tagNumber >= 31) return node.encodedBytes;
  const valueBytes = getNodeValueBytes(node);
  if (!valueBytes) return node.encodedBytes;
  const tagByte = tagClassBits(node.tagClass) | (node.constructed ? 0x20 : 0) | node.tagNumber;
  return concatBytes(new Uint8Array([tagByte]), encodeLength(valueBytes.byteLength), valueBytes);
}

function getNodeValueBytes(node: TlvNode): Uint8Array | undefined {
  if (node.children && node.children.length > 0) {
    const childBytes = node.children.map(encodeTlvNode);
    if (childBytes.some((bytes) => !bytes)) return node.valueBytes ?? node.encodedBytes;
    return concatBytes(...childBytes as Uint8Array[]);
  }
  return node.valueBytes;
}

function tagClassBits(tagClass: TlvNode['tagClass']): number {
  if (tagClass === 'application') return 0x40;
  if (tagClass === 'context') return 0x80;
  if (tagClass === 'private') return 0xc0;
  return 0;
}

function encodeLength(length: number): Uint8Array {
  if (length < 0x80) return new Uint8Array([length]);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

function getInputViewerDocumentBytes(viewer: PkiStudioViewerInstance): Uint8Array {
  if (!viewer.getNodeBytes || !viewer.root) throw new Error('PkiStudioJS viewer bytes are not available.');
  const rootIds = Array.from(viewer.root.querySelectorAll<HTMLElement>('.tree > details.node > summary .icon[data-node-id]'), (element) => element.dataset.nodeId).filter((nodeId): nodeId is string => Boolean(nodeId));
  if (rootIds.length === 0) return viewer.getNodeBytes('1');
  return concatBytes(...rootIds.map((nodeId) => viewer.getNodeBytes?.(nodeId) ?? new Uint8Array()));
}

function isInputViewerEmpty(viewer: PkiStudioViewerInstance): boolean {
  if (!viewer.root) return true;
  return Boolean(viewer.root.querySelector('.viewer.empty'));
}

function disableInputViewerEditContextActions(viewer: PkiStudioViewerInstance): void {
  if (!viewer.root) return;
  const allowedActions = new Set(['send-to', 'send-new-window', 'send-new-window-extracted', 'copy-tree', 'copy-hex']);
  for (const button of viewer.root.querySelectorAll<HTMLButtonElement>('button[data-node-action]')) {
    const action = button.dataset.nodeAction ?? '';
    if (!allowedActions.has(action)) button.disabled = true;
  }
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

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
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

function scoresTie(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
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

function initializeApiLogResizer(root: HTMLElement, resizer: HTMLElement): void {
  const minHeight = 86;
  const minWorkspaceHeight = 220;
  let startY = 0;
  let startHeight = 0;

  const resize = (event: PointerEvent): void => {
    const nextHeight = clampNumber(startHeight - (event.clientY - startY), minHeight, getMaxApiLogHeight(root, minWorkspaceHeight, minHeight));
    root.style.setProperty('--ads-api-log-height', `${nextHeight}px`);
  };

  const stopResize = (): void => {
    root.classList.remove('ads-resizing-rows');
    document.removeEventListener('pointermove', resize);
    document.removeEventListener('pointerup', stopResize);
  };

  resizer.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startY = event.clientY;
    const currentHeight = getComputedStyle(root).getPropertyValue('--ads-api-log-height').trim();
    startHeight = Number.parseFloat(currentHeight) || 156;
    root.classList.add('ads-resizing-rows');
    document.addEventListener('pointermove', resize);
    document.addEventListener('pointerup', stopResize);
  });
}

function getMaxApiLogHeight(root: HTMLElement, minWorkspaceHeight: number, minApiLogHeight: number): number {
  const toolbarHeight = root.querySelector('.ads-toolbar')?.getBoundingClientRect().height ?? 0;
  const selectedPaneMinHeight = 150;
  const splitterHeight = root.querySelector('.ads-api-log-resizer')?.getBoundingClientRect().height ?? 6;
  const availableHeight = root.getBoundingClientRect().height || window.innerHeight;
  return Math.max(minApiLogHeight, Math.floor(availableHeight - toolbarHeight - splitterHeight - selectedPaneMinHeight - minWorkspaceHeight));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}