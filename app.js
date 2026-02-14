// Default point costs (can be customized)
const DEFAULT_COSTS = {
    move: 0,
    fight: 0,
    shoot: 0,
    defense: 0,
    health: 0,
    bravery: 0,
    powerlevel: 0
};

// Factions (dropdown options for fighter builder)
const FACTIONS = ['Eshin', 'Mercenaries', 'Hired Swords', 'Undead', 'Sisters', 'Possessed'];

// Faction options for filter multi-select (value = stored in profile, label = display)
const FACTION_FILTER_OPTIONS = [
    { value: 'Eshin', label: 'Clan Eshin' },
    { value: 'Mercenaries', label: 'Mercenaries' },
    { value: 'Undead', label: 'Undead' },
    { value: 'Witch Hunters', label: 'Witch Hunters' },
    { value: 'Sisters', label: 'Sisters of Sigmar' },
    { value: 'Possessed', label: 'Possessed' },
    { value: 'Hired Sword', label: 'Hired Sword' }
];

// Basic fighter stats
const BASIC_FIGHTER = {
    name: 'Basic Fighter',
    faction: FACTIONS[0],
    move: 5,
    fight: 3,
    shoot: 3,
    defense: 3,
    health: 8,
    bravery: 5,
    powerLevel: 0,
    baseCost: 20
};

// Current editing state
let currentProfile = { ...BASIC_FIGHTER };
let editingProfileId = null;
let builderDirty = false;

// Initialize the app
function init() {
    loadCostProfiles();
    initFactionFilter();
    loadProfiles();
    setupEventListeners();
    applyTheme(localStorage.getItem('wyrdcry-theme') || 'light');
    updatePointsDisplay();
    resetProfile();
}

function initFactionFilter() {
    const optionsEl = document.getElementById('faction-filter-options');
    const triggerEl = document.getElementById('faction-filter-trigger');
    const panelEl = document.getElementById('faction-filter-panel');
    if (!optionsEl || !triggerEl || !panelEl) return;

    optionsEl.innerHTML = FACTION_FILTER_OPTIONS.map(f => `
        <label class="faction-multiselect-option">
            <input type="checkbox" class="faction-filter-checkbox" value="${escapeHtml(f.value)}">
            <span>${escapeHtml(f.label)}</span>
        </label>
    `).join('');

    triggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyOpen = panelEl.getAttribute('aria-hidden') === 'false';
        const newOpen = !currentlyOpen;
        panelEl.setAttribute('aria-hidden', newOpen ? 'false' : 'true');
        triggerEl.setAttribute('aria-expanded', newOpen);
    });

    optionsEl.addEventListener('change', () => {
        updateFactionFilterTriggerLabel();
        loadProfiles();
    });

    document.addEventListener('click', (e) => {
        const multiselect = document.getElementById('faction-multiselect');
        if (multiselect && !multiselect.contains(e.target)) {
            panelEl.setAttribute('aria-hidden', 'true');
            triggerEl.setAttribute('aria-expanded', 'false');
        }
    });
}

function getSelectedFactionValues() {
    const boxes = document.querySelectorAll('.faction-filter-checkbox:checked');
    return Array.from(boxes).map(el => el.value);
}

function updateFactionFilterTriggerLabel() {
    const trigger = document.getElementById('faction-filter-trigger');
    if (!trigger) return;
    const selected = getSelectedFactionValues();
    if (selected.length === 0) {
        trigger.textContent = 'All Factions';
    } else if (selected.length === FACTION_FILTER_OPTIONS.length) {
        trigger.textContent = 'All Factions';
    } else {
        const labels = selected.map(v => FACTION_FILTER_OPTIONS.find(f => f.value === v)?.label || v);
        trigger.textContent = labels.length <= 2 ? labels.join(', ') : labels.length + ' factions';
    }
}

function getTheme() {
    return document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') || 'light';
}

function applyTheme(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('wyrdcry-theme', theme);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}


const COST_KEYS = ['move', 'fight', 'shoot', 'defense', 'health', 'bravery', 'powerlevel'];
const COST_PROFILES_KEY = 'costProfiles';
const ACTIVE_COST_PROFILE_KEY = 'activeCostProfileId';

