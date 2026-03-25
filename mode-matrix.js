// @action.title: Mode Matrix
// @action.description: Create a visual matrix showing selection in every mode of a collection
// @action.category: organization
// @action.version: 1.0.0

/**
 * Mode Matrix
 *
 * Creates a visual matrix of the current selection rendered in every mode
 * of a variable collection. Useful for reviewing how components look
 * across themes, breakpoints, or brand variants.
 *
 * How it works:
 * 1. Clones the selection once per mode
 * 2. Labels each clone with the mode name
 * 3. Groups everything and zooms to fit
 */

const GAP = 80;
const LABEL_OFFSET = 40;
const FONT = { family: "Inter", style: "Semi Bold" };

// --- Validate selection ---
if (selection.length === 0) {
  figma.notify("Select something first.", { error: true });
  return { error: "Nothing selected" };
}

// --- Gather variable collections ---
const localCollections = await figma.variables.getLocalVariableCollectionsAsync();

// Try to include team/library collections if the API is available
let allCollections = [...localCollections];
try {
  if (figma.teamLibrary && figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
    const libCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    // Library collections have a different shape; we only need local ones
    // that are already imported, so localCollections is usually sufficient.
    console.log(`Found ${libCollections.length} library collection(s) for reference.`);
  }
} catch (e) {
  console.log("Team library API not available; using local collections only.");
}

if (allCollections.length === 0) {
  figma.notify("No variable collections found in this file.", { error: true });
  return { error: "No collections" };
}

// --- Pick the best collection (prefer one with 2+ modes) ---
let collection = allCollections.find((c) => c.modes.length >= 2);
if (!collection) {
  collection = allCollections[0];
  console.log(
    `No collection with multiple modes found. Using "${collection.name}" (${collection.modes.length} mode).`
  );
}

const modes = collection.modes; // Array of { modeId, name }
console.log(`Using collection "${collection.name}" with ${modes.length} mode(s): ${modes.map((m) => m.name).join(", ")}`);

// --- Load font for labels ---
try {
  await figma.loadFontAsync(FONT);
} catch (e) {
  console.log("Could not load Inter Semi Bold, falling back to Inter Regular.");
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  } catch (e2) {
    console.log("Font loading failed; labels will be skipped.");
  }
}

// --- Calculate selection bounds ---
function getBounds(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const { x, y, width, height } = node.absoluteBoundingBox || {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const bounds = getBounds(selection);
const startX = bounds.x;
const startY = bounds.y + bounds.height + GAP * 2; // Place below existing content

// --- Create matrix ---
const matrixChildren = [];

for (let i = 0; i < modes.length; i++) {
  const mode = modes[i];
  const offsetX = i * (bounds.width + GAP);

  // Create a label
  try {
    const label = figma.createText();
    label.fontName = FONT;
    label.characters = mode.name;
    label.fontSize = 24;
    label.x = startX + offsetX;
    label.y = startY - LABEL_OFFSET;
    label.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    matrixChildren.push(label);
  } catch (e) {
    console.log(`Skipping label for mode "${mode.name}": ${e.message}`);
  }

  // Clone each selected node
  for (const node of selection) {
    try {
      const clone = node.clone();
      clone.x = startX + offsetX + (node.x - bounds.x);
      clone.y = startY + (node.y - bounds.y);

      // Set the explicit variable mode on the clone
      // This tells Figma to resolve variables using this mode
      try {
        clone.setExplicitVariableModeForCollection(collection, mode.modeId);
      } catch (e) {
        console.log(`Could not set mode "${mode.name}" on "${node.name}": ${e.message}`);
      }

      matrixChildren.push(clone);
    } catch (e) {
      console.log(`Could not clone "${node.name}": ${e.message}`);
    }
  }
}

if (matrixChildren.length === 0) {
  figma.notify("Failed to create matrix clones.", { error: true });
  return { error: "No clones created" };
}

// --- Group everything ---
const group = figma.group(matrixChildren, currentPage);
group.name = `Mode Matrix — ${collection.name}`;

// --- Select and zoom ---
currentPage.selection = [group];
figma.viewport.scrollAndZoomIntoView([group]);

const message = `Created mode matrix for "${collection.name}" with ${modes.length} mode(s).`;
figma.notify(message);
console.log(message);

return {
  collection: collection.name,
  modes: modes.map((m) => m.name),
  clonesCreated: matrixChildren.length,
};
