const SUPABASE_URL = 'https://gjgfxiiwrliczxprzjsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZ2Z4aWl3cmxpY3p4cHJ6anNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQwMDQsImV4cCI6MjA5NTM2MDAwNH0.klalMuCkIdGqfEqXqtqrwFPicxzZUWu5mF1ttmXSFwk';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
  currentUser: null,
  recipes: [],
  ingredientsRegistry: [], 
  currentCategory: 'All',
  currentSearch: '',
  
  sortColumn: null, 
  sortDesc: false, 

  currentOpenRecipeId: null,
  currentRecipeData: null, 
  
  editIngredientsList: [],
  galleryInterval: null,

  init: async function() {
    const { data: { session } } = await client.auth.getSession();
    this.updateUserUI(session?.user || null);

    client.auth.onAuthStateChange((_event, session) => {
      this.updateUserUI(session?.user || null);
    });

    await this.fetchIngredientsRegistry();
    await this.fetchRecipes();

    const urlParams = new URLSearchParams(window.location.search);
    const sharedRecipeId = urlParams.get('recipe');
    
    if (sharedRecipeId) {
      this.openDetail(sharedRecipeId);
    } else {
      this.showView('view-home');
    }
  },

  updateUserUI: function(user) {
    this.currentUser = user;
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
    await client.auth.signInWithOAuth({ provider: 'discord' });
  },

  logout: async function() {
    await client.auth.signOut();
    this.showView('view-home');
  },

  showView: function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if(viewId === 'view-home') document.getElementById('nav-home').classList.add('active');
    if(viewId === 'view-dashboard') document.getElementById('nav-browse').classList.add('active');
    if(viewId === 'view-ingredients') document.getElementById('nav-pantry').classList.add('active');

    if (viewId === 'view-home') this.renderHome();
    if (viewId === 'view-dashboard') this.renderDashboard();
    if (viewId === 'view-ingredients') this.loadIngredientsView();
  },

  fetchIngredientsRegistry: async function() {
    const { data, error } = await client.from('ingredients').select('*').order('name');
    if (!error && data) {
      this.ingredientsRegistry = data;
      this.populateDatalists();
    }
  },

  populateDatalists: function() {
    const dl = document.getElementById('ingredientDatalist');
    if (dl) dl.innerHTML = this.ingredientsRegistry.map(ing => `<option value="${ing.name}">`).join('');
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
      tr.style.borderBottom = "1px solid #f1f5f9";
      tr.style.transition = "background-color 0.2s";
      tr.onmouseover = () => tr.style.backgroundColor = "#f8fafc";
      tr.onmouseout = () => tr.style.backgroundColor = "transparent";

      const catIcon = this.getCategoryIcon(ing.category);

      tr.innerHTML = `
        <td style="padding: 15px; font-size: 1.5rem; text-align: center;" title="${ing.category || 'Uncategorized'}">${catIcon}</td>
        <td style="padding: 15px;">
          <div style="font-weight: 800; color: var(--text-dark); font-size: 0.95rem;">${ing.name}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">${ing.notes || 'No notes'}</div>
        </td>
        <td style="padding: 15px;">
          <div style="font-weight: 700; color: var(--text-gray); font-size: 0.85rem;">${(ing.category || '---').toUpperCase()}</div>
          <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">${(ing.subcategory || '').toUpperCase()}</div>
        </td>
        <td style="padding: 15px; font-weight: 800; color: var(--accent-cyan);">${ing.unit}</td>
        <td style="padding: 15px; font-weight: 900; color: var(--pop-orange);">₱${parseFloat(ing.cost_per_unit||0).toFixed(2)}</td>
        <td style="padding: 15px; font-size: 0.8rem; font-weight: 700; color: #64748b; white-space: nowrap;">
          <span title="Calories" style="color: var(--hint-purple);">🔥 ${parseFloat(ing.calories_per_unit||0).toFixed(1)}</span> &nbsp;
          <span title="Carbohydrates" style="color: #d97706;">🌾 ${parseFloat(ing.carbs_per_unit||0).toFixed(1)}g</span> &nbsp;
          <span title="Protein" style="color: #dc2626;">🥩 ${parseFloat(ing.protein_per_unit||0).toFixed(1)}g</span> &nbsp;
          <span title="Fat" style="color: #f59e0b;">🧈 ${parseFloat(ing.fat_per_unit||0).toFixed(1)}g</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  saveIngredient: async function() {
    const name = document.getElementById('ingName').value.trim();
    const amount = parseFloat(document.getElementById('ingAmount').value);
    const unit = document.getElementById('ingUnit').value.trim();
    const cost = parseFloat(document.getElementById('ingCost').value);
    
    const category = document.getElementById('ingCategory').value.trim();
    const subcategory = document.getElementById('ingSubcategory').value.trim();
    const notes = document.getElementById('ingNotes').value.trim();

    if (!name || !amount || !unit || isNaN(cost)) {
      return alert("Please fill out Name, Amount, Unit, and Cost.");
    }

    const costPerUnit = cost / amount;

    const newIng = {
      name: name,
      unit: unit,
      cost_per_unit: costPerUnit,
      category: category,
      subcategory: subcategory,
      notes: notes,
      calories_per_unit: 0, carbs_per_unit: 0, protein_per_unit: 0, fat_per_unit: 0
    };

    const { error } = await client.from('ingredients').insert(newIng);

    if (error) {
      alert("Error saving ingredient: " + error.message);
    } else {
      document.getElementById('ingName').value = '';
      document.getElementById('ingAmount').value = '';
      document.getElementById('ingUnit').value = 'g';
      document.getElementById('ingCost').value = '';
      document.getElementById('ingCategory').value = '';
      document.getElementById('ingSubcategory').value = '';
      document.getElementById('ingNotes').value = '';
      this.loadIngredientsView();
    }
  },

  fetchRecipes: async function() {
    const { data, error } = await client.from('recipes').select(`
      *,
      recipe_ingredients ( qty, ingredients ( cost_per_unit ) )
    `).order('name');
    
    if (!error) this.recipes = data;
  },

  createRecipeCardHTML: function(recipe) {
    const isOwner = this.currentUser && recipe.author_id === this.currentUser.id;
    const ownerBadge = isOwner ? `<div style="position:absolute; top:10px; right:10px; background:var(--accent-cyan); color:white; font-size:10px; font-weight:900; padding:4px 8px; border-radius:4px;">YOURS</div>` : '';

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
          <div style="font-size: 0.75rem; color: var(--text-gray); font-weight: 600; margin-bottom: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${tagsDisplay}
          </div>
          <div class="card-meta">
            <span>🕒 ${totalTime} MIN</span>
            <span style="color: var(--text-dark); font-weight: 900;">₱${costPerServing}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderHome: function() {
    if (!this.recipes || this.recipes.length === 0) return;

    const shuffled = [...this.recipes].sort(() => 0.5 - Math.random());
    const galleryRecipes = shuffled.slice(0, 5);
    const featuredRecipes = shuffled.slice(5, 8);

    // carousel
    const gallery = document.getElementById('homeGallery');
    if (gallery) {
      gallery.innerHTML = galleryRecipes.map(r => {
        const rawImg = (r.image_url || '').trim().toLowerCase();
        const isValidImg = rawImg.length > 5 && rawImg.startsWith('http');
        const bgImage = isValidImg ? r.image_url.trim() : 'https://placehold.co/600x400/eeeeee/999999?text=No+Image';
        
        return `
          <div class="gallery-card" style="background-image: url('${bgImage}')" onclick="app.openDetail('${r.id}')">
            <div class="gallery-card-overlay">
              <h3 style="margin:0; font-size: 1.3rem; text-transform: uppercase;">${r.name}</h3>
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

    const featured = document.getElementById('homeFeatured');
    if (featured) {
      featured.innerHTML = featuredRecipes.map(r => this.createRecipeCardHTML(r)).join('');
    }
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
    const catDl = document.getElementById('categoryDatalist');
    if (catDl) catDl.innerHTML = uniqueCategories.map(c => `<option value="${c}">`).join('');
    
    let navHTML = `<button class="filter-btn ${this.currentCategory === 'All' ? 'active' : ''}" data-category="All">ALL</button>`;
    uniqueCategories.forEach(cat => {
      const isActive = this.currentCategory === cat ? 'active' : '';
      navHTML += `<button class="filter-btn ${isActive}" data-category="${cat}">${cat.toUpperCase()}</button>`;
    });
    nav.innerHTML = navHTML;

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentCategory = e.target.dataset.category;
        this.renderDashboard();
      });
    });

    const filtered = this.recipes.filter(r => {
      const catString = r.category || 'Uncategorized';
      const recipeTags = catString.split(',').map(t => t.trim());
      const matchCat = this.currentCategory === 'All' || recipeTags.includes(this.currentCategory);
      const matchSearch = r.name.toLowerCase().includes(this.currentSearch.toLowerCase());
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; font-weight: 800; color: #666;">No recipes found.</div>';
      return;
    }

    grid.innerHTML = filtered.map(r => this.createRecipeCardHTML(r)).join('');
  },

  formatProcedure: function(text) {
    if (!text) return "No instructions provided.";
    
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
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
      
      if (h1Match) {
        formattedHTML += `<h1 style="color: var(--pop-orange); margin: 20px 0 8px 0; font-size: 2.2rem;">${h1Match[1]}</h1>`;
      } else if (h2Match) {
        formattedHTML += `<h2 style="color: var(--pop-orange); margin: 18px 0 8px 0; font-size: 1.5rem; border-bottom: 2px solid var(--border-color); padding-bottom: 4px;">${h2Match[1]}</h2>`;
      } else if (h3Match) {
        formattedHTML += `<h3 style="color: var(--pop-orange); margin: 12px 0 4px 0; font-size: 1.1rem;">${h3Match[1]}</h3>`;
      } else if (olMatch) {
        formattedHTML += `
          <div style="display: flex; gap: 10px; margin-bottom: 6px; align-items: flex-start;">
            <span style="font-weight: 900; color: var(--pop-orange); font-size: 1.05rem; line-height: 1.4;">${olMatch[1]}</span>
            <span style="flex: 1; line-height: 1.4;">${olMatch[2]}</span>
          </div>`;
      } else if (ulMatch) {
        formattedHTML += `
          <div style="display: flex; gap: 10px; margin-bottom: 6px; align-items: flex-start;">
            <span style="font-weight: 900; color: var(--pop-orange); font-size: 1.2rem; line-height: 1.1;">•</span>
            <span style="flex: 1; line-height: 1.4;">${ulMatch[1]}</span>
          </div>`;
      } else {
        formattedHTML += `<p style="margin-bottom: 8px; line-height: 1.5;">${trimmed}</p>`;
      }
    });
    
    return formattedHTML;
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
      alert("Error loading recipe details.");
      return this.showView('view-dashboard');
    }

    this.currentRecipeData = recipe;
    
    const rawImg = (recipe.image_url || '').trim().toLowerCase();
    const bgImage = (rawImg.length > 5 && rawImg.startsWith('http')) ? recipe.image_url.trim() : 'https://placehold.co/1200x400/eeeeee/999999?text=No+Image';
    document.getElementById('detailImageBanner').style.backgroundImage = `url('${bgImage}')`;

    document.getElementById('detailTitle').textContent = recipe.name;
    document.getElementById('detailCategory').textContent = recipe.category || "UNCLASSIFIED";
    document.getElementById('detailPrep').textContent = recipe.prep_time || 0;
    document.getElementById('detailCook').textContent = recipe.cook_time || 0;
    document.getElementById('detailTime').textContent = (recipe.prep_time || 0) + (recipe.cook_time || 0);
    document.getElementById('detailProcedure').innerHTML = this.formatProcedure(recipe.procedure);
    
    // Author Setup
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
          return `<li style="list-style: none; color: var(--pop-orange); font-weight: 900; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; border-bottom: 2px solid var(--border-color);">${trimmed.slice(1, -1)}</li>`;
        }
        
        const match = trimmed.match(/^([\d.]+)\s*([a-zA-Z]+)?\s+(.*)$/);
        
        if (match) {
          const originalQty = parseFloat(match[1]);
          const scaledQty = +(originalQty * ratio).toFixed(2);
          const unit = match[2] ? match[2].trim() : '';
          const name = match[3].trim();

          let unitCost = 0;
          if (recipe.recipe_ingredients) {
            const mapItem = recipe.recipe_ingredients.find(m => m.ingredients.name.toLowerCase() === name.toLowerCase());
            if (mapItem) unitCost = parseFloat(mapItem.ingredients.cost_per_unit || 0);
          }
          const lineCost = (scaledQty * unitCost).toFixed(2);
          
          return `<li style="display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px dashed var(--border-color);">
                    <div style="display: flex; gap: 15px; flex: 1;">
                      <span style="color: var(--accent-cyan); font-weight: 900; font-size: 1.05rem; min-width: 80px; text-align: right;">${scaledQty} ${unit}</span>
                      <span style="font-weight: 600; color: var(--text-dark);">${name}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--text-gray); font-size: 0.9rem; min-width: 70px; text-align: right;">₱${lineCost}</span>
                  </li>`;
        }
        return `<li style="padding: 10px 0;">${trimmed}</li>`;
      }).join('');
    }
    document.getElementById('detailIngredients').innerHTML = ingredientsHTML || '<li>No ingredients specified.</li>';
  },

  shareRecipe: function() {
    if (!this.currentOpenRecipeId) return;
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?recipe=${this.currentOpenRecipeId}`;
    navigator.clipboard.writeText(shareUrl).then(() => alert("Link copied to clipboard!")).catch(() => alert("Failed to copy link."));
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
      reviewsList.innerHTML = '<div style="color: var(--text-gray); font-style: italic;">No reviews yet. Be the first!</div>';
      return;
    }

    reviewsList.innerHTML = reviews.map(rev => {
      const stars = '⭐'.repeat(rev.rating);
      return `
        <div class="review-card">
          <div class="review-header">
            <span style="color: var(--accent-cyan);">${rev.author_name}</span>
            <span class="star-rating">${stars}</span>
          </div>
          <div style="font-size: 0.95rem; line-height: 1.5;">${rev.comment || ''}</div>
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
    }
  },

  openEditor: function(recipeObj = null) {
    if (!this.currentUser) return alert("You must be logged in to create a recipe.");

    const title = document.getElementById('editorTitle');
    this.editIngredientsList = [];
    
    if (recipeObj) {
      title.textContent = "EDIT RECIPE";
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
      title.textContent = "NEW RECIPE";
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
      row.style.gap = '10px';
      row.style.alignItems = 'center';
      row.style.background = 'var(--bg-white)';
      row.style.padding = '5px';
      row.style.borderRadius = '8px';

      if (item.type === 'divider') {
        row.innerHTML = `
          <input type="text" value="${item.name}" oninput="app.editIngredientsList[${index}].name = this.value" placeholder="Section Name (e.g. Marinade)" style="flex: 1; padding: 10px; border: 2px solid var(--pop-orange); color: var(--pop-orange); font-weight: 900; outline: none; border-radius: 4px; text-transform: uppercase;">
          <button class="btn-secondary" onclick="app.removeEditorIngredient(${index})" style="padding: 10px 15px; color: red; border-color: red; font-weight: 900;">X</button>
        `;
      } else {
        row.innerHTML = `
          <input type="number" value="${item.qty}" oninput="app.editIngredientsList[${index}].qty = parseFloat(this.value) || 0" style="width: 80px; padding: 10px; border: 2px solid var(--border-color); outline: none; border-radius: 4px;" step="any">
          <span style="width: 50px; text-align: center; font-weight: 900; color: var(--accent-cyan);">${item.unit}</span>
          <input list="ingredientDatalist" value="${item.name}" onchange="app.updateEditorIngredientUnit(${index}, this.value)" oninput="app.editIngredientsList[${index}].name = this.value" placeholder="Type ingredient..." style="flex: 1; padding: 10px; border: 2px solid var(--border-color); outline: none; border-radius: 4px;">
          <button class="btn-secondary" onclick="app.removeEditorIngredient(${index})" style="padding: 10px 15px; color: red; border-color: red; font-weight: 900;">X</button>
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
      delBtn.className = 'btn-secondary';
      delBtn.style.borderColor = 'red';
      delBtn.style.color = 'red';
      delBtn.textContent = 'DELETE RECIPE';
      document.querySelector('.editor-actions').prepend(delBtn);
    }
    delBtn.style.display = 'inline-block';
    delBtn.onclick = () => this.deleteRecipe(recipeId);
  },

  saveRecipe: async function() {
    const idInput = document.getElementById('editId').value;
    const saveBtn = document.querySelector('.editor-actions .btn-primary');
    saveBtn.textContent = "SAVING...";
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

      // Re-fetch all recipes to ensure Dashboard and Home get the new data
      await this.fetchRecipes();

      saveBtn.textContent = "SAVE RECIPE";
      saveBtn.disabled = false;
      this.openDetail(finalRecipeId);

    } catch (err) {
      console.error("Save Error:", err);
      alert("Failed to save recipe. Check console.");
      saveBtn.textContent = "SAVE RECIPE";
      saveBtn.disabled = false;
    }
  },

  deleteRecipe: async function(id) {
    if (confirm("Are you sure you want to delete this recipe? This cannot be undone.")) {
      const { error } = await client.from('recipes').delete().eq('id', id);
      if (!error) {
        await this.fetchRecipes();
        this.showView('view-home');
      }
    }
  }
};

window.onload = () => app.init();