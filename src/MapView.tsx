import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

/**
 * Props is a loose “bag of properties” type for whatever comes from GeoJSON feature.properties.
 * Kept flexible because GeoJSON properties can vary by dataset.
 */
type Props = Record<string, any> | null;

// Defines how substations should look in the default mode.
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

  /**
   * Mapbox token UX:
   * If a candidate hasn't provided VITE_MAPBOX_TOKEN, we show an in-app message
   * instead of a blank page + console errors.
   */
  const [missingMapboxToken, setMissingMapboxToken] = useState(false);

  /**
   * Info panel selection state:
   * - selectedProps: properties of a clicked substation feature
   * - selectedCountyName: name of a clicked county polygon
   *
   * Note: When a user clicks a county, we clear selectedProps, and vice versa,
   * so the panel is never showing two conflicting “selected” things at once.
   */
  const [selectedProps, setSelectedProps] = useState<Props>(null);
  const [selectedCountyName, setSelectedCountyName] = useState<string | null>(null);

  /**
   * UI toggles that control what appears on the map.
   * These are pure React state, and we “apply” them to Mapbox by calling:
   * map.setLayoutProperty(...) and map.setPaintProperty(...)
   */
  const [showSubstations, setShowSubstations] = useState(true);
  const [riskView, setRiskView] = useState(false);
  const [showCounties, setShowCounties] = useState(true);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  /**
   * If substations are hidden, hide riskView, because it only affects the styling of substations.
   */
  useEffect(() => {
    if (!showSubstations && riskView) {
      setRiskView(false);
    }
  }, [showSubstations, riskView]);

  /**
   * Resize map when panel collapses/expands to ensure it fills the available space.
   * Preserves the geographic center and zoom to prevent the map from shifting.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Store current view state in geographic coordinates before resize
    const center = map.getCenter();
    const centerLngLat: [number, number] = [center.lng, center.lat];
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    
    // Handler to restore center after resize
    const restoreCenter = () => {
      map.jumpTo({
        center: centerLngLat,
        zoom: zoom,
        bearing: bearing,
        pitch: pitch,
      });
      // Remove the listener after restoring
      map.off('resize', restoreCenter);
    };
    
    // Listen for resize event to restore center after Mapbox finishes resizing
    map.once('resize', restoreCenter);
    
    // Use requestAnimationFrame to ensure DOM has updated, then resize
    const rafId = requestAnimationFrame(() => {
      map.resize();
    });

    return () => {
      cancelAnimationFrame(rafId);
      map.off('resize', restoreCenter);
    };
  }, [isPanelCollapsed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return; // Map not created yet.

    // Layer IDs we reference elsewhere.
    const subMain = "substations-points";
    const subGlow = "substations-glow";

    const countyFill = "counties-fill";
    const countyOutline = "counties-outline";

    // ---- Counties visibility ----
    // Only try to set visibility if those layers exist already.
    if (map.getLayer(countyFill) && map.getLayer(countyOutline)) {
      const vis = showCounties ? "visible" : "none";
      map.setLayoutProperty(countyFill, "visibility", vis);
      map.setLayoutProperty(countyOutline, "visibility", vis);
    }

    // ---- Substations visibility + styling ----
    // Only try to set visibility if those layers exist already.
    if (!map.getLayer(subMain) || !map.getLayer(subGlow)) return;

    // Toggle substations on/off.
    const visibility = showSubstations ? "visible" : "none";
    map.setLayoutProperty(subMain, "visibility", visibility);
    map.setLayoutProperty(subGlow, "visibility", visibility);

    // If riskView is on, override the default styling based on a data property: criticality (1-5).
    if (riskView) {
      // Main circle radius grows as criticality increases.
      map.setPaintProperty(subMain, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1,
        6, // criticality=1 -> radius=6
        5,
        12, // criticality=5 -> radius=12
      ]);

      // Main circle color shifts by criticality.
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

      // Slightly more opaque in risk mode to stand out.
      map.setPaintProperty(subMain, "circle-opacity", 0.85);

      // Glow radius also scales with criticality.
      map.setPaintProperty(subGlow, "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 1],
        1,
        12,
        5,
        22,
      ]);

      // Glow becomes more visible in risk mode.
      map.setPaintProperty(subGlow, "circle-opacity", 0.25);

      // Keep glow color consistent (purple theme) unless you want it to change too.
      map.setPaintProperty(subGlow, "circle-color", SUBSTATION_DEFAULT.glowColor);
    } else {
      /**
       * Default mode: Reset all paint properties to SUBSTATION_DEFAULT values.
       */
      map.setPaintProperty(subMain, "circle-radius", SUBSTATION_DEFAULT.radius);
      map.setPaintProperty(subMain, "circle-color", SUBSTATION_DEFAULT.color);
      map.setPaintProperty(subMain, "circle-opacity", SUBSTATION_DEFAULT.opacity);

      map.setPaintProperty(subGlow, "circle-radius", SUBSTATION_DEFAULT.glowRadius);
      map.setPaintProperty(subGlow, "circle-color", SUBSTATION_DEFAULT.glowColor);
      map.setPaintProperty(subGlow, "circle-opacity", SUBSTATION_DEFAULT.glowOpacity);
      map.setPaintProperty(subGlow, "circle-blur", SUBSTATION_DEFAULT.glowBlur);
    }
  }, [showSubstations, riskView, showCounties]);

  /**
   * Map initialization effect:
   * 1) Read Mapbox token and create the map instance.
   * 2) On "load", fetch GeoJSON data and add sources/layers.
   * 3) Set up click/hover handlers to drive the Info Panel.
   * 4) Clean up the map on unmount (important to avoid memory leaks).
   */
  useEffect(() => {
    // Mapbox token comes from Vite env vars (VITE_* is exposed to the browser bundle).
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

    // NEW: show an in-app error message if the token is missing
    if (!token || token.trim().length === 0) {
      setMissingMapboxToken(true);
      console.error("Missing VITE_MAPBOX_TOKEN in .env.local");
      return;
    }

    // If we DO have a token, ensure the “missing token” message is not shown.
    setMissingMapboxToken(false);

    mapboxgl.accessToken = token;

    // If the container div doesn't exist yet, we can't create the map.
    if (!mapContainer.current) return;

    // Prevent double-initialization (React strict mode can run effects twice in dev).
    if (mapRef.current) return;

    // Create the actual map.
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-122.2, 37.7],
      zoom: 9,
    });

    // Adds zoom in/out controls.
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // The "load" event fires when the style has fully loaded.
    map.on("load", async () => {
      // Load all datasets in parallel.
      const [countiesRes, substationsRes, linesRes] = await Promise.all([
        fetch("/data/counties.geojson"),
        fetch("/data/substations.geojson"),
        fetch("/data/transmission_lines.geojson"),
      ]);

      // Fail early with helpful messages if any file is missing.
      if (!countiesRes.ok) throw new Error("Failed to load /data/counties.geojson");
      if (!substationsRes.ok) throw new Error("Failed to load /data/substations.geojson");
      if (!linesRes.ok) throw new Error("Failed to load /data/transmission_lines.geojson");

      // Parse JSON bodies.
      const counties = await countiesRes.json();
      const substations = await substationsRes.json();
      const lines = await linesRes.json();

      /**
       * Fit map to the data bounds:
       * - We compute bounding boxes (minLng, minLat, maxLng, maxLat).
       * - Prefer counties for “big picture context”.
       * - If counties are missing or empty, fallback to substations.
       */
      const countiesBbox = getGeoJSONBBox(counties);
      const substationsBbox = getGeoJSONBBox(substations);
      const bbox = countiesBbox ?? substationsBbox;
      if (bbox) {
        map.fitBounds(bbox, { padding: 60, duration: 600 });
      }

      // =========================
      // 1) COUNTIES (POLYGONS)
      // =========================

      // A Mapbox “source” is the raw dataset. Layers reference sources.
      map.addSource("counties", { type: "geojson", data: counties });

      // Fill layer (the interior color of polygons).
      map.addLayer({
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": "#401370",
          "fill-opacity": 0.06,
        },
      });

      // Outline layer (border strokes of polygons).
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

      /**
       * Clicking a county:
       * - Grab the first feature under the mouse (e.features[0])
       * - Pull a best-effort name from a few possible property keys
       * - Save it into React state so the Info Panel updates
       * - Clear any selected substation
       */
      map.on("click", "counties-fill", (e) => {
        const f = e.features?.[0];
        const props = (f?.properties as any) ?? {};

        // Different datasets might store the county name under different keys.
        const name = props.county ?? props.name ?? props.NAME ?? props.county_name ?? null;

        setSelectedCountyName(name);
        setSelectedProps(null);
      });

      // Cursor UX: indicate that county polygons are clickable.
      map.on("mouseenter", "counties-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "counties-fill", () => (map.getCanvas().style.cursor = ""));

      // Apply initial visibility based on React state at the moment the layers are created.
      const countyVis = showCounties ? "visible" : "none";
      map.setLayoutProperty("counties-fill", "visibility", countyVis);
      map.setLayoutProperty("counties-outline", "visibility", countyVis);

      // =========================
      // 2) TRANSMISSION LINES (LINES)
      // =========================

      map.addSource("transmission-lines", { type: "geojson", data: lines });

      map.addLayer({
        id: "transmission-lines",
        type: "line",
        source: "transmission-lines",
        layout: {
          // These make line corners and ends look smoother.
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff4d00",
          "line-width": 1.0,
          "line-opacity": 0.75,
        },
      });

      // =========================
      // 3) SUBSTATIONS (POINTS)
      // =========================

      map.addSource("substations", { type: "geojson", data: substations });

      /**
       * We draw substations using TWO layers:
       * - "substations-glow": a bigger, blurry circle beneath to create a glow
       * - "substations-points": the crisp circle on top with a stroke
       *
       * This is a common mapping trick to get nice visual emphasis.
       */

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

      /**
       * Clicking a substation:
       * - Save its properties into state
       * - Clear selected county (mutually exclusive selection)
       */
      map.on("click", "substations-points", (e) => {
        const f = e.features?.[0];
        setSelectedProps((f?.properties as any) ?? null);
        setSelectedCountyName(null);
      });

      // Cursor UX for clickable substations.
      map.on("mouseenter", "substations-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "substations-points", () => (map.getCanvas().style.cursor = ""));

      // Apply initial substations visibility.
      const subVis = showSubstations ? "visible" : "none";
      map.setLayoutProperty("substations-points", "visibility", subVis);
      map.setLayoutProperty("substations-glow", "visibility", subVis);
    });

    // Store map instance so other effects/handlers can access it.
    mapRef.current = map;

    /**
     * Cleanup:
     * - When the React component unmounts, remove the map from the DOM and free resources.
     * - Also clear mapRef so future mounts can re-init safely.
     */
    return () => {
      map.remove();
      mapRef.current = null;
    };

    // We intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCounties, showSubstations]);

  /**
   * If Mapbox token is missing, show an in-app message with setup instructions.
   */
  if (missingMapboxToken) {
    return (
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          fontFamily: "Helvetica, Arial, sans-serif",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "white",
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Mapbox token required</div>
          <div style={{ color: "#555", fontSize: 13, lineHeight: 1.45 }}>
            This app needs a Mapbox access token to render the map. Please add a token to{" "}
            <span style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
              .env.local
            </span>{" "}
            and restart the dev server (or reload the Codespace).
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render:
   * - A full-screen flex container
   * - Left side: the Mapbox map container
   * - Right side: an Info Panel with checkboxes + selected feature details
   *
   * The Info Panel is “normal React UI”.
   * The map is “imperative Mapbox world”.
   * The effects above keep them in sync.
   */
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", position: "relative", overflow: "hidden", margin: 0, padding: 0 }}>
      {/* Map container div: Mapbox draws into this element */}
      <div ref={mapContainer} style={{ flex: 1, minWidth: 0, width: "100%", height: "100%" }} />

      {/* Floating expand button when collapsed */}
      {isPanelCollapsed && (
        <button
          onClick={() => setIsPanelCollapsed(false)}
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            background: "#f0f0f0",
            border: "1px solid #eee",
            borderRight: "none",
            borderTopLeftRadius: "8px",
            borderBottomLeftRadius: "8px",
            cursor: "pointer",
            fontSize: 20,
            color: "#000",
            padding: "12px 8px",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "-2px 0 4px rgba(0,0,0,0.1)",
          }}
          title="Expand panel"
        >
          ◀
        </button>
      )}

      {/* Info panel */}
      {!isPanelCollapsed && (
      <div
        style={{
          width: "450px",
          padding: 16,
          borderLeft: "1px solid #eee",
          overflow: "auto",
          fontFamily: "Helvetica, Arial, sans-serif",
          background: "#f0f0f0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#000" }}>Info Panel</div>
          <button
            onClick={() => setIsPanelCollapsed(true)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#000",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Collapse panel"
          >
            ▶
          </button>
        </div>

        {/* Layer toggles */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#000", marginBottom: 6 }}>Layers</div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#000" }}>
            <input
              type="checkbox"
              checked={showCounties}
              onChange={(e) => setShowCounties(e.target.checked)}
            />
            Counties (polygons)
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#000" }}>
            <input
              type="checkbox"
              checked={showSubstations}
              onChange={(e) => setShowSubstations(e.target.checked)}
            />
            Substations
          </label>

          {/* Only show the “risk view” toggle if substations are visible */}
          {showSubstations && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#000" }}>
              <input
                type="checkbox"
                checked={riskView}
                onChange={(e) => setRiskView(e.target.checked)}
              />
              Style substations by criticality
            </label>
          )}
        </div>

        {/* County selection section */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#000", marginBottom: 6 }}>Selected county</div>
          {!selectedCountyName ? (
            <div style={{ color: "#000" }}>Click a county to see its name.</div>
          ) : (
            <div style={{ fontWeight: 600, color: "#000" }}>{selectedCountyName}</div>
          )}
        </div>

        {/* Substation selection section */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#000", marginBottom: 6 }}>Selected substation</div>

          {!selectedProps ? (
            <div style={{ color: "#000" }}>Click a substation to see its details.</div>
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
              {/* Card header: name + asset id + a badge */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedProps.name ?? "Unnamed Substation"}
                  </div>
                  <div style={{ fontSize: 12, color: "#000", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Asset ID:{" "}
                    <span style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                      {selectedProps.asset_id ?? "—"}
                    </span>
                  </div>
                </div>

                <CriticalityBadge value={Number(selectedProps.criticality ?? 0)} />
              </div>

              {/* Simple key/value rows */}
              <div style={{ display: "grid", gap: 8 }}>
                <DetailRow label="Operator zone" value={selectedProps.operator_zone ?? "—"} />
                <DetailRow label="Asset type" value={selectedProps.asset_type ?? "—"} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Small UI helper component:
 * Renders a label on the left and a value on the right.
 * Used in the substation details card.
 */
function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#000", flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

/**
 * Renders a pill badge that visually represents "criticality" on a 1–5 scale.
 * We clamp the value so weird data (0, 999, NaN) doesn't break the UI.
 */
function CriticalityBadge({ value }: { value: number }) {
  const v = Number.isFinite(value) ? Math.max(1, Math.min(5, value)) : 1;

  // A simple severity ramp (tweak freely)
  const bg =
    v >= 5 ? "#cd7875" : // high criticality
    v === 4 ? "#d9aa1c" :
    v === 3 ? "#e0dd2d" :
    v === 2 ? "#dff65c" :
              "#b5fdc8"; // low criticality

  // Make text white for darker backgrounds, dark for lighter.
  const fg = v >= 4 ? "#ffffff" : "#1f2937";

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

/**
 * Utility: Compute a bounding box for a GeoJSON FeatureCollection.
 *
 * Mapbox fitBounds expects bounds in the form:
 * [minLng, minLat, maxLng, maxLat]
 */
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
