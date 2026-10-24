import { IkConstraint, type Skeleton } from '@esotericsoftware/spine-webgl';
import type { DriverFrame } from '../core/contracts.ts';

/** Apply the same setup-relative values compiled by appendAnimation's Spine timelines. */
export function applyDriverFrameToSkeleton(skeleton: Skeleton, frame: DriverFrame): void {
  for (const key of frame.keys) {
    if (key.property === 'ikMix') {
      const constraint = skeleton.findConstraint(key.target, IkConstraint);
      if (!constraint) throw new Error(`目标 IK 约束不存在：${key.target}`);
      constraint.pose.mix = key.value;
      continue;
    }
    const bone = skeleton.findBone(key.target);
    if (!bone) throw new Error(`目标骨不存在：${key.target}`);
    const setup = bone.data.setupPose;
    switch (key.property) {
      case 'x': bone.pose.x = setup.x + key.value; break;
      case 'y': bone.pose.y = setup.y + key.value; break;
      case 'rotation': bone.pose.rotation = setup.rotation + key.value; break;
      case 'scaleX': bone.pose.scaleX = setup.scaleX * key.value; break;
      case 'scaleY': bone.pose.scaleY = setup.scaleY * key.value; break;
    }
  }
}
