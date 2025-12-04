# gerberts

[NPM Package](https://www.npmjs.com/package/gerberts) &middot; [View Online](https://gerber.tscircuit.com)

A TypeScript Gerber file parser and serializer, also render Gerbers to SVG

## Installation

```bash
bun add gerberts
```

## Usage

### Parsing a Gerber file

```ts
import { parseGerberFile, GerberFile } from "gerberts"

// Parse from string
const source = `%FSLAX26Y26*%
%MOMM*%
%ADD10C,0.1*%
D10*
X0Y0D03*
M02*`

const gerber = parseGerberFile(source)
// or: GerberFile.parse(source)

// Access parsed data
console.log(gerber.formatSpecification) // FormatSpecification { ... }
console.log(gerber.unitMode?.unit) // "MM"
console.log(gerber.apertureDefinitions) // [ApertureDefinition { code: 10, ... }]
```

### Serializing back to text

```ts
const output = gerber.getString()
// Returns the Gerber file as a string
```

### Building a Gerber file programmatically

```ts
import {
  GerberFile,
  GerberNode,
  FormatSpecification,
  UnitMode,
  ApertureDefinition,
  SelectAperture,
  Move,
  Interpolate,
  Flash,
} from "gerberts"

const gerber = new GerberFile()

gerber.addCommand(
  new FormatSpecification({
    xIntegerDigits: 2,
    xDecimalDigits: 6,
    yIntegerDigits: 2,
    yDecimalDigits: 6,
  })
)
gerber.addCommand(new UnitMode("MM"))
gerber.addCommand(
  new ApertureDefinition({
    code: 10,
    template: "C",
    params: [0.1],
  })
)
gerber.addCommand(new SelectAperture(10))
gerber.addCommand(new Move({ x: 0, y: 0 }))
gerber.addCommand(new Interpolate({ x: 1000000, y: 1000000 }))
gerber.ensureEndOfFile()

console.log(gerber.getString())
```

### Adding commands from strings

You can add commands directly from Gerber command strings:

```ts
const gerber = new GerberFile()

// Add commands using raw Gerber syntax
gerber.addCommand("%FSLAX26Y26*%")
gerber.addCommand("%MOMM*%")
gerber.addCommand("%ADD10C,0.1*%")
gerber.addCommand("D10*")
gerber.addCommand("X0Y0D02*")
gerber.addCommand("X1000000Y1000000D01*")
gerber.addCommand("M02*")

// Or parse a command explicitly with GerberNode.parse
const flashCommand = GerberNode.parse("X500000Y500000D03*")
gerber.addCommand(flashCommand)
```

## API

### Root Class

- `GerberFile` - Root document class representing a complete Gerber file
  - `GerberFile.parse(source)` - Parse a Gerber file from text
  - `gerber.getString()` - Serialize back to Gerber format
  - `gerber.commands` - Array of all commands
  - `gerber.formatSpecification` - Get the format specification
  - `gerber.unitMode` - Get the unit mode
  - `gerber.apertureDefinitions` - Get all aperture definitions
  - `gerber.fileAttributes` - Get all file attributes (X2)
  - `gerber.operations` - Get all operations

### Parse Functions

- `parseGerberFile(source)` - Parse a Gerber file (alias for `GerberFile.parse`)
- `parseGerber(source)` - Low-level parse returning array of nodes

### Entity Classes

**Configuration Commands:**

- `FormatSpecification` - Format specification (%FS)
- `UnitMode` - Unit mode (%MO)
- `ApertureDefinition` - Aperture definition (%AD)
- `ApertureMacro` - Aperture macro (%AM)

**State Commands:**

- `LoadPolarity` - Load polarity (%LP)
- `LoadMirroring` - Load mirroring (%LM)
- `LoadRotation` - Load rotation (%LR)
- `LoadScaling` - Load scaling (%LS)
- `StepRepeat` - Step and repeat (%SR)
- `SelectAperture` - Select aperture (Dnn)
- `SetInterpolationMode` - Set interpolation (G01/G02/G03)

**Attribute Commands (X2):**

- `FileAttribute` - File attribute (%TF)
- `ApertureAttribute` - Aperture attribute (%TA)
- `ObjectAttribute` - Object attribute (%TO)
- `DeleteAttribute` - Delete attribute (%TD)

**Drawing Commands:**

- `Interpolate` - Draw/interpolate operation (D01)
- `Move` - Move without drawing (D02)
- `Flash` - Flash aperture at position (D03)
- `Operation` - Base class for D-code operations
- `RegionStart` - Start region (G36)
- `RegionEnd` - End region (G37)

**Other:**

- `Comment` - Comment (G04)
- `EndOfFile` - End of file (M02)
- `UnknownCommand` - Unrecognized commands (preserved for round-trip)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck
```

## License

MIT
