'use strict';

const polylineCodec = require('@mapbox/polyline');
const Logger        = require('@utils/Logger.util');

// Mapbox Map Matching returns one leg per pair of consecutive input
// tracepoints — we send ~100 sampled coords, so we get ~90 legs per match.
// Each leg ends with an `arrive` maneuver, so without post-processing the
// iOS Nav SDK cycles through ~90 "You have arrived at your destination"
// banner entries, misprojects the user onto the wrong leg, breaks the
// route line, and shows a fake immediate-arrival state.
//
// _collapseLegs (below) merges all legs into a single origin→destination
// leg with absorbed durations, drops inner depart/arrive maneuvers, and
// strips per-leg banner / voice cues that announce the dropped arrivals.
// _stripLegLocalIndices removes step indices that the SDK's parser would
// otherwise reject ("wrong geometry_index") because their meaning is
// per-leg and we no longer have multiple legs.

// Format a meters value as "1.5 km" or "300 m" for use in voice cues.
// Matches the rough phrasing Mapbox uses ("In 1.5 kilometers, …").
function _formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m >= 1000) {
    const km = m / 1000;
    return `${km >= 10 ? Math.round(km) : km.toFixed(1)} kilometers`;
  }
  return `${Math.round(m / 50) * 50 || 50} meters`;
}

function _stripLegLocalIndices(step) {
  // Shallow-clone so we don't mutate the upstream matching object.
  const out = { ...step };
  delete out.geometry_index;
  delete out.geometry_index_start;
  delete out.geometry_index_end;
  if (Array.isArray(out.intersections)) {
    out.intersections = out.intersections.map((i) => {
      const { geometry_index, ...rest } = i; // eslint-disable-line no-unused-vars
      return rest;
    });
  }
  return out;
}