function getCostProfiles() {
    const raw = localStorage.getItem(COST_PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
}

function setCostProfiles(profiles) {
    localStorage.setItem(COST_PROFILES_KEY, JSON.stringify(profiles));
}

function getActiveCostProfileId() {
    return localStorage.getItem(ACTIVE_COST_PROFILE_KEY);
}

function setActiveCostProfileId(id) {
    if (id != null) localStorage.setItem(ACTIVE_COST_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_COST_PROFILE_KEY);
}

function migrateToCostProfiles() {
    let profiles = getCostProfiles();
    if (profiles.length === 0) {
        const old = localStorage.getItem('pointCosts');
        if (old) {
            const costs = JSON.parse(old);
            profiles = [{ id: 'default-' + Date.now(), name: 'Default', costs, baseCost: 20 }];
            setCostProfiles(profiles);
            setActiveCostProfileId(profiles[0].id);
        }
    }
    profiles = getCostProfiles();
    const updated = profiles.map(p => ({ ...p, baseCost: p.baseCost != null ? p.baseCost : 20 }));
    if (updated.length) setCostProfiles(updated);
}

function getActiveBaseCost() {
    const activeId = getActiveCostProfileId();
    const profiles = getCostProfiles();
    const active = profiles.find(p => p.id === activeId);
    if (active && active.baseCost != null) return Number(active.baseCost);
    const input = document.getElementById('cost-profile-base');
    if (input) return Math.max(0, parseInt(input.value, 10) || 20);
    return 20;
}

function loadCostProfiles() {
    migrateToCostProfiles();
    const profiles = getCostProfiles();
    const activeId = getActiveCostProfileId();
    const active = profiles.find(p => p.id === activeId);
    if (active) {
        COST_KEYS.forEach(key => {
            const input = document.getElementById(`cost-${key}`);
            if (input && active.costs[key] != null) input.value = active.costs[key];
        });
        const nameEl = document.getElementById('cost-profile-name');
        if (nameEl) nameEl.value = active.name || '';
        const baseEl = document.getElementById('cost-profile-base');
        if (baseEl) baseEl.value = active.baseCost != null ? active.baseCost : 20;
    } else {
        COST_KEYS.forEach(key => {
            const input = document.getElementById(`cost-${key}`);
            if (input) input.value = DEFAULT_COSTS[key] != null ? DEFAULT_COSTS[key] : 0;
        });
        const nameEl = document.getElementById('cost-profile-name');
        if (nameEl) nameEl.value = '';
        const baseEl = document.getElementById('cost-profile-base');
        if (baseEl) baseEl.value = 20;
    }
    loadCostProfilesDropdown();
    updatePointsDisplay();
    updateAllProfilesDisplay();
}

function loadCostProfilesDropdown() {
    const select = document.getElementById('cost-profile-select');
    if (!select) return;
    const profiles = getCostProfiles();
    const activeId = getActiveCostProfileId();
    select.innerHTML = '<option value="__add__">— Add new profile —</option>' +
        profiles.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name || 'Unnamed') + '</option>').join('');
    select.value = activeId && profiles.some(p => p.id === activeId) ? activeId : '__add__';
}

function selectCostProfile(profileId) {
    if (profileId === '__add__' || !profileId) {
        setActiveCostProfileId(null);
        COST_KEYS.forEach(key => {
            const input = document.getElementById(`cost-${key}`);
            if (input) input.value = DEFAULT_COSTS[key] != null ? DEFAULT_COSTS[key] : 0;
        });
        document.getElementById('cost-profile-name').value = '';
        const baseEl = document.getElementById('cost-profile-base');
        if (baseEl) baseEl.value = 20;
    } else {
        setActiveCostProfileId(profileId);
        const profiles = getCostProfiles();
        const p = profiles.find(x => x.id === profileId);
        if (p) {
            COST_KEYS.forEach(key => {
                const input = document.getElementById(`cost-${key}`);
                if (input && p.costs[key] != null) input.value = p.costs[key];
            });
            document.getElementById('cost-profile-name').value = p.name || '';
            const baseEl = document.getElementById('cost-profile-base');
            if (baseEl) baseEl.value = p.baseCost != null ? p.baseCost : 20;
        }
    }
    updatePointsDisplay();
    updateAllProfilesDisplay();
}

