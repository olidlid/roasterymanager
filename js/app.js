// MAIN APPLICATION ENGINE (ES MODULE)
import { supabase, initSupabase, isConnected, disconnectSupabase } from './supabase.js';
import { currentLanguage, translatePage, setLanguage, t } from './i18n.js';

// --- STATE MANAGEMENT ---
let isMockMode = localStorage.getItem('is_mock_mode') === 'true';
let currentUser = null;
let companySettings = {
    company_name: 'Roastery Kopi Mandiri',
    address: 'Jl. Kopi No. 12, Jakarta',
    phone: '08123456789',
    email: 'info@roasterykopimandiri.com',
    logo_base64: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=100&auto=format&fit=crop',
    handover_title: 'SURAT JALAN SERAH TERIMA BARANG',
    show_logo_in_print: true,
    print_footer_text: 'Barang yang sudah diserahterimakan menjadi tanggung jawab tim sales.',
    currency: 'IDR',
    weight_unit: 'kg',
    default_language: 'en'
};

// Mock Local Storage Databases (Used if Supabase is offline/Mock Mode)
const MOCK_DB = {
    green_coffee: [
        { id: 1, code: '1', name: 'Aceh Gayo Arabika', origin: 'Aceh', process: 'Wet Hulled', stock_kg: 250.0, purchase_date: '2026-05-15', purchase_price_per_kg: 95000, supplier: 'Gayo Estate' },
        { id: 2, code: '2', name: 'Sidikalang Robusta', origin: 'Dairi', process: 'Full Wash', stock_kg: 180.0, purchase_date: '2026-05-20', purchase_price_per_kg: 52000, supplier: 'Sidikalang Coop' },
        { id: 3, code: '3', name: 'Toraja Arabika', origin: 'Sulawesi', process: 'Natural', stock_kg: 100.0, purchase_date: '2026-06-01', purchase_price_per_kg: 110000, supplier: 'Toraja Highlands' }
    ],
    blend_recipes: [
        { id: 1, code: 'B1', name: 'Espresso House Blend', description: 'Racikan espresso seimbang untuk cafe latte.' }
    ],
    blend_ingredients: [
        { id: 1, blend_recipe_id: 1, green_coffee_id: 1, percentage: 60.0 },
        { id: 2, blend_recipe_id: 1, green_coffee_id: 2, percentage: 40.0 }
    ],
    machines: [
        { id: 1, code: '1', name: 'Probat 5kg (Mesin #1)' },
        { id: 2, code: '2', name: 'Giesen W6 6kg (Mesin #2)' }
    ],
    roasting_plans: [
        { id: 1, day: 'Senin', plan_date: '2026-06-29', coffee_type: 'Single', single_coffee_id: 1, blend_recipe_id: null, target_roasted_kg: 10.0, fulfilled_roasted_kg: 8.5, status: 'In Progress' },
        { id: 2, day: 'Senin', plan_date: '2026-06-29', coffee_type: 'Blend', single_coffee_id: null, blend_recipe_id: 1, target_roasted_kg: 20.0, fulfilled_roasted_kg: 0.0, status: 'Pending' }
    ],
    roast_batches: [
        { id: 1, batch_code: '1-106271', roast_date: '2026-06-27', roast_type: 'Regular', qc_status: 'Success', coffee_type: 'Single', single_coffee_id: 1, blend_recipe_id: null, machine_id: 1, roasting_plan_id: 1, input_weight_kg: 10.0, output_weight_kg: 8.5, yield_percentage: 85.0, remaining_bulk_kg: 3.5, roaster_operator: 'Budi', notes: 'Roasting filter yang bersih.' }
    ],
    waste_inventory: [],
    packed_coffee: [
        { id: 1, roast_batch_id: 1, custom_coffee_name: null, bag_size_g: 250, quantity: 12, selling_price: 45000 },
        { id: 2, roast_batch_id: 1, custom_coffee_name: null, bag_size_g: 1000, quantity: 2, selling_price: 160000 }
    ],
    request_orders: [
        { id: 1, order_date: '2026-06-28', sales_name: 'Dewi', status: 'Pending Approval', notes: 'Untuk Kafe Melati' }
    ],
    request_order_items: [
        { id: 1, request_order_id: 1, coffee_type: 'Single', single_coffee_id: 1, blend_recipe_id: null, bag_size_g: 250, quantity_requested: 10, quantity_allocated: 0, quantity_pending: 0 }
    ],
    handover_logs: [],
    profiles: [
        { id: 'dev-id', username: 'developer', role: 'Developer', name: 'Super Developer' }
    ]
};

// Initialize localStorage databases if empty
function initMockDatabases() {
    for (const key in MOCK_DB) {
        if (!localStorage.getItem(`mock_${key}`)) {
            localStorage.setItem(`mock_${key}`, JSON.stringify(MOCK_DB[key]));
        }
    }
    if (!localStorage.getItem('mock_company_settings')) {
        localStorage.setItem('mock_company_settings', JSON.stringify(companySettings));
    }
}
initMockDatabases();

// Helper to get/set mock DB table
function getMockTable(table) {
    return JSON.parse(localStorage.getItem(`mock_${table}`));
}
function setMockTable(table, data) {
    localStorage.setItem(`mock_${table}`, JSON.stringify(data));
}

// --- CONFIGURATION & CONNECTION FLOW ---
const configOverlay = document.getElementById('config-overlay');
const authOverlay = document.getElementById('auth-overlay');
const onboardingOverlay = document.getElementById('onboarding-overlay');

function checkDatabaseConnection() {
    if (!isConnected() && !isMockMode) {
        configOverlay.classList.remove('hidden');
        authOverlay.classList.add('hidden');
        return false;
    }
    configOverlay.classList.add('hidden');
    return true;
}

function checkAuthentication() {
    if (!checkDatabaseConnection()) return;
    
    if (isMockMode) {
        currentUser = { id: 'dev-id', name: 'Super Developer', role: localStorage.getItem('mock_active_role') || 'Developer' };
        authOverlay.classList.add('hidden');
        initAppDashboard();
        return;
    }

    // Check Supabase Auth State
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            authOverlay.classList.remove('hidden');
            document.getElementById('app-container').style.display = 'none';
        } else {
            authOverlay.classList.add('hidden');
            document.getElementById('app-container').style.display = 'flex';
            loadUserProfile(session.user.id);
        }
    });
}

// --- PROFILE & SETTINGS LOADERS ---
async function loadUserProfile(userId) {
    try {
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        
        currentUser = data;
        
        // Check if company settings exist
        let { data: company, error: compErr } = await supabase
            .from('company_settings')
            .select('*')
            .eq('id', 1)
            .single();
            
        if (!company || compErr) {
            // Show Onboarding overlay
            onboardingOverlay.classList.remove('hidden');
        } else {
            companySettings = company;
            if (!localStorage.getItem('app_language') && companySettings.default_language) {
                setLanguage(companySettings.default_language);
            }
            onboardingOverlay.classList.add('hidden');
            initAppDashboard();
        }
    } catch (e) {
        console.error("Profile load failed, entering mock profile:", e);
        // Fallback profile if connection issues occur
        currentUser = { id: userId, username: 'user', role: 'Leader', name: 'User Baru' };
        onboardingOverlay.classList.remove('hidden');
    }
}

// --- NAVIGATION & DOM ROUTER ---
const navItems = document.querySelectorAll('.menu-item');
const pageSections = document.querySelectorAll('.page-section');
const activePageTitle = document.getElementById('active-page-title');
const activePageSubtitle = document.getElementById('active-page-subtitle');

const PAGE_METADATA = {
    'sec-dashboard': { title: 'Dashboard Produksi', subtitle: 'Ringkasan inventaris dan grafik yield konsistensi' },
    'sec-greenbean': { title: 'Bahan Baku & Resep', subtitle: 'Kelola stok greenbean mentah dan formula racikan blend' },
    'sec-roasting': { title: 'Proses Roasting & Plan', subtitle: 'Jadwalkan pemanggangan kopi dan rekam batch roasting' },
    'sec-packing': { title: 'Kemasan & Inventaris', subtitle: 'Bungkus kopi curah matang ke kemasan siap jual' },
    'sec-handover': { title: 'Order & Serah Terima', subtitle: 'Persetujuan pesanan sales dan pencetakan surat serah terima' },
    'sec-users': { title: 'Manajemen Anggota', subtitle: 'Daftarkan user dan atur wewenang tim roastery' },
    'sec-settings': { title: 'Pengaturan Sistem', subtitle: 'Konfigurasi profil perusahaan dan tata letak cetakan stiker/struk' }
};

function navigateTo(sectionId) {
    // Hide all sections
    pageSections.forEach(sec => sec.classList.add('hidden'));
    // Show active section
    const activeSec = document.getElementById(sectionId);
    if (activeSec) activeSec.classList.remove('hidden');

    // Update active state in nav bars (desktop and mobile)
    navItems.forEach(item => {
        if (item.getAttribute('data-target') === sectionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update Title Texts
    const meta = PAGE_METADATA[sectionId] || { title: 'Aplikasi', subtitle: '' };
    activePageTitle.textContent = meta.title;
    activePageSubtitle.textContent = meta.subtitle;

    // Load data specific to the section
    loadSectionData(sectionId);
}

// Set click handlers on Navigation menus
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        navigateTo(target);
    });
});

