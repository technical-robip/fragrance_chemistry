import { useEffect, useRef, useState } from 'react';
import type { CostView } from './flacon-model';
import styles from './FlaconFigure.module.css';

type Props = {
  /** Concentrate = open bottle with a neat-oil slug. Packaged = seated cap, full fill. */
  view?: CostView;
  label: string;
  /** Called once when WebGL is unavailable or the renderer fails to start. */
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
 * The manual's illustrated plate for the costing division: a procedural Three.js
 * flacon that fills and caps between concentrate and the packaged unit.
 *
 * Three.js and the model are imported only once the figure is actually on
 * screen, so the landing bundle does not carry a renderer nobody scrolled to.
 * Without WebGL the component reports failure and the caller falls back.
 */
export function FlaconFigure({ view = 'packaged', label, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  const unavailableRef = useRef(onUnavailable);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  viewRef.current = view;
  unavailableRef.current = onUnavailable;

  function fail() {
    setFailed(true);
    unavailableRef.current?.();
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!supportsWebGl()) {
      fail();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !visible || failed) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const [three, room, model] = await Promise.all([
          import('three'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          import('./flacon-model'),
        ]);
        if (disposed) return;

        const { applyCostView, createFlaconModel } = model;
        const {
          ACESFilmicToneMapping,
          AmbientLight,
          Clock,
          DirectionalLight,
          PerspectiveCamera,
          PMREMGenerator,
          Scene,
          SRGBColorSpace,
          WebGLRenderer,
        } = three;

        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.outputColorSpace = SRGBColorSpace;
        host.appendChild(renderer.domElement);

        const scene = new Scene();

        // Transmissive materials refract whatever surrounds them. With no
        // environment the glass and the juice render as flat grey slabs, which
        // is the exact risk the sculpt spec recorded; a prefiltered room supplies
        // structure for them to bend without pretending to be a real interior.
        const pmrem = new PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new room.RoomEnvironment(), 0.04);
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.55;
        pmrem.dispose();

        const camera = new PerspectiveCamera(32, 1, 0.1, 100);

        // Camera pose solved off the reference: three-quarter view, slightly above.
        const azimuth = (34 * Math.PI) / 180;
        const elevation = (12 * Math.PI) / 180;
        const distance = 4.2;
        camera.position.set(
          Math.sin(azimuth) * Math.cos(elevation) * distance,
          Math.sin(elevation) * distance,
          Math.cos(azimuth) * Math.cos(elevation) * distance,
        );
        camera.lookAt(0, 0, 0);

        // Key from upper left, low ambient fill, low rim: the reference's own setup.
        const key = new DirectionalLight(0xffffff, 2.6);
        key.position.set(-2.4, 2.6, 2.2);
        const rim = new DirectionalLight(0xcfe0e0, 0.9);
        rim.position.set(2.6, 0.5, -1.4);
        scene.add(key, rim, new AmbientLight(0xffffff, 0.35));

        const built = createFlaconModel();
        scene.add(built.root);

        const reduced = prefersReducedMotion();
        const clock = new Clock();
        let raf = 0;
        let spin = 0;
        let settled = viewRef.current === 'packaged' ? 1 : 0;
        applyCostView(built, settled);

        function resize() {
          const rect = host!.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }

        function frame() {
          const target = viewRef.current === 'packaged' ? 1 : 0;
          if (reduced) {
            settled = target;
          } else {
            const dt = Math.min(clock.getDelta(), 0.05);
            settled += (target - settled) * (1 - Math.exp(-dt * 8));
          }
          applyCostView(built, settled);
          if (!reduced) {
            spin += 0.0022;
            built.root.rotation.y = spin;
          }
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        }

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        frame();

        cleanup = () => {
          cancelAnimationFrame(raf);
          resizeObserver.disconnect();
          built.geometries.forEach((geometry) => geometry.dispose());
          built.materials.forEach((material) => {
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
  }, [visible, failed]);

  if (failed) return null;

  return (
    <div
      ref={hostRef}
      className={styles.host}
      role="img"
      aria-label={label}
      data-cost-view={view}
    />
  );
}
