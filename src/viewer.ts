import PkiStudio from '@pkistudio/pkistudiojs/viewer';
import PkiStudioOidResolver from '@pkistudio/pkistudiojs/oid-resolver';

type PkiStudioViewerApi = {
  init: (options: {
    mount: string | Element;
    oidResolver?: unknown;
    fullscreen?: boolean;
  }) => unknown;
};

window.addEventListener('DOMContentLoaded', () => {
  (PkiStudio as PkiStudioViewerApi).init({
    mount: '#pkistudioViewer',
    oidResolver: PkiStudioOidResolver,
    fullscreen: true
  });
});
