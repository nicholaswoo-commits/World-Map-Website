// Global Variables
let map;
let markerCluster;
let markers = [];
let companies = []; // Will store data from Firestore
let currentMode = 'ALL'; 
let currentCompany = null;
let currentPage = 1;
const itemsPerPage = 50;

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const appDiv = document.getElementById('app');
const companyList = document.getElementById('company-list');
const officeList = document.getElementById('office-list');
const backToListBtn = document.getElementById('back-to-list-btn');
const mainFilters = document.getElementById('main-filters');

const searchInput = document.getElementById('search-input');
const companyFilter = document.getElementById('company-filter');
const cityFilter = document.getElementById('city-filter');
const viewDataBtn = document.getElementById('view-data-btn');
const dataModal = document.getElementById('data-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const logoutBtn = document.getElementById('logout-btn');
const dataTableBody = document.querySelector('#data-table tbody');

// Summary Box Elements
const summaryBox = document.getElementById('summary-box');
const closeSummaryBtn = document.getElementById('close-summary-btn');
const summaryName = document.getElementById('summary-name');
const summaryCompanySelect = document.getElementById('summary-company-select');
const summaryIndustry = document.getElementById('summary-industry');
const summaryDesc = document.getElementById('summary-desc');
const summaryStats = document.getElementById('summary-stats');
const summaryWebsite = document.getElementById('summary-website');
const summaryLinkedin = document.getElementById('summary-linkedin');

// --- Firebase Authentication ---
auth.onAuthStateChanged(user => {
    if (user) {
        loginOverlay.classList.add('hidden');
        appDiv.classList.remove('hidden');
        initApp();
    } else {
        loginOverlay.classList.remove('hidden');
        appDiv.classList.add('hidden');
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    auth.signInWithEmailAndPassword(email, password).catch(err => {
        loginError.textContent = 'Invalid credentials.';
    });
});

logoutBtn.addEventListener('click', () => auth.signOut());

// --- Application Logic ---

async function initApp() {
    if (!map) {
        map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(map);
        markerCluster = L.markerClusterGroup();
        map.addLayer(markerCluster);
    }

    try {
        const snapshot = await db.collection('companies').get();
        companies = snapshot.docs.map(doc => doc.data());
        window.companies = companies;
        populateDropdowns();
        renderApp(companies);
    } catch (error) {
        console.error("Error:", error);
    }
}

function populateDropdowns() {
    const uniqueCompanies = [...new Set(companies.map(c => c.name))].sort();
    companyFilter.innerHTML = '<option value="">All Companies</option>';
    summaryCompanySelect.innerHTML = '<option value="">Switch Company...</option>';
    uniqueCompanies.forEach(name => {
        const opt = `<option value="${name}">${name}</option>`;
        companyFilter.innerHTML += opt;
        summaryCompanySelect.innerHTML += opt;
    });

    const countries = [...new Set(companies.flatMap(c => c.offices.map(o => o.country)))].sort();
    cityFilter.innerHTML = '<option value="">All Regions</option>';
    countries.forEach(c => {
        cityFilter.innerHTML += `<option value="country:${c}">${c}</option>`;
    });
}

function renderApp(data) {
    if (currentMode === 'ALL') {
        renderList(data);
        renderMap(data);
    }
    renderTable(data);
}

function renderList(data) {
    companyList.innerHTML = '';
    
    // Calculate slices
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const dataToRender = data.slice(startIndex, endIndex);

    dataToRender.forEach(company => {
        const card = document.createElement('div');
        card.className = 'company-card';
        const countries = [...new Set(company.offices.map(o => o.country))];
        const tags = countries.map(c => `<span class="card-tag">${c}</span>`).join('');
        card.innerHTML = `<h3>${company.name}</h3><p>${company.industry}</p><div style="margin-top:0.5rem;">${tags}</div>`;
        card.addEventListener('click', () => enterCompanyMode(company));
        companyList.appendChild(card);
    });

    // Pagination controls
    const totalPages = Math.ceil(data.length / itemsPerPage);
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn-primary';
        prevBtn.textContent = 'Prev';
        prevBtn.disabled = currentPage === 1;
        if (currentPage === 1) prevBtn.style.opacity = '0.5';
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderList(data);
                companyList.scrollTop = 0;
            }
        });

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.style.color = 'var(--text-secondary)';
        pageInfo.style.fontSize = '0.85rem';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-primary';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = currentPage === totalPages;
        if (currentPage === totalPages) nextBtn.style.opacity = '0.5';
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderList(data);
                companyList.scrollTop = 0;
            }
        });

        paginationContainer.appendChild(prevBtn);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextBtn);
        companyList.appendChild(paginationContainer);
    }
}

function renderMap(data) {
    if (markerCluster) markerCluster.clearLayers();
    markers = [];
    data.forEach(company => {
        company.offices.forEach(office => {
            if (!office.lat || !office.lng) return;
            const marker = L.marker([office.lat, office.lng]).bindPopup(`<h3>${company.name}</h3><p>${office.city || ''} ${office.country}</p>`);
            marker.on('mouseover', () => marker.openPopup());
            marker.on('mouseout', () => marker.closePopup());
            marker.on('click', () => enterCompanyMode(company));
            markerCluster.addLayer(marker);
            markers.push({ marker, company: company.name });
        });
    });
}

