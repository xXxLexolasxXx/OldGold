'use strict';

let canvas, context;
self.onmessage = ({data: {bitmap, x, y, width, height}}) => {
  try {
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = new OffscreenCanvas(width, height);
      context = canvas.getContext('2d', {willReadFrequently: true, colorSpace: 'srgb'});
    }
    context.globalCompositeOperation = 'copy';
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    self.postMessage(data.buffer, [data.buffer]);
  } catch (error) {
    self.postMessage({error: error.message});
  } finally {
    bitmap.close();
  }
};
self.postMessage({ready: true});
