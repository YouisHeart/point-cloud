import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export const useAreaMeasurement = ({ scene, renderer, camera }) => {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // 平面用于鼠标未拾取到模型时的交点计算
  const plane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();

  const stateRef = useRef({
    points: [],           // 存储多边形顶点
    spheres: [],          // 存储所有红点
    lines: [],            // 存储多边形边
    fillMesh: null,       // 填充面片
    areaLabel: null,      // 面积标签
    tempLine: null,       // 临时线段（鼠标移动时）
    isMeasuring: false,   // 是否在测量模式
    viewerRef: null       // 模型引用
  });

  // 设置viewer引用
  const setViewer = (viewer) => {
    stateRef.current.viewerRef = viewer;
  };

  // 创建红点
  const createPoint = (position) => {
    const geometry = new THREE.SphereGeometry(0.01, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    scene.add(sphere);
    return sphere;
  };

  // 创建线
  const createLine = (p1, p2, color = 0x00ff00) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    return line;
  };

  // 更新线
  const updateLine = (line, p1, p2) => {
    if (!line) return;
    line.geometry.setFromPoints([p1, p2]);
    line.geometry.attributes.position.needsUpdate = true;
  };

  // 创建填充面片
  const createFillMesh = (points) => {
    if (points.length < 3) return null;

    // 创建多边形几何体
    const vertices = [];
    points.forEach(point => {
      vertices.push(point.x, point.y, point.z);
    });

    // 计算三角形索引（简单的三角剖分，假设点是共面的且按顺序排列）
    const indices = [];
    for (let i = 1; i < points.length - 1; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // 创建半透明填充材质
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return mesh;
  };

  // 更新填充面片
  const updateFillMesh = () => {
    const state = stateRef.current;
    
    // 移除旧的填充面片
    if (state.fillMesh) {
      scene.remove(state.fillMesh);
      state.fillMesh = null;
    }

    // 创建新的填充面片
    if (state.points.length >= 3) {
      state.fillMesh = createFillMesh(state.points);
    }
  };

  // 创建面积标签
  const createAreaLabel = (position, area) => {
    // 移除旧的标签
    if (stateRef.current.areaLabel) {
      scene.remove(stateRef.current.areaLabel);
    }

    const div = document.createElement('div');
    div.textContent = area.toFixed(2) + '㎡';
    div.style.color = 'white';
    div.style.fontSize = '16px';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '1px 1px 2px black';
    div.style.backgroundColor = 'rgba(0,0,0,0.7)';
    div.style.padding = '4px 8px';
    div.style.borderRadius = '4px';
    div.style.pointerEvents = 'none';
    
    const label = new CSS2DObject(div);
    label.position.copy(position);
    scene.add(label);
    return label;
  };

  // 计算多边形面积
  const calculatePolygonArea = (points) => {
    if (points.length < 3) return 0;

    // 计算多边形所在平面的法向量
    const normal = new THREE.Vector3();
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];
    
    const v1 = new THREE.Vector3().subVectors(p2, p1);
    const v2 = new THREE.Vector3().subVectors(p3, p1);
    normal.crossVectors(v1, v2).normalize();

    // 将点投影到2D平面进行计算
    const projectedPoints = points.map(point => {
      // 创建局部坐标系
      const u = new THREE.Vector3(1, 0, 0);
      if (Math.abs(normal.dot(u)) > 0.999) u.set(0, 1, 0);
      const v = new THREE.Vector3().crossVectors(normal, u).normalize();
      const w = new THREE.Vector3().crossVectors(v, normal).normalize();
      
      // 计算投影坐标
      const relativePos = new THREE.Vector3().subVectors(point, points[0]);
      return {
        x: relativePos.dot(v),
        y: relativePos.dot(w)
      };
    });

    // 使用鞋带公式计算面积
    let area = 0;
    const n = projectedPoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += projectedPoints[i].x * projectedPoints[j].y;
      area -= projectedPoints[j].x * projectedPoints[i].y;
    }
    area = Math.abs(area) / 2;

    return area;
  };

  // 获取鼠标与场景的交点
  const getIntersectPoint = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 先尝试拾取模型点
    if (stateRef.current.viewerRef) {
      const intersects = raycaster.intersectObject(stateRef.current.viewerRef, true);
      if (intersects.length > 0) {
        return intersects[0].point.clone();
      }
    }

    // 如果没有拾取到模型点，使用与平面的交点
    const state = stateRef.current;
    if (state.points.length > 0) {
      const lastPoint = state.points[state.points.length - 1];
      planeNormal.copy(camera.position).normalize();
      plane.setFromNormalAndCoplanarPoint(planeNormal, lastPoint);
      
      const ray = raycaster.ray;
      const target = new THREE.Vector3();
      
      if (ray.intersectPlane(plane, target)) {
        return target.clone();
      }
    }
    
    return null;
  };

  // 左键点击处理
  const handleClick = (event) => {
    const state = stateRef.current;
    if (!state.isMeasuring) return;

    const point = getIntersectPoint(event);
    if (!point) return;

    // 创建新点
    const newSphere = createPoint(point);
    state.spheres.push(newSphere);
    state.points.push(point);

    // 创建线段
    if (state.points.length > 1) {
      const lastPoint = state.points[state.points.length - 2];
      const newLine = createLine(lastPoint, point, 0x00ff00);
      state.lines.push(newLine);
    }

    // 清除旧的临时线段
    if (state.tempLine) {
      scene.remove(state.tempLine);
      state.tempLine = null;
    }

    // 创建新的临时线段
    if (state.points.length >= 1) {
      state.tempLine = createLine(point, point, 0xffff00);
    }

    // 更新填充面片
    if (state.points.length >= 3) {
      updateFillMesh();
    }

    // 更新面积标签
    if (state.points.length >= 3) {
      const area = calculatePolygonArea(state.points);
      
      // 计算中心点
      const center = new THREE.Vector3();
      state.points.forEach(p => center.add(p));
      center.divideScalar(state.points.length);
      
      state.areaLabel = createAreaLabel(center, area);
    }
  };

  // 鼠标移动处理
  const handleMouseMove = (event) => {
    const state = stateRef.current;
    if (!state.isMeasuring || state.points.length === 0) return;

    const point = getIntersectPoint(event);
    if (!point) return;

    const lastPoint = state.points[state.points.length - 1];
    updateLine(state.tempLine, lastPoint, point);
  };

  // 右键取消/完成
  const handleRightClick = (event) => {
    event.preventDefault();

    const state = stateRef.current;
    
    if (state.points.length > 0) {
      // 移除临时线段
      if (state.tempLine) {
        scene.remove(state.tempLine);
        state.tempLine = null;
      }

      // 闭合多边形：连接最后一个点和第一个点
      if (state.points.length >= 3) {
        const firstPoint = state.points[0];
        const lastPoint = state.points[state.points.length - 1];
        const closeLine = createLine(lastPoint, firstPoint, 0x00ff00);
        state.lines.push(closeLine);
        
        // 更新填充面片
        updateFillMesh();
        
        // 计算最终面积
        const area = calculatePolygonArea(state.points);
        console.log("面积测量完成，总面积:", area.toFixed(2), "㎡");
      }
      
      state.isMeasuring = false;
    }
  };

  // 清除所有测量标记
  const clearMeasurements = () => {
    const state = stateRef.current;
    
    state.spheres.forEach(sphere => scene.remove(sphere));
    state.lines.forEach(line => scene.remove(line));
    if (state.fillMesh) scene.remove(state.fillMesh);
    if (state.areaLabel) scene.remove(state.areaLabel);
    if (state.tempLine) scene.remove(state.tempLine);
    
    state.points = [];
    state.spheres = [];
    state.lines = [];
    state.fillMesh = null;
    state.areaLabel = null;
    state.tempLine = null;
    state.isMeasuring = false;
    
    console.log("已清除所有面积测量标记");
  };

  // 开始测量
  const startMeasurement = () => {
    clearMeasurements();
    stateRef.current.isMeasuring = true;
    console.log("开始面积测量，左键添加点，右键闭合多边形");
  };

  // 结束测量
  const stopMeasurement = () => {
    stateRef.current.isMeasuring = false;
  };

  // 键盘事件处理（空格键完成测量）
  const handleKeyDown = (event) => {
    if (event.code === "Space") {
      const state = stateRef.current;
      if (state.isMeasuring && state.points.length >= 3) {
        handleRightClick(event);
      }
    }
  };

  useEffect(() => {
    if (!renderer || !renderer.domElement) return;

    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("contextmenu", handleRightClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener("click", handleClick);
        renderer.domElement.removeEventListener("mousemove", handleMouseMove);
        renderer.domElement.removeEventListener("contextmenu", handleRightClick);
      }
      window.removeEventListener("keydown", handleKeyDown);
      clearMeasurements();
    };
  }, [renderer, camera]);

  return {
    startMeasurement,
    stopMeasurement,
    clearMeasurements,
    setViewer,
    isMeasuring: stateRef.current.isMeasuring
  };
};