import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = Record<string, any> | null;

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [selectedProps, setSelectedProps] = useState<Props>(null);
  const [showSubstations, setShowSubstations] = useState(true);
  const [riskView, setRiskView] = useState(false);

  // NEW: counties toggle
  const [showCounties, setShowCounties] = useState(true);

  // Keep UI state sane: if substations hidden, risk view should be off
  useEffect(() => {
    if (!showSubstations && riskView) {
      setRiskView(false);
    }
  }, [showSubstations, riskView]);

  // Apply UI state to map after layers exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const subMain = "substations-points";
    const subGlow = "substations-glow";

    const countyFill = "counties-fill";
    const countyOutline = "counties-outline";

    // Counties visibility (only if layers exist yet)
    if (map.getLayer(countyFill) && map.getLayer(countyOutline)) {
      const vis = showCounties ? "visible" : "none";
      map.setLayoutProperty(countyFill, "visibility", vis);
      map.setLayoutProperty(countyOutline, "visibility", vis);
    }

    // Substations visibility + styling (only if layers exist yet)
    if (!map.getLayer(subMain) || !map.getLayer(subGlow)) return;

    const visibility = showSubstations ? "visible" : "none";
    map.setLayoutProperty(subMain, "visibility", visibility);
    map.setLayoutProperty(subGlow, "visibility", visibility);

    // Toggle styling mode (risk vs default)
    // Hook: "criticality" property (1-5)
    if (riskView) {
      map.setPaintProperty(subMain, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1, 6,
        5, 12
      ]);
      map.setPaintProperty(subMain, "circle-color", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1, "#5DADE2",
        3, "#BB8FCE",
        5, "#E74C3C"
      ]);
      map.setPaintProperty(subGlow, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1, 12,
        5, 22
      ]);
      map.setPaintProperty(subGlow, "circle-opacity", 0.25);
    } else {
      // Default mode: subtle sizing and consistent “clean” tone
      map.setPaintProperty(subMain, "circle-radius", 7);
      map.setPaintProperty(subMain, "circle-color", "#7FB3D5");
      map.setPaintProperty(subGlow, "circle-radius", 16);
      map.setPaintProperty(subGlow, "circle-opacity", 0.18);
    }
  }, [showSubstations, riskView, showCounties]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!token) {
      console.error("Missing VITE_MAPBOX_TOKEN in .env.local");
      return;
    }
    mapboxgl.accessToken = token;

    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      // We'll fit bounds after loading data, so these are just placeholders
      center: [-122.2, 37.7],
      zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      // Load both datasets in parallel
      const [countiesRes, substationsRes] = await Promise.all([
        fetch("/data/counties.geojson"),
        fetch("/data/substations.geojson"),
      ]);

      if (!countiesRes.ok) throw new Error("Failed to load /data/counties.geojson");
      if (!substationsRes.ok) throw new Error("Failed to load /data/substations.geojson");

      const counties = await countiesRes.json();
      const substations = await substationsRes.json();

      // Fit bounds: prefer counties (bigger context), fallback to substations
      const countiesBbox = getGeoJSONBBox(counties);
      const substationsBbox = getGeoJSONBBox(substations);
      const bbox = countiesBbox ?? substationsBbox;
      if (bbox) {
        map.fitBounds(bbox, { padding: 60, duration: 600 });
      }

      // ----- Counties (polygons) -----
      map.addSource("counties", { type: "geojson", data: counties });

      // Fill goes underneath points
      map.addLayer({
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": "#5DADE2",
          "fill-opacity": 0.08
        }
      });

      map.addLayer({
        id: "counties-outline",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#2E86C1",
          "line-width": 1.5,
          "line-opacity": 0.35
        }
      });

      // Apply initial counties visibility
      const countyVis = showCounties ? "visible" : "none";
      map.setLayoutProperty("counties-fill", "visibility", countyVis);
      map.setLayoutProperty("counties-outline", "visibility", countyVis);

      // ----- Substations (points) -----
      map.addSource("substations", { type: "geojson", data: substations });

      // Glow layer (draw first, underneath main points)
      map.addLayer({
        id: "substations-glow",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": 16,
          "circle-color": "#85C1E9",
          "circle-blur": 0.8,
          "circle-opacity": 0.18
        }
      });

      // Main points layer
      map.addLayer({
        id: "substations-points",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": 7,
          "circle-color": "#7FB3D5",
          "circle-opacity": 0.95,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.9
        }
      });

      map.on("click", "substations-points", (e) => {
        const f = e.features?.[0];
        setSelectedProps((f?.properties as any) ?? null);
      });

      map.on("mouseenter", "substations-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "substations-points", () => (map.getCanvas().style.cursor = ""));

      // Apply initial substations visibility
      const subVis = showSubstations ? "visible" : "none";
      map.setLayoutProperty("substations-points", "visibility", subVis);
      map.setLayoutProperty("substations-glow", "visibility", subVis);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div ref={mapContainer} style={{ flex: 1 }} />

      <div
        style={{
          width: 380,
          padding: 16,
          borderLeft: "1px solid #eee",
          overflow: "auto",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Exercise Panel</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Layers</div>

          {/* NEW: counties toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={showCounties}
              onChange={(e) => setShowCounties(e.target.checked)}
            />
            Counties (polygons)
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={showSubstations}
              onChange={(e) => setShowSubstations(e.target.checked)}
            />
            Substations
          </label>

          {showSubstations && (
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={riskView}
                onChange={(e) => setRiskView(e.target.checked)}
              />
              Risk view (styles by criticality)
            </label>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Legend</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <div><b>Counties</b>: placeholder polygons around the Bay Area</div>
            <div><b>Substations</b>: points in the Bay Area</div>
            <div><b>Criticality</b>: 1 (low) → 5 (high)</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Selected substation</div>
          {!selectedProps ? (
            <div style={{ color: "#666" }}>Click a point to see details.</div>
          ) : (
            <pre
              style={{
                fontSize: 12,
                whiteSpace: "pre-wrap",
                background: "#fafafa",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 10,
              }}
            >
              {JSON.stringify(selectedProps, null, 2)}
            </pre>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#666" }}>
          Tip: candidates can improve legend clarity, filtering, search, and decision-support UX.
        </div>
      </div>
    </div>
  );
}

// Computes [minLng, minLat, maxLng, maxLat] for a GeoJSON FeatureCollection
function getGeoJSONBBox(geojson: any): mapboxgl.LngLatBoundsLike | null {
  const coords: Array<[number, number]> = [];

  const pushCoord = (c: any) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      coords.push([c[0], c[1]]);
    } else if (Array.isArray(c)) {
      for (const item of c) pushCoord(item);
    }
  };

  const features = geojson?.features ?? [];
  for (const f of features) {
    pushCoord(f?.geometry?.coordinates);
  }
  if (!coords.length) return null;

  let minX = coords[0][0], minY = coords[0][1], maxX = coords[0][0], maxY = coords[0][1];
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}
