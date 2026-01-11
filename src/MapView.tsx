import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = Record<string, any> | null;

// Single source of truth for default substation styling (purple theme)
const SUBSTATION_DEFAULT = {
  radius: 5,
  color: "#7720f1",
  opacity: 0.75,
  glowRadius: 16,
  glowColor: "#ac4ae1",
  glowOpacity: 0.18,
  glowBlur: 0.8,
  strokeColor: "#FFFFFF",
  strokeWidth: 2,
  strokeOpacity: 0.9,
};

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [selectedProps, setSelectedProps] = useState<Props>(null);
  const [selectedCountyName, setSelectedCountyName] = useState<string | null>(null);

  const [showSubstations, setShowSubstations] = useState(true);
  const [riskView, setRiskView] = useState(false);
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

    // Risk vs default styling
    if (riskView) {
      // Size and color by criticality (1-5)
      map.setPaintProperty(subMain, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1,
        6,
        5,
        12,
      ]);
      map.setPaintProperty(subMain, "circle-color", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1,
        "#5DADE2",
        3,
        "#BB8FCE",
        5,
        "#E74C3C",
      ]);
      map.setPaintProperty(subMain, "circle-opacity", 0.85);

      map.setPaintProperty(subGlow, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1,
        12,
        5,
        22,
      ]);
      map.setPaintProperty(subGlow, "circle-opacity", 0.25);
      // leave glow color as-is (purple) unless you want it to change too
      map.setPaintProperty(subGlow, "circle-color", SUBSTATION_DEFAULT.glowColor);
    } else {
      // Reset to the one true default styling
      map.setPaintProperty(subMain, "circle-radius", SUBSTATION_DEFAULT.radius);
      map.setPaintProperty(subMain, "circle-color", SUBSTATION_DEFAULT.color);
      map.setPaintProperty(subMain, "circle-opacity", SUBSTATION_DEFAULT.opacity);

      map.setPaintProperty(subGlow, "circle-radius", SUBSTATION_DEFAULT.glowRadius);
      map.setPaintProperty(subGlow, "circle-color", SUBSTATION_DEFAULT.glowColor);
      map.setPaintProperty(subGlow, "circle-opacity", SUBSTATION_DEFAULT.glowOpacity);
      map.setPaintProperty(subGlow, "circle-blur", SUBSTATION_DEFAULT.glowBlur);
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
      center: [-122.2, 37.7],
      zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      const [countiesRes, substationsRes, linesRes] = await Promise.all([
        fetch("/data/counties.geojson"),
        fetch("/data/substations.geojson"),
        fetch("/data/transmission_lines.geojson"),
      ]);

      if (!countiesRes.ok) throw new Error("Failed to load /data/counties.geojson");
      if (!substationsRes.ok) throw new Error("Failed to load /data/substations.geojson");
      if (!linesRes.ok) throw new Error("Failed to load /data/transmission_lines.geojson");

      const counties = await countiesRes.json();
      const substations = await substationsRes.json();
      const lines = await linesRes.json();

      // Fit bounds: prefer counties (bigger context), fallback to substations
      const countiesBbox = getGeoJSONBBox(counties);
      const substationsBbox = getGeoJSONBBox(substations);
      const bbox = countiesBbox ?? substationsBbox;
      if (bbox) {
        map.fitBounds(bbox, { padding: 60, duration: 600 });
      }

      // ----- Counties (polygons) -----
      map.addSource("counties", { type: "geojson", data: counties });

      map.addLayer({
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": "#401370",
          "fill-opacity": 0.06,
        },
      });

      map.addLayer({
        id: "counties-outline",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#7720f1",
          "line-width": 1.5,
          "line-opacity": 0.75,
        },
      });

      map.on("click", "counties-fill", (e) => {
        const f = e.features?.[0];
        const props = (f?.properties as any) ?? {};
        const name = props.county ?? props.name ?? props.NAME ?? props.county_name ?? null;
        setSelectedCountyName(name);
        setSelectedProps(null);
      });

      map.on("mouseenter", "counties-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "counties-fill", () => (map.getCanvas().style.cursor = ""));

      // Apply initial counties visibility
      const countyVis = showCounties ? "visible" : "none";
      map.setLayoutProperty("counties-fill", "visibility", countyVis);
      map.setLayoutProperty("counties-outline", "visibility", countyVis);

      // ----- Transmission lines (lines) -----
      map.addSource("transmission-lines", { type: "geojson", data: lines });

      map.addLayer({
        id: "transmission-lines",
        type: "line",
        source: "transmission-lines",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff4d00",
          "line-width": 1.0,
          "line-opacity": 0.75,
        },
      });

      // ----- Substations (points) -----
      map.addSource("substations", { type: "geojson", data: substations });

      map.addLayer({
        id: "substations-glow",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": SUBSTATION_DEFAULT.glowRadius,
          "circle-color": SUBSTATION_DEFAULT.glowColor,
          "circle-blur": SUBSTATION_DEFAULT.glowBlur,
          "circle-opacity": SUBSTATION_DEFAULT.glowOpacity,
        },
      });

      map.addLayer({
        id: "substations-points",
        type: "circle",
        source: "substations",
        paint: {
          "circle-radius": SUBSTATION_DEFAULT.radius,
          "circle-color": SUBSTATION_DEFAULT.color,
          "circle-opacity": SUBSTATION_DEFAULT.opacity,
          "circle-stroke-color": SUBSTATION_DEFAULT.strokeColor,
          "circle-stroke-width": SUBSTATION_DEFAULT.strokeWidth,
          "circle-stroke-opacity": SUBSTATION_DEFAULT.strokeOpacity,
        },
      });

      map.on("click", "substations-points", (e) => {
        const f = e.features?.[0];
        setSelectedProps((f?.properties as any) ?? null);
        setSelectedCountyName(null);
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
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Info Panel</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Layers</div>

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
              Style substations by criticality
            </label>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Selected county</div>
          {!selectedCountyName ? (
            <div style={{ color: "#666" }}>Click a county to see its name.</div>
          ) : (
            <div style={{ fontWeight: 600 }}>{selectedCountyName}</div>
          )}
        </div>

<div style={{ marginBottom: 14 }}>
  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Selected substation</div>

  {!selectedProps ? (
    <div style={{ color: "#666" }}>Click a substation to see its details.</div>
  ) : (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
            {selectedProps.name ?? "Unnamed Substation"}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>
            Asset ID: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{selectedProps.asset_id ?? "—"}</span>
          </div>
        </div>

        <CriticalityBadge value={Number(selectedProps.criticality ?? 0)} />
      </div>

      {/* Key-value rows */}
      <div style={{ display: "grid", gap: 8 }}>
        <DetailRow label="Operator zone" value={selectedProps.operator_zone ?? "—"} />
        <DetailRow label="Asset type" value={selectedProps.asset_type ?? "—"} />
      </div>

      {/* Optional: show raw JSON in a collapsible section */}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>View raw properties</summary>
        <pre
          style={{
            marginTop: 8,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 10,
          }}
        >
          {JSON.stringify(selectedProps, null, 2)}
        </pre>
      </details>
    </div>
  )}
</div>

      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function CriticalityBadge({ value }: { value: number }) {
  const v = Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 1;

  // Purple theme mapping
  const bg =
    v >= 5 ? "#cd7875" :
    v === 4 ? "#d9aa1c" :
    v === 3 ? "#e0dd2d" :
    v === 2 ? "#dff65c" :
              "#b5fdc8";

  const fg = v <= 6 ? "#1f2937" : "#ffffff";

  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
      title="Criticality (1–5)"
    >
      Criticality {v}
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

  let minX = coords[0][0],
    minY = coords[0][1],
    maxX = coords[0][0],
    maxY = coords[0][1];
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}
