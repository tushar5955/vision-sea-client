import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

export interface CyberneticEyesProps {
  position?: [number, number, number]
  scale?: number
}

export default function CyberneticEyes({ position = [0, 0, 0], scale = 1 }: CyberneticEyesProps) {
  const leftEyeRef = useRef<THREE.Mesh>(null)
  const rightEyeRef = useRef<THREE.Mesh>(null)
  const leftGlowRef = useRef<THREE.Mesh>(null)
  const rightGlowRef = useRef<THREE.Mesh>(null)
  const [blinkState, setBlinkState] = useState({ left: 1, right: 1 })
  const [lastBlink, setLastBlink] = useState(0)

  useFrame((state) => {
    const time = state.clock.elapsedTime
    
    if (time - lastBlink > 2 + Math.random() * 3) {
      setBlinkState({
        left: Math.random() > 0.5 ? 0.1 : 1,
        right: Math.random() > 0.5 ? 0.1 : 1
      })
      setLastBlink(time)
      setTimeout(() => {
        setBlinkState({ left: 1, right: 1 })
      }, 150)
    }

    const leftPulse = Math.sin(time * 3.2) * 0.2 + 0.8
    const rightPulse = Math.sin(time * 2.9) * 0.2 + 0.8

    if (leftGlowRef.current?.material) {
      (leftGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = leftPulse * 0.9
    }
    if (rightGlowRef.current?.material) {
      (rightGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = rightPulse * 0.9
    }
  })

  return (
    <group position={position} scale={scale}>
      <group position={[-0.28, 0.18, 0.6]}>
        <mesh position={[0, 0, -0.01]} rotation={[-Math.PI / 2, 0, 0]}> 
          <ringGeometry args={[0.09, 0.115, 32]} />
          <meshBasicMaterial color="#0b1c26" transparent opacity={0.85} />
        </mesh>
        <Sphere ref={leftEyeRef} args={[0.08, 16, 16]} scale={[1, blinkState.left, 1]}>
          <meshStandardMaterial
            color="#0aa2c0"
            emissive="#0aa2c0"
            emissiveIntensity={0.6}
            transparent
            opacity={0.95}
            roughness={0.35}
            metalness={0.1}
          />
        </Sphere>
        <Sphere ref={leftGlowRef} args={[0.115, 16, 16]} scale={[1, blinkState.left, 1]}>
          <meshStandardMaterial
            color="#3cc6ff"
            emissive="#3cc6ff"
            emissiveIntensity={0.35}
            transparent
            opacity={0.28}
          />
        </Sphere>
        <Sphere args={[0.028, 8, 8]} position={[0.02, 0.02, 0.05]}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1.2}
            transparent
            opacity={0.75}
          />
        </Sphere>
      </group>

      <group position={[0.28, 0.18, 0.6]}>
        <mesh position={[0, 0, -0.01]} rotation={[-Math.PI / 2, 0, 0]}> 
          <ringGeometry args={[0.09, 0.115, 32]} />
          <meshBasicMaterial color="#0b1c26" transparent opacity={0.85} />
        </mesh>
        <Sphere ref={rightEyeRef} args={[0.08, 16, 16]} scale={[1, blinkState.right, 1]}>
          <meshStandardMaterial
            color="#0aa2c0"
            emissive="#0aa2c0"
            emissiveIntensity={0.6}
            transparent
            opacity={0.95}
            roughness={0.35}
            metalness={0.1}
          />
        </Sphere>
        <Sphere ref={rightGlowRef} args={[0.115, 16, 16]} scale={[1, blinkState.right, 1]}>
          <meshStandardMaterial
            color="#3cc6ff"
            emissive="#3cc6ff"
            emissiveIntensity={0.35}
            transparent
            opacity={0.28}
          />
        </Sphere>
        <Sphere args={[0.028, 8, 8]} position={[0.02, 0.02, 0.05]}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1.2}
            transparent
            opacity={0.75}
          />
        </Sphere>
      </group>
    </group>
  )
}
