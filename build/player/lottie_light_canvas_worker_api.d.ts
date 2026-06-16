import {
  AnimationDirection,
  AnimationSegment,
  AnimationEventName,
  AnimationEventCallback,
  AnimationEvents,
} from '../../index';

export interface LottieCanvasWorkerConfig {
  /** Canvas whose control is transferred to the worker via OffscreenCanvas. */
  canvas: HTMLCanvasElement;
  /** URL to a Lottie JSON animation. Ignored when `animationData` is provided. */
  src?: string;
  /** Parsed Lottie animation data. Takes precedence over `src`. */
  animationData?: any;
  loop?: boolean | number;
  autoplay?: boolean;
  speed?: number;
  direction?: AnimationDirection;
  segment?: AnimationSegment;
  /** Override the worker bundle URL (escape hatch for custom hosting/CSP). */
  workerUrl?: string | URL;
}

export declare class LottieCanvasWorker {
  constructor(config: LottieCanvasWorkerConfig);
  play(): void;
  pause(): void;
  stop(): void;
  setSpeed(speed: number): void;
  setDirection(direction: AnimationDirection): void;
  setLoop(loop: boolean | number): void;
  goToAndStop(value: number, isFrame?: boolean): void;
  goToAndPlay(value: number, isFrame?: boolean): void;
  playSegments(
    segments: AnimationSegment | AnimationSegment[],
    forceFlag?: boolean,
  ): void;
  setSubframe(useSubFrames: boolean): void;
  resize(width?: number, height?: number): void;
  destroy(): void;
  addEventListener(name: 'load', callback: () => void): () => void;
  addEventListener(name: 'error', callback: (error: Error) => void): () => void;
  addEventListener<T extends AnimationEventName>(
    name: T,
    callback: AnimationEventCallback<AnimationEvents[T]>,
  ): () => void;
  removeEventListener<T extends AnimationEventName>(
    name: T,
    callback?: AnimationEventCallback<AnimationEvents[T]>,
  ): void;
}

export default LottieCanvasWorker;
