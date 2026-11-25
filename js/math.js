export function hexToRgb01(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function buildViewProj(camPos, target, aspect) {
  const f = 3.30;
  const near = 0.1;
  const far = 40.0;
  const fx = f / aspect;

  let zx = camPos[0] - target[0];
  let zy = camPos[1] - target[1];
  let zz = camPos[2] - target[2];
  const zLen = Math.hypot(zx, zy, zz) || 1;
  zx /= zLen;
  zy /= zLen;
  zz /= zLen;

  let rx = zz;
  let ry = 0;
  let rz = -zx;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  const ux = zy * rz - zz * ry;
  const uy = zz * rx - zx * rz;
  const uz = zx * ry - zy * rx;

  const tx = -(rx * camPos[0] + ry * camPos[1] + rz * camPos[2]);
  const ty = -(ux * camPos[0] + uy * camPos[1] + uz * camPos[2]);
  const tz = -(zx * camPos[0] + zy * camPos[1] + zz * camPos[2]);

  const nf = 1 / (near - far);
  const p22 = (far + near) * nf;
  const p32 = (2 * far * near) * nf;

  return new Float32Array([
    rx * fx, ux * f, zx * p22, -zx,
    ry * fx, uy * f, zy * p22, -zy,
    rz * fx, uz * f, zz * p22, -zz,
    tx * fx, ty * f, tz * p22 + p32, -tz
  ]);
}
