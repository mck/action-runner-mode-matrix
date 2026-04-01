// @action.title: Clean File Token Data
// @action.description: Remove all Tokens Studio plugin data from the file root
// @action.category: migration
// @action.version: 1.0.0

/* @action.params
[
  { "key": "dryRun", "type": "boolean", "label": "Dry run (preview only)", "default": true }
]
*/

var dryRun = params.dryRun !== false;
var root = figma.root;

// Get all plugin data keys on the document root
var pluginDataKeys = root.getPluginDataKeys();
var sharedKeys = root.getSharedPluginDataKeys("tokens");

console.log("=== File-level Token Data ===");
console.log("Plugin data keys:", pluginDataKeys.length);
console.log("Shared 'tokens' namespace keys:", sharedKeys.length);

var removed = 0;

// List and remove plugin data (private to this plugin)
for (var i = 0; i < pluginDataKeys.length; i++) {
  var key = pluginDataKeys[i];
  var value = root.getPluginData(key);
  var preview = value.length > 80 ? value.substring(0, 80) + "..." : value;
  console.log("  pluginData[" + key + "] = " + preview);
  if (!dryRun) {
    root.setPluginData(key, "");
    removed++;
  }
}

// List and remove shared plugin data in "tokens" namespace
for (var j = 0; j < sharedKeys.length; j++) {
  var skey = sharedKeys[j];
  var svalue = root.getSharedPluginData("tokens", skey);
  var spreview = svalue.length > 80 ? svalue.substring(0, 80) + "..." : svalue;
  console.log("  shared:tokens[" + skey + "] = " + spreview);
  if (!dryRun) {
    root.setSharedPluginData("tokens", skey, "");
    removed++;
  }
}

var total = pluginDataKeys.length + sharedKeys.length;

if (dryRun) {
  figma.notify("Dry run: found " + total + " keys. Uncheck 'Dry run' to remove.");
  return { mode: "dry-run", pluginDataKeys: pluginDataKeys.length, sharedTokenKeys: sharedKeys.length };
} else {
  figma.notify("Removed " + removed + " token data keys from file");
  return { mode: "removed", removed: removed };
}