function _collapseLegs(matching) {
  if (!matching || !Array.isArray(matching.legs) || matching.legs.length <= 1) {
    // Single-leg matchings already have correct Mapbox-emitted banners and
    // voice cues — no leg-seams to clean up. Returning them verbatim
    // preserves the SDK's expected banner shape (the rewrite path below
    // would coerce primary.type to 'arrive' for short [depart, arrive]
    // routes, which the SDK then refuses to render as a normal banner).
    return matching;
  }

  const legs = matching.legs;
  const lastIdx = legs.length - 1;

  let totalWeight = 0;

  // Pass 1: classify every step as kept/dropped. We walk all legs in order
  // so that absorption (next step) crosses leg boundaries naturally.
  const allSteps = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const isFirst = i === 0;
    const isLast  = i === lastIdx;
    totalWeight += Number(leg.weight ?? 0);
    for (const step of leg.steps ?? []) {
      const type = step.maneuver?.type;
      const kept = !((type === 'depart' && !isFirst) ||
                     (type === 'arrive' && !isLast));
      allSteps.push({ step, kept });
    }
  }

  // Pass 2: forward sweep. When a step is dropped, accumulate its duration
  // and distance into a "pending" bucket; on the next kept step, fold the
  // pending into that step's duration/distance. Result: sum(step.duration)
  // === sum(original step.duration) === leg.duration. Without this, the
  // iOS Nav SDK computes remaining duration from kept steps only and shows
  // a wildly wrong ETA (e.g. "1 min" on a 28 km / 46 min route).
  const collapsedSteps = [];
  let pendingDuration = 0;
  let pendingDistance = 0;

  for (const { step, kept } of allSteps) {
    if (!kept) {
      pendingDuration += Number(step.duration ?? 0);
      pendingDistance += Number(step.distance ?? 0);
      continue;
    }
    const copy = _stripLegLocalIndices(step);
    copy.duration = Number(copy.duration ?? 0) + pendingDuration;
    copy.distance = Number(copy.distance ?? 0) + pendingDistance;
    pendingDuration = 0;
    pendingDistance = 0;
    collapsedSteps.push(copy);
  }
  // Anything still pending after the last kept step belongs at the tail.
  // (Shouldn't happen since we always keep the final leg's `arrive`, but
  // belt-and-suspenders.)
  if ((pendingDuration > 0 || pendingDistance > 0) && collapsedSteps.length > 0) {
    const last = collapsedSteps[collapsedSteps.length - 1];
    last.duration = Number(last.duration ?? 0) + pendingDuration;
    last.distance = Number(last.distance ?? 0) + pendingDistance;
  }

  // Banner / voice rewrite.
  //
  // Banner and voice instructions describe the *next* maneuver, not the
  // step they live on. With Map Matching's multi-leg output, almost every
  // inner step's "next" was the leg's `arrive` — which we dropped. So the
  // original cues all announce phantom arrivals.
  //
  // We *clone* the step's first existing banner/voice entry (to preserve
  // the JSON keys the iOS SDK's Codable expects) and:
  //   1. Override the maneuver-pointing fields with the next surviving
  //      step's maneuver text/type/modifier.
  //   2. Re-anchor `distanceAlongGeometry` to fire when the step *starts*.
  //      Mapbox sets distanceAlongGeometry = remaining-distance-in-step,
  //      so for the immediate "you're now on this step" announcement we
  //      use the step's full distance. The original value was relative to
  //      the tiny pre-collapse leg (e.g. 100 m) — keeping it would make
  //      the cue fire only ~100 m before the next turn, way too late and
  //      effectively never on long absorbed steps.
  //   3. Emit two cues per step (immediate + near-approach) so the user
  //      hears the upcoming maneuver early and again as they approach it,
  //      matching Mapbox's natural staggering pattern.
  //
  // The final step keeps its original arrival cues untouched — that's the
  // legitimate "you have arrived at your destination" announcement.
  const NEAR_APPROACH_DISTANCE_M = 200;

  const _buildBanner = (origBanner, m, distanceAlongGeometry) => {
    const text     = m.instruction ?? '';
    const type     = m.type ?? 'turn';
    const modifier = m.modifier;
    const components = [{ text, type: 'text' }];

    if (origBanner) {
      const out = {
        ...origBanner,
        distanceAlongGeometry,
        distance_along_geometry: distanceAlongGeometry,
        primary: {
          ...(origBanner.primary ?? {}),
          text,
          type,
          ...(modifier ? { modifier } : {}),
          components,
        },
      };
      delete out.secondary;
      delete out.sub;
      return out;
    }
    return {
      distanceAlongGeometry,
      distance_along_geometry: distanceAlongGeometry,
      primary: { text, type, ...(modifier ? { modifier } : {}), components },
    };
  };

  const _buildVoice = (origVoice, m, distanceAlongGeometry, prefix) => {
    const baseText = m.instruction ?? '';
    const text     = prefix ? `${prefix} ${baseText}` : baseText;
    if (origVoice) {
      return {
        ...origVoice,
        distanceAlongGeometry,
        distance_along_geometry: distanceAlongGeometry,
        announcement:     text,
        ssmlAnnouncement: `<speak>${text}</speak>`,
      };
    }
    return {
      distanceAlongGeometry,
      distance_along_geometry: distanceAlongGeometry,
      announcement:     text,
      ssmlAnnouncement: `<speak>${text}</speak>`,
    };
  };

  for (let k = 0; k < collapsedSteps.length - 1; k++) {
    const current = collapsedSteps[k];
    const next    = collapsedSteps[k + 1];
    const m       = next.maneuver ?? {};
    const stepDistance = Number(current.distance ?? 0);

    // Banner stays visible for the whole step — anchor at full distance.
    const origBanner = (current.bannerInstructions ?? [])[0];
    current.bannerInstructions = [_buildBanner(origBanner, m, stepDistance)];

    // Voice: immediate cue at step start, plus a near-approach cue if the
    // step is long enough that the user benefits from a reminder.
    const origVoice = (current.voiceInstructions ?? [])[0];
    const voiceCues = [];

    const immediateDistance = Math.round(stepDistance);
    const immediatePrefix   = stepDistance > NEAR_APPROACH_DISTANCE_M
      ? `In ${_formatDistance(stepDistance)},`
      : '';
    voiceCues.push(_buildVoice(origVoice, m, immediateDistance, immediatePrefix));

    if (stepDistance > NEAR_APPROACH_DISTANCE_M * 1.5) {
      voiceCues.push(_buildVoice(origVoice, m, NEAR_APPROACH_DISTANCE_M, ''));
    }

    current.voiceInstructions = voiceCues;
  }

  // Drop the per-leg `annotation` (parallel arrays of per-segment
  // distance/duration/speed). Once legs are collapsed, the SDK expects the
  // array length to equal the new leg's segment count, which the merged
  // arrays don't satisfy — and the resulting size mismatch triggers a
  // "Element's count in duration from annotations does not equal segment
  // count" warning. Easier to omit it than to recompute.
  const { annotation: _omitAnnotation, ...firstLegRest } = legs[0];

  // Mapbox provides authoritative totals at the matching (route) level;
  // summing per-leg fields can drift off (rounding per leg, or different
  // weighting). Trust the route-level totals so leg.duration matches
  // route.duration — the SDK reads both during progress tracking and
  // mismatched values produce nonsense ETAs (e.g. "1 min remaining" on a
  // 28 km route).
  const routeDistance = Number(matching.distance);
  const routeDuration = Number(matching.duration);

  const combinedLeg = {
    ...firstLegRest,
    summary:  legs[0].summary || legs[lastIdx].summary || '',
    distance: Number.isFinite(routeDistance) ? routeDistance : 0,
    duration: Number.isFinite(routeDuration) ? routeDuration : 0,
    weight:   totalWeight,
    steps:    collapsedSteps,
  };

  return {
    ...matching,
    legs: [combinedLeg],
  };
}

