/**
 * Personal Inventory System
 * Handles isolated fetching, caching, manual entry, table sorting/filtering, and Quick Add logic for the user's pantry.
 */

const InventoryApp = {
  
  userInventory: [],
  sortColumn: 'name',
  sortDesc: false,
  searchQuery: '',

  fetchUserInventory: async function() {
    if (!app.currentUser) {
      this.userInventory = [];
      this.renderInventoryList();
      return;
    }
    const { data, error } = await client.from('user_inventory').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      this.userInventory = data;
      this.renderInventoryList();
    }
  },

  autoFillInventoryUnit: function(name) {
    const found = app.ingredientsRegistry.find(i => i.name.toLowerCase() === name.trim().toLowerCase());
    if (found && found.unit) {
      app.selectDropdown('invUnit', found.unit, found.unit);
    }
  },

  searchInventory: function(query) {
    this.searchQuery = query.toLowerCase();
    this.renderInventoryList();
  },

  sortInventory: function(columnName) {
    if (this.sortColumn === columnName) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortColumn = columnName;
      this.sortDesc = false;
    }
    this.renderInventoryList();
  },

  // Handles adding manually from the form (Upsert logic preserves amounts)
  addInventoryItem: async function() {
    if (!app.currentUser) return app.customAlert("Login Required", "You must be logged in to save your inventory.");
    
    const name = document.getElementById('invName').value.trim();
    const qtyInput = document.getElementById('invQty').value;
    const qty = qtyInput !== '' ? parseFloat(qtyInput) : null;
    const unit = document.getElementById('invUnit').value;

    if (!name) return app.customAlert("Missing Info", "Please enter an ingredient name.");

    app.playSound('pop');

    // 1. Check if the item already exists in inventory
    const existingIndex = this.userInventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase());

    if (existingIndex > -1) {
      // It exists: UPDATE it
      const existingItem = this.userInventory[existingIndex];
      
      // If user left qty blank, keep the old one. If they supplied a new one, overwrite.
      const newQty = qty !== null ? qty : existingItem.qty;
      const newUnit = unit !== '-' ? unit : existingItem.unit;

      existingItem.qty = newQty;
      existingItem.unit = newUnit;

      // Bump to the top of the array
      this.userInventory.splice(existingIndex, 1);
      this.userInventory.unshift(existingItem);
      
      this.renderInventoryList();

      document.getElementById('invName').value = '';
      document.getElementById('invQty').value = '';
      app.selectDropdown('invUnit', '-', '-');

      if (!existingItem.id.toString().startsWith('temp-')) {
        await client.from('user_inventory').update({ qty: newQty, unit: newUnit }).eq('id', existingItem.id);
      }
    } else {
      // It's new: INSERT it
      const tempId = 'temp-' + Date.now();
      this.userInventory.unshift({ id: tempId, name, qty, unit });
      this.renderInventoryList();

      document.getElementById('invName').value = '';
      document.getElementById('invQty').value = '';
      app.selectDropdown('invUnit', '-', '-');

      const { data, error } = await client.from('user_inventory')
        .insert({ user_id: app.currentUser.id, name, qty, unit })
        .select().single();

      if (data) {
        const index = this.userInventory.findIndex(i => i.id === tempId);
        if (index > -1) this.userInventory[index].id = data.id;
      } else if (error) {
         app.showToast("Failed to sync inventory to cloud.");
      }
    }
  },

  // Handles clicking a capsule in the Quick Add board
  toggleQuickAddItem: async function(name) {
    if (!app.currentUser) return app.customAlert("Login Required", "You must be logged in to save your inventory.");
    
    app.playSound('pop');
    const existing = this.userInventory.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (existing) {
       // If it's already there, clicking the capsule removes it
       this.removeInventoryItem(existing.id);
    } else {
       // If it's not there, add it purely as a toggle (no amount)
       const foundReg = app.ingredientsRegistry.find(i => i.name.toLowerCase() === name.toLowerCase());
       const unit = foundReg && foundReg.unit ? foundReg.unit : '-';
       
       const tempId = 'temp-' + Date.now();
       this.userInventory.unshift({ id: tempId, name: name, qty: null, unit: unit });
       this.renderInventoryList();

       const { data } = await client.from('user_inventory')
         .insert({ user_id: app.currentUser.id, name: name, qty: null, unit: unit })
         .select().single();

       if (data) {
         const index = this.userInventory.findIndex(i => i.id === tempId);
         if (index > -1) this.userInventory[index].id = data.id;
       }
    }
  },

  removeInventoryItem: async function(id) {
    app.playSound('pop');
    this.userInventory = this.userInventory.filter(item => item.id !== id);
    this.renderInventoryList();

    if (!id.toString().startsWith('temp-')) {
      await client.from('user_inventory').delete().eq('id', id);
    }
  },

  updateInventoryItem: function(id, field, value) {
    const item = this.userInventory.find(i => i.id === id);
    if (!item) return;

    if (field === 'qty') {
      item.qty = value === '' ? null : parseFloat(value);
    } else if (field === 'unit') {
      item.unit = value === '' ? '-' : value;
    }

    // Sync to Supabase in the background if it's not a pending local-only item
    if (app.currentUser && !id.toString().startsWith('temp-')) {
      const updateData = {};
      updateData[field] = item[field];
      client.from('user_inventory').update(updateData).eq('id', id).then();
    }
  },

  renderInventoryList: function() {
    const container = document.getElementById('inventoryListContainer');
    if (!container) return;

    // 1. Map local inventory to the global registry to get icons and categories
    let displayList = this.userInventory.map(item => {
      const regItem = app.ingredientsRegistry.find(i => i.name.toLowerCase() === item.name.toLowerCase()) || {};
      return {
        ...item,
        category: regItem.category || 'Other',
        subcategory: regItem.subcategory || '',
        notes: regItem.notes || ''
      };
    });

    // 2. Filter by search query
    if (this.searchQuery) {
      displayList = displayList.filter(item => item.name.toLowerCase().includes(this.searchQuery));
    }

    // 3. Sort by headers
    if (this.sortColumn) {
      displayList.sort((a, b) => {
        let valA = a[this.sortColumn] || '';
        let valB = b[this.sortColumn] || '';
        if (this.sortColumn === 'qty') {
           valA = a.qty || 0;
           valB = b.qty || 0;
        } else {
           valA = valA.toString().toLowerCase();
           valB = valB.toString().toLowerCase();
        }
        if (valA < valB) return this.sortDesc ? 1 : -1;
        if (valA > valB) return this.sortDesc ? -1 : 1;
        return 0;
      });
    }

    // Update Header Sort Icons
    ['name', 'category', 'qty'].forEach(col => {
      const iconSpan = document.getElementById(`invSortIcon-${col}`);
      if (iconSpan) iconSpan.textContent = this.sortColumn === col ? (this.sortDesc ? '▼' : '▲') : '';
    });

    if (displayList.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-gray); font-weight: 800; padding: 30px;">No matching ingredients found.</td></tr>`;
    } else {
      container.innerHTML = displayList.map(item => {
        const catIcon = app.getCategoryIcon(item.category);

        return `
          <tr style="border-bottom: 2px solid #f1f5f9; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
            <td style="padding: 15px; font-size: 1.5rem; text-align: center;" title="${item.category}">${catIcon}</td>
            <td style="padding: 15px; min-width: 160px;">
              <div style="font-weight: 800; color: var(--text-dark); font-size: 1.05rem;">${item.name}</div>
              <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600; margin-top: 4px;">${item.notes || 'No notes'}</div>
            </td>
            <td style="padding: 15px; min-width: 140px;">
              <div style="font-weight: 800; color: var(--text-gray); font-size: 0.95rem;">${item.category}</div>
              <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-top: 2px;">${item.subcategory || ''}</div>
            </td>
            <td style="padding: 15px; white-space: nowrap;">
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="number" value="${item.qty !== null ? item.qty : ''}" placeholder="-" step="any" onchange="InventoryApp.updateInventoryItem('${item.id}', 'qty', this.value)" style="width: 70px; padding: 8px 12px; font-size: 0.9rem; text-align: center;">
                <input type="text" value="${item.unit !== '-' ? item.unit : ''}" placeholder="Unit" onchange="InventoryApp.updateInventoryItem('${item.id}', 'unit', this.value)" style="width: 70px; padding: 8px 12px; font-size: 0.9rem; text-align: center;">
              </div>
            </td>
            <td style="padding: 15px; text-align: right;">
              <button class="btn-danger" style="padding: 8px 14px; font-size: 0.8rem;" onclick="InventoryApp.removeInventoryItem('${item.id}')">X</button>
            </td>
          </tr>
        `;
      }).join('');
    }
    
    // Always trigger Quick Add render so capsules reflect the new active states
    this.renderQuickAdd();
  },

  // Generates the Alphabetical Quick Add capsules grouped by Category
  renderQuickAdd: function() {
    const container = document.getElementById('inventoryQuickAddContainer');
    if (!container) return;

    // Group the global registry by category
    const grouped = {};
    app.ingredientsRegistry.forEach(ing => {
      const cat = ing.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ing.name);
    });

    let html = `
      <h3 style="color: var(--accent-cyan); font-size: 1.3rem; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
        <svg class="icon" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg> Quick Add
      </h3>
    `;

    for (const [cat, items] of Object.entries(grouped)) {
      items.sort((a,b) => a.localeCompare(b));
      
      html += `
        <div style="background: white; border: 2px solid var(--border-color); border-radius: 16px; padding: 15px; margin-bottom: 15px; box-shadow: 0 4px 0 0 var(--border-color);">
          <h4 style="font-size: 0.95rem; color: var(--text-gray); text-transform: uppercase; margin-bottom: 10px; font-weight: 900;">${cat}</h4>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${items.map(name => {
              // Check if user already has it to apply active styling
              const existing = this.userInventory.find(i => i.name.toLowerCase() === name.toLowerCase());
              const isActive = existing ? 'active' : '';
              
              return `<button class="filter-btn ${isActive}" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 12px;" onclick="InventoryApp.toggleQuickAddItem('${name.replace(/'/g, "\\'")}')">${name}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  exportInventory: function() {
    if (this.userInventory.length === 0) return app.customAlert("Empty", "Nothing to export.");
    
    const exportData = this.userInventory.map(item => ({
      name: item.name,
      qty: item.qty,
      unit: item.unit
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "my_pantry_inventory.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    app.showToast("Inventory Exported!");
  },

  importInventory: async function(event) {
    const file = event.target.files[0];
    if (!file || !app.currentUser) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!Array.isArray(json)) throw new Error("File must be an array of ingredients.");

        app.playSound('success');
        app.showToast("Importing inventory... please wait.");

        const payloads = json.map(item => ({
          user_id: app.currentUser.id,
          name: item.name,
          qty: item.qty !== undefined ? item.qty : null,
          unit: item.unit || '-'
        })).filter(p => p.name); 

        const { data, error } = await client.from('user_inventory').insert(payloads).select();
        if (error) throw error;

        if (data) {
          this.userInventory = [...data, ...this.userInventory];
          this.renderInventoryList(); 
          app.showToast(`Imported ${data.length} items successfully!`);
        }
      } catch (err) {
        app.customAlert("Import Error", "Failed to parse inventory file. Ensure it is a valid JSON array.");
        console.error(err);
      }
      event.target.value = ""; 
    };
    reader.readAsText(file);
  }
};