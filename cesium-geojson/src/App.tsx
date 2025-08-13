import { useState } from "react";
import CesiumMap from "./components/CesiumMap";
import GeoJsonUploader from "./components/GeoJsonUploader";

function App() {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
  const [uploaded, setUploaded] = useState<object | null>(null);

  const clearUpload = () => setUploaded(null);

  const geojsonUrl = !uploaded && apiBase ? `${apiBase}/api/geojson` : undefined;

  return (
    <div style={{ height: "100%", position: "relative" }}>
      {/* Controls overlay */}
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          top: 12,
          left: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <GeoJsonUploader onLoad={setUploaded} />
        {uploaded && (
          <button
            type="button"
            onClick={clearUpload}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(0,0,0,.55)",
              color: "white",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
            }}
            title="Back to API data"
          >
            Reset to API
          </button>
        )}
      </div>

      {/* Map */}
      <CesiumMap
        geojson={uploaded ?? undefined}
        geojsonUrl={geojsonUrl}
        pointSize={12}
        label
      />
    </div>
  );
}

export default App;
