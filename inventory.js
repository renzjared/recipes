/**
 * Personal Inventory System
 * Handles isolated fetching, caching, and editing of user-specific inventory.
 */

const InventoryApp = {
  
  userInventory: [],

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

  addInventoryItem: async function() {
    if (!app.currentUser) return app.customAlert("Login Required", "You must be logged in to save your inventory.");
    
    const name = document.getElementById('invName').value.trim();
    const qtyInput = document.getElementById('invQty').value;
    const qty = qtyInput !== '' ? parseFloat(qtyInput) : null;
    const unit = document.getElementById('invUnit').value;

    if (!name) return app.customAlert("Missing Info", "Please enter an ingredient name.");

    app.playSound('pop');

    // Optimistic UI Update
    const tempId = 'temp-' + Date.now();
    this.userInventory.unshift({ id: tempId, name, qty, unit });
    this.renderInventoryList();

    // Reset Inputs
    document.getElementById('invName').value = '';
    document.getElementById('invQty').value = '';
    app.selectDropdown('invUnit', '-', '-');

    // Background Sync
    const { data, error } = await client.from('user_inventory')
      .insert({ user_id: app.currentUser.id, name, qty, unit })
      .select().single();

    if (data) {
      const index = this.userInventory.findIndex(i => i.id === tempId);
      if (index > -1) this.userInventory[index].id = data.id;
    } else if (error) {
       app.showToast("Failed to sync inventory to cloud.");
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

  renderInventoryList: function() {
    const container = document.getElementById('inventoryListContainer');
    if (!container) return;

    if (this.userInventory.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-gray); font-weight: 800; padding: 20px;">Your pantry is empty. Add ingredients above!</div>`;
      return;
    }

    container.innerHTML = this.userInventory.map(item => {
      const displayQty = item.qty !== null ? `${item.qty} ${item.unit !== '-' ? item.unit : ''}` : '<span style="color: var(--text-gray); font-size: 0.85rem;">Amount not specified</span>';
      
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 20px; border-radius: 16px; border: 2px solid var(--border-color); box-shadow: 0 4px 0 0 var(--border-color);">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-weight: 900; color: var(--text-dark); font-size: 1.1rem;">${item.name}</span>
            <span style="font-weight: 800; color: var(--accent-cyan); background: var(--cyan-light); padding: 4px 10px; border-radius: 8px; font-size: 0.9rem;">${displayQty}</span>
          </div>
          <button class="btn-danger" style="padding: 6px 12px; font-size: 0.8rem;" onclick="InventoryApp.removeInventoryItem('${item.id}')">X</button>
        </div>
      `;
    }).join('');
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