export const CRYSTAL_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

export const CRYSTAL_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform sampler2D uTextSDF;
uniform float uSdfIsR8;

// Camera
uniform vec3 uCamPos;
uniform vec3 uCamTarget;

// Name Engraving
uniform float uTextSize;
uniform float uTextDepth;
uniform float uTextThickness;
uniform vec2 uTextRot;
uniform vec2 uTextPos;

// Optical Controls
uniform float uRefraction;
uniform float uIOR;
uniform float uReflection;
uniform float uFresnel;
uniform float uDispersion;
uniform float uTransparency;

// Surface Controls
uniform float uFrost;
uniform float uRoughness;
uniform float uSmoothness;
uniform float uWaterDistortion;
uniform float uSurfaceDetail;

// Lighting Controls
uniform float uLightIntensity;
uniform vec3 uLightColor;
uniform vec3 uLightDir;
uniform float uRimLight;
uniform float uBgIllum;

// Volume & Material Preset Controls
uniform float uSphereSize;
uniform int uShapeType;
uniform float uInternalGlow;
uniform vec3 uBaseTint;
uniform vec3 uAbsorption;
uniform vec3 uEngravingColor;
uniform vec3 uRimColor;
uniform float uMetalness;
uniform float uIridescence;
uniform float uIcePreset;

// Classroom WOW Mode Factors
uniform float uReveal;
uniform float uExplode;
uniform float uXray;
uniform float uLightExp;
uniform float uFreeze;

/* --- Procedural 3D Noise & FBM --- */
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i + vec3(0,0,0));
  float n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0));
  float n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1));
  float n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1));
  float n111 = hash13(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise3D(p);
    p = p * 2.05 + vec3(13.1, 7.7, 5.3);
    a *= 0.5;
  }
  return v;
}

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

/* --- Analytic Ray-Sphere Bounding Intersection --- */
vec2 intersectSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

/* --- 3D Engraved Student Name SDF --- */
float sdEngravedText(vec3 p) {
  vec3 q = p - vec3(uTextPos.x, uTextPos.y, uExplode * 0.44);
  q.xz *= rot2(-uTextRot.x);
  q.yz *= rot2(-uTextRot.y);

  // Gentle cylindrical wrap inside the crystal sphere
  float curve = 0.11 * (1.0 - uExplode * 0.7);
  q.z -= (q.x * q.x) * curve;

  float boxH = 0.35 * uTextSize * uSphereSize;
  float boxW = boxH * 4.0;
  float halfW = boxW * 0.5;
  float halfH = boxH * 0.5;

  // Fast AABB distance check before texture lookup when far away
  vec3 boxDist = abs(q) - vec3(halfW, halfH, uTextDepth + 0.02);
  float outsideAABB = length(max(boxDist, 0.0));
  if (outsideAABB > 0.05) {
    return outsideAABB * 0.85;
  }

  vec2 uv = vec2(q.x / boxW + 0.5, q.y / boxH + 0.5);
  vec2 clampedUv = clamp(uv, vec2(0.002), vec2(0.998));

  float rawSample = texture(uTextSDF, clampedUv).r;
  float d2dNorm = (uSdfIsR8 > 0.5) ? (rawSample - 0.5) * 0.70 : rawSample;
  float d2d = d2dNorm * boxH - uTextThickness;

  vec2 outBox = max(abs(q.xy) - vec2(halfW, halfH), 0.0);
  if (outBox.x > 0.0 || outBox.y > 0.0) {
    d2d = max(d2d, 0.0) + length(outBox);
  }

  // Inward-compensated bevel keeps letter silhouettes razor-sharp with polished 3D edges!
  float bevel = min(0.0045, uTextDepth * 0.22);
  float dz = abs(q.z) - max(0.008, uTextDepth - bevel);
  vec2 w = vec2(d2d + bevel, dz);
  float d3d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bevel;

  // Center-outward laser carving during Name Reveal
  if (uReveal < 0.999) {
    float revealRadius = mix(-0.08, halfW + 0.22, smoothstep(0.18, 0.96, uReveal));
    float wipe = abs(q.x) - revealRadius;
    d3d = max(d3d, wipe);
  }

  return d3d * 0.75;
}

