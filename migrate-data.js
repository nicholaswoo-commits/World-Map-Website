// Migration Script: CSV to Firestore
// Run this in the browser console AFTER logging in.

const migrateData = async (manualCsvText) => {
    console.log('Starting migration...');

    // 1. Get Data (Fetch or Fallback)
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3ZCOzJZwtsXjYwTkXlhRv2PvLQ1wEY1-NkH1t4QQa_wFO-dmx6utjofne7HyDdq9VYSKLGrISbMjz/pub?output=csv';
    let csvText = manualCsvText;

    if (!csvText) {
        try {
            const response = await fetch(SHEET_URL);
            if (response.ok) {
                csvText = await response.text();
            }
        } catch (error) {
            console.warn('Direct fetch failed (likely CORS). Checking for fallbacks...', error);
        }
    }

    // Reuse existing parse/transform logic
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

    // Country Center Coordinates (Approximate)
    const COUNTRY_COORDINATES = {
        'USA': { lat: 37.0902, lng: -95.7129 },
        'UK': { lat: 55.3781, lng: -3.4360 },
        'Singapore': { lat: 1.3521, lng: 103.8198 },
        'India': { lat: 20.5937, lng: 78.9629 },
        'Japan': { lat: 36.2048, lng: 138.2529 },
        'South Korea': { lat: 35.9078, lng: 127.7669 },
        'Korea': { lat: 35.9078, lng: 127.7669 },
        'Ireland': { lat: 53.1424, lng: -7.6921 },
        'Netherlands': { lat: 52.1326, lng: 5.2913 },
        'Israel': { lat: 31.0461, lng: 34.8516 },
        'Canada': { lat: 56.1304, lng: -106.3468 },
        'France': { lat: 46.2276, lng: 2.2137 },
        'Poland': { lat: 51.9194, lng: 19.1451 },
        'Australia': { lat: -25.2744, lng: 133.7751 },
        'Philippines': { lat: 12.8797, lng: 121.7740 },
        'New Zealand': { lat: -40.9006, lng: 174.8860 },
        'Malaysia': { lat: 4.2105, lng: 101.9758 },
        'China': { lat: 35.8617, lng: 104.1954 },
        'Germany': { lat: 51.1657, lng: 10.4515 },
        'Brazil': { lat: -14.2350, lng: -51.9253 },
        'Mexico': { lat: 23.6345, lng: -102.5528 }
    };

    const getJitteredCoords = (country) => {
        const center = COUNTRY_COORDINATES[country] || { lat: 0, lng: 0 }; // Default to 0,0 if unknown
        // Jitter by +/- 2-5 degrees to spread them out
        const jitterLat = (Math.random() - 0.5) * 4;
        const jitterLng = (Math.random() - 0.5) * 4;
        return {
            lat: center.lat + jitterLat,
            lng: center.lng + jitterLng
        };
    };

    const transformData = (flatData) => {
        const companyMap = new Map();
        flatData.forEach(row => {
            if (!row.Name) return;
            if (!companyMap.has(row.Name)) {
                companyMap.set(row.Name, {
                    id: row.Name,
                    name: row.Name,
                    industry: row.Industry || 'Technology',
                    description: row.Description || 'No description available.',
                    offices: [],
                    signedTermsPercentage: row['Signed Terms Percentage'] || 'N/A' // New Field
                });
            }

            // Generate Coords based on Country
            const country = row.Country || 'Unknown';
            const coords = getJitteredCoords(country);

            const company = companyMap.get(row.Name);
            company.offices.push({
                city: row.City || 'Unknown City', // Still keeping city name for display if available
                country: country,
                lat: coords.lat,
                lng: coords.lng, // Generated
                type: row.Type || 'Office',
                signedTerms: row['Signed Terms'] ? row['Signed Terms'].trim().toLowerCase() === 'yes' : false
            });

            // Update company-level fields if present in any row
            if (row.Website) company.website = row.Website;
            if (row.LinkedIn) company.linkedin = row.LinkedIn;
            if (row['Signed Terms Percentage']) company.signedTermsPercentage = row['Signed Terms Percentage'];
        });
        return Array.from(companyMap.values());
    };

    let companies = [];

    if (csvText) {
        console.log('Using CSV data...');
        const flatData = parseCSV(csvText);
        companies = transformData(flatData);
    } else if (window.companies && window.companies.length > 0) {
        console.log('Using local fallback data (data.js)...');
        companies = window.companies;
    } else {
        console.error('No data found. Please provide CSV text manually.');
        alert('Migration Failed: Could not fetch data. \n\nWorkaround: \n1. Open the Google Sheet CSV URL in a new tab. \n2. Copy all text. \n3. Run: window.migrateData(`PASTE_TEXT_HERE`)');
        return;
    }

    console.log(`Ready to upload ${companies.length} companies.`);

    // 2. Upload to Firestore
    try {
        const batch = db.batch();

        companies.forEach(company => {
            const docRef = db.collection('companies').doc(company.name); // Use name as ID
            batch.set(docRef, company);
        });

        await batch.commit();
        console.log('Migration complete! Data uploaded to Firestore.');
        alert('Migration complete! Refresh the page to see data from Firestore.');
    } catch (error) {
        console.error('Firestore upload failed:', error);
        alert('Upload failed. Check console for details.');
    }
};

// Expose to window so user can call it
window.migrateData = migrateData;
console.log('Migration script loaded. Run window.migrateData() in console to start.');
