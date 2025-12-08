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
                    offices: []
                });
            }
            const lat = parseFloat(row.Lat);
            const lng = parseFloat(row.Lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                const company = companyMap.get(row.Name);
                company.offices.push({
                    city: row.City || 'Unknown City',
                    country: row.Country || 'Unknown Country',
                    lat: lat,
                    lng: lng,
                    type: row.Type || 'Office',
                    signedTerms: row['Signed Terms'] ? row['Signed Terms'].trim().toLowerCase() === 'yes' : false
                });

                // Update company-level fields if present in any row
                if (row.Website) company.website = row.Website;
                if (row.LinkedIn) company.linkedin = row.LinkedIn;
            }
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
