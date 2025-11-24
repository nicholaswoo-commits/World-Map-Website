// Google Sheet CSV URL
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3ZCOzJZwtsXjYwTkXlhRv2PvLQ1wEY1-NkH1t4QQa_wFO-dmx6utjofne7HyDdq9VYSKLGrISbMjz/pub?output=csv';

// Data is loaded from data.js as fallback
let companies = window.companies || [];

// Map Configuration
const mapConfig = {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false
};

// Initialize Map
const map = L.map('map', mapConfig);

// Add Dark Matter Tiles (CartoDB)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Custom Icon Definition
const createCustomIcon = (type) => {
    const color = type === 'HQ' ? '#00f0ff' : '#7000ff'; // Cyan for HQ, Purple for Regional
    const size = type === 'HQ' ? 12 : 8;

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
            border: 2px solid #fff;
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size]
    });
};

// State
let markers = [];

// CSV Parser
const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = currentLine[j].trim();
            }
            data.push(row);
        }
    }
    return data;
};

// Transform Flat CSV Data to Hierarchical Structure
const transformData = (flatData) => {
    const companyMap = new Map();

    flatData.forEach(row => {
        if (!row.Name) return; // Skip empty rows

        if (!companyMap.has(row.Name)) {
            companyMap.set(row.Name, {
                id: row.Name,
                name: row.Name,
                industry: row.Industry || 'Technology',
                description: row.Description || 'No description available.',
                offices: []
            });
        }

        const lat = parseFloat(row.Lat);
        const lng = parseFloat(row.Lng);

        // Only add office if coordinates are valid
        if (!isNaN(lat) && !isNaN(lng)) {
            const company = companyMap.get(row.Name);
            company.offices.push({
                city: row.City || 'Unknown City',
                country: row.Country || 'Unknown Country',
                lat: lat,
                lng: lng,
                type: row.Type || 'Office'
            });
        }
    });

    return Array.from(companyMap.values());
};

// Render Logic
const renderApp = (filteredCompanies = companies) => {
    const companyListEl = document.getElementById('company-list');
    companyListEl.innerHTML = '';

    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

});

companyListEl.appendChild(card);

// Add Markers to Map
company.offices.forEach(office => {
    const marker = L.marker([office.lat, office.lng], {
        icon: createCustomIcon(office.type),
        title: `${company.name} - ${office.city}`
    }).addTo(map);

    marker.bindPopup(`
                <h3>${company.name}</h3>
                <p><strong>${office.city}, ${office.country}</strong></p>
                <p>${office.type} Office</p>
            `);

    markers.push(marker);
});
    });
};

// Filter Logic
const searchInput = document.getElementById('search-input');
const companyFilter = document.getElementById('company-filter');
const cityFilter = document.getElementById('city-filter');

const populateDropdowns = () => {
    const uniqueCompanies = [...new Set(companies.map(c => c.name))].sort();
    // Get all cities from all offices
    const allCities = companies.flatMap(c => c.offices.map(o => o.city));
    const uniqueCities = [...new Set(allCities)].sort();

    if (companyFilter) {
        companyFilter.innerHTML = '<option value="">All Companies</option>';
        uniqueCompanies.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            companyFilter.appendChild(option);
        });
    }

    if (cityFilter) {
        cityFilter.innerHTML = '<option value="">All Cities</option>';
        uniqueCities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            cityFilter.appendChild(option);
        });
    }
};

const filterData = () => {
    const searchText = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedCompany = companyFilter ? companyFilter.value : '';
    const selectedCity = cityFilter ? cityFilter.value : '';

    const filtered = companies.filter(company => {
        // Search matches Company Name OR City
        const matchesSearch = company.name.toLowerCase().includes(searchText) ||
            company.offices.some(o => o.city.toLowerCase().includes(searchText));

        const matchesCompany = selectedCompany ? company.name === selectedCompany : true;

        const matchesCity = selectedCity ? company.offices.some(o => o.city === selectedCity) : true;

        return matchesSearch && matchesCompany && matchesCity;
    });

    renderApp(filtered);
};

// Add Event Listeners
if (searchInput) searchInput.addEventListener('input', filterData);
if (companyFilter) companyFilter.addEventListener('change', filterData);
if (cityFilter) cityFilter.addEventListener('change', filterData);

// Initialize App
const initApp = async () => {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        const flatData = parseCSV(csvText);
        companies = transformData(flatData);

        populateDropdowns();
        renderApp();
    } catch (error) {
        console.error('Error fetching data:', error);

        // Fallback to static data if fetch fails
        if (window.companies) {
            console.log('Falling back to static data');
            companies = window.companies;
            populateDropdowns();
            renderApp();
        }
    }
};

// Start App
initApp();

// Add Zoom Control
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Modal Logic
const modal = document.getElementById('data-modal');
const viewDataBtn = document.getElementById('view-data-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const tableBody = document.querySelector('#data-table tbody');

if (viewDataBtn) {
    viewDataBtn.addEventListener('click', () => {
        // Populate table
        tableBody.innerHTML = '';
        companies.forEach(company => {
            company.offices.forEach(office => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><span style="color: #fff; font-weight: 500;">${company.name}</span></td>
                    <td>${company.industry}</td>
                    <td>${office.city}</td>
                    <td>${office.country}</td>
                    <td><span style="
                        padding: 2px 6px; 
                        border-radius: 4px; 
                        background: ${office.type === 'HQ' ? 'rgba(0, 240, 255, 0.1)' : 'rgba(112, 0, 255, 0.1)'};
                        color: ${office.type === 'HQ' ? '#00f0ff' : '#7000ff'};
                        font-size: 0.75rem;
                    ">${office.type}</span></td>
                `;
                tableBody.appendChild(row);
            });
        });

        modal.classList.remove('hidden');
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

// Close modal on outside click
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}
