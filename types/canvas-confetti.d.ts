declare module "canvas-confetti" {
  export type Options = {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: string[];
    scalar?: number;
  };

  export type Create = (
    root: HTMLCanvasElement | HTMLElement,
    opts?: { resize?: boolean; useWorker?: boolean }
  ) => (opts?: Options) => void | Promise<void>;

  export interface ConfettiFn {
    (opts?: Options): void | Promise<void>;
    create: Create;
  }

  const confetti: ConfettiFn;
  export default confetti;
}

