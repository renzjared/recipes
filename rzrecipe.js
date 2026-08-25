/**
 * RZRecipe Import/Export System
 * Handles the .rzrecipe JSON schema and seamlessly pipes it into the app state.
 */

const RzRecipe = {
  
  // Package the active recipe detail view into a .rzrecipe file and download
  exportCurrent: function() {
    const recipe = app.currentRecipeData;
    if (!recipe) return;

    // Convert raw_ingredients strings back into clean JSON arrays for the file
    const cleanIngs = [];
    if (recipe.raw_ingredients) {
      recipe.raw_ingredients.split('\n').forEach(line => {
        const t = line.trim();
        if (!t) return;
        
        if (t.startsWith('[') && t.endsWith(']')) {
          cleanIngs.push({ type: 'divider', name: t.slice(1, -1) });
        } else if (t.startsWith('#RICH#')) {
          const parts = t.split(' | ');
          cleanIngs.push({
            type: 'ingredient',
            qty: parseFloat(parts[1]) || 1,
            unit: parts[2] || '-',
            name: parts[3] || '',
            desc: parts[4] || '',
            alts: JSON.parse(parts[5] || '[]')
          });
        } else {
          // Strict fallback for legacy raw text entries
          const match = t.match(/^([\d.\/]+)\s*([a-zA-Z]+)?\s+(.*)$/);
          if (match) {
             cleanIngs.push({ type: 'ingredient', qty: parseFloat(match[1]), unit: match[2]||'-', name: match[3].trim() });
          } else {
             cleanIngs.push({ type: 'ingredient', qty: 1, unit: '-', name: t });
          }
        }
      });
    }

    const exportData = {
      version: "1.0",
      name: recipe.name,
      secondary_name: recipe.secondary_name || "",
      category: recipe.category || "",
      image_url: recipe.image_url || "",
      servings: recipe.servings || 1,
      prep_time: recipe.prep_time || 0,
      cook_time: recipe.cook_time || 0,
      procedure: recipe.procedure || "",
      ingredients: cleanIngs
    };

    // Trigger Browser Download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", (recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || "recipe") + ".rzrecipe");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    app.showToast("Exported to .rzrecipe!");
  },

  // Parse a user-uploaded .rzrecipe file and send it to the Editor
  handleImport: function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const json = JSON.parse(e.target.result);

        // Reconstruct the #RICH# ingredient string format that the Editor parses
        let rawStr = "";
        if (json.ingredients && Array.isArray(json.ingredients)) {
          rawStr = json.ingredients.map(item => {
            if (item.type === 'divider') return `[${item.name}]`;
            const altsClean = JSON.stringify(item.alts || []);
            return `#RICH# | ${item.qty || 1} | ${item.unit || '-'} | ${item.name || ''} | ${item.desc || ''} | ${altsClean}`;
          }).join('\n');
        }

        const mockedRecipe = {
          id: '', // Blank ID forces the app to save this as a brand NEW recipe
          name: json.name || '',
          secondary_name: json.secondary_name || '',
          image_url: json.image_url || '',
          category: json.category || '',
          servings: json.servings || 1,
          prep_time: json.prep_time || 0,
          cook_time: json.cook_time || 0,
          procedure: json.procedure || '',
          raw_ingredients: rawStr
        };

        app.openEditor(mockedRecipe);
        app.showToast("Recipe imported! Review and click Save.");
      } catch (err) {
        app.customAlert("Import Error", "Failed to parse .rzrecipe file. Ensure it is a valid JSON schema.");
        console.error(err);
      }
      
      event.target.value = ""; // Reset file input so same file can be clicked again
    };
    reader.readAsText(file);
  }
};