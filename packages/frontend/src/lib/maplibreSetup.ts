import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

// MapLibre GL 6 resolves its worker relative to its own module URL, which a
// bundler cannot follow. Point it at the worker file Vite emits instead.
setWorkerUrl(workerUrl);