// Switch view based on selected Roleplay
const rolePlaySwitcher = document.getElementById('role-play-switcher');
rolePlaySwitcher.addEventListener('change', (e) => {
    const newRole = e.target.value;
    if (currentUser) {
        currentUser.role = newRole;
        if (isMockMode) {
            localStorage.setItem('mock_active_role', newRole);
        }
        applyRoleplayRestrictions();
        console.log(`Role switched to ${newRole}`);
        initAppDashboard();
    }
});

function applyRoleplayRestrictions() {
    if (!currentUser) return;
    
    // Update headers avatar & labels
    const avatar = document.getElementById('user-avatar-lbl');
    const nameLabel = document.getElementById('user-name-lbl');
    const roleLabel = document.getElementById('user-role-lbl');
    
    avatar.textContent = currentUser.name.charAt(0).toUpperCase();
    nameLabel.textContent = currentUser.name;
    roleLabel.textContent = currentUser.role;

    // Hide/show navigation items depending on Roleplay
    const role = currentUser.role;
    navItems.forEach(item => {
        const target = item.getAttribute('data-target');
        let visible = false;
        
        if (role === 'Developer' || role === 'Leader') {
            visible = true;
        } else if (role === 'Roaster') {
            visible = ['sec-dashboard', 'sec-greenbean', 'sec-roasting', 'sec-settings'].includes(target);
        } else if (role === 'Packing') {
            visible = ['sec-dashboard', 'sec-packing', 'sec-handover', 'sec-settings'].includes(target);
        } else if (role === 'Sales') {
            visible = ['sec-dashboard', 'sec-handover'].includes(target);
        }
        
        if (visible) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
}

// --- DATA READ/WRITE HANDLERS (SUPABASE VS MOCK FALLBACK) ---
async function fetchData(table, options = {}) {
    if (isMockMode) {
        let data = getMockTable(table);
        // Apply basic filtering/sorting if required
        if (options.eq) {
            data = data.filter(row => row[options.eq.col] === options.eq.val);
        }
        return { data, error: null };
    } else {
        try {
            let query = supabase.from(table).select(options.select || '*');
            if (options.eq) {
                query = query.eq(options.eq.col, options.eq.val);
            }
            if (options.order) {
                query = query.order(options.order.col, { ascending: options.order.asc });
            }
            const { data, error } = await query;
            return { data, error };
        } catch (e) {
            console.error(`Fetch ${table} error:`, e);
            return { data: [], error: e };
        }
    }
}

async function insertData(table, record) {
    if (isMockMode) {
        let data = getMockTable(table);
        // Generate auto increment ID
        const nextId = data.length > 0 ? Math.max(...data.map(r => r.id)) + 1 : 1;
        const newRecord = { id: nextId, ...record };
        data.push(newRecord);
        setMockTable(table, data);
        return { data: [newRecord], error: null };
    } else {
        try {
            const { data, error } = await supabase.from(table).insert([record]).select();
            return { data, error };
        } catch (e) {
            console.error(`Insert ${table} error:`, e);
            return { data: null, error: e };
        }
    }
}

async function updateData(table, id, updates) {
    if (isMockMode) {
        let data = getMockTable(table);
        data = data.map(row => row.id === id ? { ...row, ...updates } : row);
        setMockTable(table, data);
        return { data, error: null };
    } else {
        try {
            const { data, error } = await supabase.from(table).update(updates).eq('id', id).select();
            return { data, error };
        } catch (e) {
            console.error(`Update ${table} error:`, e);
            return { data: null, error: e };
        }
    }
}

// --- CHART GENERATION (YIELD TREN) ---
let yieldChart = null;

function renderYieldChart(batches) {
    const ctx = document.getElementById('yield-chart');
    if (!ctx) return;

    if (yieldChart) {
        yieldChart.destroy();
    }

    // Sort batches by date ascending
    const sorted = [...batches].sort((a, b) => new Date(a.roast_date) - new Date(b.roast_date)).slice(-10);
    const labels = sorted.map(b => b.batch_code);
    const dataPoints = sorted.map(b => parseFloat(b.yield_percentage));
    const types = sorted.map(b => b.roast_type);

    yieldChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Yield Kopi Matang (%)',
                data: dataPoints,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: context => {
                    const idx = context.dataIndex;
                    return types[idx] === 'Test' ? '#f59e0b' : '#6366f1';
                },
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 75,
                    max: 95,
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Yield: ${context.parsed.y}% (${types[context.dataIndex]} Batch)`
                    }
                }
            }
        }
    });
}

// --- INITIALIZE DASHBOARD & GENERAL DATA LOADERS ---
async function initAppDashboard() {
    applyRoleplayRestrictions();
    document.getElementById('app-container').style.display = 'flex';

    // Load metrics stats
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: batches } = await fetchData('roast_batches');
    const { data: packed } = await fetchData('packed_coffee');
    const { data: orders } = await fetchData('request_orders');

    // Calculate metrics
    const totalGB = greenbeans.reduce((sum, item) => sum + parseFloat(item.stock_kg), 0);
    const totalBulk = batches.reduce((sum, item) => sum + parseFloat(item.remaining_bulk_kg || 0), 0);
    const totalPacked = packed.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'Pending Approval').length;

    // Display values with custom unit preferences
    const unit = companySettings.weight_unit || 'kg';
    document.getElementById('stat-greenbean').textContent = `${totalGB.toFixed(1)} ${unit}`;
    document.getElementById('stat-bulk').textContent = `${totalBulk.toFixed(1)} ${unit}`;
    document.getElementById('stat-packed').textContent = `${totalPacked} pack`;
    document.getElementById('stat-pending-orders').textContent = `${pendingOrders} order`;

    // Render Yield Chart
    renderYieldChart(batches);

    // Render Dashboard active plan list
    const dashboardPlansList = document.getElementById('dashboard-plans-list');
    const today = new Date().toISOString().split('T')[0];
    const { data: plans } = await fetchData('roasting_plans', { eq: { col: 'plan_date', val: today } });
    
    if (plans && plans.length > 0) {
        dashboardPlansList.innerHTML = '';
        for (const plan of plans) {
            let coffeeName = 'Kopi';
            if (plan.coffee_type === 'Single') {
                const gb = greenbeans.find(g => g.id === plan.single_coffee_id);
                if (gb) coffeeName = gb.name;
            } else {
                const { data: blend } = await fetchData('blend_recipes');
                const bl = blend.find(b => b.id === plan.blend_recipe_id);
                if (bl) coffeeName = bl.name;
            }
            
            const progressPct = Math.min((parseFloat(plan.fulfilled_roasted_kg) / parseFloat(plan.target_roasted_kg)) * 100, 100);
            
            dashboardPlansList.innerHTML += `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 550;">
                        <span>${coffeeName} (${plan.coffee_type})</span>
                        <span>${parseFloat(plan.fulfilled_roasted_kg)} / ${parseFloat(plan.target_roasted_kg)} ${unit}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
                    </div>
                </div>
            `;
        }
    } else {
        dashboardPlansList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Tidak ada rencana roasting terjadwal hari ini.</p>`;
    }
}

// Load Section Specific Datasets
async function loadSectionData(sectionId) {
    if (sectionId === 'sec-dashboard') {
        initAppDashboard();
    } else if (sectionId === 'sec-greenbean') {
        renderGreenbeanSection();
    } else if (sectionId === 'sec-roasting') {
        renderRoastingSection();
    } else if (sectionId === 'sec-packing') {
        renderPackingSection();
    } else if (sectionId === 'sec-handover') {
        renderHandoverSection();
    } else if (sectionId === 'sec-settings') {
        renderSettingsSection();
    } else if (sectionId === 'sec-users') {
        renderUsersSection();
    }
}

// --- RENDER SECTION IMPLEMENTATIONS ---

// 1. GREENBEAN & RECIPES
async function renderGreenbeanSection() {
    const { data: greenbeans } = await fetchData('green_coffee');
    const tableBody = document.getElementById('greenbean-table-body');
    const unit = companySettings.weight_unit || 'kg';
    
    tableBody.innerHTML = '';
    greenbeans.forEach(gb => {
        const isLow = parseFloat(gb.stock_kg) < 15;
        const stockBadge = isLow ? `<span class="badge badge-danger">${gb.stock_kg} ${unit} (Kritis)</span>` : `<span class="badge badge-success">${gb.stock_kg} ${unit}</span>`;
        
        tableBody.innerHTML += `
            <tr>
                <td><strong>#${gb.code}</strong></td>
                <td>${gb.name}</td>
                <td>${gb.origin}</td>
                <td>${gb.process}</td>
                <td>${stockBadge}</td>
                <td>${gb.supplier}</td>
                <td>
                    <button class="btn btn-secondary btn-sm edit-gb-btn" data-id="${gb.id}">Edit</button>
                </td>
            </tr>
        `;
    });

    // Render Blend Recipes Cards
    const { data: recipes } = await fetchData('blend_recipes');
    const { data: ingredients } = await fetchData('blend_ingredients');
    const cardsContainer = document.getElementById('recipes-cards-container');
    
    cardsContainer.innerHTML = '';
    recipes.forEach(recipe => {
        const recipeIngs = ingredients.filter(ing => ing.blend_recipe_id === recipe.id);
        let ingredientsText = '';
        recipeIngs.forEach(ri => {
            const gb = greenbeans.find(g => g.id === ri.green_coffee_id);
            if (gb) {
                ingredientsText += `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">• ${gb.name}: <strong>${parseFloat(ri.percentage)}%</strong></div>`;
            }
        });

        cardsContainer.innerHTML += `
            <div class="card" style="padding: 16px; border-radius: var(--radius-md);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="font-size: 1rem; font-weight: 600;">${recipe.name} (${recipe.code})</h4>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${recipe.description || 'Tidak ada deskripsi'}</p>
                    </div>
                </div>
                <div style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">Komposisi Blend:</span>
                    ${ingredientsText}
                </div>
            </div>
        `;
    });
}

// 2. ROASTING PLAN & BATCHES
async function renderRoastingSection() {
    const { data: plans } = await fetchData('roasting_plans');
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: recipes } = await fetchData('blend_recipes');
    const { data: machines } = await fetchData('machines');
    const { data: batches } = await fetchData('roast_batches');
    const unit = companySettings.weight_unit || 'kg';

    const planTableBody = document.getElementById('plan-table-body');
    planTableBody.innerHTML = '';
    plans.forEach(plan => {
        let coffeeName = 'Kopi';
        if (plan.coffee_type === 'Single') {
            const gb = greenbeans.find(g => g.id === plan.single_coffee_id);
            if (gb) coffeeName = gb.name;
        } else {
            const recipe = recipes.find(r => r.id === plan.blend_recipe_id);
            if (recipe) coffeeName = recipe.name;
        }

        let statusClass = 'badge-warning';
        if (plan.status === 'Completed') statusClass = 'badge-success';
        if (plan.status === 'Pending') statusClass = 'badge-primary';

        planTableBody.innerHTML += `
            <tr>
                <td>${plan.plan_date} (${plan.day})</td>
                <td><strong>${coffeeName}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${plan.coffee_type})</span></td>
                <td>${parseFloat(plan.target_roasted_kg)} ${unit}</td>
                <td>${parseFloat(plan.fulfilled_roasted_kg)} ${unit}</td>
                <td><span class="badge ${statusClass}">${plan.status}</span></td>
                <td>
                    ${plan.status !== 'Completed' ? `<button class="btn btn-primary btn-sm btn-roast-now" data-id="${plan.id}">Sangrai Sekarang</button>` : 'Selesai'}
                </td>
            </tr>
        `;
    });

    const batchTableBody = document.getElementById('batch-table-body');
    batchTableBody.innerHTML = '';
    batches.forEach(batch => {
        let coffeeName = 'Kopi';
        if (batch.coffee_type === 'Single') {
            const gb = greenbeans.find(g => g.id === batch.single_coffee_id);
            if (gb) coffeeName = gb.name;
        } else {
            const recipe = recipes.find(r => r.id === batch.blend_recipe_id);
            if (recipe) coffeeName = recipe.name;
        }

        const mach = machines.find(m => m.id === batch.machine_id);
        const machineName = mach ? mach.name : 'Mesin';

        batchTableBody.innerHTML += `
            <tr>
                <td><strong>${batch.batch_code}</strong></td>
                <td>${coffeeName}</td>
                <td>${machineName}</td>
                <td>${batch.input_weight_kg}/${batch.output_weight_kg} ${unit}</td>
                <td>${batch.yield_percentage}%</td>
                <td><span class="badge ${batch.roast_type === 'Test' ? 'badge-warning' : 'badge-success'}">${batch.roast_type}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-print-sticker" data-id="${batch.id}"><i class="lucide-printer"></i></button>
                </td>
            </tr>
        `;
    });
}

