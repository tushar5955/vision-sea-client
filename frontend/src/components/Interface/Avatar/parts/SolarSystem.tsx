import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export type Vec3 = [number, number, number]

export interface PlanetConfig {
  name: string
  color: string
  radius: number
  a: number
  e: number
  period: number
  inclination: number
  lonOfNode: number
  argOfPeriapsis?: number
  phase?: number
  showOrbit?: boolean
  direction?: 1 | -1
  orientation?: 'horizontal' | 'vertical' | 'diagonal'
  ring?: { inner: number; outer: number; color: string; opacity?: number }
}

export interface SolarSystemProps {
  center?: Vec3
  scale?: number
  dimFactor?: number
  tiltScale?: number
  viewportFill?: number
  planetScale?: number
  speedFactor?: number
}

export default function SolarSystem({ center = [0, 0, 0], scale = 1, dimFactor = 0.9, tiltScale = 3.5, viewportFill = 0.7, planetScale = 0.75, speedFactor = 1.25 }: SolarSystemProps) {
  const planetRefs = useRef<Record<string, THREE.Group>>({})

  const planets = useMemo<PlanetConfig[]>(() => [
    { name: 'Mercury', color: '#b5b5b5', radius: 0.04, a: 1.0, e: 0.205, period: 45,  inclination: THREE.MathUtils.degToRad(7),   lonOfNode: THREE.MathUtils.degToRad(48),  argOfPeriapsis: THREE.MathUtils.degToRad(29),  phase: 0,   showOrbit: true, direction: 1,  orientation: 'horizontal' },
    { name: 'Venus',   color: '#e3c16f', radius: 0.085, a: 1.4, e: 0.007, period: 80,  inclination: THREE.MathUtils.degToRad(3.4), lonOfNode: THREE.MathUtils.degToRad(76),  argOfPeriapsis: THREE.MathUtils.degToRad(55),  phase: 0.2, showOrbit: true, direction: -1, orientation: 'vertical'   },
    { name: 'Earth',   color: '#4ea1d3', radius: 0.09, a: 1.9, e: 0.017, period: 120, inclination: THREE.MathUtils.degToRad(0),   lonOfNode: THREE.MathUtils.degToRad(-11), argOfPeriapsis: THREE.MathUtils.degToRad(102), phase: 0.7, showOrbit: true, direction: 1,  orientation: 'horizontal' },
    { name: 'Mars',    color: '#d2653a', radius: 0.06, a: 2.5, e: 0.093, period: 180, inclination: THREE.MathUtils.degToRad(1.85),lonOfNode: THREE.MathUtils.degToRad(49),  argOfPeriapsis: THREE.MathUtils.degToRad(286), phase: 1.2, showOrbit: true, direction: -1, orientation: 'vertical'   },
    { name: 'Jupiter', color: '#d8b38a', radius: 0.18, a: 3.3, e: 0.049, period: 360, inclination: THREE.MathUtils.degToRad(1.3), lonOfNode: THREE.MathUtils.degToRad(100), argOfPeriapsis: THREE.MathUtils.degToRad(275), phase: 2.0, showOrbit: true, direction: 1,  orientation: 'diagonal'   },
    { name: 'Saturn',  color: '#e4cf9f', radius: 0.16, a: 4.2, e: 0.056, period: 520, inclination: THREE.MathUtils.degToRad(2.5), lonOfNode: THREE.MathUtils.degToRad(113), argOfPeriapsis: THREE.MathUtils.degToRad(339), phase: 2.8, showOrbit: true, direction: -1, orientation: 'horizontal',
      ring: { inner: 0.22, outer: 0.35, color: '#ccb98a', opacity: 0.35 } },
    { name: 'Uranus',  color: '#8fd6d6', radius: 0.12, a: 5.2, e: 0.047, period: 800, inclination: THREE.MathUtils.degToRad(0.8), lonOfNode: THREE.MathUtils.degToRad(74),  argOfPeriapsis: THREE.MathUtils.degToRad(96),  phase: 3.6, showOrbit: true, direction: 1,  orientation: 'vertical'   },
    { name: 'Neptune', color: '#5a7fe8', radius: 0.11, a: 6.4, e: 0.009, period: 1100,inclination: THREE.MathUtils.degToRad(1.8), lonOfNode: THREE.MathUtils.degToRad(131), argOfPeriapsis: THREE.MathUtils.degToRad(273), phase: 4.4, showOrbit: true, direction: -1, orientation: 'diagonal'   }
  ], [])

  const { viewport } = useThree()
  const maxA = useMemo(() => planets.reduce((m, p) => Math.max(m, p.a), 0), [planets])
  const autoScale = useMemo(() => {
    const clampedFill = Math.min(Math.max(viewportFill, 0.2), 0.95)
    const safety = 0.9
    const targetRadius = Math.min(viewport.width, viewport.height) * (clampedFill * 0.5) * safety
    return maxA > 0 ? targetRadius / maxA : 1
  }, [viewport.width, viewport.height, maxA, viewportFill])
  const computedScale = scale * autoScale

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 20, 20), [])

  const orbitGeometries = useMemo(() => {
    const geos: Record<string, THREE.BufferGeometry> = {}
    planets.forEach(p => {
      if (!p.showOrbit) return
      const segments = 256
      const positions: number[] = []
      const b = p.a * Math.sqrt(1 - p.e * p.e)
      for (let i = 0; i <= segments; i++) {
        const th = (i / segments) * Math.PI * 2
        const x = p.a * Math.cos(th)
        const z = b * Math.sin(th)
        const v = new THREE.Vector3(x, 0, z)
        const m = new THREE.Matrix4()
          .makeRotationY(p.argOfPeriapsis ?? 0)
          .multiply(new THREE.Matrix4().makeRotationX(p.inclination * tiltScale))
          .multiply(new THREE.Matrix4().makeRotationY(p.lonOfNode))
          .multiply(new THREE.Matrix4().makeRotationZ(
            p.orientation === 'vertical' ? Math.PI / 2 : p.orientation === 'diagonal' ? Math.PI / 4 : 0
          ))
        v.applyMatrix4(m)
        positions.push(v.x, v.y, v.z)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geos[p.name] = geo
    })
    return geos
  }, [planets, tiltScale])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    planets.forEach(p => {
      const group = planetRefs.current[p.name]
      if (!group) return
      const dir = p.direction ?? 1
      const progress = ((t * speedFactor) / p.period) % 1
      const theta = dir * (progress * Math.PI * 2) + (p.phase ?? 0)
      const b = p.a * Math.sqrt(1 - p.e * p.e)
      const px = p.a * Math.cos(theta)
      const pz = b * Math.sin(theta)

      const pos = new THREE.Vector3(px, 0, pz)
      const rot = new THREE.Matrix4()
        .makeRotationY(p.argOfPeriapsis ?? 0)
        .multiply(new THREE.Matrix4().makeRotationX(p.inclination * tiltScale))
        .multiply(new THREE.Matrix4().makeRotationY(p.lonOfNode))
        .multiply(new THREE.Matrix4().makeRotationZ(
          p.orientation === 'vertical' ? Math.PI / 2 : p.orientation === 'diagonal' ? Math.PI / 4 : 0
        ))
      pos.applyMatrix4(rot)

      group.position.set(
        center[0] + pos.x * computedScale,
        center[1] + pos.y * computedScale,
        center[2] + pos.z * computedScale
      )

      group.rotation.y += 0.01
    })
  })

  return (
    <group position={center}>
      <group scale={[computedScale, computedScale, computedScale]}>
        {planets.map(p => (
          p.showOrbit ? (
            <group key={p.name + '-orbit'}>
              <lineLoop geometry={orbitGeometries[p.name]}>
                <lineBasicMaterial color={new THREE.Color(p.color).lerp(new THREE.Color('#00e5ff'), 0.5)} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
              </lineLoop>
              <lineLoop geometry={orbitGeometries[p.name]}>
                <lineBasicMaterial color={new THREE.Color(p.color).lerp(new THREE.Color('#39f3ff'), 0.7)} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
              </lineLoop>
            </group>
          ) : null
        ))}
      </group>

      {planets.map(p => (
        <group key={p.name} ref={(g) => { if (g) planetRefs.current[p.name] = g }}>
          <mesh geometry={sphereGeo} scale={[p.radius * planetScale, p.radius * planetScale, p.radius * planetScale]}>
            <meshStandardMaterial
              color={new THREE.Color(p.color).multiplyScalar(dimFactor)}
              roughness={0.8}
              metalness={0.1}
              emissive={new THREE.Color(p.color).multiplyScalar(0.05)}
              emissiveIntensity={0.2}
            />
          </mesh>

          {p.ring ? (
            <mesh rotation={[THREE.MathUtils.degToRad(90), 0, 0]}>
              <ringGeometry args={[p.ring.inner * planetScale, p.ring.outer * planetScale, 64]} />
              <meshBasicMaterial color={p.ring.color} transparent opacity={p.ring.opacity ?? 0.5} side={THREE.DoubleSide} />
            </mesh>
          ) : null}
        </group>
      ))}

      <pointLight position={[0, 0, 0]} color={'#3cc6ff'} intensity={0.35} distance={6} decay={2} />
    </group>
  )
}
