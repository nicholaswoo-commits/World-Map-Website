// Global Variables
let map;
let markers = [];
let companies = []; // Will store data from Firestore

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const appDiv = document.getElementById('app');
const companyList = document.getElementById('company-list');
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
const summaryIndustry = document.getElementById('summary-industry');
const summaryDesc = document.getElementById('summary-desc');
const summaryStats = document.getElementById('summary-stats');
const summaryWebsite = document.getElementById('summary-website');
const summaryLinkedin = document.getElementById('summary-linkedin');

// --- Firebase Authentication ---
// auth and db are initialized in firebase-config.js


// Check Auth State
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        loginOverlay.classList.add('hidden');
        appDiv.classList.remove('hidden');
        initApp(); // Initialize app only after login
    } else {
        // User is signed out
        console.log('User signed out');
        loginOverlay.classList.remove('hidden');
        appDiv.classList.add('hidden');
    }
});

// Handle Login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            console.error('Login Error:', error);
            loginError.textContent = 'Invalid email or password.';
        });
});

// Handle Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// --- Application Logic ---

async function initApp() {
    // Initialize Map
    if (!map) {
        map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
    }

    // Fetch Data from Firestore
    try {
        console.log('Fetching companies from Firestore...');
        const snapshot = await db.collection('companies').get();
        companies = snapshot.docs.map(doc => doc.data());
        window.companies = companies; // Expose for debugging
        console.log('Loaded companies:', companies.length);

        if (companies.length === 0) {
            console.warn('No companies found in Firestore. Did you run the migration?');
            // alert('No data found! Run window.migrateData() in console.');
        }

        populateDropdowns();
        renderApp(companies);
    } catch (error) {
        console.error("Error fetching companies:", error);
        alert('Error fetching data: ' + error.message);
    }
}

function populateDropdowns() {
    // Unique Companies
    const uniqueCompanies = [...new Set(companies.map(c => c.name))].sort();

    // Group cities by country
    const citiesByCountry = {};
    companies.forEach(company => {
        company.offices.forEach(office => {
            if (!citiesByCountry[office.country]) {
                citiesByCountry[office.country] = new Set();
            }
            citiesByCountry[office.country].add(office.city);
        });
    });

    // Populate Company Filter
    companyFilter.innerHTML = '<option value="">All Companies</option>';
    uniqueCompanies.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        companyFilter.appendChild(option);
    });

    // Populate City Filter (Grouped)
    cityFilter.innerHTML = '<option value="">All Locations</option>';
    const sortedCountries = Object.keys(citiesByCountry).sort();

    sortedCountries.forEach(country => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = country;

        // Option for entire country
        const countryOption = document.createElement('option');
        countryOption.value = `country:${country}`;
        countryOption.textContent = `All ${country} Cities`;
        optgroup.appendChild(countryOption);

        // Options for cities
        const sortedCities = [...citiesByCountry[country]].sort();
        sortedCities.forEach(city => {
            const option = document.createElement('option');
            option.value = `city:${city}`;
            option.textContent = city;
            optgroup.appendChild(option);
        });

        cityFilter.appendChild(optgroup);
    });
}

function renderApp(data) {
    renderList(data);
    renderMap(data);
    renderTable(data);
}

function renderList(data) {
    companyList.innerHTML = '';
    data.forEach(company => {
        const card = document.createElement('div');
        card.className = 'company-card';

        // Create tags for locations
        const locations = company.offices.map(o => `${o.city}, ${o.country}`).join(' | ');
        const tags = company.offices.slice(0, 2).map(o => `<span class="card-tag">${o.city}</span>`).join('');

        card.innerHTML = `
            <h3>${company.name}</h3>
            <p>${company.industry}</p>
            <div style="margin-top:0.5rem;">${tags}</div>
        `;

        card.addEventListener('click', () => {
            // Zoom to first office
            if (company.offices.length > 0) {
                const office = company.offices[0];
                map.setView([office.lat, office.lng], 10);
                // Find and open popup
                markers.forEach(m => {
                    if (m.company === company.name) {
                        m.marker.openPopup();
                    }
                });
            }
            // Show Summary
            updateSummaryBox(company);
        });

        companyList.appendChild(card);
    });
}

