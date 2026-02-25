import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill';

declare global {
  interface ServiceWorkerGlobalScope {
    BarcodeDetector: typeof BarcodeDetectorPolyfill | undefined;
  }
  interface Window {
    BarcodeDetector: typeof BarcodeDetectorPolyfill | undefined;
  }
}
(function() {
  let that = self || window;
  if(typeof that.BarcodeDetector == "undefined") {
    that.BarcodeDetector = BarcodeDetectorPolyfill;
  }
})();

(async () => {
  console.log('QR Scan Worker initialized');
  if(!self.BarcodeDetector) return;
  const detector = new self.BarcodeDetector({ formats: ['qr_code'] })
  // Listen for messages from JS main thread containing raw image data
  self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    detector.detect(data).then(barcodes => {
      if (barcodes) {
        postMessage(barcodes);
      }
    });
  });
})();
