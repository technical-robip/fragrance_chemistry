import { useEffect, useRef, useState } from 'react';
import styles from './WeighScaleFigure.module.css';

type Props = {
  /** Live pan reading in grams. */
  panGrams: number;
  /** Target for the first material (Bergamot EO). */
  targetGrams: number;
  label: string;
  /** Fired once the first WebGL frame is on screen — gate the pour on this. */
  onReady?: () => void;
  onUnavailable?: () => void;
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Analytical balance with the procedural flacon on the pan.
 * Juice fill and pan settle track `panGrams / targetGrams`.
 */
export function WeighScaleFigure({ panGrams, targetGrams, label, onReady, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gramsRef = useRef(panGrams);
  const targetRef = useRef(targetGrams);
  const readyRef = useRef(onReady);
  const unavailableRef = useRef(onUnavailable);
  const [failed, setFailed] = useState(false);

  gramsRef.current = panGrams;
  targetRef.current = targetGrams;
  readyRef.current = onReady;
  unavailableRef.current = onUnavailable;

  function fail() {
    setFailed(true);
    unavailableRef.current?.();
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;
    if (!supportsWebGl()) {
      fail();
      return;
    }

    // Parent leaf already gates visibility — mount the scene immediately so the
    // pour can start in sync with the first rendered frame (no second IO lag).
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let readySent = false;

    void (async () => {
      try {
        const [three, room, flaconMod, scaleMod] = await Promise.all([
          import('three'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          import('./flacon-model'),
          import('./lab-scale-model'),
        ]);
        if (disposed) return;

        const { applyWeighFill, createFlaconModel } = flaconMod;
        const { applyWeighMass, createLabScaleModel } = scaleMod;
        const {
          ACESFilmicToneMapping,
          AmbientLight,
          DirectionalLight,
          Group,
          PerspectiveCamera,
          PMREMGenerator,
          Scene,
          SRGBColorSpace,
          WebGLRenderer,
        } = three;

        // Same renderer contract as FlaconFigure — transmission needs this path.
        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.outputColorSpace = SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const scene = new Scene();
        const pmrem = new PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new room.RoomEnvironment(), 0.04);
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.55;
        pmrem.dispose();

        const camera = new PerspectiveCamera(28, 1, 0.1, 100);
        // Frame scale + bench cap on the left; low enough to show housing.
        const azimuth = (28 * Math.PI) / 180;
        const elevation = (22 * Math.PI) / 180;
        const distance = 3.85;
        camera.position.set(
          Math.sin(azimuth) * Math.cos(elevation) * distance - 0.25,
          Math.sin(elevation) * distance + 0.06,
          Math.cos(azimuth) * Math.cos(elevation) * distance,
        );
        camera.lookAt(-0.15, 0.36, 0);

        const key = new DirectionalLight(0xffffff, 2.6);
        key.position.set(-2.4, 2.6, 2.2);
        const rim = new DirectionalLight(0xcfe0e0, 0.9);
        rim.position.set(2.6, 0.5, -1.4);
        scene.add(key, rim, new AmbientLight(0xffffff, 0.35));

        const scale = createLabScaleModel();
        const flacon = createFlaconModel();
        // createFlaconModel centres on collar+cap; reset so the body base sits on the deck.
        flacon.root.position.set(0, 0, 0);
        flacon.root.rotation.y = Math.PI * 0.18;
        flacon.root.scale.setScalar(0.55);
        // Seat on the disc; nudge toward camera so the pan rim stays behind the bottle.
        flacon.root.position.set(0, 0.04, 0.06);
        const labelMesh = flacon.tiers.juice.getObjectByName('label');
        if (labelMesh) labelMesh.visible = false;

        // Cap set down on the bench to the left — open bottle keeps collar on the neck.
        const capMesh = flacon.tiers.packaged.getObjectByName('cap');
        const benchCap = new Group();
        benchCap.name = 'bench-cap';
        if (capMesh) {
          flacon.tiers.packaged.remove(capMesh);
          capMesh.position.set(0, 0, 0);
          capMesh.visible = true;
          benchCap.add(capMesh);
          benchCap.scale.setScalar(0.55);
          // Left of the housing, sitting on the bench plane.
          benchCap.position.set(-1.25, 0, 0.22);
          benchCap.rotation.y = Math.PI * 0.55;
          scene.add(benchCap);
        }

        scale.deck.add(flacon.root);
        scene.add(scale.root);

        const reduced = prefersReducedMotion();
        let raf = 0;

        function resize() {
          const rect = host!.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }

        function frame() {
          const target = Math.max(0.001, targetRef.current);
          const fill = gramsRef.current / target;
          applyWeighFill(flacon, fill);
          applyWeighMass(scale, fill);
          renderer.render(scene, camera);
          if (!readySent) {
            readySent = true;
            readyRef.current?.();
          }
          raf = requestAnimationFrame(frame);
        }

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        applyWeighFill(flacon, reduced ? gramsRef.current / Math.max(0.001, targetRef.current) : 0);
        applyWeighMass(scale, reduced ? gramsRef.current / Math.max(0.001, targetRef.current) : 0);
        frame();

        cleanup = () => {
          cancelAnimationFrame(raf);
          resizeObserver.disconnect();
          scale.geometries.forEach((g) => g.dispose());
          scale.materials.forEach((m) => m.dispose());
          flacon.geometries.forEach((g) => g.dispose());
          flacon.materials.forEach((material) => {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          });
          environment.texture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (!disposed) fail();
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [failed]);

  if (failed) return null;

  return (
    <div
      ref={hostRef}
      className={styles.host}
      role="img"
      aria-label={label}
      data-pan-grams={panGrams.toFixed(3)}
    />
  );
}
