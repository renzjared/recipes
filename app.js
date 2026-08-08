const SUPABASE_URL = 'https://gjgfxiiwrliczxprzjsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZ2Z4aWl3cmxpY3p4cHJ6anNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQwMDQsImV4cCI6MjA5NTM2MDAwNH0.klalMuCkIdGqfEqXqtqrwFPicxzZUWu5mF1ttmXSFwk';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
  currentUser: null,
  recipes: [],
  ingredientsRegistry: [], 
  shoppingList: [], 
  pantrySelection: [], 
  tempPantrySelection: [],
  currentCategory: 'All',
  currentSearch: '',
  
  sortColumn: null, 
  sortDesc: false, 

  currentOpenRecipeId: null,
  currentRecipeData: null, 
  
  editIngredientsList: [],
  galleryInterval: null,

  init: async function() {
    if (window.location.hash && window.location.hash.includes('access_token')) {
       window.history.replaceState(null, null, window.location.pathname);
    }

    const { data: { session } } = await client.auth.getSession();
    this.updateUserUI(session?.user || null);

    client.auth.onAuthStateChange((_event, session) => {
      this.updateUserUI(session?.user || null);
    });

    this.shoppingList = JSON.parse(localStorage.getItem('renz_shopping_list')) || [];
    this.pantrySelection = JSON.parse(localStorage.getItem('renz_pantry_selection')) || []; 

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
      }
    });

    const procedureArea = document.getElementById('editProcedure');
    if (procedureArea) {
      procedureArea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          let handled = false;
          if (e.code === 'KeyB') { this.insertMarkdown('**', '**'); handled = true; }
          if (e.code === 'KeyI') { this.insertMarkdown('*', '*'); handled = true; }
          if (e.code === 'KeyU') { this.insertMarkdown('__', '__'); handled = true; }
          if (handled) {
            e.preventDefault();
            this.updatePreview();
          }
        }
      });
    }

    await this.fetchIngredientsRegistry();
    await this.fetchRecipes();

    const urlParams = new URLSearchParams(window.location.search);
    const sharedRecipe = urlParams.get('r') || urlParams.get('recipe');
    
    if (sharedRecipe) {
      this.loadSharedRecipe(sharedRecipe);
    } else {
      this.showView('view-home');
    }
  },

  playSound: function(type) {
    let audioId = 'sfx-pop';
    if (type === 'success') audioId = 'sfx-success';
    if (type === 'star') audioId = 'sfx-star';
    
    const audio = document.getElementById(audioId);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Audio play blocked by browser: ", e));
    }
  },

  showToast: function(msg) {
    this.playSound('pop');
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div class="toast-icon">✓</div> <div>${msg}</div>`;
    container.appendChild(toast);
    
    void toast.offsetWidth;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  customAlert: function(title, message) {
    this.playSound('pop');
    document.getElementById('customModalTitle').textContent = title;
    document.getElementById('customModalMessage').textContent = message;
    document.getElementById('customModalActions').innerHTML = `<button class="btn-primary" onclick="document.getElementById('customModalOverlay').classList.add('hidden')">Got it!</button>`;
    document.getElementById('customModalOverlay').classList.remove('hidden');
  },

  customConfirm: function(title, message, onConfirm) {
    this.playSound('pop');
    document.getElementById('customModalTitle').textContent = title;
    document.getElementById('customModalMessage').textContent = message;
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-danger';
    confirmBtn.textContent = 'Yes, do it';
    confirmBtn.onclick = () => {
      document.getElementById('customModalOverlay').classList.add('hidden');
      onConfirm();
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => document.getElementById('customModalOverlay').classList.add('hidden');
    
    const actions = document.getElementById('customModalActions');
    actions.innerHTML = '';
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    
    document.getElementById('customModalOverlay').classList.remove('hidden');
  },

  selectDropdown: function(id, value, displayLabel) {
    document.getElementById(id).value = value;
    document.getElementById(id + 'Display').textContent = displayLabel || value;
    
    if(id === 'ingUnit') {
       this.calcMacrosUI(); 
    }
  },

  filterAutocomplete: function(input, type) {
    const val = input.value.toLowerCase().trim();
    const dropdown = input.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('autocomplete-dropdown')) return;

    let sourceData = [];
    if (type === 'ingredient') {
       sourceData = [...new Set(this.ingredientsRegistry.map(i => i.name))];
    } else if (type === 'category') {
       const allTags = new Set();
       this.recipes.forEach(r => {
         if(r.category) r.category.split(',').forEach(t => allTags.add(t.trim()));
       });
       sourceData = [...allTags];
    }

    let matches = sourceData;
    if (val) {
      matches = matches.filter(name => name.toLowerCase().includes(val));
    }

    matches = matches.slice(0, 15);

    if (matches.length > 0) {
      dropdown.innerHTML = matches.map(m => `<div class="autocomplete-item" onmousedown="app.selectAutocomplete(event, this, '${m.replace(/'/g, "\\'")}')">${m}</div>`).join('');
      dropdown.classList.add('show');
    } else {
      dropdown.classList.remove('show');
    }
  },
  
  closeAutocomplete: function(input) {
     const dropdown = input.nextElementSibling;
     if (dropdown) {
         setTimeout(() => dropdown.classList.remove('show'), 150); 
     }
  },
  
  selectAutocomplete: function(e, itemElem, name) {
     e.preventDefault(); 
     const input = itemElem.parentElement.previousElementSibling;
     input.value = name;
     
     const evt1 = new Event('input', { bubbles: true });
     input.dispatchEvent(evt1);
     const evt2 = new Event('change', { bubbles: true });
     input.dispatchEvent(evt2);
     
     itemElem.parentElement.classList.remove('show');
  },

  updateUserUI: function(user) {
    this.currentUser = user;
    this.fetchShoppingList();
    const profileDiv = document.getElementById('userProfile');
    const loginBtn = document.getElementById('loginBtn');

    if (user) {
      profileDiv.style.display = 'flex';
      loginBtn.style.display = 'none';
      document.getElementById('userName').textContent = user.user_metadata.full_name || 'Chef';
      document.getElementById('userAvatar').src = user.user_metadata.avatar_url || 'https://via.placeholder.com/35';
    } else {
      profileDiv.style.display = 'none';
      loginBtn.style.display = 'block';
    }
  },

  loginWithDiscord: async function() {
    const dynamicRedirectUrl = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: dynamicRedirectUrl }
    });
    if (error) this.customAlert("Login Failed", error.message);
  },

  logout: async function() {
    await client.auth.signOut();
    this.showView('view-home');
  },

  showView: function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if(viewId === 'view-home') document.getElementById('nav-home')?.classList.add('active');
    if(viewId === 'view-dashboard') document.getElementById('nav-browse')?.classList.add('active');
    if(viewId === 'view-ingredients') document.getElementById('nav-pantry')?.classList.add('active');
    if(viewId === 'view-shopping') document.getElementById('nav-cart')?.classList.add('active');

    if (viewId === 'view-home') this.renderHome();
    if (viewId === 'view-dashboard') {
      this.tempPantrySelection = [...this.pantrySelection];
      this.renderPantryFilter();
      this.renderDashboard();
    }
    if (viewId === 'view-ingredients') this.loadIngredientsView();
    if (viewId === 'view-shopping') {
      this.fetchShoppingList();
      this.renderShoppingList();
    }
  },

  loadSharedRecipe: async function(code) {
    document.getElementById('detailTitle').textContent = "Loading...";
    this.showView('view-detail');
    const { data, error } = await client.from('recipes').select('id').eq('short_code', code).maybeSingle();
    if (data && data.id) {
      this.openDetail(data.id);
    } else {
      this.openDetail(code);
    }
  },

  fetchIngredientsRegistry: async function() {
    const { data, error } = await client.from('ingredients').select('*').order('name');
    if (!error && data) {
      this.ingredientsRegistry = data;
    }
  },

  getCategoryIcon: function(category) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('meat') || cat.includes('pork') || cat.includes('beef') || cat.includes('poultry')) return '🥩';
    if (cat.includes('veg')) return '🥬';
    if (cat.includes('fruit')) return '🍎';
    if (cat.includes('dairy') || cat.includes('cheese')) return '🧀';
    if (cat.includes('spice') || cat.includes('season')) return '🧂';
    if (cat.includes('bake') || cat.includes('baking')) return '🧁';
    if (cat.includes('liquid') || cat.includes('sauce') || cat.includes('oil')) return '💧';
    if (cat.includes('carb') || cat.includes('rice') || cat.includes('pasta')) return '🌾';
    if (cat.includes('sea') || cat.includes('fish')) return '🐟';
    return '🛒'; 
  },

  sortTable: function(columnName) {
    if (this.sortColumn === columnName) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortColumn = columnName;
      this.sortDesc = false;
    }
    this.loadIngredientsView();
  },

  loadIngredientsView: async function() {
    await this.fetchIngredientsRegistry();
    const tbody = document.getElementById('ingredientsTableBody');
    tbody.innerHTML = '';

    let sortedData = [...this.ingredientsRegistry];

    if (this.sortColumn) {
      sortedData.sort((a, b) => {
        let valA = a[this.sortColumn] || '';
        let valB = b[this.sortColumn] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return this.sortDesc ? 1 : -1;
        if (valA > valB) return this.sortDesc ? -1 : 1;
        return 0;
      });
    } else {
      sortedData.sort((a, b) => {
        const nameCmp = (a.name || '').localeCompare(b.name || '');
        if (nameCmp !== 0) return nameCmp;
        const catCmp = (a.category || '').localeCompare(b.category || '');
        if (catCmp !== 0) return catCmp;
        return (a.subcategory || '').localeCompare(b.subcategory || '');
      });
    }

    ['name', 'category', 'cost_per_unit'].forEach(col => {
      const iconSpan = document.getElementById(`sortIcon-${col}`);
      if (iconSpan) iconSpan.textContent = this.sortColumn === col ? (this.sortDesc ? '▼' : '▲') : '';
    });

    sortedData.forEach(ing => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = "2px solid #f1f5f9";
      tr.style.transition = "background-color 0.2s";
      tr.onmouseover = () => tr.style.backgroundColor = "#f8fafc";
      tr.onmouseout = () => tr.style.backgroundColor = "transparent";

      const catIcon = this.getCategoryIcon(ing.category);

      tr.innerHTML = `
        <td style="padding: 15px; font-size: 1.5rem; text-align: center;" title="${ing.category || 'Uncategorized'}">${catIcon}</td>
        <td style="padding: 15px;">
          <div style="font-weight: 800; color: var(--text-dark); font-size: 1.05rem;">${ing.name}</div>
          <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600; margin-top: 4px;">${ing.notes || 'No notes'}</div>
        </td>
        <td style="padding: 15px;">
          <div style="font-weight: 800; color: var(--text-gray); font-size: 0.95rem;">${(ing.category || '---')}</div>
          <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-top: 2px;">${(ing.subcategory || '')}</div>
        </td>
        <td style="padding: 15px; font-weight: 800; color: var(--accent-cyan); font-size: 1.05rem;">${ing.unit}</td>
        <td style="padding: 15px; font-weight: 900; font-size: 1.1rem; color: var(--pop-orange);">₱${parseFloat(ing.cost_per_unit||0).toFixed(2)}</td>
        <td style="padding: 15px; font-size: 0.9rem; font-weight: 700; color: #64748b; white-space: nowrap;">
          <span title="Calories" style="color: var(--hint-purple);">🔥 ${parseFloat(ing.calories_per_unit||0).toFixed(1)}</span> &nbsp;
          <span title="Carbohydrates" style="color: #d97706;">🌾 ${parseFloat(ing.carbs_per_unit||0).toFixed(1)}g</span> &nbsp;
          <span title="Protein" style="color: #dc2626;">🥩 ${parseFloat(ing.protein_per_unit||0).toFixed(1)}g</span> &nbsp;
          <span title="Fat" style="color: #f59e0b;">🧈 ${parseFloat(ing.fat_per_unit||0).toFixed(1)}g</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  calcMacrosUI: function() {
    const amount = parseFloat(document.getElementById('ingAmount').value) || 0;
    const unit = document.getElementById('ingUnit').value || 'unit';
    const cal = parseFloat(document.getElementById('ingCal').value) || 0;
    const carb = parseFloat(document.getElementById('ingCarb').value) || 0;
    const pro = parseFloat(document.getElementById('ingPro').value) || 0;
    const fat = parseFloat(document.getElementById('ingFat').value) || 0;

    const formatVal = (val) => amount > 0 ? (val / amount).toFixed(2) : 0;

    document.getElementById('ingCalSub').textContent = `${formatVal(cal)} per ${unit}`;
    document.getElementById('ingCarbSub').textContent = `${formatVal(carb)}g per ${unit}`;
    document.getElementById('ingProSub').textContent = `${formatVal(pro)}g per ${unit}`;
    document.getElementById('ingFatSub').textContent = `${formatVal(fat)}g per ${unit}`;
  },

  saveIngredient: async function() {
    const name = document.getElementById('ingName').value.trim();
    const amount = parseFloat(document.getElementById('ingAmount').value);
    const unit = document.getElementById('ingUnit').value.trim();
    const cost = parseFloat(document.getElementById('ingCost').value);
    
    const category = document.getElementById('ingCategory').value.trim();
    const subcategory = document.getElementById('ingSubcategory').value.trim();
    const notes = document.getElementById('ingNotes').value.trim();

    const cal = parseFloat(document.getElementById('ingCal').value) || 0;
    const carb = parseFloat(document.getElementById('ingCarb').value) || 0;
    const pro = parseFloat(document.getElementById('ingPro').value) || 0;
    const fat = parseFloat(document.getElementById('ingFat').value) || 0;

    if (!name || !amount || !unit || isNaN(cost)) {
      return this.customAlert("Missing Info", "Please fill out Name, Amount, Unit, and Cost.");
    }

    const costPerUnit = cost / amount;

    const newIng = {
      name: name,
      unit: unit,
      cost_per_unit: costPerUnit,
      category: category,
      subcategory: subcategory,
      notes: notes,
      calories_per_unit: cal / amount,
      carbs_per_unit: carb / amount,
      protein_per_unit: pro / amount,
      fat_per_unit: fat / amount
    };

    const { error } = await client.from('ingredients').insert(newIng);

    if (error) {
      this.customAlert("Error", "Failed to save ingredient: " + error.message);
    } else {
      document.getElementById('ingName').value = '';
      document.getElementById('ingAmount').value = '';
      this.selectDropdown('ingUnit', 'g', 'g');
      document.getElementById('ingCost').value = '';
      document.getElementById('ingCategory').value = '';
      document.getElementById('ingSubcategory').value = '';
      document.getElementById('ingNotes').value = '';
      
      document.getElementById('ingCal').value = '';
      document.getElementById('ingCarb').value = '';
      document.getElementById('ingPro').value = '';
      document.getElementById('ingFat').value = '';
      this.calcMacrosUI();

      this.loadIngredientsView();
      this.showToast("Ingredient Added to Database");
    }
  },

  fetchRecipes: async function() {
    const { data, error } = await client.from('recipes').select(`
      *,
      recipe_ingredients ( qty, ingredients ( cost_per_unit, name ) )
    `).order('name');
    
    if (!error) this.recipes = data;
  },

  createRecipeCardHTML: function(recipe) {
    const isOwner = this.currentUser && recipe.author_id === this.currentUser.id;
    const ownerBadge = isOwner ? `<div style="position:absolute; top:15px; right:15px; background:var(--accent-cyan); color:white; font-size:0.8rem; font-weight:800; padding:6px 12px; border-radius:12px; box-shadow: 0 2px 0 0 #008b92;">Yours</div>` : '';

    const rawImg = (recipe.image_url || '').trim().toLowerCase();
    const isValidImg = rawImg.length > 5 && rawImg.startsWith('http');
    const bgImage = isValidImg ? recipe.image_url.trim() : 'https://placehold.co/600x400/eeeeee/999999?text=No+Image';
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    
    let baseCost = 0;
    if (recipe.recipe_ingredients) {
      recipe.recipe_ingredients.forEach(mapping => {
        if (mapping.ingredients) baseCost += (mapping.qty * parseFloat(mapping.ingredients.cost_per_unit || 0));
      });
    }
    const costPerServing = (baseCost / (recipe.servings || 1)).toFixed(2);
    const tagsDisplay = (recipe.category || 'Uncategorized').split(',').map(t => t.trim()).join(' • ');

    return `
      <div class="recipe-card" onclick="app.openDetail('${recipe.id}')">
        <div class="card-img" style="position:relative; background-image: url('${bgImage}'); background-size: cover; background-position: center;">
          ${ownerBadge}
        </div>
        <div class="card-content">
          <h3 class="card-title" style="margin-bottom: 5px;">${recipe.name}</h3>
          <div style="font-size: 0.85rem; color: var(--text-gray); font-weight: 700; margin-bottom: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${tagsDisplay}
          </div>
          <div class="card-meta">
            <span>🕒 ${totalTime} MIN</span>
            <span style="color: var(--text-dark); font-weight: 900; font-size: 1.1rem;">₱${costPerServing}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderHome: function() {
    if (!this.recipes || this.recipes.length === 0) return;

    const galleryRecipes = [...this.recipes].sort(() => 0.5 - Math.random()).slice(0, 5);

    const gallery = document.getElementById('homeGallery');
    if (gallery) {
      gallery.innerHTML = galleryRecipes.map(r => {
        const rawImg = (r.image_url || '').trim().toLowerCase();
        const isValidImg = rawImg.length > 5 && rawImg.startsWith('http');
        const bgImage = isValidImg ? r.image_url.trim() : 'https://placehold.co/600x400/eeeeee/999999?text=No+Image';
        return `
          <div class="gallery-card" style="background-image: url('${bgImage}')" onclick="app.openDetail('${r.id}')">
            <div class="gallery-card-overlay">
              <h3 style="font-weight: 900;">${r.name}</h3>
            </div>
          </div>
        `;
      }).join('');

      if (this.galleryInterval) clearInterval(this.galleryInterval);
      this.galleryInterval = setInterval(() => {
        if (gallery) {
          gallery.scrollBy({ left: 370, behavior: 'smooth' });
          if (gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 10) {
            gallery.scrollTo({ left: 0, behavior: 'smooth' });
          }
        }
      }, 3500);
    }

    const container = document.getElementById('dynamicHomeCategories');
    if (!container) return;
    container.innerHTML = ''; 

    const getCost = (r) => {
      let baseCost = 0;
      if (r.recipe_ingredients) {
        r.recipe_ingredients.forEach(m => {
          if (m.ingredients) baseCost += (m.qty * parseFloat(m.ingredients.cost_per_unit || 0));
        });
      }
      return baseCost / (parseFloat(r.servings) || 1);
    };
    const getTime = (r) => (Number(r.prep_time) || 0) + (Number(r.cook_time) || 0);

    const renderSection = (title, icon, recipesToRender) => {
      if (recipesToRender.length === 0) return;
      container.innerHTML += `
        <div style="margin-bottom: 70px;">
          <h2 class="dynamic-section-title"><span>${icon}</span> ${title}</h2>
          <div class="recipe-grid">
            ${recipesToRender.map(r => this.createRecipeCardHTML(r)).join('')}
          </div>
        </div>
      `;
    };

    let cheapRecipes = [...this.recipes].filter(r => getCost(r) > 0).sort((a, b) => getCost(a) - getCost(b)).slice(0, 3);
    renderSection('Cheap Eats', '💸', cheapRecipes);

    let quickRecipes = [...this.recipes].filter(r => getTime(r) > 0).sort((a, b) => getTime(a) - getTime(b)).slice(0, 3);
    renderSection('Quick Bites', '⚡', quickRecipes);

    let airfryerRecipes = this.recipes.filter(r => (r.category || '').toLowerCase().includes('air-fryer') || (r.category || '').toLowerCase().includes('airfryer')).slice(0, 3);
    renderSection('Air-Fryer Goodness', '💨', airfryerRecipes);

    const categoryCounts = {};
    this.recipes.forEach(r => {
      const tags = (r.category || '').split(',').map(t => t.trim()).filter(t => t);
      tags.forEach(t => {
        const lowerT = t.toLowerCase();
        if(lowerT !== 'air-fryer' && lowerT !== 'airfryer' && lowerT !== 'main') {
          categoryCounts[t] = (categoryCounts[t] || 0) + 1;
        }
      });
    });

    const sortedTags = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]).slice(0, 2);
    sortedTags.forEach(tag => {
      const tagRecipes = this.recipes.filter(r => (r.category || '').toLowerCase().includes(tag.toLowerCase())).slice(0, 3);
      const icons = ['🔥', '✨', '😋', '🌟', '👨‍🍳', '🍲', '❤️'];
      const randIcon = icons[Math.floor(Math.random() * icons.length)];
      renderSection(`Top Rated: ${tag}`, randIcon, tagRecipes);
    });
  },

  renderPantryFilter: function() {
    const container = document.getElementById('pantryFilterList');
    if (!container) return;
    
    const grouped = {};
    this.ingredientsRegistry.forEach(ing => {
      const cat = ing.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ing.name);
    });

    let html = '';
    for (const [cat, items] of Object.entries(grouped)) {
      items.sort((a,b) => a.localeCompare(b));
      html += `
        <div style="background: var(--bg-light); border: 2px solid var(--border-color); border-radius: 20px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <h4 style="font-size: 1.2rem; color: var(--text-dark); text-transform: uppercase;">${cat}</h4>
            <div style="display: flex; gap: 8px;">
              <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.75rem; box-shadow: none;" onclick="app.pantrySelectAllCat('${cat.replace(/'/g, "\\'")}')">Select All</button>
              <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.75rem; box-shadow: none;" onclick="app.pantryClearCat('${cat.replace(/'/g, "\\'")}')">Clear</button>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${items.map(name => {
              const isActive = this.tempPantrySelection.includes(name) ? 'active' : '';
              return `<button class="filter-btn ${isActive}" style="font-size: 0.9rem; padding: 10px 18px; border-radius: 16px;" onclick="app.togglePantryItem('${name.replace(/'/g, "\\'")}')">${name}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  togglePantryItem: function(ingName) {
    const index = this.tempPantrySelection.indexOf(ingName);
    if (index > -1) {
      this.tempPantrySelection.splice(index, 1);
    } else {
      this.tempPantrySelection.push(ingName);
    }
    this.renderPantryFilter();
  },

  pantrySelectAllCat: function(catName) {
    this.ingredientsRegistry.forEach(ing => {
      if ((ing.category || 'Other') === catName && !this.tempPantrySelection.includes(ing.name)) {
        this.tempPantrySelection.push(ing.name);
      }
    });
    this.renderPantryFilter();
  },

  pantryClearCat: function(catName) {
    const namesToClear = this.ingredientsRegistry.filter(ing => (ing.category || 'Other') === catName).map(i => i.name);
    this.tempPantrySelection = this.tempPantrySelection.filter(name => !namesToClear.includes(name));
    this.renderPantryFilter();
  },

  pantrySelectAllGlobal: function() {
    this.tempPantrySelection = this.ingredientsRegistry.map(i => i.name);
    this.renderPantryFilter();
  },

  pantryClearGlobal: function() {
    this.tempPantrySelection = [];
    this.renderPantryFilter();
  },

  applyPantryFilter: function() {
    this.pantrySelection = [...this.tempPantrySelection];
    localStorage.setItem('renz_pantry_selection', JSON.stringify(this.pantrySelection));
    document.getElementById('pantryFilterSection').classList.add('hidden');
    this.playSound('success');
    this.showToast("Pantry Filter Applied!");
    this.renderDashboard();
  },

  renderDashboard: function() {
    const grid = document.getElementById('recipeGrid');
    const nav = document.getElementById('categoryNav');
    grid.innerHTML = '';
    
    const allTags = new Set();
    this.recipes.forEach(r => {
      const catString = r.category || 'Uncategorized';
      catString.split(',').forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) allTags.add(cleanTag);
      });
    });
    
    const uniqueCategories = Array.from(allTags).sort();
    
    let navHTML = `<button class="filter-btn ${this.currentCategory === 'All' ? 'active' : ''}" data-category="All">All</button>`;
    uniqueCategories.forEach(cat => {
      const isActive = this.currentCategory === cat ? 'active' : '';
      navHTML += `<button class="filter-btn ${isActive}" data-category="${cat}">${cat}</button>`;
    });
    nav.innerHTML = navHTML;

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentCategory = e.target.dataset.category;
        this.renderDashboard();
      });
    });

    const searchVal = this.currentSearch.toLowerCase();

    const filtered = this.recipes.filter(r => {
      const catString = r.category || 'Uncategorized';
      const recipeTags = catString.split(',').map(t => t.trim());
      
      const matchCatNav = this.currentCategory === 'All' || recipeTags.includes(this.currentCategory);
      
      const matchSearch = r.name.toLowerCase().includes(searchVal) ||
                          catString.toLowerCase().includes(searchVal) ||
                          (r.author_name || '').toLowerCase().includes(searchVal);

      let matchPantry = true;
      if (this.pantrySelection.length > 0) {
        const recipeIngs = r.recipe_ingredients 
          ? r.recipe_ingredients.map(m => m.ingredients ? m.ingredients.name.toLowerCase().trim() : '').filter(Boolean) 
          : [];
        
        if (recipeIngs.length > 0) {
          const pantrySet = new Set(this.pantrySelection.map(p => p.toLowerCase().trim()));
          matchPantry = recipeIngs.every(req => pantrySet.has(req));
        } else {
          matchPantry = false;
        }
      }

      return matchCatNav && matchSearch && matchPantry;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-weight: 800; color: #666; font-size: 1.2rem; padding: 40px;">No recipes found.</div>';
      return;
    }

    grid.innerHTML = filtered.map(r => this.createRecipeCardHTML(r)).join('');
  },

  formatProcedure: function(text) {
    if (!text) return "No instructions provided.";
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code style="background:#e2e8f0; padding:4px 8px; border-radius:8px; font-family:monospace; color:var(--pop-orange); font-size:0.9em; font-weight:bold;">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent-cyan); text-decoration:underline;">$1</a>');

    const lines = html.split('\n');
    let formattedHTML = '';
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return; 

      const h3Match = trimmed.match(/^###\s+(.*)/);
      const h2Match = trimmed.match(/^##\s+(.*)/);
      const h1Match = trimmed.match(/^#\s+(.*)/);
      const olMatch = trimmed.match(/^(\d+\.)\s+(.*)/); 
      const ulMatch = trimmed.match(/^[-*]\s+(.*)/);    
      const subtextMatch = trimmed.match(/^-#\s+(.*)/); 
      
      if (h1Match) {
        formattedHTML += `<h1 style="color: var(--pop-orange); margin: 20px 0 8px 0; font-size: 2.4rem;">${h1Match[1]}</h1>`;
      } else if (h2Match) {
        formattedHTML += `<h2 style="color: var(--pop-orange); margin: 18px 0 8px 0; font-size: 1.8rem; border-bottom: 3px solid var(--border-color); padding-bottom: 6px;">${h2Match[1]}</h2>`;
      } else if (h3Match) {
        formattedHTML += `<h3 style="color: var(--pop-orange); margin: 12px 0 4px 0; font-size: 1.3rem;">${h3Match[1]}</h3>`;
      } else if (olMatch) {
        formattedHTML += `
          <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start;">
            <span style="font-weight: 900; color: var(--pop-orange); font-size: 1.15rem; line-height: 1.5;">${olMatch[1]}</span>
            <span style="flex: 1; line-height: 1.5;">${olMatch[2]}</span>
          </div>`;
      } else if (ulMatch) {
        formattedHTML += `
          <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: flex-start;">
            <span style="font-weight: 900; color: var(--pop-orange); font-size: 1.4rem; line-height: 1.1;">•</span>
            <span style="flex: 1; line-height: 1.5;">${ulMatch[1]}</span>
          </div>`;
      } else if (subtextMatch) {
        formattedHTML += `<p style="font-size: 0.95rem; color: var(--text-gray); margin-bottom: 8px; line-height: 1.5; font-weight: 700;">${subtextMatch[1]}</p>`;
      } else {
        formattedHTML += `<p style="margin-bottom: 10px; line-height: 1.6;">${trimmed}</p>`;
      }
    });
    
    return formattedHTML;
  },

  togglePreview: function() {
    const preview = document.getElementById('procedurePreview');
    if (preview.style.display === 'none') {
      preview.style.display = 'block';
      this.updatePreview();
    } else {
      preview.style.display = 'none';
    }
  },

  updatePreview: function() {
    const preview = document.getElementById('procedurePreview');
    const textarea = document.getElementById('editProcedure');
    if (preview.style.display === 'block') {
      preview.innerHTML = this.formatProcedure(textarea.value);
    }
  },

  insertMarkdown: function(prefix, suffix) {
    const textarea = document.getElementById('editProcedure');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const pLen = prefix.length;
    const sLen = suffix.length;

    let replaceStart = start;
    let replaceEnd = end;
    let newText = "";
    let finalCursorStart = start;
    let finalCursorEnd = end;

    if (start >= pLen && text.substring(start - pLen, start) === prefix && text.substring(end, end + sLen) === suffix) {
      replaceStart = start - pLen;
      replaceEnd = end + sLen;
      newText = selectedText; 
      finalCursorStart = start - pLen;
      finalCursorEnd = end - pLen;
    }
    else if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= pLen + sLen) {
      newText = selectedText.substring(pLen, selectedText.length - sLen);
      finalCursorStart = start;
      finalCursorEnd = start + newText.length;
    }
    else {
      newText = prefix + selectedText + suffix;
      if (selectedText.length === 0 && suffix.length > 0) {
        finalCursorStart = start + pLen;
        finalCursorEnd = start + pLen;
      } else {
        finalCursorStart = start;
        finalCursorEnd = start + newText.length;
      }
    }
    textarea.focus();
    textarea.setSelectionRange(replaceStart, replaceEnd);

    if (!document.execCommand("insertText", false, newText)) {
      textarea.setRangeText(newText);
    }

    textarea.setSelectionRange(finalCursorStart, finalCursorEnd);
    this.updatePreview();
  },

  checkFavoriteStatus: async function() {
    const btn = document.getElementById('btnFavorite');
    if (!btn) return;
    if (!this.currentUser || !this.currentOpenRecipeId) {
      btn.textContent = "⭐ Save";
      btn.style.backgroundColor = "var(--bg-white)";
      return;
    }

    const { data } = await client.from('favorites')
      .select('recipe_id')
      .eq('user_id', this.currentUser.id)
      .eq('recipe_id', this.currentOpenRecipeId)
      .maybeSingle();

    if (data) {
      btn.textContent = "🌟 Saved!";
      btn.style.backgroundColor = "#fef3c7";
    } else {
      btn.textContent = "⭐ Save";
      btn.style.backgroundColor = "var(--bg-white)";
    }
  },

  toggleFavorite: async function() {
    if (!this.currentUser) return this.customAlert("Login Required", "Please log in to save favorites to your catalog!");
    if (!this.currentOpenRecipeId) return;

    this.playSound('star');

    const { data } = await client.from('favorites')
      .select('recipe_id')
      .eq('user_id', this.currentUser.id)
      .eq('recipe_id', this.currentOpenRecipeId)
      .maybeSingle();

    if (data) {
      await client.from('favorites').delete().eq('user_id', this.currentUser.id).eq('recipe_id', this.currentOpenRecipeId);
      this.showToast("Removed from Favorites");
    } else {
      await client.from('favorites').insert({ user_id: this.currentUser.id, recipe_id: this.currentOpenRecipeId });
      this.showToast("Added to Favorites!");
    }
    this.checkFavoriteStatus();
  },

  openDetail: async function(recipeId) {
    document.getElementById('detailTitle').textContent = "Loading...";
    this.showView('view-detail');

    const { data: recipe, error } = await client
      .from('recipes')
      .select(`
        *,
        recipe_ingredients (
          qty,
          ingredients ( name, unit, cost_per_unit, calories_per_unit, carbs_per_unit, protein_per_unit, fat_per_unit )
        )
      `)
      .eq('id', recipeId)
      .single();

    if (error) {
      this.customAlert("Error", "Error loading recipe details.");
      return this.showView('view-dashboard');
    }

    this.currentRecipeData = recipe;
    this.currentOpenRecipeId = recipe.id;
    this.checkFavoriteStatus();
    
    const rawImg = (recipe.image_url || '').trim().toLowerCase();
    const bgImage = (rawImg.length > 5 && rawImg.startsWith('http')) ? recipe.image_url.trim() : 'https://placehold.co/1200x400/eeeeee/999999?text=No+Image';
    document.getElementById('detailImageBanner').style.backgroundImage = `url('${bgImage}')`;

    document.getElementById('detailTitle').textContent = recipe.name;
    document.getElementById('detailCategory').textContent = recipe.category || "Unclassified";
    document.getElementById('detailPrep').textContent = recipe.prep_time || 0;
    document.getElementById('detailCook').textContent = recipe.cook_time || 0;
    document.getElementById('detailTime').textContent = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    document.getElementById('detailProcedure').innerHTML = this.formatProcedure(recipe.procedure);
    
    document.getElementById('detailAuthorName').textContent = recipe.author_name || 'Anonymous Chef';
    document.getElementById('detailAuthorAvatar').src = recipe.author_avatar || 'https://via.placeholder.com/35';

    document.getElementById('detailServings').value = recipe.servings || 1;
    this.renderDetailScaling();

    const editBtn = document.getElementById('detailEditBtn');
    if (this.currentUser && recipe.author_id === this.currentUser.id) {
      editBtn.style.display = 'inline-block';
      editBtn.onclick = () => this.openEditor(recipe);
    } else {
      editBtn.style.display = 'none';
    }

    this.loadReviews(recipe.id);
  },

  scaleServings: function(change) {
    let current = parseFloat(document.getElementById('detailServings').value) || 1;
    let next = current + change;
    if (next > 0) this.setServings(next);
  },

  setServings: function(value) {
    let target = parseFloat(value);
    if (isNaN(target) || target <= 0) target = 1;
    document.getElementById('detailServings').value = target;
    this.renderDetailScaling();
  },

  renderDetailScaling: function() {
    if (!this.currentRecipeData) return;
    const recipe = this.currentRecipeData;
    
    const baseServings = recipe.servings || 1;
    const targetServings = parseFloat(document.getElementById('detailServings').value) || 1;
    const ratio = targetServings / baseServings;

    let baseCost = 0, baseCal = 0, baseCarbs = 0, basePro = 0, baseFat = 0;
    
    if (recipe.recipe_ingredients) {
      recipe.recipe_ingredients.forEach(mapping => {
        if (mapping.ingredients) {
          baseCost += (mapping.qty * parseFloat(mapping.ingredients.cost_per_unit || 0));
          baseCal += (mapping.qty * parseFloat(mapping.ingredients.calories_per_unit || 0));
          baseCarbs += (mapping.qty * parseFloat(mapping.ingredients.carbs_per_unit || 0));
          basePro += (mapping.qty * parseFloat(mapping.ingredients.protein_per_unit || 0));
          baseFat += (mapping.qty * parseFloat(mapping.ingredients.fat_per_unit || 0));
        }
      });
    }

    const scaledCost = baseCost * ratio;
    const costPerServing = baseCost / baseServings;
    document.getElementById('detailCost').textContent = scaledCost.toFixed(2);
    document.getElementById('detailCostPerServing').textContent = costPerServing.toFixed(2);

    document.getElementById('detailCalories').textContent = (baseCal / baseServings).toFixed(0);
    document.getElementById('detailCarbs').textContent = (baseCarbs / baseServings).toFixed(1);
    document.getElementById('detailProtein').textContent = (basePro / baseServings).toFixed(1);
    document.getElementById('detailFat').textContent = (baseFat / baseServings).toFixed(1);

    let ingredientsHTML = '';
    if (recipe.raw_ingredients) {
      ingredientsHTML = recipe.raw_ingredients.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          return `<li style="list-style: none; color: var(--pop-orange); font-weight: 900; margin-top: 20px; margin-bottom: 8px; border-bottom: 3px solid var(--border-color); padding-bottom: 4px; font-size: 1.1rem;">${trimmed.slice(1, -1)}</li>`;
        }
        
        const match = trimmed.match(/^([\d.\/]+)\s*([a-zA-Z]+)?\s+(.*)$/);
        
        if (match) {
          let originalQty = 1;
          if (match[1].includes('/')) {
              const [num, den] = match[1].split('/');
              originalQty = (parseFloat(num) / parseFloat(den)) || 1;
          } else {
              originalQty = parseFloat(match[1]) || 1;
          }

          const scaledQty = +(originalQty * ratio).toFixed(2);
          const unit = match[2] ? match[2].trim() : '';
          const name = match[3].trim();

          let unitCost = 0;
          if (recipe.recipe_ingredients) {
            const mapItem = recipe.recipe_ingredients.find(m => m.ingredients.name.toLowerCase() === name.toLowerCase());
            if (mapItem) unitCost = parseFloat(mapItem.ingredients.cost_per_unit || 0);
          }
          const lineCost = (scaledQty * unitCost).toFixed(2);
          
          return `<li style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0; border-bottom: 2px dashed var(--border-color);">
                    <div style="display: flex; gap: 15px; flex: 1;">
                      <span style="color: var(--accent-cyan); font-weight: 900; font-size: 1.1rem; min-width: 80px; text-align: right;">${scaledQty} ${unit}</span>
                      <span style="font-weight: 700; color: var(--text-dark); font-size: 1.05rem;">${name}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--text-gray); font-size: 1rem; min-width: 70px; text-align: right;">₱${lineCost}</span>
                  </li>`;
        }
        return `<li style="padding: 12px 0; font-weight: 600; font-size: 1.05rem;">${trimmed}</li>`;
      }).join('');
    }
    document.getElementById('detailIngredients').innerHTML = ingredientsHTML || '<li>No ingredients specified.</li>';
  },

  copyShareLink: function(event) {
    event.stopPropagation();
    const link = document.getElementById('shareCardLinkText').textContent;
    navigator.clipboard.writeText(link).then(() => {
      this.showToast("Link copied to clipboard!");
    });
  },

  openShareCard: function() {
    if (!this.currentOpenRecipeId || !this.currentRecipeData) return;

    const modal = document.getElementById('shareCardModal');
    const recipe = this.currentRecipeData;
    
    document.getElementById('shareCardTitle').textContent = recipe.name;
    document.getElementById('shareCardTags').textContent = (recipe.category || 'Uncategorized').split(',').map(t => t.trim()).join(' • ');

    const rawImg = (recipe.image_url || '').trim().toLowerCase();
    const bgImage = (rawImg.length > 5 && rawImg.startsWith('http')) ? recipe.image_url.trim() : 'https://placehold.co/600x600/eeeeee/999999?text=No+Image';
    document.getElementById('shareCardImage').src = bgImage;

    const code = recipe.short_code || recipe.id;
    const shareUrl = `https://renzjared.github.io/recipes/?r=${code}`;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;
    document.getElementById('shareCardQR').src = qrUrl;
    document.getElementById('shareCardLinkText').textContent = shareUrl;
    
    document.getElementById('shareCardCost').textContent = document.getElementById('detailCostPerServing').textContent;
    document.getElementById('shareCardCal').textContent = document.getElementById('detailCalories').textContent;
    document.getElementById('shareCardCarb').textContent = document.getElementById('detailCarbs').textContent + 'g';
    document.getElementById('shareCardPro').textContent = document.getElementById('detailProtein').textContent + 'g';
    document.getElementById('shareCardFat').textContent = document.getElementById('detailFat').textContent + 'g';

    document.querySelector('.flip-container').classList.remove('flipped');
    modal.classList.remove('hidden');
  },

  loadProfile: async function(userId) {
    document.getElementById('profileName').textContent = "Loading...";
    this.showView('view-profile');

    const { data: userRecipes } = await client.from('recipes').select('*').eq('author_id', userId);
    const authorName = userRecipes && userRecipes.length > 0 ? userRecipes[0].author_name : "Chef";
    const authorAvatar = userRecipes && userRecipes.length > 0 ? userRecipes[0].author_avatar : "https://via.placeholder.com/120";

    document.getElementById('profileName').textContent = authorName;
    document.getElementById('profileAvatar').src = authorAvatar;

    const { data: userReviews } = await client.from('recipe_reviews').select('id').eq('user_id', userId);

    const recipeCount = userRecipes ? userRecipes.length : 0;
    const reviewCount = userReviews ? userReviews.length : 0;
    const totalXp = (recipeCount * 100) + (reviewCount * 20);
    const level = Math.floor(totalXp / 500) + 1;
    const progress = (totalXp % 500) / 500 * 100;

    document.getElementById('profileLevel').textContent = level;
    document.getElementById('profileXpText').textContent = `${totalXp} XP`;
    document.getElementById('profileXpFill').style.width = `${progress}%`;

    const recipesGrid = document.getElementById('profileRecipesGrid');
    recipesGrid.innerHTML = userRecipes && userRecipes.length > 0 
      ? userRecipes.map(r => this.createRecipeCardHTML(r)).join('') 
      : "<p style='grid-column: 1/-1; text-align: center; font-weight: 800; color: #666;'>No recipes authored yet.</p>";

    const badges = [
      { name: "First Steps", desc: "Write your first recipe.", icon: "🥚", unlocked: recipeCount >= 1 },
      { name: "Master Chef", desc: "Author 5+ recipes.", icon: "👨‍🍳", unlocked: recipeCount >= 5 },
      { name: "Food Critic", desc: "Leave 3+ reviews.", icon: "📝", unlocked: reviewCount >= 3 },
      { name: "Pantry Lord", desc: "Reach Level 5.", icon: "👑", unlocked: level >= 5 }
    ];

    document.getElementById('profileBadgesGrid').innerHTML = badges.map(b => `
      <div class="badge-card ${b.unlocked ? 'unlocked' : ''}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      </div>
    `).join('');

    this.loadFavoritesTab(userId);
    this.loadPlannerTab(userId);
  },

  switchProfileTab: function(tabName, btnElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
    btnElement.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
  },

  loadFavoritesTab: async function(userId) {
    const grid = document.getElementById('profileFavoritesGrid');
    const { data: favs } = await client.from('favorites').select('recipe_id').eq('user_id', userId);
    
    if (!favs || favs.length === 0) {
      grid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; font-weight: 800; color: #666;'>No favorites saved yet.</p>";
      return;
    }

    const recipeIds = favs.map(f => f.recipe_id);
    const { data: recipes } = await client.from('recipes').select('*').in('id', recipeIds);
    
    if(recipes) {
        grid.innerHTML = recipes.map(r => this.createRecipeCardHTML(r)).join('');
        const dragList = document.getElementById('plannerFavoritesList');
        dragList.innerHTML = recipes.map(r => `
        <div class="mini-recipe-card" draggable="true" ondragstart="app.handleDragStart(event, '${r.id}', '${encodeURIComponent(r.name)}', '${encodeURIComponent(r.image_url)}')">
            <img src="${r.image_url || 'https://via.placeholder.com/40'}" class="mini-img">
            <span>${r.name}</span>
        </div>
        `).join('');
    }
  },

  loadPlannerTab: async function(userId) {
    const { data: planItems } = await client.from('weekly_plan').select('*, recipes(name, image_url)').eq('user_id', userId);
    
    document.querySelectorAll('.drop-zone').forEach(zone => zone.innerHTML = '');

    if (planItems) {
      planItems.forEach(item => {
        const zone = document.querySelector(`.drop-zone[data-day="${item.day_of_week}"]`);
        if (zone && item.recipes) {
          zone.innerHTML += `
            <div class="mini-recipe-card" style="cursor: default;">
              <img src="${item.recipes.image_url || 'https://via.placeholder.com/40'}" class="mini-img">
              <span style="flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.recipes.name}</span>
              <button onclick="app.removePlanItem('${item.id}', this)" style="background: none; border: none; color: red; font-weight: 900; padding: 0 5px; box-shadow: none;">X</button>
            </div>
          `;
        }
      });
    }
  },

  handleDragStart: function(e, recipeId, name, img) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ recipeId, name: decodeURIComponent(name), img: decodeURIComponent(img) }));
  },
  handleDragOver: function(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  },
  handleDragLeave: function(e) {
    e.currentTarget.classList.remove('drag-over');
  },
  handleDrop: async function(e) {
    e.preventDefault();
    const zone = e.currentTarget;
    zone.classList.remove('drag-over');

    const day = zone.dataset.day;
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));

    if (!this.currentUser) return this.customAlert("Login Required", "Must be logged in to save plans!");

    this.playSound('pop');

    const { data: newPlan } = await client.from('weekly_plan').insert({
      user_id: this.currentUser.id,
      recipe_id: data.recipeId,
      day_of_week: day
    }).select().single();

    if (newPlan) {
      zone.innerHTML += `
        <div class="mini-recipe-card" style="cursor: default;">
          <img src="${data.img || 'https://via.placeholder.com/40'}" class="mini-img">
          <span style="flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.name}</span>
          <button onclick="app.removePlanItem('${newPlan.id}', this)" style="background: none; border: none; color: red; font-weight: 900; padding: 0 5px; box-shadow: none;">X</button>
        </div>
      `;
    }
  },
  removePlanItem: async function(planId, btnElement) {
    await client.from('weekly_plan').delete().eq('id', planId);
    btnElement.parentElement.remove();
  },

  fetchShoppingList: async function() {
    if (this.currentUser) {
      const { data, error } = await client
        .from('shopping_list')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        this.shoppingList = data.map(item => ({...item, db_id: item.id}));
      }
    } else {
      this.shoppingList = JSON.parse(localStorage.getItem('renz_shopping_list')) || [];
    }
    
    if (document.getElementById('view-shopping').classList.contains('active')) {
      this.renderShoppingList();
    }
  },

  addRecipeToShoppingList: function() {
    if (!this.currentRecipeData) return;
    
    const recipe = this.currentRecipeData;
    const baseServings = recipe.servings || 1;
    const targetServings = parseFloat(document.getElementById('detailServings').value) || 1;
    const ratio = targetServings / baseServings;

    if (!recipe.raw_ingredients) return;

    let addedCount = 0;

    recipe.raw_ingredients.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return;
      
      const match = trimmed.match(/^([\d.\/]+)\s*([a-zA-Z]+)?\s+(.*)$/);
      
      let qty = 1;
      let unit = '';
      let name = trimmed;

      if (match) {
        if (match[1].includes('/')) {
            const [num, den] = match[1].split('/');
            qty = (parseFloat(num) / parseFloat(den)) || 1;
        } else {
            qty = parseFloat(match[1]) || 1;
        }
        qty = +(qty * ratio).toFixed(2);
        unit = match[2] ? match[2].trim() : '';
        name = match[3].trim();
      }

      let unitCost = 0;
      if (recipe.recipe_ingredients) {
        const mapItem = recipe.recipe_ingredients.find(m => m.ingredients.name.toLowerCase() === name.toLowerCase());
        if (mapItem) unitCost = parseFloat(mapItem.ingredients.cost_per_unit || 0);
      }

      this.upsertShoppingItem(name, qty, unit, unitCost);
      addedCount++;
    });

    if (addedCount > 0) {
      this.playSound('success');
      this.showToast(`Added ${addedCount} ingredient(s) to List!`);
    }
  },

  checkManualShopUnit: function(value) {
    const unitInput = document.getElementById('manualShopUnit');
    const found = this.ingredientsRegistry.find(i => i.name.toLowerCase() === value.trim().toLowerCase());
    if (found) {
      unitInput.value = found.unit;
      unitInput.setAttribute('disabled', 'true');
    } else {
      unitInput.removeAttribute('disabled');
    }
  },

  addManualShoppingItem: function() {
    const nameInput = document.getElementById('manualShopName');
    const qtyInput = document.getElementById('manualShopQty');
    const unitInput = document.getElementById('manualShopUnit');

    const name = nameInput.value.trim();
    if (!name) return;

    let qty = parseFloat(qtyInput.value) || 1;
    let unit = unitInput.value.trim();
    let costPerUnit = 0;

    const found = this.ingredientsRegistry.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (found) {
      if (!unit) unit = found.unit;
      costPerUnit = parseFloat(found.cost_per_unit || 0);
    }

    this.upsertShoppingItem(name, qty, unit, costPerUnit);

    nameInput.value = '';
    qtyInput.value = '1';
    unitInput.value = '';
    unitInput.removeAttribute('disabled');
  },

  upsertShoppingItem: function(name, qty, unit, costPerUnit) {
    const existingIndex = this.shoppingList.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    
    let item;
    if (existingIndex !== -1) {
      item = this.shoppingList[existingIndex];
      item.qty = parseFloat((item.qty + qty).toFixed(2));
    } else {
      item = {
        id: Date.now() + Math.random().toString(), 
        name: name,
        qty: qty,
        unit: unit,
        cost_per_unit: costPerUnit,
        actual_cost: 0,
        checked: false
      };
      this.shoppingList.push(item);
    }

    if (document.getElementById('view-shopping').classList.contains('active')) {
      this.renderShoppingList();
    }

    if (this.currentUser) {
      if (existingIndex !== -1 && item.db_id) {
        client.from('shopping_list').update({ qty: item.qty }).eq('id', item.db_id).then();
      } else if (existingIndex === -1) {
        client.from('shopping_list').insert({
          user_id: this.currentUser.id,
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          cost_per_unit: item.cost_per_unit,
          actual_cost: item.actual_cost,
          checked: item.checked
        }).select().single().then(({ data, error }) => {
          if (data) item.db_id = data.id; 
        });
      }
    } else {
      localStorage.setItem('renz_shopping_list', JSON.stringify(this.shoppingList));
    }
  },

  updateShoppingItem: function(index, field, value) {
    if (field === 'qty' || field === 'actual_cost') value = parseFloat(value) || 0;
    
    const item = this.shoppingList[index];
    item[field] = value;

    if (field === 'name') {
      const found = this.ingredientsRegistry.find(i => i.name.toLowerCase() === value.trim().toLowerCase());
      if (found) {
        item.cost_per_unit = parseFloat(found.cost_per_unit || 0);
        item.unit = found.unit;
      }
    }

    this.renderShoppingList(); 

    if (this.currentUser && item.db_id) {
      const updateData = {};
      updateData[field] = value;
      if (field === 'name' && item.unit) {
        updateData.unit = item.unit;
        updateData.cost_per_unit = item.cost_per_unit;
      }
      client.from('shopping_list').update(updateData).eq('id', item.db_id).then();
    } else if (!this.currentUser) {
      localStorage.setItem('renz_shopping_list', JSON.stringify(this.shoppingList));
    }
  },

  removeShoppingItem: function(index) {
    const item = this.shoppingList[index];
    this.shoppingList.splice(index, 1);
    this.renderShoppingList(); 

    if (this.currentUser && item.db_id) {
      client.from('shopping_list').delete().eq('id', item.db_id).then();
    } else if (!this.currentUser) {
      localStorage.setItem('renz_shopping_list', JSON.stringify(this.shoppingList));
    }
  },

  clearCheckedShoppingList: function() {
    if (this.currentUser) {
      const checkedIds = this.shoppingList.filter(item => item.checked && item.db_id).map(item => item.db_id);
      if (checkedIds.length > 0) {
        client.from('shopping_list').delete().in('id', checkedIds).then();
      }
    }
    this.shoppingList = this.shoppingList.filter(item => !item.checked);
    
    if (!this.currentUser) {
      localStorage.setItem('renz_shopping_list', JSON.stringify(this.shoppingList));
    }
    this.renderShoppingList();
  },

  clearAllShoppingList: function() {
    this.customConfirm("Clear List?", "Are you sure you want to clear your entire shopping list?", () => {
      if (this.currentUser) {
        client.from('shopping_list').delete().eq('user_id', this.currentUser.id).then();
      }
      this.shoppingList = [];
      localStorage.removeItem('renz_shopping_list');
      this.renderShoppingList();
    });
  },

  renderShoppingList: function() {
    const container = document.getElementById('shoppingListContainer');
    if (!container) return;

    if (this.shoppingList.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-gray); font-weight: 800; font-size: 1.1rem; margin-top: 40px;">Your shopping list is empty.<br><span style="font-size: 0.9rem; font-weight: 600;">Add items from a recipe or enter them manually above.</span></div>';
      document.getElementById('shoppingEstTotal').textContent = '₱0.00';
      document.getElementById('shoppingActTotal').textContent = '₱0.00';
      return;
    }

    let estTotal = 0;
    let actTotal = 0;

    container.innerHTML = this.shoppingList.map((item, index) => {
      const estLineCost = (item.qty * (item.cost_per_unit || 0)).toFixed(2);
      estTotal += parseFloat(estLineCost);
      actTotal += parseFloat(item.actual_cost || 0);

      const checkedClass = item.checked ? 'bought' : '';
      const checkboxStatus = item.checked ? 'checked' : '';

      return `
        <div class="shopping-row ${checkedClass}">
          <input type="checkbox" ${checkboxStatus} onchange="app.updateShoppingItem(${index}, 'checked', this.checked)">
          <div class="shopping-item-name autocomplete-wrapper">
            <input type="text" value="${item.name}" oninput="app.filterAutocomplete(this, 'ingredient'); app.updateShoppingItem(${index}, 'name', this.value)" onfocus="app.filterAutocomplete(this, 'ingredient')" onblur="app.closeAutocomplete(this)" placeholder="Item Name" autocomplete="off" style="width: 100%;">
            <div class="autocomplete-dropdown"></div>
          </div>
          <div class="shopping-item-qty">
            <input type="number" value="${item.qty}" step="any" onchange="app.updateShoppingItem(${index}, 'qty', this.value)">
          </div>
          <div class="shopping-item-unit" style="display: flex; align-items: center; color: var(--text-gray); font-size: 1rem; font-weight: 800;">
            ${item.unit}
          </div>
          <div class="shopping-item-est" style="display: flex; align-items: center;">₱${estLineCost}</div>
          <div class="shopping-item-actual">
            <input type="number" value="${item.actual_cost || ''}" placeholder="Actual Price" step="any" onchange="app.updateShoppingItem(${index}, 'actual_cost', this.value)">
          </div>
          <button class="btn-danger" style="padding: 10px; font-size: 0.85rem;" onclick="app.removeShoppingItem(${index})">X</button>
        </div>
      `;
    }).join('');

    document.getElementById('shoppingEstTotal').textContent = `₱${estTotal.toFixed(2)}`;
    document.getElementById('shoppingActTotal').textContent = `₱${actTotal.toFixed(2)}`;
  },

  loadReviews: async function(recipeId) {
    this.currentOpenRecipeId = recipeId; 
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.innerHTML = 'Loading comments...';

    document.getElementById('reviewFormContainer').style.display = this.currentUser ? 'flex' : 'none';
    document.getElementById('loginPrompt').style.display = this.currentUser ? 'none' : 'block';

    const { data: reviews, error } = await client.from('recipe_reviews').select('*').eq('recipe_id', recipeId).order('created_at', { ascending: false });

    if (error) return console.error(error);
    
    if (reviews.length === 0) {
      reviewsList.innerHTML = '<div style="color: var(--text-gray); font-weight: 700;">No reviews yet. Be the first!</div>';
      return;
    }

    reviewsList.innerHTML = reviews.map(rev => {
      const stars = '⭐'.repeat(rev.rating);
      return `
        <div class="review-card">
          <div class="review-header">
            <span style="color: var(--accent-cyan); font-size: 1.1rem;">${rev.author_name}</span>
            <span class="star-rating">${stars}</span>
          </div>
          <div style="font-size: 1rem; line-height: 1.6; font-weight: 600;">${rev.comment || ''}</div>
        </div>
      `;
    }).join('');
  },

  submitReview: async function() {
    if (!this.currentUser || !this.currentOpenRecipeId) return;

    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewText').value.trim();

    const reviewData = {
      recipe_id: this.currentOpenRecipeId,
      user_id: this.currentUser.id,
      author_name: this.currentUser.user_metadata.full_name || 'Chef',
      rating: rating,
      comment: comment
    };

    const { error } = await client.from('recipe_reviews').insert(reviewData);

    if (!error) {
      document.getElementById('reviewText').value = ''; 
      this.loadReviews(this.currentOpenRecipeId); 
      this.playSound('success');
      this.showToast("Review submitted!");
    }
  },

  openEditor: function(recipeObj = null) {
    if (!this.currentUser) return this.customAlert("Login Required", "You must be logged in to create a recipe.");

    const title = document.getElementById('editorTitle');
    this.editIngredientsList = [];
    
    if (recipeObj) {
      title.textContent = "Edit Recipe";
      document.getElementById('editId').value = recipeObj.id;
      document.getElementById('editImage').value = recipeObj.image_url || '';
      document.getElementById('editName').value = recipeObj.name;
      document.getElementById('editCategory').value = recipeObj.category;
      document.getElementById('editServings').value = recipeObj.servings || 1;
      document.getElementById('editPrepTime').value = recipeObj.prep_time || 0; 
      document.getElementById('editCookTime').value = recipeObj.cook_time || 0; 
      document.getElementById('editProcedure').value = recipeObj.procedure;

      if (recipeObj.raw_ingredients) {
        recipeObj.raw_ingredients.split('\n').forEach(line => {
          const t = line.trim();
          if (!t) return;
          if (t.startsWith('[') && t.endsWith(']')) {
            this.editIngredientsList.push({ type: 'divider', name: t.slice(1, -1) });
          } else {
            const match = t.match(/^([\d.]+)\s*([a-zA-Z]+)?\s+(.*)$/);
            if (match) {
              this.editIngredientsList.push({ type: 'ingredient', qty: parseFloat(match[1]), unit: match[2] || '', name: match[3].trim() });
            } else {
              this.editIngredientsList.push({ type: 'ingredient', qty: 1, unit: '', name: t });
            }
          }
        });
      }
      this.injectDeleteButton(recipeObj.id);
    } else {
      title.textContent = "New Recipe";
      document.getElementById('editId').value = '';
      document.getElementById('editImage').value = '';
      document.getElementById('editName').value = '';
      document.getElementById('editCategory').value = '';
      document.getElementById('editServings').value = 1;
      document.getElementById('editPrepTime').value = '0';
      document.getElementById('editCookTime').value = '0';
      document.getElementById('editProcedure').value = '';
      this.injectDeleteButton(null);
    }
    
    this.renderEditorIngredients();
    this.showView('view-editor');
  },

  addEditorIngredient: function(type) {
    if (type === 'divider') {
      this.editIngredientsList.push({ type: 'divider', name: '' });
    } else {
      this.editIngredientsList.push({ type: 'ingredient', qty: 1, unit: '-', name: '' });
    }
    this.renderEditorIngredients();
  },

  removeEditorIngredient: function(index) {
    this.editIngredientsList.splice(index, 1);
    this.renderEditorIngredients();
  },

  updateEditorIngredientUnit: function(index, value) {
    this.editIngredientsList[index].name = value;
    const found = this.ingredientsRegistry.find(i => i.name.toLowerCase() === value.trim().toLowerCase());
    if (found) {
      this.editIngredientsList[index].unit = found.unit;
      this.renderEditorIngredients();
    }
  },

  renderEditorIngredients: function() {
    const container = document.getElementById('editorIngredientsContainer');
    container.innerHTML = '';
    
    this.editIngredientsList.forEach((item, index) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '15px';
      row.style.alignItems = 'center';
      row.style.background = 'white';
      row.style.padding = '8px';
      row.style.borderRadius = '20px';
      row.style.border = '2px solid var(--border-color)';
      row.style.boxShadow = '0 4px 0 0 var(--border-color)';

      if (item.type === 'divider') {
        row.innerHTML = `
          <input type="text" value="${item.name}" oninput="app.editIngredientsList[${index}].name = this.value" placeholder="Section Name (e.g. Marinade)" style="flex: 1; border-color: var(--pop-orange); color: var(--pop-orange); font-weight: 800;">
          <button class="btn-danger" onclick="app.removeEditorIngredient(${index})">X</button>
        `;
      } else {
        row.innerHTML = `
          <input type="number" value="${item.qty}" oninput="app.editIngredientsList[${index}].qty = parseFloat(this.value) || 0" style="width: 100px;" step="any">
          <span style="width: 50px; text-align: center; font-weight: 800; color: var(--accent-cyan); font-size: 1.1rem;">${item.unit}</span>
          
          <div class="autocomplete-wrapper" style="flex: 1;">
            <input type="text" value="${item.name}" onchange="app.updateEditorIngredientUnit(${index}, this.value)" oninput="app.editIngredientsList[${index}].name = this.value; app.filterAutocomplete(this, 'ingredient');" onfocus="app.filterAutocomplete(this, 'ingredient')" onblur="app.closeAutocomplete(this)" placeholder="Type ingredient..." autocomplete="off" style="width: 100%;">
            <div class="autocomplete-dropdown"></div>
          </div>

          <button class="btn-danger" onclick="app.removeEditorIngredient(${index})">X</button>
        `;
      }
      container.appendChild(row);
    });
  },

  cancelEdit: function() {
    const id = document.getElementById('editId').value;
    id ? this.openDetail(id) : this.showView('view-dashboard');
  },

  injectDeleteButton: function(recipeId) {
    let delBtn = document.getElementById('editorDeleteBtn');
    if (!recipeId) {
      if (delBtn) delBtn.style.display = 'none';
      return;
    }
    if (!delBtn) {
      delBtn = document.createElement('button');
      delBtn.id = 'editorDeleteBtn';
      delBtn.className = 'btn-danger';
      delBtn.textContent = 'Delete Recipe';
      document.querySelector('.editor-actions').prepend(delBtn);
    }
    delBtn.style.display = 'inline-block';
    delBtn.onclick = () => this.deleteRecipe(recipeId);
  },

  saveRecipe: async function() {
    const idInput = document.getElementById('editId').value;
    const saveBtn = document.querySelector('.editor-actions .btn-primary');
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    const raw_ingredients = this.editIngredientsList.map(item => {
      if (item.type === 'divider') return `[${item.name}]`;
      return `${item.qty} ${item.unit !== '-' ? item.unit : ''} ${item.name}`.trim();
    }).join('\n');

    const recipeData = {
      name: document.getElementById('editName').value || 'Untitled',
      image_url: document.getElementById('editImage').value.trim(),
      category: document.getElementById('editCategory').value,
      servings: parseFloat(document.getElementById('editServings').value) || 1,
      prep_time: Number(document.getElementById('editPrepTime').value) || 0,
      cook_time: Number(document.getElementById('editCookTime').value) || 0,
      procedure: document.getElementById('editProcedure').value.trim(),
      raw_ingredients: raw_ingredients,
      author_id: this.currentUser.id,
      author_name: this.currentUser.user_metadata.full_name || 'Chef',
      author_avatar: this.currentUser.user_metadata.avatar_url || 'https://via.placeholder.com/35'
    };

    let finalRecipeId = idInput;

    try {
      if (idInput) {
        await client.from('recipes').update(recipeData).eq('id', idInput);
        await client.from('recipe_ingredients').delete().eq('recipe_id', idInput);
      } else {
        recipeData.short_code = Math.random().toString(36).substring(2, 8);
        const { data, error } = await client.from('recipes').insert(recipeData).select().single();
        if (error) throw error;
        finalRecipeId = data.id;
      }

      const mappingData = [];
      this.editIngredientsList.forEach(item => {
        if (item.type === 'ingredient') {
          const foundIngr = this.ingredientsRegistry.find(ing => 
            ing.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (foundIngr) {
            mappingData.push({ recipe_id: finalRecipeId, ingredient_id: foundIngr.id, qty: item.qty });
          }
        }
      });

      if (mappingData.length > 0) {
        await client.from('recipe_ingredients').insert(mappingData);
      }

      await this.fetchRecipes();

      saveBtn.textContent = "Save Recipe";
      saveBtn.disabled = false;
      this.openDetail(finalRecipeId);
      this.playSound('success');
      this.showToast("Recipe saved successfully!");

    } catch (err) {
      console.error("Save Error:", err);
      this.customAlert("Save Error", "Failed to save recipe. Check console.");
      saveBtn.textContent = "Save Recipe";
      saveBtn.disabled = false;
    }
  },

  deleteRecipe: async function(id) {
    this.customConfirm("Delete Recipe?", "Are you sure you want to delete this recipe? This cannot be undone.", async () => {
      const { error } = await client.from('recipes').delete().eq('id', id);
      if (!error) {
        await this.fetchRecipes();
        this.showView('view-home');
        this.showToast("Recipe deleted");
      }
    });
  }
};

window.onload = () => app.init();
window.app = app;