// 3. PACKING & INVENTORY
async function renderPackingSection() {
    const { data: batches } = await fetchData('roast_batches');
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: recipes } = await fetchData('blend_recipes');
    const { data: packed } = await fetchData('packed_coffee');
    const unit = companySettings.weight_unit || 'kg';

    const queueTable = document.getElementById('packing-queue-table-body');
    queueTable.innerHTML = '';
    
    // Batches that have bulk remaining
    const packingQueue = batches.filter(b => parseFloat(b.remaining_bulk_kg) > 0 && b.qc_status !== 'Failed');
    
    if (packingQueue.length > 0) {
        packingQueue.forEach(batch => {
            let coffeeName = 'Kopi';
            if (batch.coffee_type === 'Single') {
                const gb = greenbeans.find(g => g.id === batch.single_coffee_id);
                if (gb) coffeeName = gb.name;
            } else {
                const recipe = recipes.find(r => r.id === batch.blend_recipe_id);
                if (recipe) coffeeName = recipe.name;
            }

            queueTable.innerHTML += `
                <tr>
                    <td><strong>${batch.batch_code}</strong></td>
                    <td>${coffeeName}</td>
                    <td>${batch.roast_date}</td>
                    <td><span class="badge badge-warning">${batch.remaining_bulk_kg} ${unit}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm btn-pack-bulk" data-id="${batch.id}">Kemas</button>
                    </td>
                </tr>
            `;
        });
    } else {
        queueTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Tidak ada kopi matang curah dalam antrean kemas.</td></tr>`;
    }

    const packedInventoryTable = document.getElementById('packed-inventory-table-body');
    packedInventoryTable.innerHTML = '';
    packed.forEach(p => {
        let coffeeName = '';
        let batchCode = 'Custom / External';
        
        if (p.roast_batch_id) {
            const batch = batches.find(b => b.id === p.roast_batch_id);
            if (batch) {
                batchCode = batch.batch_code;
                if (batch.coffee_type === 'Single') {
                    const gb = greenbeans.find(g => g.id === batch.single_coffee_id);
                    if (gb) coffeeName = gb.name;
                } else {
                    const recipe = recipes.find(r => r.id === batch.blend_recipe_id);
                    if (recipe) coffeeName = recipe.name;
                }
            }
        } else {
            coffeeName = p.custom_coffee_name || 'Kopi Kustom';
        }

        packedInventoryTable.innerHTML += `
            <tr>
                <td><strong>${batchCode}</strong></td>
                <td>${coffeeName}</td>
                <td>${p.bag_size_g} g</td>
                <td><span class="badge badge-success">${p.quantity} pack</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-print-bag-sticker" data-id="${p.id}">Stiker Struk</button>
                </td>
            </tr>
        `;
    });
}

// 4. HANDOVER (SERAH TERIMA)
async function renderHandoverSection() {
    const { data: orders } = await fetchData('request_orders');
    const ordersTable = document.getElementById('request-orders-table-body');
    
    ordersTable.innerHTML = '';
    orders.forEach(ord => {
        let statusClass = 'badge-warning';
        if (ord.status === 'Approved') statusClass = 'badge-primary';
        if (ord.status === 'Completed') statusClass = 'badge-success';
        if (ord.status === 'Cancelled') statusClass = 'badge-danger';

        ordersTable.innerHTML += `
            <tr>
                <td><strong>Order #${ord.id}</strong></td>
                <td>${ord.sales_name}</td>
                <td>${ord.order_date}</td>
                <td><span class="badge ${statusClass}">${ord.status}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-view-order" data-id="${ord.id}">Detail</button>
                </td>
            </tr>
        `;
    });
}

function renderSettingsSection() {
    document.getElementById('sett-company-name').value = companySettings.company_name;
    document.getElementById('sett-phone').value = companySettings.phone || '';
    document.getElementById('sett-email').value = companySettings.email || '';
    document.getElementById('sett-address').value = companySettings.address || '';
    document.getElementById('sett-weight').value = companySettings.weight_unit || 'kg';
    document.getElementById('sett-currency').value = companySettings.currency || 'IDR';
    document.getElementById('sett-language').value = companySettings.default_language || 'en';

    document.getElementById('sett-print-title').value = companySettings.handover_title || '';
    document.getElementById('sett-print-logo').checked = companySettings.show_logo_in_print;
    document.getElementById('sett-print-footer').value = companySettings.print_footer_text || '';
    
    // Set sidebar header logo if settings contains base64
    if (companySettings.logo_base64) {
        document.getElementById('sidebar-logo-img').src = companySettings.logo_base64;
    }
    document.getElementById('sidebar-company-name').textContent = companySettings.company_name;
}

// 6. USERS MANAGEMENT
async function renderUsersSection() {
    const { data: profiles } = await fetchData('profiles');
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';
    
    profiles.forEach(prof => {
        tableBody.innerHTML += `
            <tr>
                <td><strong>${prof.name}</strong></td>
                <td>${prof.username}</td>
                <td><span class="badge badge-primary">${prof.role}</span></td>
                <td>${prof.created_at ? new Date(prof.created_at).toLocaleDateString('id-ID') : '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-edit-role" data-id="${prof.id || prof.username}">Ubah Peran</button>
                </td>
            </tr>
        `;
    });
}

// --- MODAL UTILS & FORMS HANDLERS ---
const modal = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-body-content');
const btnCloseModal = document.getElementById('btn-close-modal');

function openModal(title, html) {
    modalTitle.textContent = title;
    modalContent.innerHTML = html;
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    modalContent.innerHTML = '';
}

btnCloseModal.addEventListener('click', closeModal);

// Handle Click on Roasting Plan Add Button
document.getElementById('btn-add-plan').addEventListener('click', async () => {
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: recipes } = await fetchData('blend_recipes');
    
    let gbOptions = '';
    greenbeans.forEach(g => gbOptions += `<option value="${g.id}">${g.name} (${g.process}) - Stok: ${parseFloat(g.stock_kg)} kg</option>`);
    
    let recipeOptions = '';
    recipes.forEach(r => recipeOptions += `<option value="${r.id}">${r.name}</option>`);

    const html = `
        <form id="modal-plan-form">
            <div class="form-group">
                <label class="form-label" for="plan-date">Tanggal Rencana</label>
                <input type="date" id="plan-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="plan-coffee-type">Tipe Kopi</label>
                <select id="plan-coffee-type" class="form-control">
                    <option value="Single" selected>Single Origin</option>
                    <option value="Blend">Blend (Racikan)</option>
                </select>
            </div>
            <div id="plan-single-group" class="form-group">
                <label class="form-label" for="plan-single-id">Pilih Greenbean</label>
                <select id="plan-single-id" class="form-control">${gbOptions}</select>
            </div>
            <div id="plan-blend-group" class="form-group hidden">
                <label class="form-label" for="plan-blend-id">Pilih Resep Blend</label>
                <select id="plan-blend-id" class="form-control">${recipeOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label" for="plan-target">Target Kopi Matang (kg/g/lbs)</label>
                <input type="number" id="plan-target" class="form-control" min="0.1" step="0.1" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Jadwalkan Plan</button>
        </form>
    `;
    
    openModal('Buat Roasting Plan Baru', html);
    
    // Toggle single/blend options
    const typeSelect = document.getElementById('plan-coffee-type');
    const singleGrp = document.getElementById('plan-single-group');
    const blendGrp = document.getElementById('plan-blend-group');
    
    typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Single') {
            singleGrp.classList.remove('hidden');
            blendGrp.classList.add('hidden');
        } else {
            singleGrp.classList.add('hidden');
            blendGrp.classList.remove('hidden');
        }
    });

    const form = document.getElementById('modal-plan-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateVal = document.getElementById('plan-date').value;
        const typeVal = typeSelect.value;
        const targetVal = parseFloat(document.getElementById('plan-target').value);
        
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayVal = days[new Date(dateVal).getDay()];
        
        const record = {
            day: dayVal,
            plan_date: dateVal,
            coffee_type: typeVal,
            target_roasted_kg: targetVal,
            fulfilled_roasted_kg: 0.0,
            status: 'Pending',
            single_coffee_id: typeVal === 'Single' ? parseInt(document.getElementById('plan-single-id').value) : null,
            blend_recipe_id: typeVal === 'Blend' ? parseInt(document.getElementById('plan-blend-id').value) : null
        };

        const { error } = await insertData('roasting_plans', record);
        if (error) {
            alert('Gagal membuat plan: ' + error.message);
        } else {
            closeModal();
            loadSectionData('sec-roasting');
        }
    });
});

// STICKER PRINT TRIGGER
document.addEventListener('click', async (e) => {
    const printBtn = e.target.closest('.btn-print-sticker');
    if (printBtn) {
        const id = parseInt(printBtn.getAttribute('data-id'));
        const { data: batches } = await fetchData('roast_batches');
        const batch = batches.find(b => b.id === id);
        if (!batch) return;

        const { data: greenbeans } = await fetchData('green_coffee');
        const { data: recipes } = await fetchData('blend_recipes');
        const { data: machines } = await fetchData('machines');

        let coffeeName = 'Kopi';
        if (batch.coffee_type === 'Single') {
            const gb = greenbeans.find(g => g.id === batch.single_coffee_id);
            if (gb) coffeeName = gb.name;
        } else {
            const recipe = recipes.find(r => r.id === batch.blend_recipe_id);
            if (recipe) coffeeName = recipe.name;
        }

        const mach = machines.find(m => m.id === batch.machine_id);
        const machineName = mach ? mach.name : 'Mesin';

        // Render beautiful thermal label stiker preview modal
        const html = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                <div id="sticker-print-area" class="thermal-label">
                    <div class="thermal-header">
                        ${companySettings.company_name.toUpperCase()}
                    </div>
                    <div class="thermal-body">
                        <div class="thermal-row">
                            <span>Batch:</span>
                            <strong>${batch.batch_code}</strong>
                        </div>
                        <div class="thermal-row">
                            <span>Nama Kopi:</span>
                            <span style="font-weight: 600;">${coffeeName.substring(0, 15)}</span>
                        </div>
                        <div class="thermal-row">
                            <span>Tanggal:</span>
                            <span>${batch.roast_date}</span>
                        </div>
                        <div class="thermal-row">
                            <span>Mesin:</span>
                            <span>${machineName.substring(0, 15)}</span>
                        </div>
                    </div>
                    <div class="thermal-barcode">
                        *${batch.batch_code}*
                    </div>
                </div>
                <button id="btn-print-sticker-action" class="btn btn-primary" style="width: 100%;">
                    Cetak Stiker (50x30mm)
                </button>
            </div>
        `;
        openModal('Cetak Stiker Label Batch', html);

        document.getElementById('btn-print-sticker-action').addEventListener('click', () => {
            // Simulate printing trigger
            const printWindow = window.open('', '_blank', 'width=350,height=250');
            printWindow.document.write(`
                <html>
                <head>
                    <style>
                        body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; }
                        .thermal-label {
                            width: 240px;
                            height: 140px;
                            border: 1px solid #000;
                            padding: 8px;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 11px;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }
                        .thermal-header { font-weight: bold; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 2px; }
                        .thermal-row { display: flex; justify-content: space-between; }
                        .thermal-barcode { text-align: center; font-size: 14px; letter-spacing: 2px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="thermal-label">
                        <div class="thermal-header">${companySettings.company_name.toUpperCase()}</div>
                        <div>
                            <div class="thermal-row"><span>Batch:</span><strong>${batch.batch_code}</strong></div>
                            <div class="thermal-row"><span>Kopi:</span><span>${coffeeName}</span></div>
                            <div class="thermal-row"><span>Tgl:</span><span>${batch.roast_date}</span></div>
                            <div class="thermal-row"><span>Mesin:</span><span>${machineName}</span></div>
                        </div>
                        <div class="thermal-barcode">*${batch.batch_code}*</div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }
});

// LOG BATCH FORM & LOGIC
document.getElementById('btn-add-batch').addEventListener('click', async () => {
    await openLogRoastingForm(null);
});

// Handle "Sangrai Sekarang" on planning row
document.addEventListener('click', async (e) => {
    const roastNowBtn = e.target.closest('.btn-roast-now');
    if (roastNowBtn) {
        const planId = parseInt(roastNowBtn.getAttribute('data-id'));
        await openLogRoastingForm(planId);
    }
});

async function openLogRoastingForm(fromPlanId = null) {
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: recipes } = await fetchData('blend_recipes');
    const { data: machines } = await fetchData('machines');
    const { data: plans } = await fetchData('roasting_plans');

    let initialPlan = null;
    if (fromPlanId) {
        initialPlan = plans.find(p => p.id === fromPlanId);
    }

    let gbOptions = '';
    greenbeans.forEach(g => gbOptions += `<option value="${g.id}">${g.name} - Stok: ${parseFloat(g.stock_kg)} kg</option>`);
    
    let recipeOptions = '';
    recipes.forEach(r => recipeOptions += `<option value="${r.id}">${r.name}</option>`);

    let machineOptions = '';
    machines.forEach(m => machineOptions += `<option value="${m.id}">${m.name}</option>`);

    const html = `
        <form id="modal-batch-form">
            <input type="hidden" id="roast-plan-id" value="${fromPlanId || ''}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="batch-date">Tanggal Sangrai</label>
                    <input type="date" id="batch-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="batch-roaster-name">Nama Roaster</label>
                    <input type="text" id="batch-roaster-name" class="form-control" value="${currentUser ? currentUser.name : ''}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="batch-coffee-type">Tipe Kopi</label>
                    <select id="batch-coffee-type" class="form-control" ${initialPlan ? 'disabled' : ''}>
                        <option value="Single" ${initialPlan && initialPlan.coffee_type === 'Single' ? 'selected' : ''}>Single Origin</option>
                        <option value="Blend" ${initialPlan && initialPlan.coffee_type === 'Blend' ? 'selected' : ''}>Blend (Racikan)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="batch-machine-id">Mesin Roasting</label>
                    <select id="batch-machine-id" class="form-control">${machineOptions}</select>
                </div>
            </div>

            <div id="batch-single-group" class="form-group ${initialPlan && initialPlan.coffee_type === 'Blend' ? 'hidden' : ''}">
                <label class="form-label" for="batch-single-id">Pilih Kopi Greenbean</label>
                <select id="batch-single-id" class="form-control" ${initialPlan ? 'disabled' : ''}>${gbOptions}</select>
            </div>
            <div id="batch-blend-group" class="form-group ${!initialPlan || initialPlan.coffee_type === 'Single' ? 'hidden' : ''}">
                <label class="form-label" for="batch-blend-id">Pilih Resep Blend</label>
                <select id="batch-blend-id" class="form-control" ${initialPlan ? 'disabled' : ''}>${recipeOptions}</select>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="batch-input-kg">Berat Hijau Masuk (kg)</label>
                    <input type="number" id="batch-input-kg" class="form-control" min="0.1" step="0.1" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="batch-output-kg">Berat Matang Keluar (kg)</label>
                    <input type="number" id="batch-output-kg" class="form-control" min="0.1" step="0.1" required>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="batch-roast-type">Tipe Roasting</label>
                    <select id="batch-roast-type" class="form-control">
                        <option value="Regular" selected>Regular</option>
                        <option value="Test">Test (Eksperimen)</option>
                    </select>
                </div>
                <div id="qc-test-group" class="form-group hidden">
                    <label class="form-label" for="batch-qc-status">Status Kelulusan QC</label>
                    <select id="batch-qc-status" class="form-control">
                        <option value="Pending" selected>Pending Evaluasi</option>
                        <option value="Success">Lolos QC</option>
                        <option value="Failed">Gagal QC (Limbah/Waste)</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Kalkulasi Yield</label>
                <div id="lbl-yield-calc" style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">0.00 %</div>
            </div>

            <div class="form-group">
                <label class="form-label" for="batch-notes">Catatan Profile Sangrai (Notes)</label>
                <textarea id="batch-notes" class="form-control" rows="2" placeholder="Waktu first crack, suhu pemanas, rasa cup..."></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Pratinjau Kode Batch Otomatis</label>
                <div id="lbl-batch-code-preview" style="font-family: monospace; font-size: 1rem; font-weight: 700; color: var(--text-secondary);">GENERATING...</div>
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Simpan Hasil Roasting</button>
        </form>
    `;

    openModal(fromPlanId ? 'Roasting Berdasarkan Plan' : 'Log Hasil Roasting Baru', html);

    // Form element references
    const typeSelect = document.getElementById('batch-coffee-type');
    const singleGrp = document.getElementById('batch-single-group');
    const blendGrp = document.getElementById('batch-blend-group');
    const singleSelect = document.getElementById('batch-single-id');
    const blendSelect = document.getElementById('batch-blend-id');
    const machineSelect = document.getElementById('batch-machine-id');
    const dateInput = document.getElementById('batch-date');
    const inputKg = document.getElementById('batch-input-kg');
    const outputKg = document.getElementById('batch-output-kg');
    const yieldLabel = document.getElementById('lbl-yield-calc');
    const codePreview = document.getElementById('lbl-batch-code-preview');
    const typeRoast = document.getElementById('batch-roast-type');
    const qcGrp = document.getElementById('qc-test-group');

    // Prepopulate selection values if plan is active
    if (initialPlan) {
        if (initialPlan.coffee_type === 'Single') {
            singleSelect.value = initialPlan.single_coffee_id;
        } else {
            blendSelect.value = initialPlan.blend_recipe_id;
        }
        inputKg.value = (parseFloat(initialPlan.target_roasted_kg) * 1.2).toFixed(1); // Rough input estimation
    }

    // Toggle Groups
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'Single') {
            singleGrp.classList.remove('hidden');
            blendGrp.classList.add('hidden');
        } else {
            singleGrp.classList.add('hidden');
            blendGrp.classList.remove('hidden');
        }
        updateBatchCodePreview();
    });

    typeRoast.addEventListener('change', () => {
        if (typeRoast.value === 'Test') {
            qcGrp.classList.remove('hidden');
        } else {
            qcGrp.classList.add('hidden');
        }
    });

    // Real-time calculations
    function calculateYield() {
        const inputVal = parseFloat(inputKg.value) || 0;
        const outputVal = parseFloat(outputKg.value) || 0;
        if (inputVal > 0) {
            const yieldVal = (outputVal / inputVal) * 100;
            yieldLabel.textContent = `${yieldVal.toFixed(2)} %`;
        } else {
            yieldLabel.textContent = `0.00 %`;
        }
    }

    async function updateBatchCodePreview() {
        let coffeeCode = '0';
        if (typeSelect.value === 'Single') {
            const gb = greenbeans.find(g => g.id === parseInt(singleSelect.value));
            if (gb) coffeeCode = gb.code;
        } else {
            const recipe = recipes.find(r => r.id === parseInt(blendSelect.value));
            if (recipe) coffeeCode = recipe.code;
        }

        const mach = machines.find(m => m.id === parseInt(machineSelect.value));
        const machineCode = mach ? mach.code : '0';

        const dateVal = dateInput.value;
        let month = '00';
        let day = '00';
        if (dateVal) {
            const d = new Date(dateVal);
            month = String(d.getMonth() + 1).padStart(2, '0');
            day = String(d.getDate()).padStart(2, '0');
        }

        // Get daily batch sequence count for that machine
        const { data: todayBatches } = await fetchData('roast_batches', { eq: { col: 'roast_date', val: dateVal } });
        const machineBatches = todayBatches.filter(b => b.machine_id === parseInt(machineSelect.value));
        const seq = machineBatches.length + 1;

        const code = `${coffeeCode}-${machineCode}${month}${day}${seq}`;
        codePreview.textContent = code;
        return code;
    }

    inputKg.addEventListener('input', calculateYield);
    outputKg.addEventListener('input', calculateYield);
    singleSelect.addEventListener('change', updateBatchCodePreview);
    blendSelect.addEventListener('change', updateBatchCodePreview);
    machineSelect.addEventListener('change', updateBatchCodePreview);
    dateInput.addEventListener('change', updateBatchCodePreview);

    // Initial Trigger
    calculateYield();
    await updateBatchCodePreview();

    // Form Submit Event
    const form = document.getElementById('modal-batch-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const generatedCode = await updateBatchCodePreview();
        const inputVal = parseFloat(inputKg.value);
        const outputVal = parseFloat(outputKg.value);
        const yieldVal = parseFloat(((outputVal / inputVal) * 100).toFixed(2));
        const roastTypeVal = typeRoast.value;
        const qcStatusVal = roastTypeVal === 'Test' ? document.getElementById('batch-qc-status').value : 'Success';

        // 1. Verify Greenbean Inventory Stocks
        if (typeSelect.value === 'Single') {
            const gb = greenbeans.find(g => g.id === parseInt(singleSelect.value));
            if (gb && parseFloat(gb.stock_kg) < inputVal) {
                alert(`Stok greenbean '${gb.name}' tidak mencukupi. Tersedia: ${gb.stock_kg} kg, Dibutuhkan: ${inputVal} kg.`);
                return;
            }
        } else {
            // Verify blend recipe composition values
            const recipeId = parseInt(blendSelect.value);
            const { data: ingredients } = await fetchData('blend_ingredients', { eq: { col: 'blend_recipe_id', val: recipeId } });
            
            for (const ing of ingredients) {
                const gb = greenbeans.find(g => g.id === ing.green_coffee_id);
                const neededKg = (parseFloat(ing.percentage) / 100) * inputVal;
                if (gb && parseFloat(gb.stock_kg) < neededKg) {
                    alert(`Stok greenbean '${gb.name}' untuk resep tidak mencukupi. Tersedia: ${gb.stock_kg} kg, Dibutuhkan: ${neededKg.toFixed(1)} kg.`);
                    return;
                }
            }
        }

        // Deduct stocks
        if (typeSelect.value === 'Single') {
            const gbId = parseInt(singleSelect.value);
            const gb = greenbeans.find(g => g.id === gbId);
            await updateData('green_coffee', gbId, { stock_kg: parseFloat((parseFloat(gb.stock_kg) - inputVal).toFixed(2)) });
        } else {
            const recipeId = parseInt(blendSelect.value);
            const { data: ingredients } = await fetchData('blend_ingredients', { eq: { col: 'blend_recipe_id', val: recipeId } });
            for (const ing of ingredients) {
                const gb = greenbeans.find(g => g.id === ing.green_coffee_id);
                const neededKg = (parseFloat(ing.percentage) / 100) * inputVal;
                await updateData('green_coffee', ing.green_coffee_id, { stock_kg: parseFloat((parseFloat(gb.stock_kg) - neededKg).toFixed(2)) });
            }
        }

        // Create Roast Batch Record
        const record = {
            batch_code: generatedCode,
            roast_date: dateInput.value,
            roast_type: roastTypeVal,
            qc_status: qcStatusVal,
            coffee_type: typeSelect.value,
            single_coffee_id: typeSelect.value === 'Single' ? parseInt(singleSelect.value) : null,
            blend_recipe_id: typeSelect.value === 'Blend' ? parseInt(blendSelect.value) : null,
            machine_id: parseInt(machineSelect.value),
            roasting_plan_id: fromPlanId ? parseInt(fromPlanId) : null,
            input_weight_kg: inputVal,
            output_weight_kg: outputVal,
            yield_percentage: yieldVal,
            remaining_bulk_kg: qcStatusVal === 'Failed' ? 0.0 : outputVal, // Failed tests go straight to waste
            roaster_operator: document.getElementById('batch-roaster-name').value,
            notes: document.getElementById('batch-notes').value
        };

        const { data: newBatches, error } = await insertData('roast_batches', record);
        if (error) {
            alert('Gagal mencatat batch roasting: ' + error.message);
            return;
        }

        // Handle QC failures - Discard immediately to waste inventory
        if (qcStatusVal === 'Failed' && newBatches && newBatches.length > 0) {
            await insertData('waste_inventory', {
                roast_batch_id: newBatches[0].id,
                weight_kg: outputVal,
                discard_date: dateInput.value,
                reason: 'Gagal Tes QC Roasting: ' + record.notes
            });
        }

        // 2. Satisfy active roasting plan target if linked
        if (fromPlanId) {
            const plan = plans.find(p => p.id === parseInt(fromPlanId));
            if (plan) {
                const updatedFulfilled = parseFloat(plan.fulfilled_roasted_kg) + (qcStatusVal === 'Failed' ? 0.0 : outputVal);
                const newStatus = updatedFulfilled >= parseFloat(plan.target_roasted_kg) ? 'Completed' : 'In Progress';
                await updateData('roasting_plans', plan.id, {
                    fulfilled_roasted_kg: parseFloat(updatedFulfilled.toFixed(2)),
                    status: newStatus
                });
            }
        }

        closeModal();
        loadSectionData('sec-roasting');
    } );
}

// PACKING SCREEN MODAL
document.addEventListener('click', async (e) => {
    const packBtn = e.target.closest('.btn-pack-bulk');
    if (packBtn) {
        const id = parseInt(packBtn.getAttribute('data-id'));
        const { data: batches } = await fetchData('roast_batches');
        const batch = batches.find(b => b.id === id);
        if (!batch) return;

        const { data: greenbeans } = await fetchData('green_coffee');
        const { data: recipes } = await fetchData('blend_recipes');

        let coffeeName = 'Kopi';
        if (batch.coffee_type === 'Single') {
            const gb = greenbeans.find(g => g.id === batch.single_coffee_id);
            if (gb) coffeeName = gb.name;
        } else {
            const recipe = recipes.find(r => r.id === batch.blend_recipe_id);
            if (recipe) coffeeName = recipe.name;
        }

        const unit = companySettings.weight_unit || 'kg';

        const html = `
            <form id="modal-pack-form">
                <div style="background-color: var(--surface-hover); padding: 12px; border-radius: var(--radius-md); margin-bottom: 16px;">
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Batch Roasting:</div>
                    <strong>${batch.batch_code}</strong> (${coffeeName})
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">Stok Curah Tersedia:</div>
                    <span id="lbl-bulk-qty" style="font-weight: 700; color: var(--primary);">${batch.remaining_bulk_kg} ${unit}</span>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="pack-qty-250">Jumlah Kemasan 250g (pack)</label>
                        <input type="number" id="pack-qty-250" class="form-control" min="0" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="pack-qty-1kg">Jumlah Kemasan 1kg (pack)</label>
                        <input type="number" id="pack-qty-1kg" class="form-control" min="0" value="0">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Kalkulasi Total Berat Dikemas</label>
                    <div id="lbl-pack-weight-calc" style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">0.00 kg</div>
                    <div id="warning-pack-over" class="badge badge-warning hidden" style="margin-top: 4px;">Warning: Total berat melebihi stok curah (Over-packing).</div>
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                    Kemas & Cetak Stiker
                </button>
            </form>
        `;

        openModal('Kemas Biji Kopi Matang', html);

        const qty250 = document.getElementById('pack-qty-250');
        const qty1kg = document.getElementById('pack-qty-1kg');
        const weightCalc = document.getElementById('lbl-pack-weight-calc');
        const warningOver = document.getElementById('warning-pack-over');

        function calculatePackWeight() {
            const count250 = parseInt(qty250.value) || 0;
            const count1kg = parseInt(qty1kg.value) || 0;
            const totalKg = (count250 * 0.25) + (count1kg * 1.0);
            
            // Adjust label based on unit settings
            let displayVal = totalKg.toFixed(2);
            if (unit === 'lbs') displayVal = (totalKg * 2.20462).toFixed(2);
            if (unit === 'g') displayVal = (totalKg * 1000).toFixed(0);

            weightCalc.textContent = `${displayVal} ${unit}`;

            if (totalKg > parseFloat(batch.remaining_bulk_kg)) {
                warningOver.classList.remove('hidden');
            } else {
                warningOver.classList.add('hidden');
            }
            return totalKg;
        }

        qty250.addEventListener('input', calculatePackWeight);
        qty1kg.addEventListener('input', calculatePackWeight);

        const form = document.getElementById('modal-pack-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const totalKg = calculatePackWeight();
            const count250 = parseInt(qty250.value) || 0;
            const count1kg = parseInt(qty1kg.value) || 0;

            if (count250 === 0 && count1kg === 0) {
                alert('Tentukan jumlah kemasan terlebih dahulu.');
                return;
            }

            // Deduct bulk stocks (set to 0 if overpacked)
            const remainingBulk = Math.max(0, parseFloat(batch.remaining_bulk_kg) - totalKg);
            await updateData('roast_batches', batch.id, { remaining_bulk_kg: parseFloat(remainingBulk.toFixed(2)) });

            // Add packed stocks
            const { data: packedList } = await fetchData('packed_coffee');
            
            if (count250 > 0) {
                const existing = packedList.find(p => p.roast_batch_id === batch.id && p.bag_size_g === 250);
                if (existing) {
                    await updateData('packed_coffee', existing.id, { quantity: existing.quantity + count250 });
                } else {
                    await insertData('packed_coffee', { roast_batch_id: batch.id, custom_coffee_name: null, bag_size_g: 250, quantity: count250, selling_price: 45000 });
                }
            }

            if (count1kg > 0) {
                const existing = packedList.find(p => p.roast_batch_id === batch.id && p.bag_size_g === 1000);
                if (existing) {
                    await updateData('packed_coffee', existing.id, { quantity: existing.quantity + count1kg });
                } else {
                    await insertData('packed_coffee', { roast_batch_id: batch.id, custom_coffee_name: null, bag_size_g: 1000, quantity: count1kg, selling_price: 160000 });
                }
            }

            closeModal();
            loadSectionData('sec-packing');
        });
    }
});

// CUSTOM / EXTERNAL PACK MODAL
document.getElementById('btn-custom-pack').addEventListener('click', () => {
    const html = `
        <form id="modal-custom-pack-form">
            <div class="form-group">
                <label class="form-label" for="custom-coffee-name">Nama Kopi Kustom (Maklon/Luar)</label>
                <input type="text" id="custom-coffee-name" class="form-control" placeholder="Contoh: Kopi Mandheling Custom" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="custom-batch-code">Kode Batch Kustom (Manual)</label>
                    <input type="text" id="custom-batch-code" class="form-control" placeholder="Contoh: EXT-MAND01" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="custom-bag-size">Ukuran Kemasan</label>
                    <select id="custom-bag-size" class="form-control">
                        <option value="250" selected>250 g</option>
                        <option value="1000">1 kg (1000g)</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="custom-qty">Jumlah Kemasan (pack)</label>
                    <input type="number" id="custom-qty" class="form-control" min="1" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="custom-price">Harga Jual per Pack (Rp)</label>
                    <input type="number" id="custom-price" class="form-control" min="0" value="0">
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                Tambahkan & Cetak Stiker
            </button>
        </form>
    `;
    
    openModal('Kemasan Kopi Kustom (External)', html);

    const form = document.getElementById('modal-custom-pack-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const coffeeName = document.getElementById('custom-coffee-name').value;
        const customCode = document.getElementById('custom-batch-code').value;
        const bagSize = parseInt(document.getElementById('custom-bag-size').value);
        const qty = parseInt(document.getElementById('custom-qty').value);
        const price = parseFloat(document.getElementById('custom-price').value);

        // We create a dummy/custom batch record first to hold the custom code
        const batchRecord = {
            batch_code: customCode,
            roast_date: new Date().toISOString().split('T')[0],
            roast_type: 'Custom',
            qc_status: 'Success',
            coffee_type: null,
            input_weight_kg: null,
            output_weight_kg: null,
            yield_percentage: null,
            remaining_bulk_kg: 0.0,
            notes: 'Batch kustom luar: ' + coffeeName
        };

        const { data: newBatches } = await insertData('roast_batches', batchRecord);
        const batchId = newBatches ? newBatches[0].id : null;

        await insertData('packed_coffee', {
            roast_batch_id: batchId,
            custom_coffee_name: batchId ? null : coffeeName,
            bag_size_g: bagSize,
            quantity: qty,
            selling_price: price
        });

        closeModal();
        loadSectionData('sec-packing');
    });
});

// SALES REQUEST ORDER MODAL
document.getElementById('btn-create-request').addEventListener('click', async () => {
    const { data: greenbeans } = await fetchData('green_coffee');
    const { data: recipes } = await fetchData('blend_recipes');
    
    let coffeeOptions = '';
    greenbeans.forEach(g => coffeeOptions += `<option value="Single-${g.id}">${g.name} (Single Origin)</option>`);
    recipes.forEach(r => coffeeOptions += `<option value="Blend-${r.id}">${r.name} (House Blend)</option>`);

    const html = `
        <form id="modal-request-form">
            <div class="form-group">
                <label class="form-label" for="req-sales-name">Nama Penerima Sales</label>
                <input type="text" id="req-sales-name" class="form-control" value="${currentUser ? currentUser.name : ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex: 2;">
                    <label class="form-label" for="req-coffee-select">Pilih Kopi</label>
                    <select id="req-coffee-select" class="form-control">${coffeeOptions}</select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label class="form-label" for="req-bag-size">Kemasan</label>
                    <select id="req-bag-size" class="form-control">
                        <option value="250" selected>250 g</option>
                        <option value="1000">1 kg (1000g)</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="req-qty">Jumlah Pesanan (pack)</label>
                    <input type="number" id="req-qty" class="form-control" min="1" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="req-notes">Catatan Tambahan</label>
                <input type="text" id="req-notes" class="form-control" placeholder="Nama cafe, tanggal kirim...">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
                Kirim Permintaan Order
            </button>
        </form>
    `;

    openModal('Buat Request Order Baru (Sales)', html);

    const form = document.getElementById('modal-request-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const salesName = document.getElementById('req-sales-name').value;
        const coffeeSelect = document.getElementById('req-coffee-select').value;
        const bagSize = parseInt(document.getElementById('req-bag-size').value);
        const qtyRequested = parseInt(document.getElementById('req-qty').value);
        const notes = document.getElementById('req-notes').value;

        const isSingle = coffeeSelect.startsWith('Single-');
        const coffeeId = parseInt(coffeeSelect.split('-')[1]);

        // Create main request order
        const { data: newOrders } = await insertData('request_orders', {
            order_date: new Date().toISOString().split('T')[0],
            sales_name: salesName,
            status: 'Pending Approval',
            notes: notes
        });

        if (newOrders && newOrders.length > 0) {
            await insertData('request_order_items', {
                request_order_id: newOrders[0].id,
                coffee_type: isSingle ? 'Single' : 'Blend',
                single_coffee_id: isSingle ? coffeeId : null,
                blend_recipe_id: isSingle ? null : coffeeId,
                bag_size_g: bagSize,
                quantity_requested: qtyRequested,
                quantity_allocated: 0,
                quantity_pending: 0
            });
        }

        closeModal();
        loadSectionData('sec-handover');
    });
});

// DETAIL ORDER & PERSETUJUAN LEADER
document.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.btn-view-order');
    if (viewBtn) {
        const id = parseInt(viewBtn.getAttribute('data-id'));
        const { data: orders } = await fetchData('request_orders');
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const { data: orderItems } = await fetchData('request_order_items', { eq: { col: 'request_order_id', val: id } });
        const { data: greenbeans } = await fetchData('green_coffee');
        const { data: recipes } = await fetchData('blend_recipes');
        const { data: packed } = await fetchData('packed_coffee');
        const { data: batches } = await fetchData('roast_batches');

        let itemsHtml = '';
        let showApprovalButton = order.status === 'Pending Approval' && (currentUser.role === 'Leader' || currentUser.role === 'Developer');

        // We check stock allocation options
        let canAllocateAll = true;

        for (const item of orderItems) {
            let coffeeName = 'Kopi';
            let packedStock = 0;
            
            if (item.coffee_type === 'Single') {
                const gb = greenbeans.find(g => g.id === item.single_coffee_id);
                if (gb) coffeeName = gb.name;
                
                // Get available packed stocks matching this Single coffee batch
                const matchingPacked = packed.filter(p => {
                    if (!p.roast_batch_id) return false;
                    const b = batches.find(bt => bt.id === p.roast_batch_id);
                    return b && b.coffee_type === 'Single' && b.single_coffee_id === item.single_coffee_id && p.bag_size_g === item.bag_size_g;
                });
                packedStock = matchingPacked.reduce((sum, p) => sum + p.quantity, 0);
            } else {
                const recipe = recipes.find(r => r.id === item.blend_recipe_id);
                if (recipe) coffeeName = recipe.name;

                const matchingPacked = packed.filter(p => {
                    if (!p.roast_batch_id) return false;
                    const b = batches.find(bt => bt.id === p.roast_batch_id);
                    return b && b.coffee_type === 'Blend' && b.blend_recipe_id === item.blend_recipe_id && p.bag_size_g === item.bag_size_g;
                });
                packedStock = matchingPacked.reduce((sum, p) => sum + p.quantity, 0);
            }

            const allocated = Math.min(item.quantity_requested, packedStock);
            const pending = item.quantity_requested - allocated;
            if (pending > 0) canAllocateAll = false;

            itemsHtml += `
                <div style="padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 8px;">
                    <strong>${coffeeName} (${item.bag_size_g} g)</strong>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                        <span>Diminta: ${item.quantity_requested} pack</span>
                        <span>Stok Kemasan Tersedia: ${packedStock} pack</span>
                    </div>
                    <div style="font-size:0.8rem; font-weight:600; color:var(--primary); margin-top:4px;">
                        Alokasi Langsung: ${allocated} pack | Sisa Pending: ${pending} pack
                    </div>
                </div>
            `;
        }

        const html = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <span class="badge badge-primary">Order #${order.id}</span>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Sales: ${order.sales_name} | Tanggal: ${order.order_date}</div>
                    <div style="font-size: 0.85rem; margin-top: 4px;">Catatan: ${order.notes || '-'}</div>
                </div>
                
                <div>
                    <h4 style="font-size:0.9rem; margin-bottom:8px;">Daftar Item:</h4>
                    ${itemsHtml}
                </div>

                ${showApprovalButton ? `
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button id="btn-approve-order" class="btn btn-primary" style="flex: 2;">Setujui & Alokasikan</button>
                        <button id="btn-reject-order" class="btn btn-danger" style="flex: 1;">Tolak</button>
                    </div>
                ` : ''}

                ${order.status === 'Approved' ? `
                    <button id="btn-generate-slip-action" class="btn btn-secondary" style="width: 100%;">
                        <i class="lucide-file-text"></i> Tampilkan & Cetak Lembar Serah Terima
                    </button>
                ` : ''}
            </div>
        `;

        openModal(`Detail Request Order #${order.id}`, html);

        // Click Handler for Approve
        if (showApprovalButton) {
            document.getElementById('btn-approve-order').addEventListener('click', async () => {
                // Deduct packed inventory and calculate pending backlogs
                for (const item of orderItems) {
                    let packedStock = 0;
                    let matchingPacked = [];
                    
                    if (item.coffee_type === 'Single') {
                        matchingPacked = packed.filter(p => {
                            if (!p.roast_batch_id) return false;
                            const b = batches.find(bt => bt.id === p.roast_batch_id);
                            return b && b.coffee_type === 'Single' && b.single_coffee_id === item.single_coffee_id && p.bag_size_g === item.bag_size_g;
                        });
                    } else {
                        matchingPacked = packed.filter(p => {
                            if (!p.roast_batch_id) return false;
                            const b = batches.find(bt => bt.id === p.roast_batch_id);
                            return b && b.coffee_type === 'Blend' && b.blend_recipe_id === item.blend_recipe_id && p.bag_size_g === item.bag_size_g;
                        });
                    }
                    
                    packedStock = matchingPacked.reduce((sum, p) => sum + p.quantity, 0);
                    const allocated = Math.min(item.quantity_requested, packedStock);
                    const pending = item.quantity_requested - allocated;

                    // Deduct allocated from packed tables
                    let remAlloc = allocated;
                    for (const pack of matchingPacked) {
                        if (remAlloc <= 0) break;
                        const take = Math.min(remAlloc, pack.quantity);
                        await updateData('packed_coffee', pack.id, { quantity: pack.quantity - take });
                        remAlloc -= take;
                    }

                    // Save allocated & pending numbers to order item table
                    await updateData('request_order_items', item.id, {
                        quantity_allocated: allocated,
                        quantity_pending: pending
                    });

                    // AUTO-ROASTING PLAN FOR UNFULFILLED QUANTITIES
                    if (pending > 0) {
                        const totalKgNeeded = (pending * item.bag_size_g) / 1000;
                        const planRecord = {
                            day: 'Besok',
                            plan_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Scheduled for tomorrow
                            coffee_type: item.coffee_type,
                            target_roasted_kg: parseFloat(totalKgNeeded.toFixed(2)),
                            fulfilled_roasted_kg: 0.0,
                            status: 'Pending',
                            single_coffee_id: item.single_coffee_id,
                            blend_recipe_id: item.blend_recipe_id
                        };
                        await insertData('roasting_plans', planRecord);
                    }
                }

                // Update Request status to Approved
                await updateData('request_orders', order.id, { status: 'Approved' });
                
                closeModal();
                loadSectionData('sec-handover');
            });

            document.getElementById('btn-reject-order').addEventListener('click', async () => {
                await updateData('request_orders', order.id, { status: 'Cancelled' });
                closeModal();
                loadSectionData('sec-handover');
            });
        }

        // Print preview rendering trigger
        if (order.status === 'Approved') {
            document.getElementById('btn-generate-slip-action').addEventListener('click', () => {
                closeModal();
                renderHandoverPrintSlip(order, orderItems, greenbeans, recipes, packed, batches);
            });
        }
    }
});

// RENDER PRINT SLIP TO DOCK PANEL
function renderHandoverPrintSlip(order, orderItems, greenbeans, recipes, packed, batches) {
    const previewContainer = document.getElementById('handover-slip-preview');
    const actionsBar = document.getElementById('print-actions-bar');

    let itemsRows = '';
    orderItems.forEach(item => {
        let coffeeName = 'Kopi';
        if (item.coffee_type === 'Single') {
            const gb = greenbeans.find(g => g.id === item.single_coffee_id);
            if (gb) coffeeName = gb.name;
        } else {
            const rec = recipes.find(r => r.id === item.blend_recipe_id);
            if (rec) coffeeName = rec.name;
        }

        itemsRows += `
            <tr>
                <td style="border: 1px solid #000; padding: 8px;">${coffeeName} (${item.bag_size_g} g)</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.quantity_allocated} pack</td>
            </tr>
        `;
    });

    const logoHtml = companySettings.show_logo_in_print && companySettings.logo_base64 ? 
        `<img src="${companySettings.logo_base64}" style="max-height: 50px; display: block; margin: 0 auto 10px auto;">` : '';

    previewContainer.innerHTML = `
        <div id="print-section" style="width: 100%; max-width: 600px; background-color: #fff; color: #000; padding: 30px; font-family: monospace; border: 1px solid #000; box-shadow: var(--shadow-sm);">
            ${logoHtml}
            <h3 style="text-align: center; margin-bottom: 5px; font-weight: bold;">${companySettings.handover_title}</h3>
            <p style="text-align: center; font-size: 0.8rem; margin-bottom: 20px;">${companySettings.company_name} | Telp: ${companySettings.phone || '-'}</p>
            
            <hr style="border: 0; border-top: 2px solid #000; margin-bottom: 15px;">
            
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 20px;">
                <div>
                    <div><strong>ID Order:</strong> #${order.id}</div>
                    <div><strong>Tanggal:</strong> ${order.order_date}</div>
                </div>
                <div style="text-align: right;">
                    <div><strong>Sales:</strong> ${order.sales_name}</div>
                    <div><strong>Status:</strong> Teralokasi</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 0.85rem;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #000; padding: 8px; background-color: #f2f2f2;">Nama Item Kopi</th>
                        <th style="border: 1px solid #000; padding: 8px; text-align: center; background-color: #f2f2f2;">Jumlah Diserahkan</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div class="print-sig-container">
                <div class="print-sig-box">
                    <span>Leader (Pemberi Izin)</span>
                    <strong>(................)</strong>
                </div>
                <div class="print-sig-box">
                    <span>Produksi (Penyerah)</span>
                    <strong>(................)</strong>
                </div>
                <div class="print-sig-box">
                    <span>Sales (Penerima)</span>
                    <strong>(................)</strong>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px dashed #000; margin: 30px 0 10px 0;">
            <p style="text-align: center; font-size: 0.75rem; color: #555;">${companySettings.print_footer_text}</p>
        </div>
    `;

    actionsBar.classList.remove('hidden');

    // Trigger Print Action Button
    document.getElementById('btn-print-handover').onclick = () => {
        window.print();
    };
}

// PROFILE COMPANY SETTINGS SUBMIT
const settingsForm = document.getElementById('settings-company-form');
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sett-company-name').value;
    const phone = document.getElementById('sett-phone').value;
    const email = document.getElementById('sett-email').value;
    const address = document.getElementById('sett-address').value;
    const weight = document.getElementById('sett-weight').value;
    const currency = document.getElementById('sett-currency').value;
    const lang = document.getElementById('sett-language').value;

    const logoInput = document.getElementById('sett-logo-upload');
    let logoBase64 = companySettings.logo_base64;

    const handleSave = async (logo) => {
        const updates = { 
            company_name: name, 
            phone, 
            email, 
            address, 
            weight_unit: weight, 
            currency, 
            default_language: lang,
            logo_base64: logo 
        };
        await saveSettingsRecord(updates);
        setLanguage(lang); // Apply language immediately
    };

    if (logoInput.files && logoInput.files[0]) {
        const file = logoInput.files[0];
        const reader = new FileReader();
        reader.onloadend = async () => {
            await handleSave(reader.result);
        };
        reader.readAsDataURL(file);
    } else {
        await handleSave(logoBase64);
    }
});

async function saveSettingsRecord(records) {
    const updates = { ...companySettings, ...records };
    const { error } = await updateData('company_settings', 1, updates);
    if (error) {
        alert('Gagal menyimpan profil: ' + error.message);
    } else {
        companySettings = updates;
        alert('Profil roastery berhasil disimpan!');
        loadSectionData('sec-settings');
    }
}

// LOGOUT TRIGGER
document.getElementById('btn-logout').addEventListener('click', () => {
    if (isMockMode) {
        isMockMode = false;
        localStorage.removeItem('is_mock_mode');
    } else {
        disconnectSupabase();
    }
    window.location.reload();
});

// RESET CONNECTION
document.getElementById('btn-reset-connection').addEventListener('click', () => {
    disconnectSupabase();
    localStorage.removeItem('is_mock_mode');
    window.location.reload();
});

// DEVELOPER BACKDOOR BYPASS
document.getElementById('link-dev-login').addEventListener('click', (e) => {
    e.preventDefault();
    isMockMode = true;
    localStorage.setItem('is_mock_mode', 'true');
    checkAuthentication();
});

// DB CONNECTION FORM SAVING
document.getElementById('config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('config-url').value;
    const key = document.getElementById('config-key').value;
    if (initSupabase(url, key)) {
        configOverlay.classList.add('hidden');
        checkAuthentication();
    } else {
        alert("Gagal menginisialisasi. Cek kembali URL & Key Supabase Anda.");
    }
});

