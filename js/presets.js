export const DEFAULT_STATE = {
  studentName: 'STUDENT NAME',
  font: 'sans',
  textSize: 0.96,
  textDepth: 0.065,
  textThickness: 0.000,
  textRotY: 0,
  textRotX: 0,
  textPosX: 0.00,
  textPosY: 0.00,

  refraction: 1.00,
  ior: 1.52,
  reflection: 1.08,
  fresnel: 1.15,
  dispersion: 0.045,
  transparency: 0.95,

  frost: 0.03,
  roughness: 0.05,
  smoothness: 0.95,
  waterDistortion: 0.16,
  surfaceDetail: 0.22,

  lightIntensity: 1.35,
  lightColor: '#d8f0ff',
  lightAzimuth: 42,
  lightElevation: 36,
  rimLight: 1.15,
  bgIllum: 0.85,

  sphereSize: 1.00,
  internalGlow: 0.80,
  particles: 65,
  animSpeed: 1.00,
  camYaw: 0,
  camPitch: 8,
  camZoom: 4.35,

  // Material shader properties driven by presets
  baseTint: [0.90, 0.97, 1.0],
  absorption: [0.14, 0.06, 0.02],
  engravingColor: [0.88, 0.97, 1.0],
  rimColor: [0.35, 0.78, 1.0],
  metalness: 0.0,
  iridescence: 0.12,
  icePreset: 0.0,

  // Interactive modes
  activePreset: 'crystal',
  shapeType: 0,
  paused: false,
  explodeMode: false,
  xrayMode: false,
  lightExperiment: false,
  freezeMode: false,
  presentationMode: false
};

