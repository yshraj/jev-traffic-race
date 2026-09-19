"use client";

import { useGSAP } from "@gsap/react";
import { CarProfile, Van } from "@phosphor-icons/react/dist/ssr";
import gsap from "gsap";
import { useRef } from "react";
import { hazardSpec } from "@/lib/hazards";
import { formatMetres, type Outcome, type OutcomeCounts } from "@/lib/race";
import { formatMs } from "@/lib/scoring";
import type { Lane, Visual } from "@/lib/types";

gsap.registerPlugin(useGSAP);

/** Left inset of the vehicle at zero metres, and room kept at the far end. */
const START_X = 14;
const END_PAD = 78;

export type RoadProps = {
  lane: Lane;
  name: string;
  caption?: string;
  latencyMs: number | null;
  distanceM: number;
  maxM: number;
  counts: OutcomeCounts;
  lastOutcome?: Outcome;
  resolvedBeatId?: number;
  hazard?: Visual;
  beatId?: number;
  beatMs: number;
  reducedMotion: boolean;
  error?: string;
};

function Hazard({ visual }: { visual: Visual }) {
  const spec = hazardSpec(visual.hazard);

  return (
    <div className={`hazard-body hazard-${visual.hazard}`}>
      {spec.shape === "patch" ? (
        <span className={`hazard-patch patch-${visual.hazard}`} />
      ) : spec.Glyph ? (
        <spec.Glyph size={32} weight="fill" aria-hidden />
      ) : null}
      <span className="hazard-label">{spec.label}</span>
      {visual.marking !== "none" ? (
        <span className="hazard-marking">{visual.marking}</span>
      ) : null}
    </div>
  );
}

export function Road({
  lane,
  name,
  caption,
  latencyMs,
  distanceM,
  maxM,
  counts,
  lastOutcome,
  resolvedBeatId,
  hazard,
  beatId,
  beatMs,
  reducedMotion,
  error,
}: RoadProps) {
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const vehicle = useRef<HTMLDivElement>(null);
  const hazardRef = useRef<HTMLDivElement>(null);

  const Vehicle = lane === "jev" ? CarProfile : Van;
  const progress = maxM === 0 ? 0 : Math.min(1, distanceM / maxM);

  function vehicleX(): number {
    const width = surface.current?.clientWidth ?? 0;
    return START_X + progress * Math.max(0, width - END_PAD - START_X);
  }

  // Distance drives position, so the lane that decides faster pulls ahead.
  useGSAP(
    () => {
      if (!vehicle.current) return;
      const x = vehicleX();
      if (reducedMotion) {
        gsap.set(vehicle.current, { x, yPercent: -50 });
        return;
      }
      gsap.to(vehicle.current, {
        x,
        yPercent: -50,
        duration: 0.35,
        ease: "power2.out",
      });
    },
    { dependencies: [distanceM, maxM, reducedMotion], scope: root },
  );

  // The hazard closes on the vehicle over one beat.
  useGSAP(
    () => {
      const node = hazardRef.current;
      if (!node || beatId === undefined) return;

      const width = surface.current?.clientWidth ?? 0;
      const from = width - 40;
      const to = vehicleX() + 46;

      if (reducedMotion) {
        gsap.set(node, { x: Math.max(to, from * 0.6), yPercent: -50, opacity: 1 });
        return;
      }

      gsap.fromTo(
        node,
        { x: from, yPercent: -50, opacity: 0 },
        { x: to, opacity: 1, duration: beatMs / 1000, ease: "none" },
      );
    },
    { dependencies: [beatId, beatMs, reducedMotion], scope: root },
  );

  // Swerve on a clean dodge, shake on contact.
  useGSAP(
    () => {
      if (!vehicle.current || resolvedBeatId === undefined || !lastOutcome) {
        return;
      }
      if (reducedMotion) return;

      if (lastOutcome === "clean") {
        gsap.fromTo(
          vehicle.current,
          { y: 0 },
          { y: -16, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" },
        );
        return;
      }
      if (lastOutcome === "stalled") return;

      gsap.fromTo(
        vehicle.current,
        { rotation: 0 },
        {
          rotation: lastOutcome === "hit" ? 6 : 3,
          duration: 0.06,
          yoyo: true,
          repeat: 3,
          ease: "none",
        },
      );
    },
    { dependencies: [resolvedBeatId, lastOutcome, reducedMotion], scope: root },
  );

  return (
    <section className={`lane lane-${lane}`} ref={root}>
      <div className="cluster">
        <div className="cluster-head">
          <div className="cluster-name">{name}</div>
          {lane === "jev" ? (
            <button className="chip" type="button" disabled>
              Jev can&apos;t write why
            </button>
          ) : null}
        </div>
        {caption ? <div className="cluster-caption">{caption}</div> : null}
        <div className="cluster-latency">{formatMs(latencyMs)}</div>
        <div className="cluster-counts">
          <span>clean {counts.clean}</span>
          <span>clipped {counts.clipped}</span>
          <span className="count-bad">hit {counts.hit}</span>
          <span className="count-bad">stalled {counts.stalled}</span>
        </div>
        {error ? <div className="lane-error">{error}</div> : null}
      </div>

      <div className="road" ref={surface}>
        <div className="road-dashes" aria-hidden="true" />
        <div className={`vehicle vehicle-${lane}`} ref={vehicle}>
          <Vehicle size={40} weight="fill" aria-hidden />
        </div>
        <div
          className={`hazard${lastOutcome && lastOutcome !== "clean" ? " hazard-struck" : ""}`}
          ref={hazardRef}
        >
          {hazard ? <Hazard visual={hazard} /> : null}
        </div>
      </div>

      <div className="odo">
        <div className="odo-value">{formatMetres(distanceM)}</div>
        <div className="odo-label">road covered</div>
      </div>
    </section>
  );
}
