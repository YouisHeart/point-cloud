import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export const useDistanceMeasurement = ({ scene, renderer, camera }) => {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // 平面用于鼠标未拾取到模型时的交点计算
  const plane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();

  const stateRef = useRef({
    points: [],           // 存储所有点
    spheres: [],          // 存储所有红点
    lines: [],            // 存储所有线段
    distanceLabels: [],   // 存储所有距离标签
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

  // 创建距离标签
  const createDistanceLabel = (position, distance) => {
    const div = document.createElement('div');
    div.textContent = distance.toFixed(2) + 'm';
    div.style.color = 'white';
    div.style.fontSize = '14px';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '1px 1px 2px black';
    div.style.backgroundColor = 'rgba(0,0,0,0.6)';
    div.style.padding = '2px 6px';
    div.style.borderRadius = '4px';
    div.style.pointerEvents = 'none';
    
    const label = new CSS2DObject(div);
    label.position.copy(position);
    scene.add(label);
    return label;
  };

  // 创建线
  const createLine = (p1, p2, color = 0xff0000) => {
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

    // 如果不是第一个点，创建永久线段
    if (state.points.length > 1) {
      const lastPoint = state.points[state.points.length - 2];
      const newLine = createLine(lastPoint, point);
      state.lines.push(newLine);

      // 计算距离并创建标签
      const distance = lastPoint.distanceTo(point);
      const midPoint = new THREE.Vector3().copy(lastPoint).add(point).multiplyScalar(0.5);
      const label = createDistanceLabel(midPoint, distance);
      state.distanceLabels.push(label);
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

    // 计算总距离
    calculateTotalDistance();
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
      if (state.tempLine) {
        scene.remove(state.tempLine);
        state.tempLine = null;
      }
      
      console.log("测量完成，总距离:", calculateTotalDistance());
      state.isMeasuring = false;
    }
  };

  // 计算总距离
  const calculateTotalDistance = () => {
    const { points } = stateRef.current;
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += points[i].distanceTo(points[i + 1]);
    }
    
    console.log("当前总距离:", totalDistance.toFixed(2), "m");
    return totalDistance;
  };

  // 清除所有测量标记
  const clearMeasurements = () => {
    const state = stateRef.current;
    
    state.spheres.forEach(sphere => scene.remove(sphere));
    state.lines.forEach(line => scene.remove(line));
    state.distanceLabels.forEach(label => scene.remove(label));
    if (state.tempLine) scene.remove(state.tempLine);
    
    state.points = [];
    state.spheres = [];
    state.lines = [];
    state.distanceLabels = [];
    state.tempLine = null;
    state.isMeasuring = false;
    
    console.log("已清除所有测量标记");
  };

  // 开始测量
  const startMeasurement = () => {
    clearMeasurements(); // 开始新测量前清除旧的
    stateRef.current.isMeasuring = true;
    console.log("开始两点量测");
  };

  // 结束测量
  const stopMeasurement = () => {
    stateRef.current.isMeasuring = false;
  };

  useEffect(() => {
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.addEventListener("mousemove", handleMouseMove);
    renderer.domElement.addEventListener("contextmenu", handleRightClick);

    return () => {
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("mousemove", handleMouseMove);
      renderer.domElement.removeEventListener("contextmenu", handleRightClick);
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