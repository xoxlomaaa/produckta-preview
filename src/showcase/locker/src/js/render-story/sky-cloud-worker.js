import { createCloudRenderer } from './sky-cloud-renderer.js';

self.addEventListener(
  'message',
  async function setup({ data }) {
    try {
      const { canvas } = data;
      const renderer = await createCloudRenderer(canvas);
      canvas.addEventListener('webglcontextlost', () => self.postMessage('failed'), { once: true });
      self.addEventListener('message', ({ data: frame }) => {
        renderer.paint(frame);
        self.postMessage('painted');
      });
      self.postMessage('ready');
    } catch {
      self.postMessage('failed');
    }
  },
  { once: true },
);
