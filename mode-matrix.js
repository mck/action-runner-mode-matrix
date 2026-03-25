// @action.title: Mode Matrix
// @action.description: Create a visual matrix showing selection in every mode of a collection
// @action.category: organization
// @action.version: 2.0.0

/* @action.params
[
  { "key": "axes", "type": "select", "label": "Axes", "options": ["1 Axis", "2 Axes"], "default": "1 Axis" },
  { "key": "collectionX", "type": "select", "label": "Collection (X Axis)", "source": "figma:collections" },
  { "key": "collectionY", "type": "select", "label": "Collection (Y Axis)", "source": "figma:collections", "showWhen": { "axes": "2 Axes" } }
]
*/

if (selection.length === 0) {
  figma.notify("Select something first", { error: true });
  return "No selection";
}

// Get collections
var localCollections = await figma.variables.getLocalVariableCollectionsAsync();

// Resolve selected collection(s) from params
var collectionXId = params.collectionX;
var collectionYId = params.collectionY;
var is2Axis = params.axes === "2 Axes" && collectionYId;

var collectionX = null;
for (var fi = 0; fi < localCollections.length; fi++) {
  if (localCollections[fi].id === collectionXId) { collectionX = localCollections[fi]; break; }
}
if (!collectionX) collectionX = localCollections[0];
if (!collectionX) {
  figma.notify("No variable collections found", { error: true });
  return "No collections";
}

var collectionY = null;
if (is2Axis) {
  for (var fi2 = 0; fi2 < localCollections.length; fi2++) {
    if (localCollections[fi2].id === collectionYId) { collectionY = localCollections[fi2]; break; }
  }
}

console.log("Collection X:", collectionX.name, "(" + collectionX.modes.length + " modes)");
if (collectionY) console.log("Collection Y:", collectionY.name, "(" + collectionY.modes.length + " modes)");

// Calculate selection bounds
var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (var si = 0; si < selection.length; si++) {
  var sn = selection[si];
  if ("x" in sn) {
    minX = Math.min(minX, sn.x);
    minY = Math.min(minY, sn.y);
    maxX = Math.max(maxX, sn.x + sn.width);
    maxY = Math.max(maxY, sn.y + sn.height);
  }
}
var bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
var gapX = bounds.width * 0.05;
var gapY = bounds.height * 0.05;

// Load font for labels
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });

// Start below existing content
var bottomY = 0;
for (var ci = 0; ci < figma.currentPage.children.length; ci++) {
  var cn = figma.currentPage.children[ci];
  if ("y" in cn && "height" in cn) {
    var cb = cn.y + cn.height;
    if (cb > bottomY) bottomY = cb;
  }
}
var labelHeight = 30;
var startY = bottomY + gapY + labelHeight;
var startX = bounds.x;
var allNodes = [];

function createLabel(text, x, y) {
  var label = figma.createFrame();
  label.layoutMode = "HORIZONTAL";
  label.primaryAxisSizingMode = "AUTO";
  label.counterAxisSizingMode = "AUTO";
  label.paddingLeft = 8; label.paddingRight = 8;
  label.paddingTop = 4; label.paddingBottom = 4;
  label.cornerRadius = 4;
  label.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
  label.strokes = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  label.strokeWeight = 1;
  var t = figma.createText();
  t.fontName = { family: "Inter", style: "Semi Bold" };
  t.fontSize = 12;
  t.characters = text;
  t.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  label.appendChild(t);
  label.x = x;
  label.y = y;
  return label;
}

if (is2Axis && collectionY) {
  // 2-AXIS MATRIX
  var modesX = collectionX.modes;
  var modesY = collectionY.modes;

  // Row labels (Y axis)
  for (var yi = 0; yi < modesY.length; yi++) {
    var rl = createLabel(modesY[yi].name, startX - 120, startY + (bounds.height + gapY) * yi + bounds.height / 2 - 12);
    allNodes.push(rl);
  }

  // Column labels (X axis)
  for (var xi = 0; xi < modesX.length; xi++) {
    var cl = createLabel(modesX[xi].name, startX + (bounds.width + gapX) * xi, startY - labelHeight - 4);
    allNodes.push(cl);
  }

  // Create grid
  for (var gy = 0; gy < modesY.length; gy++) {
    for (var gx = 0; gx < modesX.length; gx++) {
      var clones = [];
      for (var sci = 0; sci < selection.length; sci++) { clones.push(selection[sci].clone()); }
      for (var cli = 0; cli < clones.length; cli++) {
        var clone = clones[cli];
        if ("x" in clone) {
          clone.x += (startX + (bounds.width + gapX) * gx) - bounds.x;
          clone.y += (startY + (bounds.height + gapY) * gy) - bounds.y;
        }
        if ("setExplicitVariableModeForCollection" in clone) {
          try { clone.setExplicitVariableModeForCollection(collectionX.id, modesX[gx].modeId); } catch(e) {}
          try { clone.setExplicitVariableModeForCollection(collectionY.id, modesY[gy].modeId); } catch(e) {}
        }
      }
      for (var ai = 0; ai < clones.length; ai++) { allNodes.push(clones[ai]); }
    }
  }

  var total = modesX.length * modesY.length;
  var group = figma.group(allNodes, figma.currentPage);
  group.name = collectionX.name + " x " + collectionY.name + " - Mode Matrix";
  figma.currentPage.selection = [group];
  figma.viewport.scrollAndZoomIntoView([group]);
  figma.notify("Created " + modesX.length + "x" + modesY.length + " (" + total + ") grid");
  return total + " permutations created";

} else {
  // 1-AXIS MATRIX
  for (var i = 0; i < collectionX.modes.length; i++) {
    var mode = collectionX.modes[i];
    var x = startX + (bounds.width + gapX) * i;

    var label = createLabel(mode.name, x, startY - labelHeight - 4);
    allNodes.push(label);

    var clones2 = [];
    for (var sci2 = 0; sci2 < selection.length; sci2++) { clones2.push(selection[sci2].clone()); }
    for (var j = 0; j < clones2.length; j++) {
      var c2 = clones2[j];
      if ("x" in c2) {
        c2.x += x - bounds.x;
        c2.y += startY - bounds.y;
      }
      if ("setExplicitVariableModeForCollection" in c2) {
        try { c2.setExplicitVariableModeForCollection(collectionX.id, mode.modeId); } catch(e) {}
      }
    }
    for (var ai2 = 0; ai2 < clones2.length; ai2++) { allNodes.push(clones2[ai2]); }
    console.log("Created mode:", mode.name);
  }

  var group2 = figma.group(allNodes, figma.currentPage);
  group2.name = collectionX.name + " - Mode Matrix";
  figma.currentPage.selection = [group2];
  figma.viewport.scrollAndZoomIntoView([group2]);
  figma.notify("Created " + collectionX.modes.length + " permutations");
  return collectionX.modes.length + " modes created";
}