vec3 calcTextNormal(vec3 p) {
  const float e = 0.0022;
  return normalize(vec3(
    sdEngravedText(p + vec3(e, 0, 0)) - sdEngravedText(p - vec3(e, 0, 0)),
    sdEngravedText(p + vec3(0, e, 0)) - sdEngravedText(p - vec3(0, e, 0)),
    sdEngravedText(p + vec3(0, 0, e)) - sdEngravedText(p - vec3(0, 0, e))
  ));
}

/* --- Internal Optical Core SDF --- */
float sdInternalCore(vec3 p) {
  vec3 q = p - vec3(0.0, 0.0, -uExplode * 0.72);
  float r = uSphereSize * 0.74;
  q.xz *= rot2(uTime * 0.25 * (1.0 - uFreeze));
  q.xy *= rot2(uTime * 0.16 * (1.0 - uFreeze));

  float ring1 = abs(length(vec2(length(q.xz) - r * 0.88, q.y))) - 0.016;
  float ring2 = abs(length(vec2(length(q.yz) - r * 0.76, q.x))) - 0.013;
  float ring3 = abs(length(vec2(length(q.xy) - r * 0.66, q.z))) - 0.011;
  return min(ring1, min(ring2, ring3));
}

/* --- Multi-Shape Optical Crystal SDF Library --- */
float sdBaseShape(vec3 p, float R) {
  if (uShapeType == 1) {
    // Faceted Brilliant Diamond Gem (octahedron intersected with crown table)
    vec3 q = p;
    q.y *= 0.92;
    vec3 a = abs(q);
    float oct = (a.x + a.y + a.z - R * 1.38) * 0.57735;
    float crown = q.y - R * 0.74;
    float girdle = length(q.xz) - R * 1.04;
    float d = max(oct, crown);
    d = max(d, girdle * 0.85);
    return d - 0.025 * R;
  } else if (uShapeType == 2) {
    // Hexagonal Quartz Crystal Prism with tapered pyramidal tips
    vec3 q = p;
    vec3 a = abs(q);
    float hex = max(a.x * 0.866025 + a.z * 0.5, a.z) - R * 0.86;
    float caps = a.y - R * 1.18;
    float taper = (a.x * 0.866025 + a.z * 0.5) * 0.78 + a.y * 0.62 - R * 1.16;
    float d = max(max(hex, caps), taper);
    return d - 0.03 * R;
  } else if (uShapeType == 3) {
    // Rounded Optical K9 Glass Cube
    vec3 b = vec3(R * 0.82);
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - R * 0.14;
  } else if (uShapeType == 4) {
    // Sculpted 3D Crystal Heart
    vec3 q = p / (R * 0.98);
    q.y += 0.10;
    q.z *= 1.48;
    float x = abs(q.x);
    float y = q.y - sqrt(x * x + 0.035) * 0.54 + 0.22;
    float d = length(vec3(x, y, q.z)) - 0.86;
    return d * (R * 0.68);
  } else if (uShapeType == 5) {
    // Suspended Liquid-Crystal Water Teardrop
    vec3 q = p / (R * 0.96);
    q.y += 0.12;
    float stretch = clamp((q.y + 0.75) * 0.55, 0.0, 1.0);
    vec3 td = vec3(q.x * (1.0 + stretch * 0.85), q.y * 0.82, q.z * (1.0 + stretch * 0.85));
    return (length(td) - 0.86) * (R * 0.68);
  }
  // Default (0): Pure Optical Crystal Sphere
  return length(p) - R;
}

