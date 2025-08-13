import { useRef } from "react";

type Props = {
  onLoad: (data: object) => void;
  maxSizeMB?: number; // default 10
};

export default function GeoJsonUploader({ onLoad, maxSizeMB = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size guardrail
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      alert(`File is ${sizeMB.toFixed(1)} MB. Max allowed is ${maxSizeMB} MB.`);
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Minimal runtime validation
      const isFeatureOrFC =
        json && typeof json === "object" &&
        (json.type === "FeatureCollection" || json.type === "Feature");

      if (!isFeatureOrFC) {
        alert("This file doesn't look like valid GeoJSON (Feature or FeatureCollection).");
        e.target.value = "";
        return;
      }

      onLoad(json);
    } catch (err: any) {
      console.error("GeoJSON parse error:", err);
      alert("Failed to read/parse the file. Please ensure it's valid JSON/GeoJSON.");
    } finally {
      // Reset so the same file can be re-selected if needed
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,application/geo+json,application/json"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.2)",
          background: "rgba(0,0,0,.55)",
          color: "white",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
        title="Upload GeoJSON"
      >
        Upload GeoJSON
      </button>
    </>
  );
}
