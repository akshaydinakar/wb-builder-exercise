import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = Record<string, any> | null;

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [selectedProps, setSelectedProps] = useState<Props>(null);
  const [showAssets, setShowAssets] = useState(true);
  const [riskView, setRiskView] = useState(false);

  // Apply UI state to map (after map loads)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer("assets-points")) return;

    // Toggle visibility
    map.setLayoutProperty(
      "assets-points",
      "visibility",
      showAssets ? "visible" : "none"
    );

    // Toggle styling mode (risk vs default)
    // Uses the "criticality" property as a hook
    if (riskView) {
      map.setPaintProperty("assets-points", "circle-radius", [
        "interpolate",
        ["linear"],
        ["coalesce", ["to-number", ["get", "criticality"]], 0],
        0, 5,
        5, 11
      ]);
      map.setPaintProperty("assets-points", "circle-opacity", 0.85);
    } else {
      map.setPaintProperty("assets-points", "circle-radius", 6);
      map.setPaintProperty("assets-points", "circle-opacity", 1);
    }
  }, [showAssets, riskView]);

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
      center: [-98.5, 39.8],
      zoom: 3.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      const res = await fetch("/data/assets.geojson");
      const assets = await res.json();

      map.addSource("assets", { type: "geojson", data: assets });

      map.addLayer({
        id: "assets-points",
        type: "circle",
        source: "assets",
        paint: {
          "circle-radius": 6,
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.4
        }
      });

      map.on("click", "assets-points", (e) => {
        const f = e.features?.[0];
        setSelectedProps((f?.properties as any) ?? null);
      });

      map.on("mouseenter", "assets-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "assets-points", () => (map.getCanvas().style.cursor = ""));

      mapRef.current = map;

      // Apply initial UI state now that the layer exists
      map.setLayoutProperty(
        "assets-points",
        "visibility",
        showAssets ? "visible" : "none"
      );
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

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={showAssets}
              onChange={(e) => setShowAssets(e.target.checked)}
            />
            Assets (points)
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={riskView}
              onChange={(e) => setRiskView(e.target.checked)}
            />
            Risk view (uses “criticality”)
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Legend</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <div><b>Assets</b>: points in territory</div>
            <div><b>Criticality</b>: 1 (low) → 5 (high)</div>
            <div style={{ color: "#666", marginTop: 6 }}>
              Tip: candidates can improve how this legend works + how risk is communicated.
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Selected feature</div>
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
          You can improve UX, clarity, and decision-support. No backend changes required.
        </div>
      </div>
    </div>
  );
}