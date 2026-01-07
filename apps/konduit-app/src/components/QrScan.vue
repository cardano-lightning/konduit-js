<script setup lang="ts">
import { ref, onMounted, onUnmounted, type Ref } from "vue";
import Worker from "../utils/qrScanWorker.js?worker";

const emit = defineEmits(["payload"]);

const props = { scanRate: 500 };

//const barcode = ref(null);
const qrWorker: Ref<Worker | null> = ref(null);
const videoRef: Ref<HTMLVideoElement | null> = ref(null);
const containerRef: Ref<HTMLElement | null> = ref(null);
const snapshotCanvasRef: Ref<HTMLCanvasElement | null> = ref(null);
const resizeObserver: Ref<ResizeObserver | null> = ref(null);
const animationFramId: Ref<number | null> = ref(null);

type Dimensions = { width: number; height: number };
const containerSize: Ref<Dimensions> = ref({ width: 0, height: 0 });

const isFrontCamera = ref(false);

let lastScanTime = 0;

const animationLoop = (currentTime: number) => {
  if (!videoRef.value || !snapshotCanvasRef.value) return;

  const video = videoRef.value;
  const canvas = snapshotCanvasRef.value;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const timeSinceLastScan = currentTime - lastScanTime;

  // Process a frame if enough time has passed and the video is ready
  if (
    context &&
    timeSinceLastScan > props.scanRate &&
    video.readyState === video.HAVE_ENOUGH_DATA
  ) {
    lastScanTime = currentTime;

    // Crop a square from the center of the video feed
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const size = Math.min(videoWidth, videoHeight);
    const sx = (videoWidth - size) / 2;
    const sy = (videoHeight - size) / 2;

    // Set canvas dimensions to match the cropped size for accurate image data
    canvas.width = size;
    canvas.height = size;

    context.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const imageData = context.getImageData(0, 0, size, size);

    // Send the image data to the worker
    if (imageData && qrWorker.value) {
      // Transfer the buffer to the worker for performance
      qrWorker.value.postMessage(imageData, [imageData.data.buffer]);
    }
  }
  // Continue the loop as long as no barcode has been found
  // if (!barcode.value) {
  animationFramId.value = requestAnimationFrame(animationLoop);
  // }
};
const initializeCamera = async () => {
  if (videoRef.value) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        isFrontCamera.value = settings.facingMode === "user" || settings.facingMode === undefined;
      }
      videoRef.value.srcObject = stream;
    } catch (error) {
      console.error("Camera access was denied or an error occurred:", error);
    }
  }
};

const stopScanner = () => {
  // Stop the video stream
  if (videoRef.value?.srcObject) {
    const stream = videoRef.value.srcObject;
    if( stream instanceof MediaStream ) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.value.srcObject = null;
    }
  }
  // Stop the animation loop
  if (animationFramId.value) {
    cancelAnimationFrame(animationFramId.value);
    animationFramId.value = null;
  }
};

// --- LIFECYCLE HOOKS ---

onMounted(() => {
  qrWorker.value = new Worker();
  qrWorker.value.onmessage = (event) => {
    console.log("Received message from worker:", event.data);
    if (event.data && event.data.length > 0) {
      emit("payload", event.data[0].rawValue);
      stopScanner();
    }
  };
  initializeCamera();
  // Set up a resize observer to keep the video element square
  if (containerRef.value) {
    resizeObserver.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.width,
        };
      }
    });
    resizeObserver.value.observe(containerRef.value);
  }
  // Start the animation loop
  animationFramId.value = requestAnimationFrame(animationLoop);
});

onUnmounted(() => {
  stopScanner();
  // Terminate the worker
  if (qrWorker.value) {
    qrWorker.value.terminate();
  }
  // Disconnect the observer
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
  }
});
</script>

<template>
  <div class="qr-scan-container">
    <div ref="containerRef" class="scanner-view">
      <div>
        <video
          ref="videoRef"
          class="video-feed"
          autoplay
          playsinline
          muted
          :class="{ mirror: isFrontCamera }"
          :style="{
            width: `${containerSize.width}px`,
            height: `${containerSize.height}px`,
          }"
        />
        <div class="overlay"><div class="crosshair" /></div>
      </div>
    </div>
    <!-- Hidden canvas for capturing snapshots -->
    <canvas ref="snapshotCanvasRef" class="hidden-canvas" />
  </div>
</template>

<style scoped>
.qr-scan-container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  text-align: center;
}

.result-display {
  background-color: #dcfce7;
  color: #166534;
}

.result-title {
  font-weight: 600;
}

.result-value {
  margin-top: 0.5rem;
  word-break: break-all;
}

.scanner-view {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 2px solid #d1d5db;
  /* I'm not sure if I understand the source of the possible gap between
     the video feed and the border, but we can have such a gap.
     As a workaround we use the same background color as the border so it
     blends in seamlessly. */
  background-color: #d1d5db;
}

.video-feed {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crosshair {
  width: 75%;
  height: 75%;
  border: 4px dashed rgba(255, 255, 255, 0.5);
}

.hidden-canvas {
  display: none;
}

.mirror {
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
}
</style>
