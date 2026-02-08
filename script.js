const fileInput = document.getElementById('fileInput');
const colorDepthInput = document.getElementById('colorDepth');
const quantizeBtn = document.getElementById('quantizeBtn');
const previewCanvas = document.getElementById('previewCanvas');
const paletteEl = document.getElementById('palette');
const exportSvgBtn = document.getElementById('exportSvgBtn');
const resetAssignmentsBtn = document.getElementById('resetAssignmentsBtn');
const downloadLink = document.getElementById('downloadLink');
const activeColorSelect = document.getElementById('activeColorSelect');

const ctx = previewCanvas.getContext('2d', { willReadFrequently: true });

const state = {
  imageData: null,
  width: 0,
  height: 0,
  quantizedLabels: null,
  assignments: null,
  palette: [],
};

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const bitmap = await createImageBitmap(file);
  const maxSize = 300;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  state.width = Math.max(1, Math.round(bitmap.width * scale));
  state.height = Math.max(1, Math.round(bitmap.height * scale));
  previewCanvas.width = state.width;
  previewCanvas.height = state.height;
  ctx.drawImage(bitmap, 0, 0, state.width, state.height);
  state.imageData = ctx.getImageData(0, 0, state.width, state.height);
  quantizeBtn.disabled = false;
  exportSvgBtn.disabled = true;
  resetAssignmentsBtn.disabled = true;
  downloadLink.hidden = true;
  paletteEl.innerHTML = '';
});

quantizeBtn.addEventListener('click', () => {
  if (!state.imageData) return;
  const colorDepth = clamp(parseInt(colorDepthInput.value, 10) || 4, 2, 16);
  const result = quantizeImage(state.imageData, colorDepth);

  state.palette = result.palette;
  state.quantizedLabels = result.labels;
  state.assignments = new Uint8Array(result.labels);

  redrawPreview();
  buildPaletteEditor();

  exportSvgBtn.disabled = false;
  resetAssignmentsBtn.disabled = false;
});

previewCanvas.addEventListener('click', (event) => {
  if (!state.assignments) return;
  const targetOutputLabel = parseInt(activeColorSelect.value, 10);
  if (Number.isNaN(targetOutputLabel)) return;

  const rect = previewCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.height);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;

  const seedIndex = y * state.width + x;
  const sourceLabel = state.quantizedLabels[seedIndex];

  const q = [seedIndex];
  const seen = new Uint8Array(state.width * state.height);
  seen[seedIndex] = 1;

  while (q.length) {
    const idx = q.pop();
    state.assignments[idx] = targetOutputLabel;
    const nx = idx % state.width;
    const ny = Math.floor(idx / state.width);

    pushNeighbor(nx - 1, ny);
    pushNeighbor(nx + 1, ny);
    pushNeighbor(nx, ny - 1);
    pushNeighbor(nx, ny + 1);

    function pushNeighbor(px, py) {
      if (px < 0 || py < 0 || px >= state.width || py >= state.height) return;
      const nIdx = py * state.width + px;
      if (seen[nIdx]) return;
      if (state.quantizedLabels[nIdx] !== sourceLabel) return;
      seen[nIdx] = 1;
      q.push(nIdx);
    }
  }

  redrawPreview();
  buildPaletteEditor();
});

resetAssignmentsBtn.addEventListener('click', () => {
  if (!state.quantizedLabels) return;
  state.assignments = new Uint8Array(state.quantizedLabels);
  redrawPreview();
  buildPaletteEditor();
});

exportSvgBtn.addEventListener('click', () => {
  const svg = buildSvg();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = 'converted.svg';
  downloadLink.textContent = 'Download converted.svg';
  downloadLink.hidden = false;
});

function buildPaletteEditor() {
  paletteEl.innerHTML = '';
  activeColorSelect.innerHTML = '';

  const counts = new Array(state.palette.length).fill(0);
  for (const label of state.assignments) counts[label] += 1;

  state.palette.forEach((rgb, index) => {
    const item = document.createElement('div');
    item.className = 'palette-item';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = rgbToCss(rgb);

    const input = document.createElement('input');
    input.type = 'color';
    input.value = rgbToHex(rgb);
    input.addEventListener('input', () => {
      state.palette[index] = hexToRgb(input.value);
      redrawPreview();
    });

    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${counts[index]} px`;

    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `Color ${index + 1}`;
    activeColorSelect.append(option);

    item.append(swatch, input, count);
    paletteEl.append(item);
  });

  if (activeColorSelect.options.length > 0) {
    activeColorSelect.value = activeColorSelect.value || '0';
  }
}

function redrawPreview() {
  const out = new ImageData(state.width, state.height);
  for (let i = 0; i < state.assignments.length; i += 1) {
    const c = state.palette[state.assignments[i]];
    const p = i * 4;
    out.data[p] = c[0];
    out.data[p + 1] = c[1];
    out.data[p + 2] = c[2];
    out.data[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

function buildSvg() {
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.width} ${state.height}" shape-rendering="crispEdges">`);

  for (let y = 0; y < state.height; y += 1) {
    let x = 0;
    while (x < state.width) {
      const idx = y * state.width + x;
      const label = state.assignments[idx];
      let run = 1;
      while (x + run < state.width && state.assignments[y * state.width + x + run] === label) {
        run += 1;
      }
      const color = rgbToHex(state.palette[label]);
      lines.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}" />`);
      x += run;
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function quantizeImage(imageData, k) {
  const px = imageData.data;
  const samples = [];

  for (let i = 0; i < px.length; i += 4) {
    samples.push([px[i], px[i + 1], px[i + 2]]);
  }

  const centroids = [];
  for (let i = 0; i < k; i += 1) {
    const index = Math.floor((i / k) * (samples.length - 1));
    centroids.push(samples[index].slice());
  }

  const labels = new Uint8Array(samples.length);
  for (let iter = 0; iter < 8; iter += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);

    for (let i = 0; i < samples.length; i += 1) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c += 1) {
        const d = distSq(samples[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      labels[i] = best;
      sums[best][0] += samples[i][0];
      sums[best][1] += samples[i][1];
      sums[best][2] += samples[i][2];
      sums[best][3] += 1;
    }

    for (let c = 0; c < k; c += 1) {
      if (sums[c][3] === 0) continue;
      centroids[c][0] = Math.round(sums[c][0] / sums[c][3]);
      centroids[c][1] = Math.round(sums[c][1] / sums[c][3]);
      centroids[c][2] = Math.round(sums[c][2] / sums[c][3]);
    }
  }

  return { palette: centroids, labels };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rgbToCss([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToHex([r, g, b]) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(v) {
  return v.toString(16).padStart(2, '0');
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function distSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