function saveCostProfile() {
    const name = (document.getElementById('cost-profile-name').value || '').trim() || 'Unnamed';
    const costs = getCosts();
    const baseCostInput = document.getElementById('cost-profile-base');
    const baseCost = baseCostInput ? Math.max(0, parseInt(baseCostInput.value, 10) || 20) : 20;
    let profiles = getCostProfiles();
    const activeId = getActiveCostProfileId();
    if (activeId && profiles.some(p => p.id === activeId)) {
        const idx = profiles.findIndex(p => p.id === activeId);
        profiles[idx] = { ...profiles[idx], name, costs, baseCost };
    } else {
        const newProfile = { id: 'profile-' + Date.now(), name, costs, baseCost };
        profiles = [...profiles, newProfile];
        setActiveCostProfileId(newProfile.id);
    }
    setCostProfiles(profiles);
    loadCostProfiles();
}

// Export cost profiles as CSV
function downloadCostProfilesCsv() {
    const profiles = getCostProfiles();
    if (profiles.length === 0) {
        alert('No cost profiles to export. Create and save a cost profile first.');
        return;
    }
    const headers = ['name', 'baseCost', 'move', 'fight', 'shoot', 'defense', 'health', 'bravery', 'powerlevel'];
    const rows = profiles.map(p => [
        p.name || 'Unnamed',
        p.baseCost != null ? p.baseCost : 20,
        p.costs?.move ?? 0,
        p.costs?.fight ?? 0,
        p.costs?.shoot ?? 0,
        p.costs?.defense ?? 0,
        p.costs?.health ?? 0,
        p.costs?.bravery ?? 0,
        p.costs?.powerlevel ?? 0
    ]);
    const csvContent = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost_profiles.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Import cost profiles from CSV
function importCostProfilesFromCsv(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            alert('CSV must have a header row and at least one cost profile.');
            return;
        }
        const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
        const nameIdx = header.findIndex(h => h === 'name');
        const baseIdx = header.findIndex(h => h === 'basecost');
        const moveIdx = header.findIndex(h => h === 'move');
        const fightIdx = header.findIndex(h => h === 'fight');
        const shootIdx = header.findIndex(h => h === 'shoot');
        const defenseIdx = header.findIndex(h => h === 'defense');
        const healthIdx = header.findIndex(h => h === 'health');
        const braveryIdx = header.findIndex(h => h === 'bravery');
        const plIdx = header.findIndex(h => h === 'powerlevel');
        if (nameIdx === -1 || moveIdx === -1) {
            alert('CSV must include at least "name" and "move" columns.');
            return;
        }
        const imported = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = parseCsvLine(lines[i]);
            const get = (idx) => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');
            imported.push({
                id: 'profile-' + Date.now() + '-' + i,
                name: get(nameIdx) || 'Unnamed',
                baseCost: baseIdx >= 0 ? Math.max(0, parseInt(get(baseIdx), 10) || 20) : 20,
                costs: {
                    move: parseFloat(get(moveIdx)) || 0,
                    fight: parseFloat(get(fightIdx)) || 0,
                    shoot: parseFloat(get(shootIdx)) || 0,
                    defense: parseFloat(get(defenseIdx)) || 0,
                    health: parseFloat(get(healthIdx)) || 0,
                    bravery: parseFloat(get(braveryIdx)) || 0,
                    powerlevel: parseFloat(get(plIdx)) || 0
                }
            });
        }
        const existing = getCostProfiles();
        const merged = [...existing, ...imported];
        setCostProfiles(merged);
        if (imported.length > 0) {
            setActiveCostProfileId(imported[0].id);
        }
        loadCostProfiles();
        document.getElementById('import-cost-profiles-input').value = '';
    };
    reader.readAsText(file, 'UTF-8');
}