function enterCompanyMode(company) {
    currentMode = 'SINGLE';
    currentCompany = company;
    if (markerCluster) markerCluster.clearLayers();
    markers = [];
    const bounds = [];
    company.offices.forEach(office => {
        if (!office.lat || !office.lng) return;
        const marker = L.marker([office.lat, office.lng]).bindPopup(`<h3>${company.name}</h3><p>${office.country}</p>`);
        marker.on('mouseover', () => marker.openPopup());
        marker.on('mouseout', () => marker.closePopup());
        markerCluster.addLayer(marker);
        markers.push({ marker, company: company.name });
        bounds.push([office.lat, office.lng]);
    });
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    
    renderOfficeList(company);
    companyList.classList.add('hidden');
    officeList.classList.remove('hidden');
    backToListBtn.classList.remove('hidden');
    mainFilters.classList.add('hidden');
    updateSummaryBox(company);
}

function exitCompanyMode() {
    currentMode = 'ALL';
    currentCompany = null;
    renderMap(companies);
    map.setView([20, 0], 2);
    companyList.classList.remove('hidden');
    officeList.classList.add('hidden');
    backToListBtn.classList.add('hidden');
    mainFilters.classList.remove('hidden');
    summaryBox.classList.add('hidden');
}

function renderOfficeList(company) {
    officeList.innerHTML = `<h3 style="margin-bottom:1rem; color:var(--text-secondary);">Offices for ${company.name}</h3>`;
    company.offices.forEach(office => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.style.borderColor = office.signedTerms ? '#00f0ff' : '#ff4d4d';
        card.innerHTML = `<h3>${office.country}</h3><div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
            <span class="card-tag">${office.type}</span>
            <span style="color:${office.signedTerms ? '#00f0ff' : '#ff4d4d'}; font-weight:600; font-size:0.8rem;">
                ${office.signedTerms ? 'Signed' : 'Not Signed'}
            </span>
        </div>`;
        card.addEventListener('click', () => { if (office.lat) map.setView([office.lat, office.lng], 5); });
        officeList.appendChild(card);
    });
}

function updateSummaryBox(company) {
    summaryName.textContent = company.name;
    summaryIndustry.textContent = company.industry;
    summaryDesc.textContent = company.description || "No description.";
    summaryCompanySelect.value = company.name;

    const breakdown = company.offices.map(o => {
        const displayPercentage = o.signedTerms ? (o.signedTermsPercentage && o.signedTermsPercentage !== 'N/A' ? o.signedTermsPercentage : '100%') : '0%';
        const numericPct = parseInt(displayPercentage) || 0;
        const color = o.signedTerms ? '#00f0ff' : '#ff4d4d';
        return `
            <div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
                    <span style="color:var(--text-secondary);">${o.country}</span>
                    <span style="color:${color}; font-weight:600;">${displayPercentage}</span>
                </div>
                <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
                    <div style="width:${numericPct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}44;"></div>
                </div>
            </div>`;
    }).join('');

    summaryStats.innerHTML = `
        <div class="stat-item"><h4>Offices</h4><p>${company.offices.length}</p></div>
        <div class="stat-item" style="flex-grow:1;"><h4>Signed Terms Breakdown</h4><div style="display:flex; flex-direction:column; width:100%; gap:2px; margin-top:4px;">${breakdown}</div></div>
    `;

    if (company.website) { summaryWebsite.href = company.website; summaryWebsite.classList.remove('hidden'); } else { summaryWebsite.classList.add('hidden'); }
    if (company.linkedin) { summaryLinkedin.href = company.linkedin; summaryLinkedin.classList.remove('hidden'); } else { summaryLinkedin.classList.add('hidden'); }
    summaryBox.classList.remove('hidden');
}

backToListBtn.addEventListener('click', exitCompanyMode);
summaryCompanySelect.addEventListener('change', (e) => {
    const company = companies.find(c => c.name === e.target.value);
    company ? enterCompanyMode(company) : exitCompanyMode();
});
closeSummaryBtn.addEventListener('click', () => summaryBox.classList.add('hidden'));

function renderTable(data) {
    let htmlContent = '';
    data.forEach(company => {
        company.offices.forEach(o => {
            htmlContent += `<tr><td>${company.name}</td><td>${company.industry}</td><td>${o.city || ''}</td><td>${o.country}</td><td>${o.type}</td></tr>`;
        });
    });
    dataTableBody.innerHTML = htmlContent;
}

function filterData() {
    if (currentMode !== 'ALL') return;
    currentPage = 1; // Reset to page 1 on new filter
    
    const txt = searchInput.value.toLowerCase();
    const selC = companyFilter.value;
    const selL = cityFilter.value;

    const filtered = companies.filter(c => {
        const mTxt = c.name.toLowerCase().includes(txt) || c.offices.some(o => o.country.toLowerCase().includes(txt));
        const mSelC = selC ? c.name === selC : true;
        let mSelL = true;
        if (selL) {
            const country = selL.replace('country:', '');
            mSelL = c.offices.some(o => o.country === country);
        }
        return mTxt && mSelC && mSelL;
    });
    renderApp(filtered);
}

let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(filterData, 300);
});
companyFilter.addEventListener('change', filterData);
cityFilter.addEventListener('change', filterData);
viewDataBtn.addEventListener('click', () => dataModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => dataModal.classList.add('hidden'));
window.addEventListener('click', (e) => { if (e.target === dataModal) dataModal.classList.add('hidden'); });
