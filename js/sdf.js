const SDF_W = 768;
const SDF_H = 192;
const INF = 1e12;

function getFontSpec(fontKey, pxSize) {
  switch (fontKey) {
    case 'serif':   return `700 ${pxSize}px Georgia, "Times New Roman", serif`;
    case 'mono':    return `700 ${pxSize}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    case 'display': return `900 ${pxSize}px "Arial Black", Impact, "Segoe UI", sans-serif`;
    case 'script':  return `italic 700 ${pxSize}px "Brush Script MT", "Segoe Script", Georgia, serif`;
    case 'sans':
    default:        return `700 ${pxSize}px "Inter", "Segoe UI", -apple-system, Helvetica, Arial, sans-serif`;
  }
}

function floatToHalf(val) {
  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);
  floatView[0] = val;
  const x = int32View[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) {
    bits |= 0x7c00;
    bits |= ((e === 255) ? 0 : 1) && (x & 0x007fffff);
    return bits;
  }
  if (e < 113) {
    m |= 0x0800;
    bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
    return bits;
  }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}

/**
 * Exact 2D Euclidean Signed Distance Field (EDT) generator for live engraved text.
 * Uses Felzenszwalb & Huttenlocher's O(W*H) algorithm.
 */
export function createTextSdfManager(gl, sdfMode) {
  const textCanvas = document.createElement('canvas');
  textCanvas.width = SDF_W;
  textCanvas.height = SDF_H;
  const textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

  const edtGridOutside = new Float32Array(SDF_W * SDF_H);
  const edtGridInside = new Float32Array(SDF_W * SDF_H);
  const edtF = new Float32Array(Math.max(SDF_W, SDF_H));
  const edtD = new Float32Array(Math.max(SDF_W, SDF_H));
  const edtV = new Int32Array(Math.max(SDF_W, SDF_H));
  const edtZ = new Float32Array(Math.max(SDF_W, SDF_H) + 1);
  const sdfFloatData = new Float32Array(SDF_W * SDF_H);
  const sdfHalfData = new Uint16Array(SDF_W * SDF_H);
  const sdfByteData = new Uint8Array(SDF_W * SDF_H);

  function edt1D(f, n, d) {
    edtV[0] = 0;
    edtZ[0] = -INF;
    edtZ[1] = INF;
    let k = 0;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[edtV[k]] + edtV[k] * edtV[k])) / (2 * q - 2 * edtV[k]);
      while (s <= edtZ[k]) {
        k--;
        s = ((f[q] + q * q) - (f[edtV[k]] + edtV[k] * edtV[k])) / (2 * q - 2 * edtV[k]);
      }
      k++;
      edtV[k] = q;
      edtZ[k] = s;
      edtZ[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (edtZ[k + 1] < q) k++;
      const dx = q - edtV[k];
      d[q] = dx * dx + f[edtV[k]];
    }
  }

  function edt2D(grid, w, h) {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) edtF[y] = grid[y * w + x];
      edt1D(edtF, h, edtD);
      for (let y = 0; y < h; y++) grid[y * w + x] = edtD[y];
    }
    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      for (let x = 0; x < w; x++) edtF[x] = grid[rowOff + x];
      edt1D(edtF, w, edtD);
      for (let x = 0; x < w; x++) grid[rowOff + x] = edtD[x];
    }
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  function update(studentName, fontKey) {
    const raw = (studentName || '').trim();
    const label = raw.length > 0 ? raw : ' ';

    textCtx.clearRect(0, 0, SDF_W, SDF_H);
    textCtx.fillStyle = '#000000';
    textCtx.fillRect(0, 0, SDF_W, SDF_H);
    textCtx.fillStyle = '#ffffff';
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';

    // Support long names cleanly without clipping: balanced 2-line wrap + width auto-fit
    let lines = [label];
    if (label.length > 14 && label.includes(' ')) {
      const words = label.split(/\s+/);
      let bestSplit = 1;
      let bestDiff = 999;
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ').length;
        const l2 = words.slice(i).join(' ').length;
        const diff = Math.abs(l1 - l2);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = i;
        }
      }
      lines = [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
    }

    const maxW = SDF_W * 0.80;
    const maxH = lines.length === 1 ? SDF_H * 0.54 : SDF_H * 0.31;
    let fontSize = Math.floor(maxH);
    textCtx.font = getFontSpec(fontKey, fontSize);

    let widest = 1;
    for (const ln of lines) {
      widest = Math.max(widest, textCtx.measureText(ln).width);
    }
    if (widest > maxW) {
      fontSize = Math.max(16, Math.floor(fontSize * (maxW / widest)));
      textCtx.font = getFontSpec(fontKey, fontSize);
    }

    if (lines.length === 1) {
      textCtx.fillText(lines[0], SDF_W * 0.5, SDF_H * 0.52);
    } else {
      textCtx.fillText(lines[0], SDF_W * 0.5, SDF_H * 0.30);
      textCtx.fillText(lines[1], SDF_W * 0.5, SDF_H * 0.72);
    }

    const img = textCtx.getImageData(0, 0, SDF_W, SDF_H).data;
    const total = SDF_W * SDF_H;
    for (let i = 0; i < total; i++) {
      const a = img[i * 4] / 255.0;
      if (a >= 0.5) {
        edtGridOutside[i] = 0.0;
        edtGridInside[i] = INF;
      } else {
        edtGridOutside[i] = INF;
        edtGridInside[i] = 0.0;
      }
    }

    edt2D(edtGridOutside, SDF_W, SDF_H);
    edt2D(edtGridInside, SDF_W, SDF_H);

    const invScale = 1.0 / SDF_H;
    const r8Range = 0.35;

    for (let y = 0; y < SDF_H; y++) {
      const srcRow = (SDF_H - 1 - y) * SDF_W;
      const dstRow = y * SDF_W;
      for (let x = 0; x < SDF_W; x++) {
        const si = srcRow + x;
        const di = dstRow + x;
        const distPx = Math.sqrt(edtGridOutside[si]) - Math.sqrt(edtGridInside[si]);
        const sd = distPx * invScale;
        if (sdfMode === 'R32F') {
          sdfFloatData[di] = sd;
        } else if (sdfMode === 'R16F') {
          sdfHalfData[di] = floatToHalf(sd);
        } else {
          const norm = Math.max(0.0, Math.min(1.0, sd / (2.0 * r8Range) + 0.5));
          sdfByteData[di] = Math.round(norm * 255);
        }
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (sdfMode === 'R32F') {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, SDF_W, SDF_H, 0, gl.RED, gl.FLOAT, sdfFloatData);
    } else if (sdfMode === 'R16F') {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, SDF_W, SDF_H, 0, gl.RED, gl.HALF_FLOAT, sdfHalfData);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SDF_W, SDF_H, 0, gl.RED, gl.UNSIGNED_BYTE, sdfByteData);
    }
  }

  return { texture, update };
}