/* --- Outer Optical Crystal / Water Geometry SDF --- */
float sdOuterCrystal(vec3 p) {
  float freezeAmt = clamp(uFreeze + uIcePreset, 0.0, 1.0);
  float fluidFactor = (1.0 - uFreeze);
  float t = uTime * fluidFactor;

  float revealScale = smoothstep(0.02, 0.72, uReveal);
  float R = uSphereSize * max(0.01, revealScale);

  float dSphere;
  if (uExplode > 0.001) {
    vec3 pL = p - vec3(-0.68 * uExplode, 0.16 * uExplode, 0.0);
    vec3 pR = p - vec3( 0.68 * uExplode, -0.16 * uExplode, 0.0);
    float sL = max(sdBaseShape(pL, R), pL.x - 0.02);
    float sR = max(sdBaseShape(pR, R), -pR.x - 0.02);
    sL = max(sL, -(sdBaseShape(pL, R) + 0.14));
    sR = max(sR, -(sdBaseShape(pR, R) + 0.14));
    dSphere = min(sL, sR);
  } else {
    dSphere = sdBaseShape(p, R);
  }

  // Animated water surface ripples
  float wave = 0.0;
  if (uWaterDistortion > 0.001) {
    vec3 wp = p * 2.5 + vec3(0.0, -t * 0.85, t * 0.55);
    wave += (fbm(wp) - 0.5) * 0.070 * uWaterDistortion * (1.0 - uFreeze * 0.85);
    wave += sin(p.y * 7.0 - t * 2.2 + p.x * 3.0) * 0.008 * uWaterDistortion * fluidFactor;
  }

  // Crystalline ice faceting
  float facets = 0.0;
  if (freezeAmt > 0.01 || uSurfaceDetail > 0.05) {
    float fAmt = max(freezeAmt * 0.65, uSurfaceDetail * 0.35);
    vec3 fp = abs(p);
    float oct = (fp.x + fp.y + fp.z) * 0.577 - R * 0.94;
    float crystalNoise = abs(noise3D(p * 6.5) - 0.5) * 0.032;
    facets = mix(0.0, crystalNoise, fAmt) + max(0.0, oct) * freezeAmt * 0.14;
  }

  float revealNoise = (1.0 - smoothstep(0.35, 0.95, uReveal)) * (fbm(p * 4.5 - vec3(0.0, uTime * 2.0, 0.0)) - 0.35) * 0.25;

  return (dSphere + wave + facets + revealNoise) * 0.84;
}

vec3 calcOuterNormal(vec3 p) {
  const float e = 0.0025;
  vec3 n = normalize(vec3(
    sdOuterCrystal(p + vec3(e, 0, 0)) - sdOuterCrystal(p - vec3(e, 0, 0)),
    sdOuterCrystal(p + vec3(0, e, 0)) - sdOuterCrystal(p - vec3(0, e, 0)),
    sdOuterCrystal(p + vec3(0, 0, e)) - sdOuterCrystal(p - vec3(0, 0, e))
  ));
  float microAmt = (uFrost * 0.18 + uRoughness * 0.12 + uSurfaceDetail * 0.04) * (1.0 - uSmoothness * 0.55);
  if (microAmt > 0.004) {
    vec3 mn = vec3(
      noise3D(p * 28.0) - 0.5,
      noise3D(p * 28.0 + 17.3) - 0.5,
      noise3D(p * 28.0 + 41.7) - 0.5
    );
    n = normalize(n + mn * microAmt);
  }
  return n;
}