export const PRESETS = [
  {
    id: 'crystal',
    name: 'Pure Crystal Glass',
    swatch: 'radial-gradient(circle at 30% 30%, #ffffff, #bae6fd 42%, #38bdf8 78%, #0f172a)',
    values: {
      refraction: 1.00, ior: 1.52, reflection: 1.08, fresnel: 1.15, dispersion: 0.045, transparency: 0.95,
      frost: 0.03, roughness: 0.05, smoothness: 0.95, waterDistortion: 0.16, surfaceDetail: 0.22,
      lightIntensity: 1.35, lightColor: '#d8f0ff', rimLight: 1.15, bgIllum: 0.85, internalGlow: 0.95,
      baseTint: [0.90, 0.97, 1.0], absorption: [0.14, 0.06, 0.02], engravingColor: [0.88, 0.97, 1.0],
      rimColor: [0.35, 0.78, 1.0], metalness: 0.0, iridescence: 0.12, icePreset: 0.0
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean Water',
    swatch: 'radial-gradient(circle at 30% 30%, #67e8f9, #0284c7 48%, #0c4a6e 82%, #020617)',
    values: {
      refraction: 1.12, ior: 1.33, reflection: 0.95, fresnel: 1.25, dispersion: 0.028, transparency: 0.92,
      frost: 0.02, roughness: 0.08, smoothness: 0.92, waterDistortion: 0.62, surfaceDetail: 0.45,
      lightIntensity: 1.40, lightColor: '#7dd3fc', rimLight: 1.35, bgIllum: 0.80, internalGlow: 1.08,
      baseTint: [0.42, 0.88, 1.0], absorption: [0.95, 0.24, 0.08], engravingColor: [0.72, 0.98, 1.0],
      rimColor: [0.10, 0.85, 0.95], metalness: 0.0, iridescence: 0.08, icePreset: 0.0
    }
  },
  {
    id: 'ice',
    name: 'Frozen Ice',
    swatch: 'radial-gradient(circle at 30% 30%, #f0f9ff, #93c5fd 48%, #3b82f6 82%, #172554)',
    values: {
      refraction: 0.92, ior: 1.31, reflection: 1.15, fresnel: 1.35, dispersion: 0.032, transparency: 0.86,
      frost: 0.46, roughness: 0.34, smoothness: 0.66, waterDistortion: 0.04, surfaceDetail: 0.78,
      lightIntensity: 1.45, lightColor: '#e0f2fe', rimLight: 1.40, bgIllum: 0.90, internalGlow: 1.02,
      baseTint: [0.78, 0.93, 1.0], absorption: [0.38, 0.14, 0.04], engravingColor: [0.94, 0.99, 1.0],
      rimColor: [0.55, 0.86, 1.0], metalness: 0.0, iridescence: 0.14, icePreset: 0.95
    }
  },
  {
    id: 'mercury',
    name: 'Liquid Mercury',
    swatch: 'radial-gradient(circle at 30% 30%, #ffffff, #cbd5e1 45%, #475569 80%, #0f172a)',
    values: {
      refraction: 0.55, ior: 1.95, reflection: 1.85, fresnel: 1.75, dispersion: 0.020, transparency: 0.48,
      frost: 0.00, roughness: 0.03, smoothness: 0.97, waterDistortion: 0.46, surfaceDetail: 0.28,
      lightIntensity: 1.55, lightColor: '#f1f5f9', rimLight: 1.45, bgIllum: 1.05, internalGlow: 1.45,
      baseTint: [0.88, 0.92, 0.98], absorption: [0.22, 0.20, 0.18], engravingColor: [0.96, 0.99, 1.0],
      rimColor: [0.72, 0.85, 1.0], metalness: 0.82, iridescence: 0.10, icePreset: 0.0
    }
  },
  {
    id: 'sapphire',
    name: 'Blue Sapphire',
    swatch: 'radial-gradient(circle at 30% 30%, #93c5fd, #2563eb 48%, #1e3a8a 82%, #090d28)',
    values: {
      refraction: 1.24, ior: 1.77, reflection: 1.35, fresnel: 1.45, dispersion: 0.055, transparency: 0.90,
      frost: 0.02, roughness: 0.04, smoothness: 0.96, waterDistortion: 0.10, surfaceDetail: 0.35,
      lightIntensity: 1.50, lightColor: '#93c5fd', rimLight: 1.55, bgIllum: 0.82, internalGlow: 1.22,
      baseTint: [0.46, 0.72, 1.0], absorption: [1.35, 0.52, 0.06], engravingColor: [0.82, 0.94, 1.0],
      rimColor: [0.26, 0.54, 1.0], metalness: 0.05, iridescence: 0.18, icePreset: 0.22
    }
  },
  {
    id: 'prism',
    name: 'Rainbow Prism',
    swatch: 'conic-gradient(from 40deg, #f472b6, #facc15, #34d399, #38bdf8, #a78bfa, #f472b6)',
    values: {
      refraction: 1.35, ior: 2.15, reflection: 1.30, fresnel: 1.50, dispersion: 0.165, transparency: 0.96,
      frost: 0.00, roughness: 0.02, smoothness: 0.98, waterDistortion: 0.12, surfaceDetail: 0.30,
      lightIntensity: 1.55, lightColor: '#ffffff', rimLight: 1.40, bgIllum: 0.92, internalGlow: 1.15,
      baseTint: [0.96, 0.96, 1.0], absorption: [0.06, 0.05, 0.04], engravingColor: [1.0, 0.98, 0.95],
      rimColor: [0.68, 0.55, 1.0], metalness: 0.0, iridescence: 0.65, icePreset: 0.10
    }
  },
  {
    id: 'frosted',
    name: 'Frosted Glass',
    swatch: 'radial-gradient(circle at 30% 30%, #f8fafc, #cbd5e1 52%, #64748b 86%, #1e293b)',
    values: {
      refraction: 0.82, ior: 1.48, reflection: 0.78, fresnel: 1.28, dispersion: 0.018, transparency: 0.78,
      frost: 0.82, roughness: 0.68, smoothness: 0.32, waterDistortion: 0.06, surfaceDetail: 0.62,
      lightIntensity: 1.30, lightColor: '#e2e8f0', rimLight: 1.25, bgIllum: 0.95, internalGlow: 1.22,
      baseTint: [0.90, 0.94, 0.98], absorption: [0.22, 0.18, 0.14], engravingColor: [0.96, 0.99, 1.0],
      rimColor: [0.58, 0.80, 1.0], metalness: 0.0, iridescence: 0.05, icePreset: 0.18
    }
  },
  {
    id: 'gold',
    name: 'Golden Crystal',
    swatch: 'radial-gradient(circle at 30% 30%, #fef08a, #f59e0b 48%, #92400e 84%, #271204)',
    values: {
      refraction: 1.18, ior: 1.68, reflection: 1.48, fresnel: 1.42, dispersion: 0.060, transparency: 0.88,
      frost: 0.05, roughness: 0.07, smoothness: 0.93, waterDistortion: 0.14, surfaceDetail: 0.32,
      lightIntensity: 1.55, lightColor: '#fde68a', rimLight: 1.45, bgIllum: 0.78, internalGlow: 1.25,
      baseTint: [1.0, 0.86, 0.48], absorption: [0.10, 0.42, 1.35], engravingColor: [1.0, 0.95, 0.74],
      rimColor: [1.0, 0.76, 0.25], metalness: 0.22, iridescence: 0.15, icePreset: 0.12
    }
  },
  {
    id: 'holographic',
    name: 'Magical Holographic',
    swatch: 'radial-gradient(circle at 30% 30%, #f5d0fe, #818cf8 42%, #22d3ee 76%, #1e1b4b)',
    values: {
      refraction: 1.28, ior: 1.85, reflection: 1.50, fresnel: 1.70, dispersion: 0.135, transparency: 0.93,
      frost: 0.04, roughness: 0.05, smoothness: 0.95, waterDistortion: 0.34, surfaceDetail: 0.42,
      lightIntensity: 1.45, lightColor: '#e9d5ff', rimLight: 1.75, bgIllum: 0.95, internalGlow: 1.45,
      baseTint: [0.85, 0.88, 1.0], absorption: [0.28, 0.12, 0.06], engravingColor: [0.94, 0.90, 1.0],
      rimColor: [0.64, 0.48, 1.0], metalness: 0.12, iridescence: 1.00, icePreset: 0.0
    }
  }
];

export const SHAPES = [
  {
    id: 0,
    name: 'Crystal Sphere',
    svg: '<circle cx="12" cy="12" r="9"/>'
  },
  {
    id: 1,
    name: 'Diamond Gem',
    svg: '<polygon points="12 2 20 9 12 22 4 9"/><path d="M4 9h16M12 2l-3 7 3 13 3-13-3-7"/>'
  },
  {
    id: 2,
    name: 'Quartz Prism',
    svg: '<polygon points="12 2 19 6 19 18 12 22 5 18 5 6"/><path d="M12 2v20M5 6l14 0"/>'
  },
  {
    id: 3,
    name: 'Crystal Cube',
    svg: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 4v16M4 8h16" opacity="0.35"/>'
  },
  {
    id: 4,
    name: 'Glass Heart',
    svg: '<path d="M12 20.5s-7.5-4.7-9.2-9.2C1.4 7.7 4 4.5 7.4 4.5c2 0 3.6 1 4.6 2.5 1-1.5 2.6-2.5 4.6-2.5 3.4 0 6 3.2 4.6 6.8-1.7 4.5-9.2 9.2-9.2 9.2z"/>'
  },
  {
    id: 5,
    name: 'Water Drop',
    svg: '<path d="M12 2.5C12 2.5 5 10.2 5 14.8a7 7 0 0 0 14 0C19 10.2 12 2.5 12 2.5z"/>'
  }
];
