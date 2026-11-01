import { type Quaternion, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const worldUp = new Vector3(0, 1, 0);
const syncedUp = new WeakMap<OrbitControls, Vector3>();
type OrbitBasis = { _quat: Quaternion; _quatInverse: Quaternion };

/** Keep axis presets and orbit in the same camera-up frame without replacing controls or listeners. */
export class ViewportOrbitControls extends OrbitControls {
  override update(deltaTime: number | null = null) {
    const previous = syncedUp.get(this),
      up = this.object.up;
    if (!previous || !previous.equals(up)) {
      // three r186 caches these in its constructor and uses them for every
      // spherical update, while lookAt reads the current camera.up. Presets and
      // restored views change up later, so refresh that cache before updating.
      const basis = this as unknown as OrbitBasis;
      basis._quat.setFromUnitVectors(up.clone().normalize(), worldUp);
      basis._quatInverse.copy(basis._quat).invert();
      if (previous) previous.copy(up);
      else syncedUp.set(this, up.clone());
    }
    return super.update(deltaTime);
  }
  override dispose() {
    syncedUp.delete(this);
    super.dispose();
  }
}
