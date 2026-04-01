// @action.title: Clean Node Token Data
// @action.description: Remove token assignments from all elements (selection, page, or document)
// @action.category: migration
// @action.version: 1.0.0

/* @action.params
[
  { "key": "scope", "type": "select", "label": "Scope", "options": ["Selection", "Current Page", "Entire Document"], "default": "Current Page" },
  { "key": "dryRun", "type": "boolean", "label": "Dry run (preview only)", "default": true }
]
*/

var dryRun = params.dryRun !== false;
var scope = params.scope || "Current Page";

// Get target nodes
var roots = [];
if (scope === "Selection") {
  if (selection.length === 0) {
    figma.notify("No selection", { error: true });
    return "No selection";
  }
  for (var si = 0; si < selection.length; si++) roots.push(selection[si]);
} else if (scope === "Current Page") {
  for (var pi = 0; pi < currentPage.children.length; pi++) roots.push(currentPage.children[pi]);
} else {
  for (var di = 0; di < figma.root.children.length; di++) {
    var page = figma.root.children[di];
    if (page.type === "PAGE") {
      for (var ci = 0; ci < page.children.length; ci++) roots.push(page.children[ci]);
    }
  }
}

var nodesChecked = 0;
var nodesCleaned = 0;
var keysRemoved = 0;

function cleanNode(node) {
  nodesChecked++;

  // Check for shared plugin data in "tokens" namespace
  var keys = node.getSharedPluginDataKeys("tokens");
  if (keys.length > 0) {
    nodesCleaned++;
    var nodePath = getNodePath(node);
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var value = node.getSharedPluginData("tokens", key);
      var preview = value.length > 60 ? value.substring(0, 60) + "..." : value;
      console.log(nodePath + " [" + key + "] = " + preview);
      if (!dryRun) {
        node.setSharedPluginData("tokens", key, "");
      }
      keysRemoved++;
    }
  }

  // Recurse into children
  if ("children" in node) {
    for (var ci = 0; ci < node.children.length; ci++) {
      cleanNode(node.children[ci]);
    }
  }
}

function getNodePath(node) {
  var parts = [];
  var current = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(" / ") || node.name;
}

// Process all root nodes
for (var ri = 0; ri < roots.length; ri++) {
  cleanNode(roots[ri]);
}

console.log("---");
console.log("Scope:", scope);
console.log("Nodes checked:", nodesChecked);
console.log("Nodes with token data:", nodesCleaned);
console.log("Token keys " + (dryRun ? "found" : "removed") + ":", keysRemoved);

if (dryRun) {
  figma.notify("Dry run: " + keysRemoved + " token keys on " + nodesCleaned + " nodes. Uncheck 'Dry run' to remove.");
} else {
  figma.notify("Removed " + keysRemoved + " token keys from " + nodesCleaned + " nodes");
}

return {
  mode: dryRun ? "dry-run" : "removed",
  scope: scope,
  nodesChecked: nodesChecked,
  nodesCleaned: nodesCleaned,
  keysRemoved: keysRemoved
};
