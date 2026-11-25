# Prasad K — CRYSTAL IDENTITY

An interactive real-time **WebGL2 3D Optical Raymarching Lab** with live 3D engraved typography, physically inspired refraction, chromatic RGB dispersion, caustic floor rendering, and classroom optical experiment modes.

## Features

- **Live 3D Engraved Typography**: Real-time 2D Euclidean Signed Distance Field (Felzenszwalb & Huttenlocher $O(W \cdot H)$ EDT) extruded and beveled inside the crystal volume.
- **6 Crystal Geometries**: Crystal Sphere, Diamond Gem, Quartz Prism, Crystal Cube, Glass Heart, and Water Drop.
- **9 Optical Material Presets**: Pure Crystal Glass, Deep Ocean Water, Frozen Ice, Liquid Mercury, Blue Sapphire, Rainbow Prism, Frosted Glass, Golden Crystal, and Magical Holographic.
- **Classroom Experiment Modes**:
  - **Name Reveal**: Condenses particles and laser-carves the engraved name from the center outward.
  - **Exploded View**: Separates the outer crystal shell, internal core rings, and engraved lettering.
  - **X-Ray Mode**: Diagnostic optical scan highlighting internal geometry.
  - **Light Experiment**: Orbits a visible light source while displaying live Snell's Law telemetry (Refractive Index $n$, Critical Angle $\theta_c$, Light Azimuth, and Dispersion $\Delta n$).
  - **Freeze Mode**: Crystallizes fluid ripples into solid faceted ice.
  - **Presentation Mode & High-Res Screenshot**: Full-screen view and PNG capture download.

## Project Structure

```text
crystal-identity/
├── index.html          # Main semantic HTML page
├── css/
│   └── styles.css      # Glassmorphic HUD, control panel, and responsive styles
├── js/
│   ├── main.js         # WebGL2 setup, UI wiring, orbit camera, and render loop
│   ├── math.js         # Color conversion and view-projection matrix math
│   ├── presets.js      # Default state, 9 material presets, and 6 crystal shapes
│   ├── sdf.js          # Exact 2D Euclidean Signed Distance Field text generator
│   └── shaders.js      # WebGL2 GLSL ES 3.00 raymarching & particle shaders
├── assets/
│   └── favicon.svg     # Crystal orb SVG icon
└── .nojekyll           # Serves static ES modules directly on GitHub Pages
```

## Running Locally

Because the app uses native ES modules (`<script type="module">`), serve it with any local static web server:

```bash
npx serve .
# or
python -m http.server 8080
```
