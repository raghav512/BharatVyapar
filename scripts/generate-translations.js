const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const SRC_DIR = path.join(__dirname, '../src');
const API_URL = 'https://bharat-fpo-vyapar.onrender.com/api/translate-text';

// Helper to recursively find JS/JSX files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Extract translation keys using regex
function extractKeys() {
  const files = findFiles(SRC_DIR);
  const keysSet = new Set();
  
  // Matches t('string') or t("string") including escaped quotes inside
  // \bt\(\s*(['"`])((?:\\.|[^\\])*?)\1\s*\)
  const regex = /\bt\(\s*(['"`])((?:\\.|[^\\])*?)\1\s*\)/g;

  for (const file of files) {
    // Skip reading directories or files inside locales folder
    if (file.includes(path.join('src', 'locales'))) continue;
    
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const key = match[2].replace(/\\/g, ''); // unescape characters
      if (key && key.trim()) {
        keysSet.add(key.trim());
      }
    }
  }

  // Add some known dynamic crops or config values that are translated dynamically
  const manualKeys = [
    'Wheat (Kanak)',
    'Soybean (Yellow)',
    'Chana (Gram)',
    'Member Stock',
    'Active Loans',
    'Active Listings',
    '8 Offers',
    '1,250 MT',
    '₹18.5 L',
    'Buy',
    'Sell',
    'Book Storage',
    'Apply Loan',
    'Purchased Stock',
    'Trade Finance',
    'Active Bids',
    '3,400 MT',
    '₹45.0 L',
    '12 Bids',
    'Locate Storage',
    'Milling Stock',
    'Material Loans',
    'Buy Indents',
    '2,100 MT',
    '₹30.0 L',
    '4 Active',
    'Factory Storage',
    'Capital Loan',
    'Bulk Inventory',
    'Corporate Credit',
    'Open Tenders',
    '12,500 MT',
    '₹1.2 Cr',
    '6 Bids',
    'Bulk Storage',
    'Credit Limit',
    'Bharat FPO Vyapar',
    'FPO Dashboard',
    'Trader Dashboard',
    'Miller Dashboard',
    'Corporate Dashboard',
    'Welcome back,',
    'Manage your agriculture trading & storage seamlessly.',
    'Partner',
    'Navigation Error',
    'Could not complete the transition to the requested page.',
    'OK'
  ];

  for (const k of manualKeys) {
    keysSet.add(k);
  }

  return Array.from(keysSet).sort();
}

async function translateBatch(texts, targetLang) {
  try {
    const response = await axios.post(API_URL, {
      text: texts,
      targetLang: targetLang
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    // Extract batch translation array
    const data = response.data;
    let list = null;
    if (data && data.success && Array.isArray(data.data)) {
      list = data.data;
    } else if (Array.isArray(data)) {
      list = data;
    } else if (data && typeof data === 'object') {
      list = data.translatedText || data.translation || (data.data && (data.data.translatedText || data.data.translation || data.data)) || null;
    }

    if (Array.isArray(list) && list.length === texts.length) {
      const result = {};
      texts.forEach((text, i) => {
        const item = list[i];
        let translated = '';
        if (item) {
          if (typeof item === 'string') {
            translated = item;
          } else if (typeof item === 'object') {
            translated = item.translatedText || item.translation || '';
          }
        }
        result[text] = translated ? String(translated).trim() : text;
      });
      return result;
    }

    // Fallback to individual translation calls if batch fails or returns unexpected format
    console.log('⚠️ Batch format mismatched. Falling back to individual translation requests.');
    const result = {};
    for (const text of texts) {
      try {
        const res = await axios.post(API_URL, { text, targetLang }, { timeout: 10000 });
        let translated = '';
        const payload = res.data;
        if (typeof payload === 'string') {
          translated = payload;
        } else if (payload && typeof payload === 'object') {
          translated = payload.translatedText || payload.translation || (payload.data && (payload.data.translatedText || payload.data.translation || payload.data)) || '';
        }
        result[text] = translated ? String(translated).trim() : text;
      } catch (err) {
        console.error(`❌ Failed to translate single key "${text}":`, err.message);
        result[text] = text;
      }
    }
    return result;
  } catch (error) {
    console.error('❌ Batch API call failed:', error.message);
    throw error;
  }
}

async function run() {
  console.log('🔍 Scanning src/ codebase for translation keys...');
  const keys = extractKeys();
  console.log(`✅ Found ${keys.length} unique translation keys.`);

  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true });
    console.log(`📁 Created locales directory: ${LOCALES_DIR}`);
  }

  // Load existing translations if any
  const enPath = path.join(LOCALES_DIR, 'en.json');
  const hiPath = path.join(LOCALES_DIR, 'hi.json');

  let enData = {};
  let hiData = {};

  if (fs.existsSync(enPath)) {
    try {
      enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not parse existing en.json');
    }
  }

  if (fs.existsSync(hiPath)) {
    try {
      hiData = JSON.parse(fs.readFileSync(hiPath, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not parse existing hi.json');
    }
  }

  // Populate enData
  keys.forEach(k => {
    enData[k] = k;
  });

  // Clean obsolete keys from enData
  Object.keys(enData).forEach(k => {
    if (!keys.includes(k)) {
      delete enData[k];
    }
  });

  // Find keys needing translation to Hindi
  const keysToTranslate = keys.filter(k => !hiData[k]);

  if (keysToTranslate.length > 0) {
    console.log(`🌐 Translating ${keysToTranslate.length} new keys to Hindi via API...`);
    
    // Chunk keys to translate in batches of 50
    const chunkSize = 50;
    for (let i = 0; i < keysToTranslate.length; i += chunkSize) {
      const chunk = keysToTranslate.slice(i, i + chunkSize);
      try {
        console.log(`📤 Sending chunk ${i / chunkSize + 1} (${chunk.length} items)...`);
        const translations = await translateBatch(chunk, 'hi');
        Object.assign(hiData, translations);
      } catch (err) {
        console.error(`❌ Failed to translate chunk starting at index ${i}:`, err.message);
        // Map them as self fallback for now
        chunk.forEach(k => {
          hiData[k] = k;
        });
      }
    }
  } else {
    console.log('✨ All keys are already translated in hi.json.');
  }

  // Clean obsolete keys from hiData
  Object.keys(hiData).forEach(k => {
    if (!keys.includes(k)) {
      delete hiData[k];
    }
  });

  // Write en.json and hi.json
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), 'utf8');
  fs.writeFileSync(hiPath, JSON.stringify(hiData, null, 2), 'utf8');

  console.log('🎉 Done! Locales updated:');
  console.log(`   - en.json updated: ${Object.keys(enData).length} keys`);
  console.log(`   - hi.json updated: ${Object.keys(hiData).length} translations`);
}

run().catch(console.error);
