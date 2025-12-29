# CyberAvatar component

A self-contained 3D cybernetic avatar with subtle motion and a minimalist solar system halo. Built with React Three Fiber and drei.

You can copy the entire `Avatar` folder into another React app and use the components directly.

## Components

- `CyberAvatar` — scene-only avatar content (use inside your existing `<Canvas>`)
- `CyberAvatarCanvas` — drop-in component that creates its own `<Canvas>`, camera, and controls

## Requirements

Install peer deps in your app:

- react, react-dom
- three
- @react-three/fiber
- @react-three/drei

## Quick start

Using the Canvas-wrapped component:

```tsx
import AvatarCanvas from './components/Avatar/AvatarCanvas'

export default function Page() {
  return (
    <div style={{ width: 600, height: 400 }}>
      <AvatarCanvas background="#000" />
    </div>
  )
}
```

Using the scene-only component inside your own Canvas:

```tsx
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls } from '@react-three/drei'
import CyberAvatar from './components/Avatar/CyberAvatar'

export default function Page() {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0,0,4]} />
      <ambientLight intensity={0.1} />
      <CyberAvatar showSolarSystem />
      <OrbitControls />
    </Canvas>
  )
}
```

## CyberAvatar props

- `showSolarSystem?: boolean` — show/hide the solar system (default true)
- `solarProps?: Partial<SolarSystemProps>` — tune solar system behavior (speed, scale, etc.)
- `headLightColor?: string` — color of head point light (default `#3a7fd4`)
- `headLightIntensity?: number` — intensity of head point light (default `0.25`)

## CyberAvatarCanvas props (extends CyberAvatar props)

- `className?: string`
- `style?: React.CSSProperties` — set width/height of the container
- `background?: string` — canvas background color (default `#000`)
- `dpr?: number | [number, number]`
- `shadows?: boolean`
- `camera?: { position?: [number, number, number]; fov?: number; near?: number; far?: number }`
- `controls?: { enablePan?: boolean; enableZoom?: boolean; enableRotate?: boolean; autoRotate?: boolean; target?: [number, number, number]; minDistance?: number; maxDistance?: number }`

## Notes

- All visuals are coded inline; no global CSS required.
- If you copy this folder into another app, ensure your TS config supports `tsx` and that peer deps are installed.