vec3 spectralColor(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

/* --- Studio Environment Map (Softboxes, Nebula, Horizon & Rim Glow) --- */
vec3 sampleEnvironment(vec3 dir) {
  float y = dir.y;
  vec3 col = mix(vec3(0.004, 0.008, 0.022), vec3(0.016, 0.034, 0.082), smoothstep(-0.35, 0.75, y));
  col += vec3(0.016, 0.008, 0.045) * smoothstep(-0.2, 0.5, dir.x) * (1.0 - abs(y));
  col *= uBgIllum;

  // Overhead curved exhibition softbox (gives ultra-realistic museum glass highlights)
  float topBox = smoothstep(0.68, 0.94, dot(dir, normalize(vec3(0.18, 0.92, 0.34))));
  col += uLightColor * topBox * (1.45 * uLightIntensity);

  // Secondary cyan studio strip light on left
  float leftStrip = smoothstep(0.76, 0.97, dot(dir, normalize(vec3(-0.88, 0.28, 0.38))));
  col += uRimColor * leftStrip * (1.22 * uRimLight);

  // Secondary violet-silver studio strip on right-back
  float rightStrip = smoothstep(0.78, 0.97, dot(dir, normalize(vec3(0.84, 0.16, -0.52))));
  col += vec3(0.58, 0.48, 1.0) * rightStrip * (0.98 * uRimLight);

  // Crisp key light disk
  float keySun = pow(max(dot(dir, uLightDir), 0.0), 56.0);
  col += uLightColor * keySun * (2.8 * uLightIntensity);

  // Horizon sheen
  float horizon = exp(-abs(y) * 9.0);
  col += mix(uRimColor, vec3(0.4, 0.55, 0.9), 0.5) * horizon * 0.15 * uBgIllum;

  return col;
}

/* --- Procedural Optical Floor Caustics --- */
vec3 renderFloor(vec3 ro, vec3 rd, float floorY) {
  float tFloor = (floorY - ro.y) / rd.y;
  if (tFloor <= 0.0 || tFloor > 18.0) return vec3(0.0);

  vec3 fp = ro + rd * tFloor;
  float distCenter = length(fp.xz);
  float fade = exp(-distCenter * distCenter * 0.12);
  if (fade < 0.002) return vec3(0.0);

  vec2 lightOffset = -uLightDir.xz / max(0.35, uLightDir.y) * abs(floorY);
  vec2 cp = fp.xz - lightOffset;
  float rC = length(cp);

  float shadow = 1.0 - 0.52 * exp(-rC * rC / (uSphereSize * uSphereSize * 1.15)) * (1.0 - uXray * 0.6);

  float tAnim = uTime * 0.7 * (1.0 - uFreeze);
  float dispShift = uDispersion * 1.45;
  vec3 caustic = vec3(0.0);
  for (int ch = 0; ch < 3; ch++) {
    float shift = (float(ch) - 1.0) * dispShift;
    vec2 pCh = cp * (1.0 + shift * 0.8) + vec2(shift * 0.25, 0.0);
    float w1 = sin(pCh.x * 7.5 + tAnim + sin(pCh.y * 6.0 - tAnim * 0.8));
    float w2 = cos(pCh.y * 8.2 - tAnim * 1.1 + cos(pCh.x * 5.5 + tAnim));
    float cVal = pow(clamp((w1 * w2) * 0.5 + 0.5, 0.0, 1.0), 4.0);
    float focusRing = exp(-pow(length(pCh) - uSphereSize * 0.36, 2.0) * 5.2);
    float focusCore = exp(-dot(pCh, pCh) * 3.2);
    caustic[ch] = (cVal * 0.85 + 0.35) * (focusRing * 0.9 + focusCore * 1.15);
  }

  vec3 floorBase = vec3(0.015, 0.028, 0.065) * uBgIllum * shadow;
  float causticStrength = uLightIntensity * uTransparency * (1.0 - uMetalness * 0.7) * (1.0 - uFrost * 0.45) * smoothstep(0.2, 0.9, uReveal);
  vec3 causticCol = caustic * uLightColor * mix(vec3(1.0), uBaseTint, 0.45) * causticStrength * 0.66;

  float ring = exp(-pow(distCenter - uSphereSize * 1.15, 2.0) * 140.0) * 0.15 * uBgIllum;
  return (floorBase + causticCol + uRimColor * ring) * fade;
}

/* --- Shade 3D Engraved Lettering with Bevel Specular & Caustic Shimmer --- */
vec3 shadeEngravedText(vec3 p, vec3 rd, vec3 n, float internalBoost) {
  vec3 v = -rd;
  float ndl = max(dot(n, uLightDir), 0.0);
  float ndlBack = max(dot(-n, uLightDir), 0.0) * 0.60;
  float ndv = abs(dot(n, v));
  float fres = pow(1.0 - clamp(ndv, 0.0, 1.0), 2.3);

  vec3 h = normalize(uLightDir + v);
  float spec = pow(max(dot(n, h), 0.0), 46.0) * uLightIntensity;
  vec3 h2 = normalize(normalize(vec3(-0.6, 0.4, 0.7)) + v);
  float spec2 = pow(max(dot(n, h2), 0.0), 22.0) * uRimLight * 0.75;

  // Animated internal caustic shimmer across engraved crystal letters
  float tAnim = uTime * 1.1 * (1.0 - uFreeze);
  float shimmer = 0.5 + 0.5 * sin(p.x * 16.0 + tAnim + sin(p.y * 12.0 - tAnim * 0.7));
  shimmer = pow(shimmer, 3.0) * 0.28 * uLightIntensity;

  // Chromatic prism edge glint on engraved bevels
  vec3 edgePrism = spectralColor(ndv * 1.3 + p.x * 0.65 + uTime * 0.12) * (uDispersion * 3.6 + uIridescence * 0.45);

  // Sculpted 3D crystal engraving: deep translucent faces + luminous beveled Fresnel rims
  float bevelRim = pow(1.0 - clamp(ndv, 0.0, 1.0), 1.6);
  vec3 faceCol = mix(uRimColor * 0.42, uEngravingColor * 0.78, 0.45 + 0.55 * ndl + 0.25 * ndlBack);
  vec3 rimGlow = mix(uRimColor, vec3(0.95, 0.98, 1.0), 0.55) * bevelRim * (0.75 + uInternalGlow * 0.65);
  vec3 col = faceCol + rimGlow + uEngravingColor * shimmer * 0.55 + uLightColor * spec * 1.15 + uRimColor * spec2 * 0.8 + edgePrism * bevelRim * 0.55;

  if (uReveal < 0.99) {
    float pulse = (1.0 - smoothstep(0.65, 1.0, uReveal)) * 0.90;
    col += vec3(0.55, 0.92, 1.0) * pulse;
  }

  if (uXray > 0.01) {
    vec3 xrayCol = mix(vec3(0.25, 0.85, 1.0), vec3(0.95, 0.99, 1.0), fres * 0.7 + 0.3) * 1.38;
    col = mix(col, xrayCol, uXray * 0.85);
  }

  return col * internalBoost;
}

/* --- Single-Pass Optimised Interior Trace + Chromatic Exit Dispersion --- */
vec3 traceInteriorChromatic(vec3 entryP, vec3 rdIn, vec3 rdR, vec3 rdB, float effIOR, float disp, out bool hitTextOut) {
  float t = 0.015;
  float maxT = uSphereSize * 2.45;
  vec3 textCol = vec3(0.0);
  bool hitText = false;
  float coreGlow = 0.0;

  for (int i = 0; i < 64; i++) {
    vec3 p = entryP + rdIn * t;

    float dTxt = sdEngravedText(p);
    if (dTxt < 0.0015) {
      vec3 nt = calcTextNormal(p);
      textCol = shadeEngravedText(p, rdIn, nt, 1.20);
      // Add subtle chromatic fringe on the engraved lettering edges
      if (disp > 0.005) {
        float edgeR = clamp(1.0 - abs(sdEngravedText(p + vec3(disp * 0.16, 0.0, 0.0))) * 40.0, 0.0, 1.0);
        float edgeB = clamp(1.0 - abs(sdEngravedText(p - vec3(disp * 0.16, 0.0, 0.0))) * 40.0, 0.0, 1.0);
        textCol += vec3(edgeR * 0.22, 0.0, edgeB * 0.26) * (disp * 8.0);
      }
      hitText = true;
      break;
    }

    float dCore = sdInternalCore(p);
    float coreVis = max(uXray * 0.95, max(uExplode * 0.75, 0.14 * uInternalGlow));
    coreGlow += exp(-abs(dCore) * 34.0) * 0.052 * coreVis;

    float dOut = -sdOuterCrystal(p);
    if (dOut < 0.004 && t > 0.08) break;

    float stepD = min(dTxt, max(0.012, dOut));
    t += clamp(stepD, 0.0012, 0.095);
    if (t > maxT) break;
  }

  hitTextOut = hitText;
  vec3 exitP = entryP + rdIn * t;
  vec3 nExit = -calcOuterNormal(exitP);

  // Chromatic RGB exit refraction (physically separates R, G, B without 3x raymarching!)
  vec3 outG = refract(rdIn, nExit, effIOR);
  vec3 bgG = (length(outG) < 0.001)
    ? sampleEnvironment(reflect(rdIn, nExit)) * 1.18
    : sampleEnvironment(normalize(outG)) + renderFloor(exitP, normalize(outG), -1.32 * uSphereSize) * 0.85;

  vec3 bgTrans = bgG;
  if (disp > 0.003 && uMetalness < 0.75) {
    vec3 outR = refract(rdR, nExit, effIOR - disp);
    vec3 outB = refract(rdB, nExit, effIOR + disp);
    float rCh = (length(outR) < 0.001) ? sampleEnvironment(reflect(rdR, nExit)).r * 1.18 : sampleEnvironment(normalize(outR)).r;
    float bCh = (length(outB) < 0.001) ? sampleEnvironment(reflect(rdB, nExit)).b * 1.18 : sampleEnvironment(normalize(outB)).b;
    bgTrans = vec3(rCh, bgG.g, bCh);
  }

  vec3 absorb = exp(-uAbsorption * (t * 1.12));

  if (hitText) {
    return mix(bgTrans * absorb, textCol, 0.90) + uRimColor * coreGlow;
  } else {
    float scatter = exp(-length(exitP * 0.5) * 1.2) * uInternalGlow * 0.18;
    return bgTrans * absorb + uRimColor * (coreGlow + scatter);
  }
}

/* --- Main Raymarch & Shading Entry --- */
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  vec3 ro = uCamPos;
  vec3 forward = normalize(uCamTarget - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 rd = normalize(forward * 1.65 + right * uv.x + up * uv.y);

  // Base studio backdrop + floor caustics
  vec3 col = sampleEnvironment(rd);
  float floorY = -1.32 * uSphereSize;
  col += renderFloor(ro, rd, floorY);

  // Subtle cosmic center halo behind sphere
  float centerGlow = exp(-dot(uv, uv) * 3.4) * 0.20 * uBgIllum;
  col += mix(uRimColor, vec3(0.36, 0.25, 0.78), 0.45) * centerGlow;

  // Visible Light Source Orb during Light Experiment Mode
  if (uLightExp > 0.01) {
    vec3 lightWorldPos = uLightDir * (uSphereSize * 2.15);
    float tL = dot(lightWorldPos - ro, rd);
    if (tL > 0.0) {
      vec3 closest = ro + rd * tL;
      float dOrb = length(closest - lightWorldPos);
      float orbCore = exp(-dOrb * dOrb * 95.0);
      float orbHalo = exp(-dOrb * 4.5) * 0.55;
      col += (vec3(1.0) * orbCore * 2.5 + uLightColor * orbHalo * 1.4) * uLightExp;
    }
  }

  // Fast Bounding Sphere Check (skips raymarching for ~65% of screen pixels!)
  float boundR = uSphereSize * 1.52 + uExplode * 0.95;
  vec2 bounds = intersectSphere(ro, rd, boundR);
  int hitId = 0;
  float t = 0.0;

  if (bounds.y > 0.0) {
    t = max(0.0, bounds.x);
    float maxT = bounds.y + 0.05;

    for (int i = 0; i < 48; i++) {
      vec3 p = ro + rd * t;
      float dOuter = sdOuterCrystal(p);
      float dScene = dOuter;
      int curId = 1;

      if (uExplode > 0.05) {
        float dTxt = sdEngravedText(p);
        if (dTxt < dScene) {
          dScene = dTxt;
          curId = 2;
        }
        float dCore = sdInternalCore(p);
        if (dCore < dScene) {
          dScene = dCore;
          curId = 3;
        }
      }

      if (dScene < 0.0020) {
        hitId = curId;
        break;
      }
      t += clamp(dScene, 0.008, 0.22);
      if (t > maxT) break;
    }
  }

  if (hitId == 1) {
    vec3 p = ro + rd * t;
    vec3 n = calcOuterNormal(p);
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);

    // Schlick Fresnel
    float f0 = pow((1.0 - uIOR) / (1.0 + uIOR), 2.0);
    f0 = mix(f0, 0.82, uMetalness);
    float fres = clamp((f0 + (1.0 - f0) * pow(1.0 - ndv, 4.0)) * uFresnel, 0.0, 1.0);

    // Reflection + studio specular highlights
    vec3 reflDir = reflect(rd, n);
    vec3 reflCol = sampleEnvironment(reflDir);
    float specPow = mix(18.0, 190.0, clamp(uSmoothness * (1.0 - uRoughness * 0.7), 0.0, 1.0));
    vec3 halfV = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, halfV), 0.0), specPow) * uLightIntensity * 1.95;
    reflCol += uLightColor * spec;

    // Iridescent thin-film holographic reflection tint
    if (uIridescence > 0.01) {
      vec3 irid = spectralColor(ndv * 2.2 + dot(n, uLightDir) * 0.6 + uTime * 0.08);
      reflCol = mix(reflCol, reflCol * (0.65 + 0.9 * irid) + irid * 0.30, uIridescence);
    }

    // Single-pass Chromatic Refraction
    float effIOR = mix(1.0, uIOR, clamp(uRefraction, 0.0, 1.5));
    float disp = uDispersion * uRefraction;
    vec3 rdG = normalize(refract(rd, n, 1.0 / max(1.01, effIOR)));
    vec3 rdR = normalize(refract(rd, n, 1.0 / max(1.01, effIOR - disp)));
    vec3 rdB = normalize(refract(rd, n, 1.0 / max(1.01, effIOR + disp)));

    bool hitTextInside = false;
    vec3 transCol = traceInteriorChromatic(p, rdG, rdR, rdB, effIOR, disp, hitTextInside);

    // Frosted glass diffusion (preserves text readability!)
    if (uFrost > 0.01) {
      vec3 frostBlur = mix(sampleEnvironment(rd), uBaseTint * uLightColor * 0.55, 0.45);
      float frostMix = hitTextInside ? (uFrost * 0.42) : (uFrost * 0.72);
      transCol = mix(transCol, mix(transCol, frostBlur, 0.52), frostMix);
    }

    // Keep engraved text visible even in Liquid Mercury mode
    float reflectBlend = clamp(fres * uReflection * 0.74 + uMetalness * (hitTextInside ? 0.36 : 0.68), 0.0, 0.94);
    vec3 glassCol = mix(transCol * uBaseTint, reflCol * uBaseTint, reflectBlend);
    glassCol += reflCol * (fres * uReflection * 0.34);

    // Rim lighting halo
    float rim = pow(1.0 - ndv, 3.0) * uRimLight;
    glassCol += uRimColor * rim * 0.50;

    // Frozen ice crystalline edge glint
    float freezeAmt = clamp(uFreeze + uIcePreset, 0.0, 1.0);
    if (freezeAmt > 0.05) {
      float frostEdge = pow(1.0 - ndv, 2.2) * (0.5 + 0.5 * noise3D(p * 14.0));
      glassCol += vec3(0.62, 0.88, 1.0) * frostEdge * freezeAmt * 0.44;
    }

    vec3 finalGlass = mix(col, glassCol, clamp(0.18 + uTransparency * 0.82, 0.0, 1.0));
    if (uTransparency < 0.85) {
      float densityMix = (0.85 - uTransparency) * (hitTextInside ? 0.45 : 0.85);
      finalGlass = mix(glassCol, mix(glassCol, uBaseTint * (0.35 + 0.65 * max(dot(n, uLightDir), 0.0)), 0.55), densityMix);
    }

    // X-Ray Diagnostic Mode overlay
    if (uXray > 0.01) {
      float scanLine = 0.5 + 0.5 * sin(p.y * 55.0 - uTime * 3.0);
      vec3 xrayShell = vec3(0.08, 0.48, 0.85) * pow(1.0 - ndv, 1.8) * (1.2 + 0.35 * scanLine);
      vec3 xrayInner = transCol * 1.15 + xrayShell;
      finalGlass = mix(finalGlass, xrayInner, uXray);
    }

    // Light Experiment surface beam alignment highlight
    if (uLightExp > 0.05) {
      float beamAlign = pow(max(dot(n, uLightDir), 0.0), 8.0);
      finalGlass += uLightColor * beamAlign * 0.38 * uLightExp;
    }

    // Smooth analytic anti-aliasing along silhouette edge
    float edgeAA = smoothstep(0.0, 0.075, ndv);
    col = mix(col, finalGlass, mix(0.65, 1.0, edgeAA));
  } else if (hitId == 2) {
    vec3 p = ro + rd * t;
    vec3 n = calcTextNormal(p);
    col = shadeEngravedText(p, rd, n, 1.25);
  } else if (hitId == 3) {
    vec3 p = ro + rd * t;
    vec3 coreCol = mix(uRimColor, uLightColor, 0.45) * (0.95 + 0.55 * uInternalGlow);
    col = mix(col, coreCol, 0.85);
  }

  // Subtle cinematic vignette
  float vig = 1.0 - dot(uv * 0.50, uv * 0.50);
  col *= clamp(vig, 0.64, 1.05);

  // ACES Filmic Tone Mapping
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

  fragColor = vec4(col, 1.0);
}`;

export const PARTICLE_VERT = `#version 300 es
precision highp float;