function deleteCostProfile() {
    const activeId = getActiveCostProfileId();
    if (!activeId) {
        return;
    }
    let profiles = getCostProfiles();
    if (!confirm('Delete this cost profile? This cannot be undone.')) {
        return;
    }
    if (profiles.length <= 1) {
        if (profiles.length === 1) {
            setCostProfiles([]);
            setActiveCostProfileId(null);
            loadCostProfiles();
        }
        return;
    }
    profiles = profiles.filter(p => p.id !== activeId);
    const nextId = profiles[0].id;
    setActiveCostProfileId(nextId);
    setCostProfiles(profiles);
    loadCostProfiles();
}

// Get current point costs
function getCosts() {
    return {
        move: parseFloat(document.getElementById('cost-move').value) || 0,
        fight: parseFloat(document.getElementById('cost-fight').value) || 0,
        shoot: parseFloat(document.getElementById('cost-shoot').value) || 0,
        defense: parseFloat(document.getElementById('cost-defense').value) || 0,
        health: parseFloat(document.getElementById('cost-health').value) || 0,
        bravery: parseFloat(document.getElementById('cost-bravery').value) || 0,
        powerlevel: parseFloat(document.getElementById('cost-powerlevel').value) || 0
    };
}

// Persist cost profile inputs to localStorage immediately (when an active profile is selected)
function persistCostProfileInputs() {
    const activeId = getActiveCostProfileId();
    if (!activeId) return;
    const profiles = getCostProfiles();
    const idx = profiles.findIndex(p => p.id === activeId);
    if (idx < 0) return;
    const costs = getCosts();
    const baseCostInput = document.getElementById('cost-profile-base');
    const baseCost = baseCostInput ? Math.max(0, parseInt(baseCostInput.value, 10) || 20) : 20;
    const name = (document.getElementById('cost-profile-name').value || '').trim() || profiles[idx].name || 'Unnamed';
    profiles[idx] = { ...profiles[idx], name, costs, baseCost };
    setCostProfiles(profiles);
}

// Calculate points for a fighter profile (base cost from active cost profile)
function calculatePoints(profile) {
    const costs = getCosts();
    const baseCost = getActiveBaseCost();
    
    // Calculate costs relative to basic fighter
    const moveDiff = profile.move - BASIC_FIGHTER.move;
    const fightDiff = profile.fight - BASIC_FIGHTER.fight;
    const shootDiff = profile.shoot - BASIC_FIGHTER.shoot;
    const defenseDiff = profile.defense - BASIC_FIGHTER.defense;
    const healthDiff = profile.health - BASIC_FIGHTER.health;
    const braveryDiff = BASIC_FIGHTER.bravery - profile.bravery; // Lower is better, so reverse
    
    const moveCost = moveDiff * costs.move;
    const fightCost = fightDiff * costs.fight;
    const shootCost = shootDiff * costs.shoot;
    const defenseCost = defenseDiff * costs.defense;
    const healthCost = healthDiff * costs.health;
    const braveryCost = braveryDiff * costs.bravery;
    
    const powerLevel = profile.powerLevel ?? profile.specialTier ?? 0;
    const powerLevelCost = powerLevel * costs.powerlevel;
    
    const total = baseCost + moveCost + fightCost + shootCost + defenseCost + healthCost + braveryCost + powerLevelCost;
    
    return {
        baseCost,
        moveCost,
        fightCost,
        shootCost,
        defenseCost,
        healthCost,
        braveryCost,
        powerLevelCost,
        total: Math.max(0, total) // Ensure non-negative
    };
}

function formatGold(n) {
    return Math.round(n) + 'gc';
}

// Update points display (spans show number only; HTML has "gc" after)
function updatePointsDisplay() {
    const points = calculatePoints(currentProfile);
    
    document.getElementById('base-cost').textContent = Math.round(points.baseCost);
    document.getElementById('move-cost').textContent = Math.round(points.moveCost);
    document.getElementById('fight-cost').textContent = Math.round(points.fightCost);
    document.getElementById('shoot-cost').textContent = Math.round(points.shootCost);
    document.getElementById('defense-cost').textContent = Math.round(points.defenseCost);
    document.getElementById('health-cost').textContent = Math.round(points.healthCost);
    document.getElementById('bravery-cost').textContent = Math.round(points.braveryCost);
    document.getElementById('powerlevel-cost').textContent = Math.round(points.powerLevelCost);
    document.getElementById('total-cost').textContent = Math.round(points.total);
}

