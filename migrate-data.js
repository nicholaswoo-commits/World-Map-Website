// Migration Script: CSV to Firestore
// Run this in the browser console AFTER logging in.

const migrateData = async (manualCsvText) => {
    console.log('Starting migration...');

    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS3ZCOzJZwtsXjYwTkXlhRv2PvLQ1wEY1-NkH1t4QQa_wFO-dmx6utjofne7HyDdq9VYSKLGrISbMjz/pub?output=csv';
    let csvText = manualCsvText;

    if (!csvText) {
        try {
            const response = await fetch(SHEET_URL);
            if (response.ok) csvText = await response.text();
        } catch (error) {
            console.warn('CORS or Network error. Workaround available in help message.');
        }
    }

    const COUNTRY_COORDINATES = {
        'Canada': { lat: 56.1304, lng: -106.3468 },
        'USA': { lat: 37.0902, lng: -95.7129 },
        'United States': { lat: 37.0902, lng: -95.7129 },
        'US': { lat: 37.0902, lng: -95.7129 },
        'Spain': { lat: 40.4637, lng: -3.7492 },
        'Ireland': { lat: 53.1424, lng: -7.6921 },
        'UK': { lat: 55.3781, lng: -3.4360 },
        'United Kingdom': { lat: 55.3781, lng: -3.4360 },
        'France': { lat: 46.2276, lng: 2.2137 },
        'Germany': { lat: 51.1657, lng: 10.4515 },
        'Poland': { lat: 51.9194, lng: 19.1451 },
        'Italy': { lat: 41.8719, lng: 12.5674 },
        'Greece': { lat: 39.0742, lng: 21.8243 },
        'Netherlands': { lat: 52.1326, lng: 5.2913 },
        'Belgium': { lat: 50.5039, lng: 4.4699 },
        'Denmark': { lat: 56.2639, lng: 9.5018 },
        'Sweden': { lat: 60.1282, lng: 18.6435 },
        'Norway': { lat: 60.4720, lng: 8.4689 },
        'Finland': { lat: 61.9241, lng: 25.7482 },
        'Hong Kong': { lat: 22.3193, lng: 114.1694 },
        'Australia': { lat: -25.2744, lng: 133.7751 },
        'Singapore': { lat: 1.3521, lng: 103.8198 },
        'India': { lat: 20.5937, lng: 78.9629 },
        'Japan': { lat: 36.2048, lng: 138.2529 }
    };

    const getJitteredCoords = (country) => {
        const center = COUNTRY_COORDINATES[country];
        if (!center) {
            console.warn(`WARNING: Country "${country}" not found. Defaulting to 0,0.`);
            return { lat: 0, lng: 0 };
        }
        return {
            lat: center.lat + (Math.random() - 0.5) * 4,
            lng: center.lng + (Math.random() - 0.5) * 4
        };
    };

    const parseCSV = (text) => {
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((h, i) => row[h] = values[i] ? values[i].trim() : '');
            return row;
        });
    };

    if (!csvText) {
        console.error('No data found.');
        return;
    }

    const flatData = parseCSV(csvText);
    const companyMap = new Map();

    flatData.forEach(row => {
        if (!row.Name) return;
        if (!companyMap.has(row.Name)) {
            companyMap.set(row.Name, {
                id: row.Name,
                name: row.Name,
                industry: row.Industry || 'Technology',
                description: row.Description || 'No description.',
                website: row.Website || '',
                linkedin: row.LinkedIn || '',
                offices: []
            });
        }
        const coords = getJitteredCoords(row.Country || 'Unknown');
        companyMap.get(row.Name).offices.push({
            city: row.City || '',
            country: row.Country || 'Unknown',
            lat: coords.lat,
            lng: coords.lng,
            type: row.Type || 'Office',
            signedTerms: row['Signed Terms'] ? row['Signed Terms'].toLowerCase() === 'yes' : false,
            signedTermsPercentage: row['Signed Terms Percentage'] || 'N/A'
        });
    });

    const companies = Array.from(companyMap.values());
    console.log(`Uploading ${companies.length} companies...`);

    const batch = db.batch();
    companies.forEach(c => batch.set(db.collection('companies').doc(c.name), c));
    await batch.commit();
    console.log('Migration Complete.');
    alert('Migration complete! Refresh to see the latest map.');
};

window.migrateData = migrateData;
console.log('Migration script ready. Run window.migrateData() in console.');
