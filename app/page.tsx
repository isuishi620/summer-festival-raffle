"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 履歴・キャッシュ機能は廃止

export default function RaffleApp(): JSX.Element {
  const [maxNumber, setMaxNumber] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [justStarted, setJustStarted] = useState<boolean>(false);
  // Confetti overlay
  const cfRef = useRef<HTMLDivElement | null>(null);
  // Minimal confetti options used in this app (local type to avoid external typings)
  type ConfettiOptions = {
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
  type ConfettiInstance = (opts?: ConfettiOptions) => Promise<void> | void;
  type ConfettiCreator = (
    root: HTMLCanvasElement | HTMLElement,
    opts?: { resize?: boolean; useWorker?: boolean }
  ) => ConfettiInstance;
  type ConfettiModule = {
    default: ConfettiInstance & { create: ConfettiCreator };
    create?: ConfettiCreator;
  };
  const confettiInstanceRef = useRef<ConfettiInstance | null>(null);

  const launchConfetti = useCallback(async () => {
    const container = cfRef.current;
    if (!container) return;
    try {
      const mod = (await import("canvas-confetti")) as unknown as ConfettiModule;
      const create: ConfettiCreator = mod.create ?? mod.default.create;

      // Ensure we have a canvas to render on
      let canvas = container.querySelector<HTMLCanvasElement>("canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        container.appendChild(canvas);
      }

      // Reuse instance if exists, else create
      let shoot = confettiInstanceRef.current;
      if (!shoot) {
        shoot = create(canvas, { resize: true, useWorker: true });
        confettiInstanceRef.current = shoot;
      }

      // Colorful palette & shapes (balanced, no single hue bias)
      const colors = [
        "#26ccff", // cyan
        "#00e5ff", // aqua
        "#a25afd", // violet
        "#7c4dff", // deep violet
        "#ff5e7e", // pink
        "#f50057", // magenta
        "#88ff5a", // lime
        "#00e676", // green
        "#fcff42", // yellow
        "#ffd740", // amber
        "#ffa62d", // orange
        "#ff1744", // red
        "#64ffda", // teal
        "#ff36ff", // fuchsia
      ];
      const shapes: string[] = ["square", "circle"];

      // Kick-off burst in the center
      shoot({
        particleCount: 120,
        spread: 90,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.35 },
        colors,
        shapes,
        scalar: 1.2,
        gravity: 0.9,
        ticks: 220,
      });

      // Multiple side bursts for ~1.5s
      const end = Date.now() + 1500;
      const frame = () => {
        // left and right bursts with colorful palette
        const pick = (arr: string[], n: number) => arr
          .slice()
          .sort(() => Math.random() - 0.5)
          .slice(0, n);
        const burstColors = pick(colors, 6);

        shoot({
          particleCount: 8,
          startVelocity: 55,
          spread: 75,
          origin: { x: 0, y: Math.random() * 0.25 + 0.15 },
          angle: 60,
          scalar: 1.1 + Math.random() * 0.15,
          gravity: 0.9,
          drift: (Math.random() - 0.5) * 0.8,
          colors: burstColors,
          shapes,
          ticks: 220,
        });
        shoot({
          particleCount: 8,
          startVelocity: 55,
          spread: 75,
          origin: { x: 1, y: Math.random() * 0.25 + 0.15 },
          angle: 120,
          scalar: 1.1 + Math.random() * 0.15,
          gravity: 0.9,
          drift: (Math.random() - 0.5) * 0.8,
          colors: burstColors,
          shapes,
          ticks: 220,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } catch {
      // optional effect; ignore failures
    }
  }, []);
  

  const startDrawing = useCallback(() => {
    const max = Number(maxNumber);
    if (!Number.isInteger(max) || max < 1) return;

    const shuffled = shuffle(Array.from({ length: max }, (_, i) => i + 1));
    setAvailableNumbers(shuffled);
    setCurrentNumber(null);
    setIsDrawing(true);
    setJustStarted(true);

    window.setTimeout(() => setJustStarted(false), 300);
  }, [maxNumber]);

  const drawNumber = useCallback(() => {
    if (!isDrawing || availableNumbers.length === 0 || isRolling) return;

    // 1回のみ抽選。roll→bang に分離されたSEで同期。
    const next = availableNumbers[0];
    if (typeof next === "undefined") return; // 念のため安全策
    const roll = new Audio("/sounds/roll.wav");
    const bang = new Audio("/sounds/bang.wav");

    setIsRolling(true);
    const max = Number(maxNumber);
    const ROLL_INTERVAL_MS = 30;
    let intervalId: number | null = null;

    const startTicking = () => {
      const tick = () => {
        const fake = Math.floor(Math.random() * max) + 1;
        setCurrentNumber(fake);
      };
      tick();
      intervalId = window.setInterval(tick, ROLL_INTERVAL_MS);
    };

    const stopTicking = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    // roll が終わったら bang を鳴らし、同時に確定表示
    roll.addEventListener(
      "ended",
      () => {
        stopTicking();
        try {
          bang.currentTime = 0;
          const bp = bang.play();
          if (bp && typeof bp.then === "function") {
            bp.then(() => {
              setCurrentNumber(next); // bang開始と同時に表示
              setAvailableNumbers([]);
              setIsRolling(false);
              launchConfetti();
            }).catch(() => {
              // bang再生に失敗したら即時表示
              setCurrentNumber(next);
              setAvailableNumbers([]);
              setIsRolling(false);
              launchConfetti();
            });
          } else {
            setCurrentNumber(next);
            setAvailableNumbers([]);
            setIsRolling(false);
            launchConfetti();
          }
        } catch {
          setCurrentNumber(next);
          setAvailableNumbers([]);
          setIsRolling(false);
          launchConfetti();
        }
      },
      { once: true }
    );

    // rollの再生が始まったらアニメ開始（同期ずれ低減）
    try {
      roll.currentTime = 0;
      const rp = roll.play();
      if (rp && typeof rp.then === "function") {
        rp.then(startTicking).catch(() => {
          // 再生失敗時は即確定へ（bangも鳴らせない想定）
          setCurrentNumber(next);
          setAvailableNumbers([]);
          setIsRolling(false);
        });
      } else {
        startTicking();
      }
    } catch {
      setCurrentNumber(next);
      setAvailableNumbers([]);
      setIsRolling(false);
    }
  }, [availableNumbers, isDrawing, isRolling, maxNumber, launchConfetti]);

  const maybePerformAction = useCallback(
    (key: string) => {
      if (key !== "Enter") return;
      if (!isDrawing && /^[1-9]\d*$/.test(maxNumber)) {
        startDrawing();
      } else if (!justStarted && !isRolling && availableNumbers.length > 0) {
        drawNumber();
      }
    },
    [isDrawing, maxNumber, startDrawing, justStarted, isRolling, availableNumbers.length, drawNumber]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => maybePerformAction(e.key);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [maybePerformAction]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    maybePerformAction(e.key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-sky-50 flex flex-col items-center justify-center p-4 space-y-6 relative">
      {/* Confetti overlay */}
      <div ref={cfRef} className="pointer-events-none fixed inset-0 z-50" />
      <h1 className="text-2xl font-extrabold text-sky-600">ラストワン賞 抽選ツール</h1>

      <div className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm space-y-6 border border-sky-200">
        {!isDrawing ? (
          <input
            type="text"
            value={maxNumber}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              if (value === "" || /^[1-9]\d*$/.test(value)) {
                setMaxNumber(value);
              }
            }}
            onBlur={() => /^[1-9]\d*$/.test(maxNumber) && startDrawing()}
            onKeyDown={handleInputKeyDown}
            className="w-full text-center text-lg text-sky-700 border border-sky-300 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-300"
            placeholder="最大番号を入力"
            inputMode="numeric"
            autoFocus
          />
        ) : (
          <>
            <div className="flex justify-center">
              <button
                onClick={drawNumber}
                disabled={isRolling || availableNumbers.length === 0}
                className={`transition-transform duration-150 ${
                  isRolling || availableNumbers.length === 0
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:scale-110"
                }`}
                aria-label="抽選"
              >
                <Image src="/icons/party_popper_flat.svg" alt="draw" width={96} height={96} className="w-24 h-24" />
              </button>
            </div>

            <div className="h-40 flex items-center justify-center">
              {currentNumber !== null && (
                <div className="text-8xl font-extrabold text-sky-700 animate-pop">
                  {currentNumber}
                </div>
              )}
            </div>

          </>
        )}
      </div>

      <style>{`
        .animate-pop {
          animation: pop 0.3s ease-out;
        }
        @keyframes pop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        input[type="number"].no-spinner::-webkit-inner-spin-button,
        input[type="number"].no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"].no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
