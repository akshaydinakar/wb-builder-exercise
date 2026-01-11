import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selectedProps, setSelectedProps] = useState<Record<string, any> | null>(null);

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
          "circle-stroke-width": 1
        }
      });

      map.on("click", "assets-points", (e) => {
        const f = e.features?.[0];
        setSelectedProps((f?.properties as any) ?? null);
      });

      map.on("mouseenter", "assets-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "assets-points", () => (map.getCanvas().style.cursor = ""));
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <div ref={mapContainer} style={{ flex: 1 }} />
      <div style={{ width: 360, padding: 16, borderLeft: "1px solid #eee", overflow: "auto" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Info Panel</div>
        {!selectedProps ? (
          <div style={{ color: "#666" }}>Click a point to see details.</div>
        ) : (
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(selectedProps, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}