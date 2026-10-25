import * as THREE from "three";
import {
  MercatorCoordinate,
  type Map,
  type CustomLayerInterface,
} from "maplibre-gl";
import type { Design, Proposal } from "../types";
import { centerOf } from "../../worker/volume.js";
import { buildModel, disposeModel } from "./model.ts";

const origin = MercatorCoordinate.fromLngLat([2.34, 48.86]);
const unit = origin.meterInMercatorCoordinateUnits();
const local = new THREE.Matrix4()
  .makeTranslation(origin.x, origin.y, 0)
  .scale(new THREE.Vector3(unit, -unit, unit));

function positionModel(model: THREE.Group, design: Design) {
  const at = MercatorCoordinate.fromLngLat(centerOf(design.footprint));
  model.position.set((at.x - origin.x) / unit, -(at.y - origin.y) / unit, 0);
  model.scale.setScalar(at.meterInMercatorCoordinateUnits() / unit);
}

// A single scene/renderer, with meshes retained across votes and live refreshes.
export function sharedModels() {
  const group = new THREE.Group();
  const entries = new globalThis.Map<
    string,
    { key: string; model: THREE.Group; footprint: string }
  >();
  return {
    group,
    entries,
    update(proposals: Proposal[]) {
      const keep = new Set<string>();
      for (const p of proposals) {
        if (!p.published_at || !p.design) continue;
        keep.add(p.id);
        const key = JSON.stringify([p.design, p.style_id]);
        const old = entries.get(p.id);
        if (old?.key === key) continue;
        if (old) {
          group.remove(old.model);
          disposeModel(old.model);
        }
        const model = buildModel(p.design, p.style_id);
        positionModel(model, p.design);
        model.userData.proposalId = p.id;
        group.add(model);
        entries.set(p.id, {
          key,
          model,
          footprint: JSON.stringify(p.design.footprint),
        });
      }
      for (const [id, entry] of entries)
        if (!keep.has(id)) {
          group.remove(entry.model);
          disposeModel(entry.model);
          entries.delete(id);
        }
    },
    visibility(active?: Design, capturing = false) {
      const footprint = JSON.stringify(active?.footprint);
      for (const entry of entries.values())
        entry.model.visible = !capturing && entry.footprint !== footprint;
    },
    dispose() {
      for (const entry of entries.values()) disposeModel(entry.model);
      entries.clear();
      group.clear();
    },
  };
}

export function volumeLayer() {
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  const shared = sharedModels();
  scene.add(shared.group);
  const sky = new THREE.HemisphereLight(0xffffff, 0x91a1bb, 1.7);
  sky.position.set(0, 0, 1);
  scene.add(sky);
  const light = new THREE.DirectionalLight(0xffffff, 2.1);
  light.position.set(-120, -180, 300);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xc4dfff, 0.5);
  fill.position.set(120, 100, 90);
  scene.add(fill);
  let renderer: THREE.WebGLRenderer | undefined,
    map: Map | undefined,
    model: THREE.Group | undefined,
    current: Design | undefined,
    style = "",
    fingerprint = "",
    capturing = false,
    rendered = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const repaint = () => {
    if (map) delete map.getContainer().dataset.volumeReady;
    map?.triggerRepaint();
  };
  const rebuild = () => {
    if (model) {
      scene.remove(model);
      disposeModel(model);
      model = undefined;
    }
    if (current) {
      model = buildModel(current, style);
      positionModel(model, current);
      scene.add(model);
    }
    repaint();
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
      if (!renderer || !map) return;
      camera.projectionMatrix
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(local);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(scene, camera);
      rendered = true;
      map.getContainer().dataset.volumeReady = "true";
      map.getContainer().dataset.constructionCount = String(
        shared.entries.size,
      );
      renderer.resetState();
    },
    onRemove() {
      if (map) {
        delete map.getContainer().dataset.volumeReady;
        delete map.getContainer().dataset.constructionCount;
      }
      clearTimeout(timer);
      if (model) disposeModel(model);
      shared.dispose();
      renderer?.dispose();
      map = undefined;
      model = undefined;
    },
  };
  return {
    layer,
    setShared(proposals: Proposal[]) {
      shared.update(proposals);
      shared.visibility(current, capturing);
      repaint();
    },
    capture(value: boolean) {
      capturing = value;
      shared.visibility(current, capturing);
      repaint();
    },
    projectRoof(id: string): { x: number; y: number } | undefined {
      const entry = shared.entries.get(id);
      if (!entry || !map || !rendered || capturing) return;
      const model = entry.model;
      const point = new THREE.Vector4(
        model.position.x,
        model.position.y,
        model.userData.height * model.scale.z,
        1,
      ).applyMatrix4(camera.projectionMatrix);
      if (point.w <= 0 || Math.abs(point.z / point.w) > 1) return;
      return {
        x: ((point.x / point.w + 1) * map.getContainer().clientWidth) / 2,
        y: ((1 - point.y / point.w) * map.getContainer().clientHeight) / 2,
      };
    },
    pick(point: { x: number; y: number }): string | undefined {
      if (!map || current || capturing) return;
      const x = (point.x / map.getContainer().clientWidth) * 2 - 1;
      const y = 1 - (point.y / map.getContainer().clientHeight) * 2;
      const near = new THREE.Vector3(x, y, -1).applyMatrix4(
        camera.projectionMatrixInverse,
      );
      const far = new THREE.Vector3(x, y, 1).applyMatrix4(
        camera.projectionMatrixInverse,
      );
      const ray = new THREE.Raycaster(near, far.sub(near).normalize());
      for (const hit of ray.intersectObjects(shared.group.children, true)) {
        let node: THREE.Object3D | null = hit.object;
        while (node && !node.userData.proposalId) node = node.parent;
        if (node?.visible) return node.userData.proposalId;
      }
    },
    update(next?: Design, nextStyle = "") {
      current = next;
      style = nextStyle;
      const key = JSON.stringify([next?.footprint, next?.palette, nextStyle]);
      clearTimeout(timer);
      shared.visibility(current, capturing);
      if (model && next && key === fingerprint) {
        const scale =
          MercatorCoordinate.fromLngLat(
            centerOf(next.footprint),
          ).meterInMercatorCoordinateUnits() / unit;
        model.scale.z = (scale * next.height) / model.userData.height;
        repaint();
        timer = setTimeout(rebuild, 100);
      } else {
        fingerprint = key;
        rebuild();
      }
    },
  };
}
