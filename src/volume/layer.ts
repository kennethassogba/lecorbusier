import * as THREE from "three";
import {
  MercatorCoordinate,
  type Map,
  type CustomLayerInterface,
} from "maplibre-gl";
import type { Design } from "../types";
import { centerOf } from "../../worker/volume.js";
import { buildModel, disposeModel } from "./model";

export function volumeLayer() {
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8693a3, 2.1));
  const light = new THREE.DirectionalLight(0xffffff, 2.8);
  light.position.set(-120, -180, 300);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xc4dfff, 0.6);
  fill.position.set(120, 100, 90);
  scene.add(fill);
  let renderer: THREE.WebGLRenderer | undefined,
    map: Map | undefined,
    model: THREE.Group | undefined;
  let current: Design | undefined,
    style = "",
    fingerprint = "",
    timer: ReturnType<typeof setTimeout> | undefined;
  const rebuild = () => {
    if (model) {
      scene.remove(model);
      disposeModel(model);
      model = undefined;
    }
    if (current) {
      model = buildModel(current, style);
      scene.add(model);
    }
    map?.triggerRepaint();
  };
  const layer: CustomLayerInterface = {
    id: "corbs-volume",
    type: "custom",
    renderingMode: "3d",
    onAdd(m, gl) {
      map = m;
      renderer = new THREE.WebGLRenderer({
        canvas: m.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render(_gl, args) {
      if (!current || !model || !renderer || !map) return;
      const origin = MercatorCoordinate.fromLngLat(centerOf(current.footprint));
      const s = origin.meterInMercatorCoordinateUnits();
      const local = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, 0)
        .scale(new THREE.Vector3(s, -s, s));
      camera.projectionMatrix
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(local);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(scene, camera);
      map.getContainer().dataset.volumeReady = "true";
      renderer.resetState();
    },
    onRemove() {
      if (map) delete map.getContainer().dataset.volumeReady;
      clearTimeout(timer);
      if (model) disposeModel(model);
      renderer?.dispose();
      map = undefined;
      model = undefined;
    },
  };
  return {
    layer,
    update(next?: Design, nextStyle = "") {
      if (map) delete map.getContainer().dataset.volumeReady;
      current = next;
      style = nextStyle;
      const key = JSON.stringify([next?.footprint, nextStyle]);
      clearTimeout(timer);
      if (model && next && key === fingerprint) {
        model.scale.z = next.height / model.userData.height;
        map?.triggerRepaint();
        timer = setTimeout(rebuild, 100);
      } else {
        fingerprint = key;
        rebuild();
      }
    },
  };
}
