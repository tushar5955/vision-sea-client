import { Fragment, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import CyberneticFace from './parts/CyberneticFace'
import CyberneticEyes from './parts/CyberneticEyes'
import SolarSystem, { type SolarSystemProps } from './parts/SolarSystem'

export interface CyberAvatarProps {
  showSolarSystem?: boolean
  solarProps?: Partial<SolarSystemProps>
  headLightColor?: string
  headLightIntensity?: number
}

export default function CyberAvatar({
  showSolarSystem = true,
  solarProps,
  headLightColor = '#3a7fd4',
  headLightIntensity = 0.25,
}: CyberAvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!headGroupRef.current) return
    const t = state.clock.elapsedTime
    const yaw = Math.sin(t * 0.6) * 0.02 + Math.sin(t * 1.7) * 0.01
    const pitch = Math.sin(t * 0.8 + 1.2) * 0.012 + Math.sin(t * 1.3) * 0.006
    headGroupRef.current.rotation.set(pitch, yaw, 0)
    headGroupRef.current.position.y = Math.sin(t * 0.5) * 0.02
    headGroupRef.current.scale.setScalar(1)
  })

  return (
    <Fragment>
      {showSolarSystem && (
        <group position={[0, 0, 0]}>
          <SolarSystem {...solarProps} />
        </group>
      )}

      <group ref={headGroupRef} position={[0, 0, 0]}>
        <CyberneticFace />
        <CyberneticEyes />
        <pointLight position={[0, 0, 2]} color={headLightColor} intensity={headLightIntensity} distance={4} />
      </group>
    </Fragment>
  )
}
