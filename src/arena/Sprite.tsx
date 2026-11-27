import { memo } from 'react';
import { SPRITE_H, SPRITE_W, spriteRects, type PlayerId, type Pose } from './sprites';

const POSES: Pose[] = ['idle', 'punch', 'hurt', 'win'];

/**
 * Desenha as 4 poses de uma vez e mostra só a ativa via CSS ([data-pose]):
 * trocar de pose não re-renderiza os ~200 retângulos.
 */
const Frames = memo(function Frames({ id }: { id: PlayerId }) {
  return (
    <>
      {POSES.map((pose) => (
        <g key={pose} className={`p-${pose}`}>
          {spriteRects(id, pose).map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
      ))}
    </>
  );
});

interface Props {
  id: PlayerId;
  pose?: Pose;
  scale?: number;
  flip?: boolean;
  className?: string;
}

export function Sprite({ id, pose = 'idle', scale = 3, flip = false, className }: Props) {
  return (
    <svg
      className={`spr${flip ? ' is-flip' : ''}${className ? ` ${className}` : ''}`}
      data-pose={pose}
      viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
      width={SPRITE_W * scale}
      height={SPRITE_H * scale}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <Frames id={id} />
    </svg>
  );
}
