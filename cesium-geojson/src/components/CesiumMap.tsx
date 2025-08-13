import {
  Cartesian2,
  Color,
  DistanceDisplayCondition,
  Entity,
  GeoJsonDataSource,
  HeightReference,
  HorizontalOrigin,
  NearFarScalar,
  VerticalOrigin,
  Viewer,
} from "cesium";
import { useEffect, useRef } from "react";
import { parseCssColor } from "../lib/colors";

type Props = {
  /** Either provide geojsonUrl OR geojson; prefer geojsonUrl for API-driven data */
  geojsonUrl?: string;
  geojson?: object;
  pointSize?: number;      // default 12
  label?: boolean;         // default true
  clampToGround?: boolean; // default false
};

export default function CesiumMap({
  geojsonUrl,
  geojson,
  pointSize = 12,
  label = true,
  clampToGround = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const dsRef = useRef<GeoJsonDataSource | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: true,
      navigationHelpButton: false,
      fullscreenButton: false,
      selectionIndicator: true,
      infoBox: true,
      terrain: undefined,
      shouldAnimate: false,
    });

    // Keep labels crisp and on top
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewerRef.current = viewer;

    const load = async () => {
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
        dsRef.current = null;
      }

      const source: string | object | undefined = geojsonUrl ?? geojson;
      if (!source) {
        console.warn("CesiumMap: no geojsonUrl or geojson provided");
        return;
      }

      const ds = await GeoJsonDataSource.load(source, { clampToGround });

      for (const e of ds.entities.values) {
        applyStylingFromProperties(e, pointSize, label);
      }

      await viewer.dataSources.add(ds);
      dsRef.current = ds;

      await viewer.flyTo(ds, { duration: 1.2 });
    };

    load().catch((err) => console.error("GeoJSON load error:", err));

    return () => {
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
      }
      viewer.destroy();
    };
  }, [geojsonUrl, geojson, pointSize, label, clampToGround]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

/** Robustly resolve a human-friendly name from common barrage fields */
function resolveName(entity: Entity, propsObj: Record<string, any>): string {
  return (
    (entity.name as string | undefined) ||
    propsObj.name ||
    propsObj.Name ||
    propsObj.title ||
    propsObj.Title ||
    propsObj.barrage ||
    propsObj.Barrage ||
    propsObj.barrage_name ||
    propsObj.BarrageName ||
    propsObj.project ||
    propsObj.Project ||
    propsObj.dam ||
    propsObj.Dam ||
    propsObj.id ||
    "Unnamed Feature"
  );
}

/** Map your properties to Cesium entity graphics */
function applyStylingFromProperties(
  entity: Entity,
  pointSize: number,
  addLabel: boolean
) {
  const props = entity.properties;
  const propsObj = props?.getValue?.() ?? {};

  // Ensure we always have a name and surface it in the infoBox
  const name = resolveName(entity, propsObj);
  entity.name = name;

  // --- POINTS AS CIRCLES ---
  if (entity.point) {
    const color = parseCssColor(propsObj["marker-color"], Color.RED);
    entity.point.color = color;
    entity.point.pixelSize = pointSize;
    entity.point.outlineWidth = 1.5;
    entity.point.outlineColor = Color.BLACK.withAlpha(0.6);
    entity.point.heightReference = HeightReference.CLAMP_TO_GROUND;

    if (addLabel) attachLabel(entity, name);
  }

  // --- POINTS AS BILLBOARDS (blue pushpins from GeoJSON marker-symbol/icon) ---
  if (entity.billboard) {
    // Optional tint if a color is provided
    const colorStr = propsObj["marker-color"];
    if (colorStr) entity.billboard.color = parseCssColor(colorStr, Color.WHITE);
    entity.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
    entity.billboard.horizontalOrigin = HorizontalOrigin.CENTER;
    entity.billboard.heightReference = HeightReference.CLAMP_TO_GROUND;

    if (addLabel) attachLabel(entity, name, /*yOffset*/ -32);
  }

  // --- LINES ---
  if (entity.polyline) {
    const stroke = parseCssColor(propsObj["stroke"], Color.YELLOW);
    const opacity =
      typeof propsObj["stroke-opacity"] === "number" ? propsObj["stroke-opacity"] : 1;
    const width =
      typeof propsObj["stroke-width"] === "number" ? propsObj["stroke-width"] : 3;

    entity.polyline.material = stroke.withAlpha(opacity);
    entity.polyline.width = width;

    if (addLabel) attachLabel(entity, name);
  }
}

/** Attach a readable label; defaults tuned to sit just above a marker */
function attachLabel(entity: Entity, text: string, yOffset: number = -18) {
  entity.label = {
    text,
    font: "14px Inter, Roboto, Helvetica, Arial, sans-serif",
    pixelOffset: new Cartesian2(0, yOffset),
    fillColor: Color.WHITE,
    outlineWidth: 3,
    outlineColor: Color.BLACK.withAlpha(0.7),
    showBackground: true,
    backgroundPadding: new Cartesian2(6, 4),
    backgroundColor: Color.BLACK.withAlpha(0.35),
    distanceDisplayCondition: new DistanceDisplayCondition(0.0, 2_000_000.0),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    translucencyByDistance: new NearFarScalar(500_000, 1.0, 2_000_000, 0.8),
  } as any;
}