in vec4 aSeed;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uSphereSize;
uniform float uReveal;
uniform float uFreeze;
uniform float uPixelRatio;

out float vAlpha;
out float vHue;

void main() {
  float phase = aSeed.w * 6.28318;
  float t = uTime * (1.0 - uFreeze * 0.92);

  float ang = aSeed.x * 6.28318 + t * (0.12 + 0.14 * aSeed.w);
  float elev = (aSeed.y - 0.5) * 2.4;
  float rad = uSphereSize * (1.35 + aSeed.z * 2.45);

  float swirl = 1.0 - smoothstep(0.0, 0.88, uReveal);
  rad = mix(rad, uSphereSize * (0.15 + aSeed.z * 0.85), swirl);
  ang += swirl * (6.5 + aSeed.w * 5.0);

  vec3 pos = vec3(
    cos(ang) * rad,
    elev + sin(t * 0.7 + phase) * 0.22 * (1.0 - swirl * 0.6),
    sin(ang) * rad
  );

  vec4 clip = uViewProj * vec4(pos, 1.0);
  gl_Position = clip;

  float dist = max(0.8, clip.w);
  float baseSize = mix(2.2, 6.2, aSeed.w) * (1.0 + swirl * 0.9);
  gl_PointSize = clamp((baseSize * uPixelRatio * 2.4) / dist, 1.5, 18.0);

  float twinkle = 0.55 + 0.45 * sin(t * 2.1 + phase * 3.0);
  vAlpha = twinkle * (0.38 + swirl * 0.52) * smoothstep(7.5, 1.5, dist);
  vHue = aSeed.w;
}`;

export const PARTICLE_FRAG = `#version 300 es
precision highp float;
in float vAlpha;
in float vHue;
uniform vec3 uRimColor;
uniform vec3 uLightColor;
out vec4 fragColor;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p);
  if (r > 0.5) discard;
  float glow = exp(-r * r * 14.0);
  vec3 col = mix(uRimColor, uLightColor, vHue);
  fragColor = vec4(col * glow * 1.4, glow * vAlpha);
}`;
