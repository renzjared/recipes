/**
 * Guide & Documentation System
 * Dynamically renders Wikipedia-style sidebar navigation and documentation content.
 */

const GuideContent = [
  {
    id: "basics",
    title: "1. Basics & Introduction",
    html: `
      <h2>Welcome to Renz-Bot Recipes</h2>
      <p>This platform is designed to make recipe management, nutritional tracking, and grocery planning as friendly and automated as possible. By centralizing your ingredients into a smart database, the app automatically does the heavy lifting for you.</p>
      <ul>
        <li><strong>Browse & Discover:</strong> Search through a communal database of recipes.</li>
        <li><strong>Automate Math:</strong> Instantly calculate recipe costs, prep times, and dietary macros.</li>
        <li><strong>Smart Grocery Lists:</strong> Scale servings up or down, and generate deduplicated grocery lists with estimated prices.</li>
        <li><strong>Gamification:</strong> Earn XP, collect badges, and build a public portfolio by authoring recipes and leaving reviews.</li>
      </ul>
    `
  },
  {
    id: "home-browse",
    title: "2. Home & Browse",
    html: `
      <h2>Navigating the App</h2>
      <p>The <strong>Home Page</strong> features dynamic rows that adapt to the community's data. It automatically finds the cheapest eats, the fastest meals, and clusters recipes based on the most popular tags (e.g., Air-Fryer, Desserts).</p>
      
      <h3>The Browse Page & Advanced Filters</h3>
      <p>Click the <code>⚙️ Filters & Sort</code> button to open the advanced query panel. You can combine multiple filters simultaneously to find exactly what you need:</p>
      <ul>
        <li><strong>Ranges:</strong> Set minimum and maximum limits for <code>Rating</code>, <code>Cost per Serving</code>, and <code>Total Time</code>.</li>
        <li><strong>Sorting:</strong> Reorder the grid by Highest Rated, Lowest Cost, Fastest Time, or Alphabetical. (Alphabetical is used as an automatic tie-breaker).</li>
        <li><strong>Smart Search:</strong> The text bar doesn't just search the title—it actively scans the recipe's native/secondary names, the author's name, and the category tags.</li>
      </ul>

      <h3>🪄 What's in my Pantry?</h3>
      <p>This button opens the interactive ingredient toggle board. It utilizes a <strong>Strict Match</strong> algorithm:</p>
      <ul>
        <li>Select the ingredients you currently have in your physical kitchen.</li>
        <li>Click <strong>Show Matching Recipes</strong>.</li>
        <li>The grid will instantly hide any recipe where you are missing a required ingredient. (It considers valid substitutes as a pass!).</li>
        <li><em>Note: Your selections are saved to your browser's local storage automatically.</em></li>
      </ul>
    `
  },
  {
    id: "recipe-page",
    title: "3. The Recipe Page",
    html: `
      <h2>Viewing a Recipe</h2>
      <p>The Recipe Detail view is where the computational magic happens. Everything on this page is dynamic.</p>
      
      <h3>Dynamic Scaling & Components</h3>
      <ul>
        <li><strong>Servings Adjuster:</strong> Changing the serving size immediately multiplies the ingredient amounts, the total recipe cost, and the macros per serving.</li>
        <li><strong>Secondary Names:</strong> Displayed in italics beneath the main title, honoring the dish's native or alternative name.</li>
        <li><strong>Alternative Ingredients:</strong> Ingredients with available substitutes are marked with a blue <code>ALT</code> badge. Hovering over them reveals a tooltip with exact substitute measurements. You can also click <strong>View Alternatives</strong> to expand a table comparing the original to the substitutes.</li>
        <li><strong>Descriptors:</strong> Specific prep instructions (e.g., <em>cold</em>, <em>finely diced</em>) are shown in light italic text beside the ingredient name.</li>
      </ul>

      <h3>Account Features</h3>
      <p>If you are logged in, you can click <strong>⭐ Save</strong> to add the recipe to your personal Favorites catalog (viewable in your Profile). You can also leave a 1-to-5 star rating and a written review at the bottom of the page, which affects the recipe's global ranking.</p>
    `
  },
  {
    id: "pantry",
    title: "4. The Pantry (Ingredient Registry)",
    html: `
      <h2>The Engine of the App</h2>
      <p>The Pantry is not just a list—it is the foundation of all calculations. Before an ingredient can be used in a recipe, it must be registered here.</p>
      
      <h3>Logging an Ingredient</h3>
      <p>When you buy an item from the store, you log its <code>Store Amount</code>, <code>Unit</code>, and total <code>Store Cost</code>. You also input the Total Macros for that packaging.</p>
      
      <h3>How the Math Works</h3>
      <p>As you type, the app divides your inputs by the Store Amount. It permanently saves the <strong>Cost per Unit</strong> and the <strong>Macros per Unit</strong>. Because of this, when a recipe asks for "15g of Butter", the app knows exactly how much 15g costs and exactly how much protein, fat, and carbs it contains.</p>
    `
  },
  {
    id: "shopping-list",
    title: "5. Shopping List",
    html: `
      <h2>Smart Grocery Planning</h2>
      <p>When viewing a recipe, clicking <strong>🛒 Add to List</strong> parses the required ingredients (scaled to your current serving size) and pushes them to your list.</p>
      
      <ul>
        <li><strong>Auto-Deduplication:</strong> If you add two different recipes that both require "Garlic," the app will sum the quantities together into a single row.</li>
        <li><strong>Cost Estimation:</strong> Because the ingredients are linked to your Pantry registry, the list generates an exact <code>EST TOTAL</code> so you know your budget before reaching the checkout counter.</li>
        <li><strong>Actual Price Tracking:</strong> As you shop, input the physical price you paid to track your real-world spending.</li>
        <li><strong>Manual Entries:</strong> Use the Autocomplete bar at the top to add random household items. The unit will auto-lock if the item is recognized in your pantry.</li>
      </ul>
    `
  },
  {
    id: "format",
    title: "6. The .rzrecipe Format & Sandbox",
    html: `
      <h2>Importing & Exporting</h2>
      <p>Renz-Bot allows you to export any recipe into a custom <code>.rzrecipe</code> file. This is a strict JSON schema designed to safely package instructions, ingredient mappings, and substitutes. When you import a file, it loads directly into the Editor for your review.</p>

      <h3>Schema Documentation</h3>
      <table class="docs-table">
        <thead><tr><th>Attribute</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>version</code></td><td>String</td><td>Always <code>"1.0"</code>. Required.</td></tr>
          <tr><td><code>name</code></td><td>String</td><td>The primary name of the dish. Required.</td></tr>
          <tr><td><code>secondary_name</code></td><td>String</td><td>Alternative/native name. Optional.</td></tr>
          <tr><td><code>category</code></td><td>String</td><td>Comma-separated tags (e.g. <code>"Main, Beef"</code>).</td></tr>
          <tr><td><code>image_url</code></td><td>String</td><td>URL of the recipe photo. Optional.</td></tr>
          <tr><td><code>servings</code></td><td>Int / Float</td><td>Default serving size. Required.</td></tr>
          <tr><td><code>prep_time</code></td><td>Int</td><td>Prep time in minutes.</td></tr>
          <tr><td><code>cook_time</code></td><td>Int</td><td>Cook time in minutes.</td></tr>
          <tr><td><code>procedure</code></td><td>String</td><td>Instructions. Supports Markdown. Use <code>\\n\\n</code> for breaks.</td></tr>
          <tr><td><code>ingredients</code></td><td>Array</td><td>List of ingredient and divider objects. See below.</td></tr>
        </tbody>
      </table>

      <h3>The Ingredients Array</h3>
      <p>The array accepts two types of objects:</p>
      <ul>
        <li><strong>Divider:</strong> <code>{ "type": "divider", "name": "Marinade" }</code></li>
        <li><strong>Ingredient:</strong> <code>{ "type": "ingredient", "qty": 50, "unit": "mL", "name": "Soy Sauce", "desc": "Low sodium", "alts": [] }</code></li>
        <li><strong>Alternatives:</strong> Inside the <code>alts</code> array, provide objects like: <code>[{ "qty": 50, "unit": "mL", "name": "Tamari", "desc": "" }]</code></li>
      </ul>

      <h3>Live Interactive Sandbox</h3>
      <p>Edit the JSON in the dark editor below. If your schema is valid, the UI will instantly recompile and render the Recipe Preview on the right!</p>
      
      <div class="sandbox-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <label style="font-weight: 900; color: var(--text-dark);">.rzrecipe JSON Editor</label>
          <textarea id="sandboxEditor" spellcheck="false" oninput="GuideApp.updateSandbox()" style="width: 100%; height: 500px; background: #282a36; color: #f8f8f2; font-family: monospace; border: none; border-radius: 16px; padding: 20px; font-size: 0.9rem; line-height: 1.5; outline: 2px solid var(--border-color);"></textarea>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <label style="font-weight: 900; color: var(--text-dark);">Live App Preview</label>
          <div id="sandboxPreview" style="background: var(--bg-white); border: 2px solid var(--border-color); border-radius: 16px; box-shadow: 0 8px 0 0 var(--border-color); padding: 20px; height: 500px; overflow-y: auto;">
          </div>
        </div>
      </div>
    `
  }
];