// Adjust characteristic value
function adjustChar(char, delta) {
    const input = document.getElementById(`char-${char}`);
    const currentValue = parseFloat(input.value) || 0;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || Infinity;
    const step = parseFloat(input.step) || 1;
    
    let newValue = currentValue + (delta * step);
    newValue = Math.max(min, Math.min(max, newValue));
    if (char === 'move') newValue = Math.round(newValue);
    
    input.value = newValue;
    currentProfile[char] = char === 'move' ? Math.round(newValue) : newValue;
    builderDirty = true;
    updateSaveButtonState();
    updatePointsDisplay();
    autoSave();
}

// Reset profile to basic fighter
function resetProfile() {
    currentProfile = { ...BASIC_FIGHTER };
    editingProfileId = null;
    builderDirty = false;
    updateSaveButtonState();

    document.getElementById('profile-name').value = '';
    document.getElementById('profile-faction').value = BASIC_FIGHTER.faction || FACTIONS[0];
    document.getElementById('char-move').value = BASIC_FIGHTER.move;
    document.getElementById('char-fight').value = BASIC_FIGHTER.fight;
    document.getElementById('char-shoot').value = BASIC_FIGHTER.shoot;
    document.getElementById('char-defense').value = BASIC_FIGHTER.defense;
    document.getElementById('char-health').value = BASIC_FIGHTER.health;
    document.getElementById('char-bravery').value = BASIC_FIGHTER.bravery;
    document.getElementById('char-powerlevel').value = BASIC_FIGHTER.powerLevel ?? 0;

    updatePointsDisplay();
}

function updateSaveButtonState() {
    const btn = document.getElementById('btn-save-fighter');
    if (btn) btn.disabled = !builderDirty;
}

// Build profile object from current form values
function getProfileFromForm() {
    const name = document.getElementById('profile-name').value.trim();
    return {
        id: editingProfileId || Date.now().toString(),
        name: name,
        faction: document.getElementById('profile-faction').value || FACTIONS[0],
        move: parseInt(document.getElementById('char-move').value, 10) || BASIC_FIGHTER.move,
        fight: parseInt(document.getElementById('char-fight').value, 10) || BASIC_FIGHTER.fight,
        shoot: parseInt(document.getElementById('char-shoot').value, 10) || BASIC_FIGHTER.shoot,
        defense: parseInt(document.getElementById('char-defense').value, 10) || BASIC_FIGHTER.defense,
        health: parseInt(document.getElementById('char-health').value, 10) || BASIC_FIGHTER.health,
        bravery: parseInt(document.getElementById('char-bravery').value, 10) || BASIC_FIGHTER.bravery,
        powerLevel: parseInt(document.getElementById('char-powerlevel').value, 10) || 0,
        baseCost: getActiveBaseCost()
    };
}

// Auto-save: persist current builder state without resetting the form
function autoSave() {
    const profile = getProfileFromForm();
    if (!profile.name) return;

    const profiles = getProfiles();
    let existingIndex = profiles.findIndex(p => p.id === profile.id);

    if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
    } else {
        profile.id = Date.now().toString();
        editingProfileId = profile.id;
        profiles.push(profile);
    }

    localStorage.setItem('fighterProfiles', JSON.stringify(profiles));
    loadProfiles();
}

// Save profile (manual save button: save then reset form for next fighter)
function saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    if (!name) {
        alert('Please enter a profile name');
        return;
    }
    autoSave();
    builderDirty = false;
    updateSaveButtonState();
    resetProfile();
}

// Get all profiles from localStorage
function getProfiles() {
    const saved = localStorage.getItem('fighterProfiles');
    return saved ? JSON.parse(saved) : [];
}

