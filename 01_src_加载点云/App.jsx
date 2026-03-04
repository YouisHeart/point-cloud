import { Canvas, useLoader } from "@react-three/fiber"
import { OrbitControls,Environment } from "@react-three/drei"
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader"
import * as THREE from "three"
import {  useMemo } from "react"
import "./App.css"

// 加载ply文件
function PlyPoints() {
  const geometry = useLoader(PLYLoader, "./models/point-building.ply")

  useMemo(()=>{
    geometry.computeVertexNormals()
    geometry.center()
    console.log(geometry.attributes)
  },[geometry])

  return (
    <points
     geometry={geometry}
     rotation={[-Math.PI / 2, 0, 0]}
    >
      <pointsMaterial
       size={0.09}
       vertexColors
      />
    </points>
  )
}

function Box() {
  return (
    <>
    <Environment
     background={true}
     files="./hdr/bryanston_park_sunrise_2k.hdr"
     backgroundIntensity={1.5}
     >
    </Environment>
    <PlyPoints />
    </>
  )
}

export default function App() {
  return (
    <Canvas>
      <ambientLight />
      <Box />
      <OrbitControls />
    </Canvas>
  )
}