function renderMap(data) {
    // Clear existing markers
    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];

    data.forEach(company => {
        company.offices.forEach(office => {
            const marker = L.marker([office.lat, office.lng])
                .bindPopup(`
                    <h3>${company.name}</h3>
                    <p><strong>Industry:</strong> ${company.industry}</p>
                    <p><strong>Location:</strong> ${office.city}, ${office.country}</p>
                    <p><strong>Type:</strong> ${office.type}</p>
                `);

            // Add click listener to marker
            marker.on('click', () => {
                updateSummaryBox(company);
            });

            marker.addTo(map);
            markers.push({ marker, company: company.name });
        });
    });
}

function updateSummaryBox(company) {
    summaryName.textContent = company.name;
    summaryIndustry.textContent = company.industry;
    summaryDesc.textContent = company.description || "No description available for this company.";

    // Calculate stats
    const officeCount = company.offices.length;
    const countries = new Set(company.offices.map(o => o.country)).size;

    summaryStats.innerHTML = `
        <div class="stat-item">
            <h4>Offices</h4>
            <p>${officeCount}</p>
        </div>
        <div class="stat-item">
            <h4>Global Reach</h4>
            <p>${countries} Found</p>
        </div>
    `;

    // Social Links
    if (company.website) {
        summaryWebsite.href = company.website;
        summaryWebsite.classList.remove('hidden');
    } else {
        summaryWebsite.classList.add('hidden');
    }

    if (company.linkedin) {
        summaryLinkedin.href = company.linkedin;
        summaryLinkedin.classList.remove('hidden');
    } else {
        summaryLinkedin.classList.add('hidden');
    }

    summaryBox.classList.remove('hidden');
}

// Close Summary Box
closeSummaryBtn.addEventListener('click', () => {
    summaryBox.classList.add('hidden');
});

function renderTable(data) {
    dataTableBody.innerHTML = '';
    data.forEach(company => {
        company.offices.forEach(office => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${company.name}</td>
                <td>${company.industry}</td>
                <td>${office.city}</td>
                <td>${office.country}</td>
                <td>${office.type}</td>
            `;
            dataTableBody.appendChild(row);
        });
    });
}

// --- Filtering Logic ---
function filterData() {
    const searchText = searchInput.value.toLowerCase();
    const selectedCompany = companyFilter.value;
    const selectedLocation = cityFilter.value;

    const filtered = companies.filter(company => {
        // 1. Search Text (Name or City)
        const matchesSearch = company.name.toLowerCase().includes(searchText) ||
            company.offices.some(o => o.city.toLowerCase().includes(searchText));

        // 2. Company Dropdown
        const matchesCompany = selectedCompany ? company.name === selectedCompany : true;

        // 3. Location Dropdown (Country or City)
        let matchesLocation = true;
        if (selectedLocation) {
            if (selectedLocation.startsWith('country:')) {
                const country = selectedLocation.replace('country:', '');
                matchesLocation = company.offices.some(o => o.country === country);
            } else if (selectedLocation.startsWith('city:')) {
                const city = selectedLocation.replace('city:', '');
                matchesLocation = company.offices.some(o => o.city === city);
            }
        }

        return matchesSearch && matchesCompany && matchesLocation;
    });

    renderApp(filtered);
}

// Event Listeners for Filters
searchInput.addEventListener('input', filterData);
companyFilter.addEventListener('change', filterData);
cityFilter.addEventListener('change', filterData);

// --- Modal Logic ---
viewDataBtn.addEventListener('click', () => {
    dataModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    dataModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === dataModal) {
        dataModal.classList.add('hidden');
    }
});
