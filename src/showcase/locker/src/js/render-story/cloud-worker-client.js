export function startCloudWorker(canvas, onPaint, onFailure) {
  const worker = new Worker(canvas.dataset.cloudWorker, { type: 'module' });
  let inFlight = false;
  let pending;

  function flush() {
    if (inFlight || !pending) return;
    inFlight = true;
    worker.postMessage(pending);
    pending = undefined;
  }

  return new Promise((resolve, reject) => {
    function fail() {
      worker.terminate();
      reject(new Error('Cloud worker unavailable'));
    }
    worker.onerror = fail;
    worker.onmessage = ({ data }) => {
      if (data !== 'ready') {
        fail();
        return;
      }
      worker.onerror = onFailure;
      worker.onmessage = ({ data: state }) => {
        if (state === 'failed') onFailure();
        else {
          inFlight = false;
          onPaint();
          flush();
        }
      };
      resolve({
        paint(frame) {
          pending = frame;
          flush();
        },
        destroy() {
          worker.terminate();
        },
      });
    };
    try {
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ canvas: offscreen }, [offscreen]);
    } catch {
      fail();
    }
  });
}