// Return currently filtered and sorted profiles (same logic as table)
function getFilteredAndSortedProfiles() {
    let profiles = getProfiles();
    const selectedFactions = getSelectedFactionValues();
    const sortBy = document.getElementById('sort-profiles')?.value || 'name-asc';
    if (selectedFactions.length > 0) {
        const set = new Set(selectedFactions);
        profiles = profiles.filter(p => set.has(p.faction || ''));
    }
    return [...profiles].sort((a, b) => {
        const costA = calculatePoints(a).total;
        const costB = calculatePoints(b).total;
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const factionA = (a.faction || '').toLowerCase();
        const factionB = (b.faction || '').toLowerCase();
        switch (sortBy) {
            case 'name-asc': return nameA.localeCompare(nameB);
            case 'name-desc': return nameB.localeCompare(nameA);
            case 'cost-asc': return costA - costB;
            case 'cost-desc': return costB - costA;
            case 'faction-asc': return factionA.localeCompare(factionB) || nameA.localeCompare(nameB);
            case 'faction-desc': return factionB.localeCompare(factionA) || nameA.localeCompare(nameB);
            default: return nameA.localeCompare(nameB);
        }
    });
}

// Load and display profiles (with filter and sort)
function loadProfiles() {
    const listElement = document.getElementById('profiles-list');
    const sorted = getFilteredAndSortedProfiles();

    if (sorted.length === 0) {
        listElement.innerHTML = '<p class="empty-message">No profiles saved yet. Create one in Fighter Builder!</p>';
        return;
    }

    listElement.innerHTML = `
        <table class="profiles-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Faction</th>
                    <th title="Move">M</th>
                    <th title="Fight">F</th>
                    <th title="Shoot">S</th>
                    <th title="Defense">D</th>
                    <th title="Health">H</th>
                    <th title="Bravery">Br</th>
                    <th title="Power Level">PL</th>
                    <th>Cost</th>
                    <th class="th-actions"></th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(profile => {
                    const points = calculatePoints(profile);
                    const factionDisplay = profile.faction ? escapeHtml(profile.faction) : '—';
                    const pl = profile.powerLevel ?? profile.specialTier ?? 0;
                    return `
                    <tr>
                        <td>${escapeHtml(profile.name)}</td>
                        <td>${factionDisplay}</td>
                        <td title="Move">${profile.move}"</td>
                        <td title="Fight">${profile.fight}</td>
                        <td title="Shoot">${profile.shoot}</td>
                        <td title="Defense">${profile.defense}</td>
                        <td title="Health">${profile.health}</td>
                        <td title="Bravery">${profile.bravery}+</td>
                        <td title="Power Level">${pl}</td>
                        <td class="td-cost">${formatGold(points.total)}</td>
                        <td class="td-actions">
                            <button class="btn-edit btn-table" onclick="editProfile('${profile.id}')">Edit</button>
                            <button class="btn-delete btn-table" onclick="deleteProfile('${profile.id}')">Delete</button>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Update all profiles display (when costs change)
function updateAllProfilesDisplay() {
    loadProfiles();
}

// Escape a value for CSV (quote if contains comma, newline, or quote)
function csvEscape(val) {
    const s = String(val == null ? '' : val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

// Export ALL fighters as CSV (ignores filter; uses current sort)
function downloadProfilesCsv() {
    const all = getProfiles();
    if (all.length === 0) {
        alert('No fighters to export. Add fighters first.');
        return;
    }
    const sortBy = document.getElementById('sort-profiles')?.value || 'name-asc';
    const sorted = [...all].sort((a, b) => {
        const costA = calculatePoints(a).total;
        const costB = calculatePoints(b).total;
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const factionA = (a.faction || '').toLowerCase();
        const factionB = (b.faction || '').toLowerCase();
        switch (sortBy) {
            case 'name-asc': return nameA.localeCompare(nameB);
            case 'name-desc': return nameB.localeCompare(nameA);
            case 'cost-asc': return costA - costB;
            case 'cost-desc': return costB - costA;
            case 'faction-asc': return factionA.localeCompare(factionB) || nameA.localeCompare(nameB);
            case 'faction-desc': return factionB.localeCompare(factionA) || nameA.localeCompare(nameB);
            default: return nameA.localeCompare(nameB);
        }
    });
    const headers = ['Name', 'Faction', 'Move', 'Fight', 'Shoot', 'Defense', 'Health', 'Bravery', 'Power Level', 'Cost (gc)'];
    const rows = sorted.map(p => {
        const cost = Math.round(calculatePoints(p).total);
        const pl = p.powerLevel ?? p.specialTier ?? '';
        return [p.name || '', p.faction || '', p.move, p.fight, p.shoot, p.defense, p.health, p.bravery + '+', pl, cost];
    });
    const csvContent = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getCsvExportFilename();
    a.click();
    URL.revokeObjectURL(url);
}

function getCsvExportFilename() {
    const activeId = getActiveCostProfileId();
    const profiles = getCostProfiles();
    const activeProfile = profiles.find(p => p.id === activeId);
    const profileName = (activeProfile && activeProfile.name) ? activeProfile.name : 'default';
    let profileSlug = profileName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'default';

    const selected = getSelectedFactionValues();
    let factionSlug = 'allfactions';
    if (selected.length > 0) {
        const slugs = selected.map(v => {
            const opt = FACTION_FILTER_OPTIONS.find(f => f.value === v);
            return (opt ? opt.label : v).toLowerCase().replace(/\s+/g, '');
        });
        factionSlug = slugs.join('_');
    }

    return profileSlug + '_' + factionSlug + '.csv';
}

// Parse a single CSV line (handles quoted fields)
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (inQuotes) {
            cur += c;
        } else if (c === ',') {
            out.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out;
}

// Import CSV and overwrite all fighters
function importProfilesFromCsv(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
            alert('CSV must have a header row and at least one data row.');
            return;
        }
        const header = parseCsvLine(lines[0]).map(h => h.trim());
        const nameIdx = header.findIndex(h => /name/i.test(h));
        const factionIdx = header.findIndex(h => /faction/i.test(h));
        const moveIdx = header.findIndex(h => /move/i.test(h));
        const fightIdx = header.findIndex(h => /fight/i.test(h));
        const shootIdx = header.findIndex(h => /shoot/i.test(h));
        const defenseIdx = header.findIndex(h => /defense/i.test(h));
        const healthIdx = header.findIndex(h => /health/i.test(h));
        const braveryIdx = header.findIndex(h => /bravery/i.test(h));
        const plIdx = header.findIndex(h => /power/i.test(h));
        if (nameIdx === -1 || moveIdx === -1) {
            alert('CSV must include at least Name and Move columns.');
            return;
        }
        const profiles = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = parseCsvLine(lines[i]);
            const get = (idx) => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');
            const braveryStr = get(braveryIdx).replace(/\+/g, '');
            const bravery = parseInt(braveryStr, 10);
            const powerLevel = plIdx >= 0 ? parseInt(get(plIdx), 10) : 0;
            profiles.push({
                id: Date.now().toString() + '-' + i,
                name: get(nameIdx) || 'Unnamed',
                faction: get(factionIdx) || FACTIONS[0],
                move: parseInt(get(moveIdx), 10) || BASIC_FIGHTER.move,
                fight: parseInt(get(fightIdx), 10) || BASIC_FIGHTER.fight,
                shoot: parseInt(get(shootIdx), 10) || BASIC_FIGHTER.shoot,
                defense: parseInt(get(defenseIdx), 10) || BASIC_FIGHTER.defense,
                health: parseInt(get(healthIdx), 10) || BASIC_FIGHTER.health,
                bravery: isNaN(bravery) ? BASIC_FIGHTER.bravery : bravery,
                powerLevel: isNaN(powerLevel) ? 0 : Math.max(-3, Math.min(3, powerLevel)),
                baseCost: BASIC_FIGHTER.baseCost
            });
        }
        if (!confirm('This will replace all current fighters with ' + profiles.length + ' from the file. Continue?')) {
            return;
        }
        localStorage.setItem('fighterProfiles', JSON.stringify(profiles));
        loadProfiles();
        document.getElementById('import-csv-input').value = '';
    };
    reader.readAsText(file, 'UTF-8');
}

