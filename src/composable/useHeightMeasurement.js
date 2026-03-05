// useHeightMeasurement.js
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

export const useHeightMeasurement = ({ scene, renderer, camera }) => {
  const viewerRef = useRef(null)
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  
  // 创建平面用于鼠标未拾取到模型时的交点计算
  const plane = new THREE.Plane()
  const planeNormal = new THREE.Vector3()

  const stateRef = useRef({
    points: [],           // 存储所有点 [底部点, 顶部点, 垂直点]
    spheres: [],          // 存储所有红点
    lines: [],            // 存储所有线段
    distanceLabels: [],   // 存储所有距离标签
    tempLine: null,       // 临时线段
    isMeasuring: false,   // 是否在测量模式
    step: 0,              // 测量步骤: 0-等待第一个点, 1-等待第二个点, 2-等待确认
    bottomPoint: null,    // 底部点
    topPoint: null,       // 顶部点
    verticalPoint: null,  // 垂直点
    triangleLines: [],    // 三角形的三条线
    triangleLabels: []    // 三角形的三个标签
  })

  useEffect(() => {
    // ================================
    // 创建红点
    // ================================
    const createPoint = (position, color = 0xff0000) => {
      const geometry = new THREE.SphereGeometry(0.01, 16, 16)
      const material = new THREE.MeshBasicMaterial({ color })
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.copy(position)
      scene.add(sphere)
      return sphere
    }

    // ================================
    // 创建线
    // ================================
    const createLine = (p1, p2, color = 0xff0000, dashed = false) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
      
      let material
      if (dashed) {
        material = new THREE.LineDashedMaterial({ 
          color, 
          dashSize: 0.05, 
          gapSize: 0.025,
          linewidth: 1
        })
      } else {
        material = new THREE.LineBasicMaterial({ color })
      }
      
      const line = new THREE.Line(geometry, material)
      
      if (dashed) {
        line.computeLineDistances()
      }
      
      scene.add(line)
      return line
    }

    // ================================
    // 更新线
    // ================================
    const updateLine = (line, p1, p2) => {
      if (!line) return
      line.geometry.setFromPoints([p1, p2])
      line.geometry.attributes.position.needsUpdate = true
      
      if (line.material instanceof THREE.LineDashedMaterial) {
        line.computeLineDistances()
      }
    }

    // ================================
    // 创建距离标签
    // ================================
    const createDistanceLabel = (position, distance, color = 'white', prefix = '') => {
      const div = document.createElement('div')
      div.textContent = prefix + distance.toFixed(2) + 'm'
      div.style.color = color
      div.style.fontSize = '14px'
      div.style.fontWeight = 'bold'
      div.style.textShadow = '1px 1px 2px black'
      div.style.backgroundColor = 'rgba(0,0,0,0.7)'
      div.style.padding = '2px 8px'
      div.style.borderRadius = '4px'
      div.style.pointerEvents = 'none'
      div.style.userSelect = 'none'
      div.style.fontFamily = 'Arial, sans-serif'
      div.style.border = '1px solid ' + color
      
      const label = new CSS2DObject(div)
      label.position.copy(position)
      scene.add(label)
      return label
    }

    // ================================
    // 获取鼠标与场景的交点
    // ================================
    const getIntersectPoint = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // 先尝试拾取模型点
      const intersects = raycaster.intersectObject(viewerRef.current, true)

      if (intersects.length > 0) {
        return intersects[0].point.clone()
      }

      // 如果没有拾取到模型点，使用与平面的交点
      const state = stateRef.current
      if (state.points.length > 0) {
        const lastPoint = state.points[state.points.length - 1]
        planeNormal.copy(camera.position).normalize()
        plane.setFromNormalAndCoplanarPoint(planeNormal, lastPoint)
        
        const ray = raycaster.ray
        const target = new THREE.Vector3()
        
        if (ray.intersectPlane(plane, target)) {
          return target.clone()
        }
      }
      
      return null
    }

    // ================================
    // 计算垂直点
    // ================================
    const calculateVerticalPoint = (bottom, top) => {
      // 创建从底部到顶部的向量
      const dir = new THREE.Vector3().subVectors(top, bottom)
      
      // 垂直点 = 底部点 + (顶部点投影到水平面的向量)
      // 这里我们假设垂直点是与底部点相同高度，但在顶部点的正上方/下方
      const vertical = new THREE.Vector3(top.x, bottom.y, top.z)
      
      return vertical
    }

    // ================================
    // 计算三角形的三个边
    // ================================
    const calculateTriangle = (bottom, top, vertical) => {
      const a = bottom.distanceTo(vertical)  // 水平距离
      const b = vertical.distanceTo(top)     // 垂直距离（高度）
      const c = bottom.distanceTo(top)       // 斜边距离
      
      return { a, b, c }
    }

    // ================================
    // 创建三角形
    // ================================
    const createTriangle = (bottom, top, vertical) => {
      const state = stateRef.current
      
      // 清除旧的三角形
      state.triangleLines.forEach(line => scene.remove(line))
      state.triangleLabels.forEach(label => scene.remove(label))
      
      // 计算三条边
      const distances = calculateTriangle(bottom, top, vertical)
      
      // 创建三条线
      const line1 = createLine(bottom, vertical, 0x00ff00) // 水平边 - 绿色
      const line2 = createLine(vertical, top, 0x0000ff, true) // 垂直边 - 蓝色（虚线）
      const line3 = createLine(bottom, top, 0xff0000) // 斜边 - 红色
      
      // 创建三个标签
      const mid1 = new THREE.Vector3().addVectors(bottom, vertical).multiplyScalar(0.5)
      const mid2 = new THREE.Vector3().addVectors(vertical, top).multiplyScalar(0.5)
      const mid3 = new THREE.Vector3().addVectors(bottom, top).multiplyScalar(0.5)
      
      const label1 = createDistanceLabel(mid1, distances.a, '#00ff00', 'H: ')
      const label2 = createDistanceLabel(mid2, distances.b, '#0000ff', 'V: ')
      const label3 = createDistanceLabel(mid3, distances.c, '#ff0000', 'D: ')
      
      state.triangleLines = [line1, line2, line3]
      state.triangleLabels = [label1, label2, label3]
    }

    // ================================
    // 重置测量
    // ================================
    const resetMeasurement = () => {
      const state = stateRef.current
      
      // 移除所有点
      state.spheres.forEach(sphere => scene.remove(sphere))
      state.lines.forEach(line => scene.remove(line))
      state.distanceLabels.forEach(label => scene.remove(label))
      state.triangleLines.forEach(line => scene.remove(line))
      state.triangleLabels.forEach(label => scene.remove(label))
      if (state.tempLine) scene.remove(state.tempLine)
      
      // 重置状态
      state.points = []
      state.spheres = []
      state.lines = []
      state.distanceLabels = []
      state.triangleLines = []
      state.triangleLabels = []
      state.tempLine = null
      state.isMeasuring = false
      state.step = 0
      state.bottomPoint = null
      state.topPoint = null
      state.verticalPoint = null
    }

    // ================================
    // 左键点击
    // ================================
    const handleClick = (event) => {
      const point = getIntersectPoint(event)
      if (!point) return

      const state = stateRef.current
      
      if (!state.isMeasuring) {
        // 开始新的测量
        resetMeasurement()
        state.isMeasuring = true
        state.step = 1
        state.bottomPoint = point
        
        // 创建底部点
        const sphere = createPoint(point, 0xff0000)
        state.spheres.push(sphere)
        state.points.push(point)
        
        console.log("请选择顶部点")
      } else if (state.step === 1) {
        // 选择顶部点
        state.step = 2
        state.topPoint = point
        
        // 创建顶部点
        const sphere = createPoint(point, 0xff0000)
        state.spheres.push(sphere)
        state.points.push(point)
        
        // 计算并创建垂直点
        const vertical = calculateVerticalPoint(state.bottomPoint, state.topPoint)
        state.verticalPoint = vertical
        
        // 创建垂直点（用不同颜色）
        const verticalSphere = createPoint(vertical, 0xffff00)
        state.spheres.push(verticalSphere)
        state.points.push(vertical)
        
        // 创建临时三角形
        createTriangle(state.bottomPoint, state.topPoint, vertical)
        
        // 移除临时线段
        if (state.tempLine) {
          scene.remove(state.tempLine)
          state.tempLine = null
        }
        
        console.log("按空格键确认测量结果")
      }
    }

    // ================================
    // 鼠标移动（动态拉线）
    // ================================
    const handleMouseMove = (event) => {
      const state = stateRef.current
      if (!state.isMeasuring) return

      const point = getIntersectPoint(event)
      if (!point) return

      if (state.step === 1) {
        // 正在选择顶部点，显示从底部到鼠标的线
        if (!state.tempLine) {
          state.tempLine = createLine(state.bottomPoint, point, 0xffff00)
        } else {
          updateLine(state.tempLine, state.bottomPoint, point)
        }
      }
    }

    // ================================
    // 空格键确认
    // ================================
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        
        const state = stateRef.current
        if (state.step === 2 && state.bottomPoint && state.topPoint && state.verticalPoint) {
          // 计算最终结果
          const distances = calculateTriangle(state.bottomPoint, state.topPoint, state.verticalPoint)
          
          console.log('========== 三角测量结果 ==========')
          console.log(`水平距离: ${distances.a.toFixed(2)} m`)
          console.log(`垂直距离: ${distances.b.toFixed(2)} m`)
          console.log(`斜边距离: ${distances.c.toFixed(2)} m`)
          console.log('=================================')
          
          // 测量完成，进入完成状态
          state.isMeasuring = false
          state.step = 3
        }
      } else if (event.key === 'Escape') {
        // ESC键重置
        resetMeasurement()
        console.log("测量已重置")
      }
    }

    // ================================
    // 右键取消
    // ================================
    const handleRightClick = (event) => {
      event.preventDefault()
      resetMeasurement()
      console.log("测量已取消")
    }

    // 设置 viewer 引用
    const viewer = scene.children.find(child => child instanceof GaussianSplats3D.DropInViewer)
    if (viewer) {
      viewerRef.current = viewer
    }

    // 添加事件监听
    renderer.domElement.addEventListener("click", handleClick)
    renderer.domElement.addEventListener("mousemove", handleMouseMove)
    renderer.domElement.addEventListener("contextmenu", handleRightClick)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      renderer.domElement.removeEventListener("click", handleClick)
      renderer.domElement.removeEventListener("mousemove", handleMouseMove)
      renderer.domElement.removeEventListener("contextmenu", handleRightClick)
      window.removeEventListener("keydown", handleKeyDown)
      resetMeasurement()
    }

  }, [scene, renderer, camera])

  // 返回控制方法
  return {
    startMeasurement: () => {
      resetMeasurement()
      stateRef.current.isMeasuring = true
      stateRef.current.step = 1
      console.log("开始三角测量，请选择底部点")
    },
    resetMeasurement: () => resetMeasurement(),
    getResult: () => {
      const state = stateRef.current
      if (state.bottomPoint && state.topPoint && state.verticalPoint) {
        return calculateTriangle(state.bottomPoint, state.topPoint, state.verticalPoint)
      }
      return null
    }
  }
}