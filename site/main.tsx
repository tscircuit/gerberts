import { useState, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { parseGerberFile, renderGerberToSvg } from "../lib/index.ts"

interface GerberLayer {
  name: string
  svg: string
  error?: string
}

const GERBER_EXTENSIONS = [
  ".gbr",
  ".ger",
  ".gtl",
  ".gbl",
  ".gts",
  ".gbs",
  ".gto",
  ".gbo",
  ".gtp",
  ".gbp",
  ".gko",
  ".gm1",
  ".g1",
  ".g2",
  ".g3",
  ".g4",
  ".top",
  ".bot",
  ".smt",
  ".smb",
  ".sst",
  ".ssb",
  ".pst",
  ".psb",
]

const LAYER_COLORS: Record<
  string,
  { stroke: string; fill: string; bg: string }
> = {
  // Copper layers
  gtl: { stroke: "#ff5555", fill: "#ff5555", bg: "#330000" },
  gbl: { stroke: "#5555ff", fill: "#5555ff", bg: "#000033" },
  top: { stroke: "#ff5555", fill: "#ff5555", bg: "#330000" },
  bot: { stroke: "#5555ff", fill: "#5555ff", bg: "#000033" },
  // Solder mask
  gts: { stroke: "#55ff55", fill: "#55ff55", bg: "#003300" },
  gbs: { stroke: "#55ffff", fill: "#55ffff", bg: "#003333" },
  smt: { stroke: "#55ff55", fill: "#55ff55", bg: "#003300" },
  smb: { stroke: "#55ffff", fill: "#55ffff", bg: "#003333" },
  // Silkscreen
  gto: { stroke: "#ffffff", fill: "#ffffff", bg: "#222222" },
  gbo: { stroke: "#ffff55", fill: "#ffff55", bg: "#333300" },
  sst: { stroke: "#ffffff", fill: "#ffffff", bg: "#222222" },
  ssb: { stroke: "#ffff55", fill: "#ffff55", bg: "#333300" },
  // Paste
  gtp: { stroke: "#aaaaaa", fill: "#aaaaaa", bg: "#222222" },
  gbp: { stroke: "#888888", fill: "#888888", bg: "#222222" },
  // Edge cuts
  gko: { stroke: "#ffff00", fill: "none", bg: "#222222" },
  gm1: { stroke: "#ffff00", fill: "none", bg: "#222222" },
}

function getLayerColors(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return (
    LAYER_COLORS[ext] ?? { stroke: "#00ff00", fill: "#00ff00", bg: "#111111" }
  )
}

function isGerberFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return GERBER_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function App() {
  const [layers, setLayers] = useState<GerberLayer[]>([])
  const [selectedLayer, setSelectedLayer] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const processGerberContent = useCallback(
    (name: string, content: string): GerberLayer => {
      try {
        const gerberFile = parseGerberFile(content)
        const colors = getLayerColors(name)
        let svg = renderGerberToSvg(gerberFile, {
          strokeColor: colors.stroke,
          fillColor: colors.fill,
          backgroundColor: colors.bg,
          scale: 1,
          padding: 0.5,
        })
        // Make SVG responsive by removing fixed dimensions
        svg = svg
          .replace(/\s+width="[^"]*"/, "")
          .replace(/\s+height="[^"]*"/, "")
          .replace("<svg ", '<svg style="max-width:100%;max-height:500px" ')
        return { name, svg }
      } catch (err) {
        return {
          name,
          svg: "",
          error:
            err instanceof Error ? err.message : "Failed to parse gerber file",
        }
      }
    },
    [],
  )

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsLoading(true)
      setError(null)
      setLayers([])
      setSelectedLayer(0)

      try {
        const newLayers: GerberLayer[] = []

        for (const file of Array.from(files)) {
          if (file.name.toLowerCase().endsWith(".zip")) {
            // Handle zip file
            const JSZip = (await import("jszip")).default
            const zip = await JSZip.loadAsync(file)

            const gerberFiles: { name: string; content: string }[] = []

            for (const [path, zipEntry] of Object.entries(zip.files)) {
              if (zipEntry.dir) continue
              const filename = path.split("/").pop() ?? path
              if (isGerberFile(filename)) {
                const content = await zipEntry.async("string")
                gerberFiles.push({ name: filename, content })
              }
            }

            if (gerberFiles.length === 0) {
              setError("No gerber files found in the ZIP archive")
              continue
            }

            for (const { name, content } of gerberFiles) {
              newLayers.push(processGerberContent(name, content))
            }
          } else if (isGerberFile(file.name)) {
            // Handle single gerber file
            const content = await file.text()
            newLayers.push(processGerberContent(file.name, content))
          } else {
            // Try to parse it anyway - might be a gerber without standard extension
            try {
              const content = await file.text()
              newLayers.push(processGerberContent(file.name, content))
            } catch {
              setError(`Unsupported file format: ${file.name}`)
            }
          }
        }

        if (newLayers.length > 0) {
          setLayers(newLayers)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process files")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [processGerberContent],
  )

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return
      await processFiles(files)
    },
    [processFiles],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragging(false)

      const files = event.dataTransfer.files
      if (!files || files.length === 0) return

      await processFiles(files)
    },
    [processFiles],
  )

  const currentLayer = layers[selectedLayer]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">Gerber Viewer</h1>

        {/* File Upload */}
        <div className="mb-8">
          <label
            className="block mb-4"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div
              className={`flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-600 hover:border-blue-500"
              }`}
            >
              <div className="text-center">
                <svg
                  className={`mx-auto h-12 w-12 ${isDragging ? "text-blue-400" : "text-gray-400"}`}
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-labelledby="upload-icon-title"
                >
                  <title id="upload-icon-title">Upload file</title>
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p
                  className={`mt-2 text-sm ${isDragging ? "text-blue-400" : "text-gray-400"}`}
                >
                  {isLoading
                    ? "Processing..."
                    : isDragging
                      ? "Drop your files here"
                      : "Click or drag & drop Gerber files or ZIP archive"}
                </p>
              </div>
            </div>
            <input
              type="file"
              accept=".zip,.gbr,.ger,.gtl,.gbl,.gts,.gbs,.gto,.gbo,.gtp,.gbp,.gko,.gm1"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isLoading}
              multiple
            />
          </label>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Results Section */}
        {layers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Layer List */}
            <div className="lg:col-span-1 bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Layers</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {layers.map((layer, index) => (
                  <button
                    type="button"
                    key={layer.name}
                    onClick={() => setSelectedLayer(index)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                      selectedLayer === index
                        ? "bg-blue-600"
                        : layer.error
                          ? "bg-red-900/30 hover:bg-red-900/50"
                          : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {layer.error ? (
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-mono truncate">
                      {layer.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Section */}
            <div className="lg:col-span-3 bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                Preview:{" "}
                <span className="font-mono text-blue-400">
                  {currentLayer?.name}
                </span>
              </h2>

              {currentLayer?.error ? (
                <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 text-red-200">
                  <p className="font-semibold mb-2">
                    Failed to parse gerber file:
                  </p>
                  <p className="font-mono text-sm">{currentLayer.error}</p>
                </div>
              ) : currentLayer?.svg ? (
                <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center min-h-[500px]">
                  <div
                    className="w-full h-[500px] flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: currentLayer.svg }}
                  />
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-4 min-h-[500px] flex items-center justify-center">
                  <p className="text-gray-500">No preview available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        {layers.length === 0 && !isLoading && !error && (
          <div className="text-center text-gray-400 mt-8">
            <p className="mb-2">Upload Gerber files to preview them as SVG.</p>
            <p className="text-sm">
              Supports single Gerber files or ZIP archives containing multiple
              layers.
            </p>
            <p className="text-sm mt-4 text-gray-500">
              Supported formats: .gbr, .ger, .gtl, .gbl, .gts, .gbs, .gto, .gbo,
              .gtp, .gbp, .gko, .gm1
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById("root")!)
root.render(<App />)
