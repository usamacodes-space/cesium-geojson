import compression from "compression";
import cors from "cors";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- Infra ----------
app.set("etag", "strong");
app.use(helmet());
app.use(cors({ origin: true }));
app.use(compression());
app.use(express.json({ limit: "10mb" })); // JSON uploads up to ~10MB

// HTTP access logs
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));

// Storage
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer for multipart files (kept in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/geo+json" ||
      file.mimetype === "application/json" ||
      file.originalname.toLowerCase().endsWith(".geojson") ||
      file.originalname.toLowerCase().endsWith(".json");
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

// ---------- Logging helper ----------
const logStep = (phase, meta = {}) => {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${phase}] ${JSON.stringify(meta)}`);
};

// ---------- Validation (GeoJSON) ----------
const geometry = z.object({
  type: z.enum([
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
  ]),
  coordinates: z.any(), // accept valid shapes; deeper checks can be added later
});

const feature = z.object({
  type: z.literal("Feature"),
  geometry,
  properties: z.record(z.any()).optional(),
});

const featureCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(feature),
});

const geojsonSchema = z.union([featureCollection, feature]);

// ---------- Health ----------
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------- Persisted GET by id ----------
app.get("/api/geojson/:id", async (req, res) => {
  const id = req.params.id;
  const filePath = path.join(UPLOAD_DIR, `${id}.geojson`);
  try {
    const stat = await fs.promises.stat(filePath);
    res.setHeader("Content-Type", "application/geo+json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Last-Modified", stat.mtime.toUTCString());
    logStep("PERSISTED_GET", { id, bytes: stat.size });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    logStep("PERSISTED_GET_MISS", { id });
    res.status(404).json({ error: "Not found" });
  }
});

// ---------- Upload (JSON body OR multipart file) ----------
app.post("/api/geojson", upload.single("file"), async (req, res) => {
  try {
    let rawText;

    if (req.file) {
      // multipart/form-data upload
      rawText = req.file.buffer.toString("utf-8");
      logStep("UPLOAD_RECEIVED_FILE", {
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } else if (req.is("application/json")) {
      // direct JSON body
      rawText = JSON.stringify(req.body);
      logStep("UPLOAD_RECEIVED_JSON", { approxBytes: Buffer.byteLength(rawText) });
    } else {
      return res.status(400).json({ error: "Send as multipart field `file` OR application/json" });
    }

    // Parse + validate
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      logStep("UPLOAD_PARSE_ERROR", { message: String(e) });
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const validated = geojsonSchema.parse(parsed);
    logStep("UPLOAD_VALIDATED", {
      type: validated.type,
      features: validated.type === "FeatureCollection" ? validated.features.length : 1,
    });

    // Persist
    const id = uuidv4();
    const filePath = path.join(UPLOAD_DIR, `${id}.geojson`);
    const pretty = JSON.stringify(validated, null, 2);
    await fs.promises.writeFile(filePath, pretty, "utf-8");
    const bytes = Buffer.byteLength(pretty);

    logStep("UPLOAD_SAVED", { id, filePath, bytes });

    // Respond with stable URL
    const url = `/api/geojson/${id}`;
    logStep("UPLOAD_RESPOND", { id, url });
    res.status(201).json({ id, url, bytes });
  } catch (err) {
    if (err?.issues) {
      logStep("UPLOAD_VALIDATION_ERROR", { issues: err.issues });
      return res.status(400).json({ error: "Invalid GeoJSON", details: err.issues });
    }
    logStep("UPLOAD_FATAL", { message: String(err) });
    res.status(500).json({ error: "Internal error" });
  }
});

// ---------- Boot ----------
app.listen(PORT, () => {
  logStep("SERVER_START", { port: PORT, uploadDir: UPLOAD_DIR });
  console.log(`API listening on http://localhost:${PORT}`);
});
