import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import CyberAvatar, { type CyberAvatarProps } from './CyberAvatar'
import { type CSSProperties } from 'react'

export interface CameraConfig {
  position?: [number, number, number]
  fov?: number
  near?: number
  far?: number
}

export interface ControlsConfig {
  enablePan?: boolean
  enableZoom?: boolean
  enableRotate?: boolean
  autoRotate?: boolean
  target?: [number, number, number]
  minDistance?: number
  maxDistance?: number
}

export interface AvatarCanvasProps extends CyberAvatarProps {
  className?: string
  style?: CSSProperties
  background?: string
  dpr?: number | [number, number]
  shadows?: boolean
  camera?: CameraConfig
  controls?: ControlsConfig
}

export default function AvatarCanvas({
  className,
  style,
  background = '#000000',
  dpr,
  shadows = false,
  camera,
  controls,
  ...avatarProps
}: AvatarCanvasProps) {
  const cam = { position: [0, 0, 4] as [number, number, number], fov: 75, near: 0.1, far: 1000, ...camera }
  const ctl = {
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
    autoRotate: false,
    target: [0, 0, 0] as [number, number, number],
    minDistance: 2,
    maxDistance: 8,
    ...controls,
  }

  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: background,
    ...style,
  }

  return (
    <div className={className} style={containerStyle}>
      <Canvas dpr={dpr} shadows={shadows}>
        <PerspectiveCamera makeDefault position={cam.position} fov={cam.fov} near={cam.near} far={cam.far} />
        <ambientLight intensity={0.1} />
        <CyberAvatar {...avatarProps} />
        <OrbitControls
          enablePan={ctl.enablePan}
          enableZoom={ctl.enableZoom}
          enableRotate={ctl.enableRotate}
          autoRotate={ctl.autoRotate}
          target={ctl.target}
          minDistance={ctl.minDistance}
          maxDistance={ctl.maxDistance}
        />
        <color attach="background" args={[background]} />
      </Canvas>
    </div>
  )
}
