#!/usr/bin/env -S deno run --no-check -A
/**
 * Simulates a dedicated GTFS outage against the ACTUAL preview handler.
 * Every Supabase URL is intercepted by an in-memory fetch mock.
 * No real database, user JWT, project secret, network API or production code is mutated.
 */
const error = (message: string): never => { throw new Error(message); };
const assert = (value: unknown, message: string) => { if (!value) error(message); };
const preview = new URL("./transit-schedule-dedicated-preview/index.ts", import.meta.url);
const temp = new URL("./__temporary_preview_fallback_test.ts", import.meta.url);
const source = await Deno.readTextFile(preview);
assert(source.includes("Deno.serve(async req=>{"), "Preview handler declaration changed");
assert(source.endsWith("});\n"), "Preview handler file ending changed");
const rewritten = source
  .replace("Deno.serve(async req=>{", "globalThis.__LDP_TEST_HANDLER = async req=>{")
  .replace(/\}\);\s*$/, "};\n");
const requests: string[] = [];
let dedicatedDown = false;
let legacyDown = false;
const oldUrl = "https://djbxhyhqefylyqqlifan.supabase.co";
const dedicatedUrl = "https://gnqtngtuzbxohgwgvmpb.supabase.co";
const localJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const oldRows = Array.from({length: 5}, (_, i) => ({
  scoped_id: "de-national:legacy" + i,
  feed_source: "de-national",
  stop_id: "legacy" + i,
  stop_name: "Test legacy Regensburg " + i,
  stop_lat: 49.0132 + i * 0.00001,
  stop_lon: 12.1015 + i * 0.00001,
  distance_m: i * 14,
}));
const newRows = [{
  scoped_id: "de-national:dedicated",
  feed_source: "de-national",
  stop_id: "dedicated",
  stop_name: "Test new GTFS Regensburg",
  stop_lat: 49.0133, stop_lon: 12.1015, distance_m: 10,
}];
const originalFetch = globalThis.fetch;
const fakeFetch: typeof globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input :
    input instanceof URL ? input.toString() : input.url;
  requests.push(url);
  if (url === oldUrl + "/auth/v1/user") {
    assert(new Headers(init?.headers).get("authorization")?.startsWith("Bearer "),
      "Missing end-user auth bearer");
    return localJson({ id: "local-user-fixture" });
  }
  if (url === oldUrl + "/rest/v1/rpc/consume_user_rate_limit") {
    return localJson({ allowed: true });
  }
  if (url === dedicatedUrl + "/rest/v1/rpc/transit_gtfs_nearby") {
    const h = new Headers(init?.headers);
    assert(h.get("apikey") === "sb_secret_offline_fixture", "Dedicated service key missing in apikey header");
    assert(h.get("authorization") === null,
      "Opaque sb_secret_ key incorrectly sent as a JWT");
    return dedicatedDown ? localJson({ error: "isolated connection outage" }, 503) : localJson(newRows);
  }
  if (url === oldUrl + "/rest/v1/rpc/transit_gtfs_nearby") {
    return legacyDown ? localJson({ error: "old RPC unavailable" }, 503) : localJson(oldRows);
  }
  if (url === dedicatedUrl + "/rest/v1/rpc/transit_gtfs_departures" ||
      url === dedicatedUrl + "/rest/v1/rpc/transit_gtfs_trip_route") {
    return dedicatedDown ? localJson({error: "simulated dedicated outage"}, 503) : localJson([]);
  }
  if (url.startsWith("https://transit.land/api/v2/rest/")) {
    return localJson({ stops: [], stop_times: [], departures: [] });
  }
  if (url.startsWith("https://v6.db.transport.rest/locations/nearby?")) {
    return localJson([{
      id: "8012345", name: "Regensburg Hbf", products: {bus:true},
      location:{latitude:49.0133,longitude:12.1015},
    }]);
  }
  if (url.startsWith("https://v6.db.transport.rest/stops/8012345/departures?")) {
    return localJson([{
      tripId:"db-native-trip-001",line:{name:"6",product:"bus"},
      direction:"Klinikum",when:"2026-10-17T16:04:00+02:00",
      plannedWhen:"2026-10-17T16:04:00+02:00",cancelled:false,
    }]);
  }
  // Absolutely NO live external network during the simulated outage.
  throw Error("Unmocked network request blocked");
};
Deno.env.set("SUPABASE_URL", oldUrl);
Deno.env.set("SUPABASE_ANON_KEY", "sb_publishable_offline_fixture");
Deno.env.set("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY", "sb_secret_offline_fixture");
globalThis.fetch = fakeFetch;
try {
  await Deno.writeTextFile(temp, rewritten);
  await import(temp.href);
  const handler = (globalThis as any).__LDP_TEST_HANDLER as (req: Request) => Promise<Response>;
  assert(typeof handler === "function", "Test couldn't capture preview handler");

  const post = (action: string, extra = {}, withUser = true) =>
    handler(new Request(oldUrl + "/functions/v1/transit-schedule-dedicated-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(withUser ? {"Authorization": "Bearer offline.jwt.fixture"} : {}),
      },
      body: JSON.stringify({
        action,
        country: "DE",
        lat: 49.0134,
        lon: 12.1016,
        radiusM: 1500,
        limit: 5,
        ...extra,
      }),
    }));

  // 1. The new project's stop results are preferred while the RPC is healthy.
  let response = await post("nearby");
  let body = await response.json();
  assert(response.status === 200 && body.ok === true, "Healthy nearby request failed");
  assert(body.stops?.length === 1 && body.stops[0].id === "de-national:dedicated",
    "New dedicated GTFS wasn't preferred");
  assert(!requests.some(url => url === oldUrl + "/rest/v1/rpc/transit_gtfs_nearby"),
    "Legacy called despite successful dedicated GTFS");
  console.log("DEDICATED_GTFS_PRIMARY_PREFERENCE_PASS");

  // 2. Simulate an upstream 503: old GTFS must be chosen without mixing trips.
  requests.length = 0;
  dedicatedDown = true;
  response = await post("nearby");
  body = await response.json();
  assert(response.status === 200 && body.ok === true, "Automatic fallback request failed");
  assert(body.stops?.length === 5 && body.stops[0].id === "de-national:legacy0",
    "Legacy GTFS stops missing after simulated outage");
  assert(body.stops.every((x: any) => x.provider === "LifeDashPro legacy GTFS locations"),
    "Mixed or incorrectly labeled feed");
  assert(body.attempts?.[0]?.providerId === "de-gtfs-legacy" &&
         body.attempts[0].ok === true,
    "Automatic fallback was not registered in attempts");
  assert(requests.some(url => url === dedicatedUrl + "/rest/v1/rpc/transit_gtfs_nearby") &&
         requests.some(url => url === oldUrl + "/rest/v1/rpc/transit_gtfs_nearby"),
    "Missing real dedicated->legacy fallback chain");
  console.log("DEDICATED_GTFS_SIMULATED_OUTAGE_FALLBACK_PASS");

  // 3. Diagnostic explicitly checks old source, without attempting dedicated.
  requests.length = 0;
  response = await post("fallback-diagnostic");
  body = await response.json();
  assert(response.status === 200 && body.ok === true &&
         body.fallbackTestOnly === true && body.itemCount === 5,
    "Manual fallback diagnostic contract changed");
  assert(!requests.some(url => url.startsWith(dedicatedUrl)), "Diagnostic unexpectedly called dedicated");
  console.log("DEDICATED_GTFS_FALLBACK_DIAGNOSTIC_PASS");

  // 4. Missing user credentials must be rejected (no bypass for fallback).
  response = await post("fallback-diagnostic", {}, false);
  body = await response.json();
  assert(response.status === 401 && body.ok === false,
    "Preview fallback accepted missing user credentials");
  console.log("DEDICATED_GTFS_FALLBACK_AUTH_REQUIRED_PASS");

  // 5. Scoped GTFS stop IDs must never be sent to Transitland as if they
  // were independent Onestop IDs. Resolve by coordinate for alternate DB.
  requests.length = 0;
  response = await post("departures", {
    stopId:"de-national:355633",feedSource:"de-national",duration:90
  });
  body = await response.json();
  assert(response.status === 200 && body.ok === true, "Outage departures response failed");
  assert(body.departures?.length === 1 && body.departures[0].tripId === "db-native-trip-001",
    "Coordinate-resolved DB departures missing during dedicated outage");
  assert(body.providerId === "de-db-rest", "Wrong provider selected for alternate departures");
  assert(!requests.some(url => url.includes("de-national%3A355633") ||
                              url.includes("de-national:355633")),
    "Feed-scoped stopId leaked into an unrelated provider's URL");
  assert(requests.some(url => url.startsWith("https://v6.db.transport.rest/locations/nearby?")),
    "DB-native station resolution by GPS missing");
  console.log("DEDICATED_GTFS_DEPARTURES_PROVIDER_ID_ISOLATION_PASS");

  // 6. Scoped GTFS trip IDs may not be forwarded to DB transport.rest.
  requests.length = 0;
  response = await post("trip", {
    tripId:"959325",feedSource:"de-national",
    providerId:"de-national",lineName:"11"
  });
  body = await response.json();
  assert(response.status === 200 && body.ok === true && body.route === null,
    "Unavailable GTFS route should fail closed with null route");
  assert(body.providerId === "de-national" && body.attempts?.length === 1 &&
         body.attempts[0].ok === false,
    "Missing GTFS trip-specific failure trace");
  assert(requests.every(url => !url.startsWith("https://v6.db.transport.rest/") &&
                               !url.startsWith("https://transit.land/")),
    "Dedicated tripId was passed to another provider");
  console.log("DEDICATED_GTFS_TRIP_PROVIDER_ID_ISOLATION_PASS");

  console.log("DEDICATED_GTFS_OFFLINE_FALLBACK_INTEGRATION_ALL_PASS");
} finally {
  globalThis.fetch = originalFetch;
  try { await Deno.remove(temp); } catch { /* cleanup in CI */ }
}