const GuideApp = {
  
  defaultJSON: `{
  "version": "1.0",
  "name": "Barista Blend Cold Brew",
  "secondary_name": "Kape",
  "category": "Beverage, Coffee, Quick",
  "image_url": "https://placehold.co/600x400/eeeeee/999999?text=Coffee",
  "servings": 2,
  "prep_time": 5,
  "cook_time": 0,
  "procedure": "## Step 1\\nMix coffee and water.\\n\\n## Step 2\\nSteep in fridge.",
  "ingredients": [
    { "type": "divider", "name": "The Brew" },
    { "type": "ingredient", "qty": 100, "unit": "g", "name": "Barista Blend Coffee Beans", "desc": "Coarse grind", "alts": [] },
    { "type": "ingredient", "qty": 1, "unit": "L", "name": "Water", "desc": "Cold", "alts": [
       { "qty": 1, "unit": "L", "name": "Milk", "desc": "For a creamier brew" }
    ] }
  ]
}`,

  init: function() {
    this.renderSidebar();
    // Default load the first section
    this.loadSection(GuideContent[0].id);
  },

  renderSidebar: function() {
    const sidebar = document.getElementById('guideSidebar');
    if (!sidebar) return;

    sidebar.innerHTML = GuideContent.map((section, index) => {
      const isActive = index === 0 ? 'active' : '';
      return `<button class="guide-nav-btn ${isActive}" data-target="${section.id}" onclick="GuideApp.handleNavClick(this, '${section.id}')">${section.title}</button>`;
    }).join('');
  },

  handleNavClick: function(btnElement, sectionId) {
    document.querySelectorAll('.guide-nav-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    this.loadSection(sectionId);
  },

  loadSection: function(sectionId) {
    const contentArea = document.getElementById('guideContent');
    const sectionData = GuideContent.find(s => s.id === sectionId);
    
    if (contentArea && sectionData) {
      contentArea.innerHTML = sectionData.html;
      
      // If we loaded the format page, initialize the Sandbox
      if (sectionId === 'format') {
        const editor = document.getElementById('sandboxEditor');
        if (editor) {
          editor.value = this.defaultJSON;
          this.updateSandbox();
        }
      }
    }
  },

  updateSandbox: function() {
    const editor = document.getElementById('sandboxEditor');
    const preview = document.getElementById('sandboxPreview');
    if (!editor || !preview) return;

    try {
      const json = JSON.parse(editor.value);
      
      const prep = parseInt(json.prep_time) || 0;
      const cook = parseInt(json.cook_time) || 0;
      const totalTime = prep + cook;
      const img = json.image_url || 'https://placehold.co/600x400/eeeeee/999999?text=No+Image';

      let ingsHtml = (json.ingredients || []).map(ing => {
        if(ing.type === 'divider') {
          return `<div style="color: var(--pop-orange); font-weight: 900; margin-top: 15px; margin-bottom: 5px; border-bottom: 2px solid var(--border-color);">${ing.name}</div>`;
        }
        
        let desc = ing.desc ? ` <span style="font-weight: normal; font-style: italic; color: #9ca3af; font-size: 0.9rem;">(${ing.desc})</span>` : '';
        let altsBadge = (ing.alts && ing.alts.length > 0) ? ` <span style="font-size: 0.7rem; background: var(--cyan-light); color: var(--accent-cyan); padding: 2px 6px; border-radius: 8px; font-weight: 900; vertical-align: middle;">ALT</span>` : '';
        
        let altsDisplay = '';
        if (ing.alts && ing.alts.length > 0) {
           altsDisplay = `<ul style="list-style: none; padding-left: 20px; margin-top: 5px; border-left: 2px solid var(--border-color);">` + 
             ing.alts.map(a => `<li style="font-size: 0.85rem; color: var(--text-gray);"><span style="color: #d97706; font-weight: 800;">OR</span> ${a.qty} ${a.unit} ${a.name} ${a.desc ? `<i>(${a.desc})</i>` : ''}</li>`).join('') + 
           `</ul>`;
        }

        return `
          <div style="padding: 8px 0; border-bottom: 1px dashed var(--border-color);">
            <div style="display: flex; gap: 10px;">
              <span style="color: var(--accent-cyan); font-weight: 900;">${ing.qty} ${ing.unit}</span>
              <span style="font-weight: 700; color: var(--text-dark);">${ing.name}${desc}${altsBadge}</span>
            </div>
            ${altsDisplay}
          </div>
        `;
      }).join('');

      const safeProcedure = (json.procedure || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/## (.*?)\n/g, '<h3 style="color: var(--pop-orange); margin: 15px 0 5px 0;">$1</h3>')
        .replace(/\n\n/g, '<br><br>');

      preview.innerHTML = `
        <div style="width: 100%; border-radius: 16px; overflow: hidden;">
           <img src="${img}" style="width: 100%; height: 150px; object-fit: cover;">
           <div style="padding: 15px;">
             <h2 style="color: var(--text-dark); margin-bottom: 5px;">${json.name || 'Unnamed Recipe'}</h2>
             ${json.secondary_name ? `<h3 style="color: var(--text-gray); font-style: italic; font-size: 1.1rem; margin-bottom: 15px;">${json.secondary_name}</h3>` : ''}
             
             <div style="display: flex; gap: 10px; font-size: 0.85rem; margin-bottom: 15px; font-weight: 800;">
               <span style="background: var(--bg-light); padding: 4px 8px; border-radius: 8px;">🕒 ${totalTime} MIN</span>
               <span style="background: var(--bg-light); padding: 4px 8px; border-radius: 8px;">🍽️ ${json.servings} Servings</span>
             </div>
             
             <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-gray); margin-bottom: 20px;">
               ${(json.category || '').split(',').map(t => `<span style="background: var(--text-dark); color: white; padding: 2px 6px; border-radius: 4px; margin-right: 5px;">${t.trim()}</span>`).join('')}
             </div>
             
             <h3 style="border-bottom: 2px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px;">Ingredients</h3>
             ${ingsHtml}
             
             <h3 style="border-bottom: 2px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px; margin-top: 20px;">Procedure</h3>
             <div style="font-size: 0.9rem; line-height: 1.5; color: var(--text-gray); font-weight: 600;">${safeProcedure}</div>
           </div>
        </div>
      `;
    } catch (e) {
      preview.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: red; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 15px;">⚠️</div>
          <h3 style="font-weight: 900;">Invalid JSON Format</h3>
          <p style="font-size: 0.9rem; font-weight: 600; margin-top: 10px;">${e.message}</p>
        </div>
      `;
    }
  }
};