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
            console.warn('CORS or Network error. Use manual CSV paste method.');
        }
    }

    const CITY_COORDINATES = {
        'London':      { lat: 51.5074,  lng: -0.1278  },
        'New York':    { lat: 40.7128,  lng: -74.0060 },
        'Berlin':      { lat: 52.5200,  lng: 13.4050  },
        'Paris':       { lat: 48.8566,  lng: 2.3522   },
        'Rome':        { lat: 41.9028,  lng: 12.4964  },
        'Madrid':      { lat: 40.4168,  lng: -3.7038  },
        'Amsterdam':   { lat: 52.3676,  lng: 4.9041   },
        'Brussels':    { lat: 50.8503,  lng: 4.3517   },
        'Dublin':      { lat: 53.3498,  lng: -6.2603  },
        'Warsaw':      { lat: 52.2297,  lng: 21.0122  },
        'Athens':      { lat: 37.9838,  lng: 23.7275  },
        'Copenhagen':  { lat: 55.6761,  lng: 12.5683  },
        'Stockholm':   { lat: 59.3293,  lng: 18.0686  },
        'Oslo':        { lat: 59.9139,  lng: 10.7522  },
        'Helsinki':    { lat: 60.1695,  lng: 24.9354  },
        'Hong Kong':   { lat: 22.3193,  lng: 114.1694 },
        'Sydney':      { lat: -33.8688, lng: 151.2093 },
        'Singapore':   { lat: 1.3521,   lng: 103.8198 },
        'Toronto':     { lat: 43.6510,  lng: -79.3470 }
    };

    const getCoords = (city, country) => {
        if (CITY_COORDINATES[city]) return CITY_COORDINATES[city];
        if (CITY_COORDINATES[country]) return CITY_COORDINATES[country];
        console.warn(No coords found for ", ". Defaulting to 0,0.);
        return { lat: 0, lng: 0 };
    };

    // Robust CSV parser that handles quoted fields with commas inside
    const parseCSV = (text) => {
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') { inQuotes = !inQuotes; }
                else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
                else { current += ch; }
            }
            values.push(current.trim());
            const row = {};
            headers.forEach((h, i) => row[h] = (values[i] || '').replace(/^"|"$/g, '').trim());
            return row;
        });
    };

    if (!csvText) { console.error('No data found.'); return; }

    const flatData = parseCSV(csvText);
    const companyMap = new Map();

    flatData.forEach(row => {
        if (!row.Name) return;
        if (!companyMap.has(row.Name)) {
            companyMap.set(row.Name, {
                id: row.Name,
                name: row.Name,
                industry: row.Industry || 'Technology',
                description: row.Description || '',
                website: row.Website || '',
                linkedin: row.LinkedIn || '',
                offices: []
            });
        }

        // Prefer Lat/Lng from CSV if valid, otherwise derive from city/country
        const csvLat = parseFloat(row.Lat);
        const csvLng = parseFloat(row.Lng);
        const coords = (!isNaN(csvLat) && !isNaN(csvLng) && csvLat !== 0)
            ? { lat: csvLat, lng: csvLng }
            : getCoords(row.City || '', row.Country || '');

        companyMap.get(row.Name).offices.push({
            city:                    row.City || '',
            country:                 row.Country || 'Unknown',
            lat:                     coords.lat,
            lng:                     coords.lng,
            type:                    row.Type || 'Office',
            signedTerms:             (row['Signed Terms'] || '').toLowerCase() === 'yes',
            signedTermsPercentage:   row['Signed Terms Percentage'] || row['Terms Percentage'] || 'N/A',
            paymentTerms:            row['Payment Terms'] || '',
            rebateTerms:             row['Rebate Terms'] || ''
        });
    });

    const companies = Array.from(companyMap.values());
    console.log(Uploading  companies to Firestore...);

    const sanitizeId = (name) => name.replace(/\//g, '-').replace(/[.#$\[\]]/g, '_');

    // Upload in batches of 400 (Firestore limit is 500 ops per batch)
    const BATCH_SIZE = 400;
    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
        const chunk = companies.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach(c => batch.set(db.collection('companies').doc(sanitizeId(c.name)), c));
        await batch.commit();
        console.log(Uploaded  / );
    }

    console.log('Migration Complete!');
    alert('Migration complete! Refresh to see the updated map.');
};

const clearData = async () => {
    console.log('Clearing database...');
    const snapshot = await db.collection('companies').get();
    const BATCH_SIZE = 400;
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    console.log('Database cleared.');
    alert('Database cleared! You can now start the new migration.');
};

window.migrateData = migrateData;
window.clearData = clearData;
console.log('Migration script ready. Run clearData() then load your file with the file picker.');
