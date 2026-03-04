import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { useEffect, useRef } from "react"
import { useViewer } from "./composable/useViewer"
import { PerspectiveCamera,Scene,Vector3 } from 'three';
import "./App.css"

function setupCamera() {
  const camera = new PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, -4, 0);
  camera.lookAt(new Vector3().fromArray([0, 0, 0]));
  camera.up = new Vector3().fromArray([0, -1, -0.6]).normalize();
  return camera;
}

function setupScene() {
  const scene = new Scene();
  return scene;
}

export default function App() {
  const scene = useRef(setupScene());
  const camera = useRef(setupCamera());
  useViewer({ scene: scene.current });
  return (
    <Canvas
      scene={scene.current}
      camera={camera.current}
    >
      <OrbitControls />
    </Canvas>
  )
}