/**
 * Wraps a raw Map Matching `matching` object as a Mapbox-Directions-shape
 * response so the iOS Nav SDK's RouteResponse decoder can build a
 * NavigationRoute from it verbatim.
 *
 * The decoder requires legs.length + 1 === waypoints.length. We collapse
 * the matching's many legs into one (see _collapseLegs) so a 2-waypoint,
 * 1-leg shape is structurally valid.
 */
function _directionsResponseFromMatching(matching) {
  if (!matching) return null;

  const collapsed = _collapseLegs(matching);

  const coords = polylineCodec.decode(collapsed.geometry ?? '', 6);
  if (coords.length < 2) return null;

  const [firstLat, firstLng] = coords[0];
  const [lastLat,  lastLng]  = coords[coords.length - 1];

  Logger.info(
    `[Route.dto] collapsed matching: ` +
    `legs_in=${(matching.legs ?? []).length} ` +
    `legs_out=${(collapsed.legs ?? []).length} ` +
    `route_distance=${matching.distance} ` +
    `route_duration=${matching.duration} ` +
    `leg_distance=${collapsed.legs?.[0]?.distance} ` +
    `leg_duration=${collapsed.legs?.[0]?.duration} ` +
    `steps_out=${collapsed.legs?.[0]?.steps?.length}`,
  );

  return {
    code:      'Ok',
    uuid:      `ecoroute-${Date.now()}`,
    routes:    [collapsed],
    waypoints: [
      { distance: 0, name: 'Origin',      location: [firstLng, firstLat] },
      { distance: 0, name: 'Destination', location: [lastLng,  lastLat]  },
    ],
  };
}

/**
 * Normalises a single enriched route option into the API response shape.
 * Routes come from RouteE Compass (energy data) + Mapbox Map Matching (steps).
 */
function routeOptionDTO(route) {
  return {
    label:        route.label,           // 'eco' | 'balanced' | 'fastest'
    distance_km:  route.distance_km,
    duration_sec: route.duration_sec,
    energy_kwh:        route.energy_kwh ?? null,
    elevation_gain_km: route.elevation_gain_km ?? null,
    polyline:          route.polyline,
    directions_json:   _directionsResponseFromMatching(route.matching),
    warnings:          route.warnings ?? [],
  };
}

function routeSearchResultDTO(routes) {
  return routes.map(routeOptionDTO);
}

module.exports = { routeOptionDTO, routeSearchResultDTO };
