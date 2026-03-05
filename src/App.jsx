import { Canvas, useThree, extend } from "@react-three/fiber"
import { OrbitControls, Environment, GizmoHelper, GizmoViewport } from "@react-three/drei"
import { useEffect, useRef } from "react"
import { useViewer } from "./composable/useViewer"
import { useDistanceMeasurement } from "./composable/useDistanceMeasurement"
import { useHeightMeasurement } from "./composable/useHeightMeasurement"
import { useAreaMeasurement } from "./composable/useAreaMeasurement"
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { Button } from 'antd';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import "./App.css"

function SceneContent({measurementRef}) {
  const { scene, camera, gl } = useThree()
  const css2DRendererRef = useRef(null)
  const viewer = useViewer({scene})

  // 距离测量
  const distanceMeasurement = useDistanceMeasurement({
    scene,
    renderer: gl,
    camera: camera
  });

  // 高度测量
  const heightMeasurement = useHeightMeasurement({
    scene,
    renderer: gl,
    camera
  })

  // 面积测量
  const areaMeasurement = useAreaMeasurement({
    scene,
    renderer: gl,
    camera
  })

  // 设置viewer引用到测量hook
  useEffect(() => {
    if (viewer) {
      distanceMeasurement.setViewer(viewer);
      areaMeasurement.setViewer(viewer);
    }
  }, [viewer]);

  // 把方法暴露给外部
  useEffect(() => {
    if (measurementRef) {
      measurementRef.current = {
        distance: distanceMeasurement,
        height: heightMeasurement,
        area:areaMeasurement
      }
    }
  }, [distanceMeasurement,heightMeasurement,areaMeasurement])


  useEffect(() => {
    // 创建 CSS2DRenderer
    const css2DRenderer = new CSS2DRenderer()
    css2DRenderer.setSize(gl.domElement.clientWidth, gl.domElement.clientHeight)
    css2DRenderer.domElement.style.position = 'absolute'
    css2DRenderer.domElement.style.top = '0px'
    css2DRenderer.domElement.style.left = '0px'
    css2DRenderer.domElement.style.pointerEvents = 'none' // 让点击事件穿透
    
    // 将 CSS2DRenderer 的 DOM 元素添加到 canvas 的父容器
    gl.domElement.parentElement.appendChild(css2DRenderer.domElement)
    css2DRendererRef.current = css2DRenderer

    // 创建自定义的渲染循环
    const originalRender = gl.render
    gl.render = function(scene, camera) {
      originalRender.call(this, scene, camera)
      css2DRenderer.render(scene, camera)
    }

    // 处理窗口大小变化
    const handleResize = () => {
      const width = gl.domElement.clientWidth
      const height = gl.domElement.clientHeight
      css2DRenderer.setSize(width, height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      // 清理
      if (css2DRendererRef.current) {
        css2DRendererRef.current.domElement.remove()
      }
      // 恢复原始渲染器
      gl.render = originalRender
    }
  }, [gl])

  useViewer({
    scene,
    renderer: gl,
    camera: camera
  })

  return null
}

export default function App() {
  const measurementRef = useRef(null)

  const handleDistanceClick = ()=>{
    measurementRef.current.distance.startMeasurement();
  }

  const handleHeightClick = () => {
    measurementRef.current.height.startMeasurement();
  }

  const handleAreaClick = () =>{
    measurementRef.current.area.startMeasurement();
  }
  return (
    <>
      {/* UI组件 */}
      <div className="ui">
        <Button type="primary" onClick={handleDistanceClick}>两点量测</Button>
        <Button type="primary" onClick={handleHeightClick}>高度量测</Button>
        <Button type="primary" onClick={handleAreaClick}>面积测量</Button>
      </div>
      
      {/* Threejs场景 */}
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas
          camera={{
            fov: 65,
            position: [0, -4, 0],
            up: [0, -1, -0.6]
          }}
        >
          <OrbitControls />
          <GizmoHelper
            alignment="bottom-right"
            margin={[80, 80]}
          >
            <GizmoViewport axisColors={["red", "green", "blue"]} labelColor="white" />
          </GizmoHelper>
          <SceneContent measurementRef={measurementRef}/>
        </Canvas>
      </div>
    </>
  )
}