// Edit profile
function editProfile(id) {
    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === id);
    
    if (!profile) return;
    
    editingProfileId = profile.id;
    currentProfile = { ...profile };
    
    document.getElementById('profile-name').value = profile.name;
    const factionSelect = document.getElementById('profile-faction');
    if (factionSelect) {
        factionSelect.value = (profile.faction && FACTIONS.includes(profile.faction)) ? profile.faction : FACTIONS[0];
    }
    document.getElementById('char-move').value = profile.move;
    document.getElementById('char-fight').value = profile.fight;
    document.getElementById('char-shoot').value = profile.shoot;
    document.getElementById('char-defense').value = profile.defense;
    document.getElementById('char-health').value = profile.health;
    document.getElementById('char-bravery').value = profile.bravery;
    const pl = profile.powerLevel ?? profile.specialTier ?? 0;
    document.getElementById('char-powerlevel').value = Math.max(-3, Math.min(3, pl));

    builderDirty = false;
    updateSaveButtonState();
    updatePointsDisplay();

    document.querySelector('.profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Delete profile
function deleteProfile(id) {
    if (!confirm('Are you sure you want to delete this profile?')) {
        return;
    }
    
    const profiles = getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    localStorage.setItem('fighterProfiles', JSON.stringify(filtered));
    loadProfiles();
}

// Setup event listeners
function setupEventListeners() {
    // Cost inputs: update display and persist immediately when active profile is selected
    COST_KEYS.forEach(key => {
        const input = document.getElementById(`cost-${key}`);
        if (input) {
            input.addEventListener('input', () => {
                persistCostProfileInputs();
                updatePointsDisplay();
                updateAllProfilesDisplay();
            });
        }
    });

    // Cost profile dropdown
    const costProfileSelect = document.getElementById('cost-profile-select');
    if (costProfileSelect) {
        costProfileSelect.addEventListener('change', () => selectCostProfile(costProfileSelect.value));
    }

    // Base fighter cost: same as other cost fields - persist immediately
    const costProfileBase = document.getElementById('cost-profile-base');
    if (costProfileBase) {
        costProfileBase.addEventListener('input', () => {
            persistCostProfileInputs();
            updatePointsDisplay();
            updateAllProfilesDisplay();
        });
    }
    
    // Profile name: sync currentProfile and auto-save
    const nameInput = document.getElementById('profile-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            currentProfile.name = nameInput.value.trim();
            builderDirty = true;
            updateSaveButtonState();
            autoSave();
        });
    }

    // Faction: sync and auto-save
    const factionSelect = document.getElementById('profile-faction');
    if (factionSelect) {
        factionSelect.addEventListener('change', () => {
            currentProfile.faction = factionSelect.value;
            builderDirty = true;
            updateSaveButtonState();
            autoSave();
        });
    }

    // Characteristic inputs
    ['move', 'fight', 'shoot', 'defense', 'health'].forEach(char => {
        const input = document.getElementById(`char-${char}`);
        if (input) {
            input.addEventListener('input', () => {
                const val = input.value;
                currentProfile[char] = char === 'move' ? parseInt(val, 10) : parseFloat(val);
                if (char === 'move') input.value = currentProfile[char];
                builderDirty = true;
                updateSaveButtonState();
                updatePointsDisplay();
                autoSave();
            });
        }
    });

    // Bravery select
    const braverySelect = document.getElementById('char-bravery');
    if (braverySelect) {
        braverySelect.addEventListener('change', () => {
            currentProfile.bravery = parseInt(braverySelect.value, 10);
            builderDirty = true;
            updateSaveButtonState();
            updatePointsDisplay();
            autoSave();
        });
    }

    // Power level select
    const powerlevelSelect = document.getElementById('char-powerlevel');
    if (powerlevelSelect) {
        powerlevelSelect.addEventListener('change', () => {
            currentProfile.powerLevel = parseInt(powerlevelSelect.value, 10) || 0;
            builderDirty = true;
            updateSaveButtonState();
            updatePointsDisplay();
            autoSave();
        });
    }

    // Sort for saved profiles (faction filter uses checkboxes, handled in initFactionFilter)
    const sortProfilesEl = document.getElementById('sort-profiles');
    if (sortProfilesEl) sortProfilesEl.addEventListener('change', loadProfiles);

    // Import CSV file input (fighters)
    const importInput = document.getElementById('import-csv-input');
    if (importInput) {
        importInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (file) importProfilesFromCsv(file);
        });
    }

    // Import cost profiles CSV
    const importCostInput = document.getElementById('import-cost-profiles-input');
    if (importCostInput) {
        importCostInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (file) importCostProfilesFromCsv(file);
        });
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
init();