// WIZARD ONBOARDING SAVE
document.getElementById('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('onboard-name').value;
    const weight = document.getElementById('onboard-weight').value;
    const currency = document.getElementById('onboard-currency').value;
    const lang = document.getElementById('onboard-language').value;

    const updates = {
        company_name: name,
        weight_unit: weight,
        currency: currency,
        default_language: lang,
        logo_base64: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=100&auto=format&fit=crop'
    };

    if (isMockMode) {
        localStorage.setItem('mock_company_settings', JSON.stringify(updates));
    } else {
        await supabase.from('company_settings').upsert([{ id: 1, ...updates }]);
    }

    companySettings = updates;
    setLanguage(lang); // Set language immediately
    onboardingOverlay.classList.add('hidden');
    initAppDashboard();
});

document.getElementById('btn-skip-onboard').addEventListener('click', () => {
    onboardingOverlay.classList.add('hidden');
    initAppDashboard();
});

// PRINT CUSTOMIZER SAVE
document.getElementById('settings-print-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('sett-print-title').value;
    const showLogo = document.getElementById('sett-print-logo').checked;
    const footer = document.getElementById('sett-print-footer').value;

    await saveSettingsRecord({ handover_title: title, show_logo_in_print: showLogo, print_footer_text: footer });
});

// --- APP LAUNCH BOOTSTRAP ---
window.addEventListener('DOMContentLoaded', () => {
    // Determine light/dark mode based on body class list
    const themeBtn = document.getElementById('theme-toggle');
    const darkActive = localStorage.getItem('dark_mode_active') === 'true';
    if (darkActive) {
        document.body.classList.add('dark-mode');
        themeBtn.innerHTML = '<i class="lucide-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        themeBtn.innerHTML = '<i class="lucide-moon"></i>';
    }

    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('dark_mode_active', isDark);
        themeBtn.innerHTML = isDark ? '<i class="lucide-sun"></i>' : '<i class="lucide-moon"></i>';
    });

    // Setup Quick Language Switcher Dropdown in Header
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.value = currentLanguage;
        langSwitcher.addEventListener('change', (e) => {
            setLanguage(e.target.value);
            // Refresh active title subtitles to match language
            const activeMenuItem = document.querySelector('.menu-item.active');
            if (activeMenuItem) {
                navigateTo(activeMenuItem.getAttribute('data-target'));
            }
        });
    }

    // Set page translations dynamically on load
    translatePage();

    // Check routes
    checkAuthentication();
});
