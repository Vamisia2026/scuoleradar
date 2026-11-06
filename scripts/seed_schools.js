// scripts/seed_schools.js
//
// Seeds Supabase table `radar_schools` from the official MIM
// "Informazioni anagrafiche scuole statali" open dataset.
//
// Usage:
//   node scripts/seed_schools.js
//   node scripts/seed_schools.js --sample=100
//
// Environment:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// The script is idempotent: it upserts on `school_code`.

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Official MIM open-data JSON registry.
// The page exposes several school years; we pin 2024/25 for stability.
// You can override with MIM_REGISTRY_URL if a newer distribution is preferred.
const DEFAULT_REGISTRY_URL =
  'https://dati.istruzione.it/opendata/opendata/catalogo/elements1/leaf/SCUANAGRAFESTAT20242520240901.json';

const REGISTRY_URL = process.env.MIM_REGISTRY_URL || DEFAULT_REGISTRY_URL;

const BATCH_SIZE = 500;

// School types we care about: secondaria (I and II grado) and istituti comprensivi.
const SECONDARY_KEYWORDS = [
  'SECONDARIA',
  'COMPRENSIVO',
  'ISTITUTO COMPRENSIVO',
  'ISTITUTO DI ISTRUZIONE SUPERIORE',
  'ISTITUTO TECNICO',
  'ISTITUTO PROFESSIONALE',
  'LICEO',
];

// ---------------------------------------------------------------------------
// CLI PARSING
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { sample: null };

  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--sample=')) {
      const value = raw.split('=')[1];
      const n = Number.parseInt(value, 10);
      if (Number.isNaN(n) || n <= 0) {
        console.error(`Invalid --sample value: ${value}`);
        process.exit(1);
      }
      args.sample = n;
    } else if (raw === '--sample') {
      // Default sample size is 100 when the flag is used without a number.
      args.sample = 100;
    } else if (raw === '--help' || raw === '-h') {
      console.log(`
Usage: node scripts/seed_schools.js [--sample=N]

  --sample=N   Use N curated test records instead of downloading MIM data.
               N is capped at 100 in this implementation.

Environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MIM_REGISTRY_URL  (optional, override the default JSON endpoint)
`);
      process.exit(0);
    }
  }

  return args;
}

const { sample: sampleSize } = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// FIELD MAPPING HELPERS
// ---------------------------------------------------------------------------

/**
 * Return the first non-empty value from an object for a list of possible keys.
 * MIM open-data uses uppercase Italian column names, but aliases keep the
 * script resilient to minor schema changes.
 */
function pick(obj, keys) {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

/**
 * Normalise the website field: drop placeholder values and ensure a protocol.
 */
function normaliseWebsite(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || /^assente$/i.test(trimmed) || trimmed === '-') return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Decide whether a record belongs to the target school types
 * (secondary schools and comprehensive institutes).
 */
function isTargetSchoolType(value) {
  if (!value) return false;
  const upper = value.toUpperCase();
  return SECONDARY_KEYWORDS.some((kw) => upper.includes(kw));
}

/**
 * Map a raw MIM record to the Supabase schema.
 */
function mapSchool(raw) {
  const schoolCode = pick(raw, [
    'CODICESCUOLA',
    'CODICEMECCANOGRAFICO',
    'CODICE_SCUOLA',
  ]);

  if (!schoolCode) return null;

  const name = pick(raw, [
    'DENOMINAZIONESCUOLA',
    'DENOMINAZIONE_SCUOLA',
    'DENOMINAZIONE',
  ]);

  const province = pick(raw, [
    'SIGLAPROVINCIA',
    'PROVINCIA',
    'SIGLA_PROVINCIA',
  ]);

  const region = pick(raw, [
    'DESCRIZIONEREGIONE',
    'REGIONE',
    'DESCRIZIONE_REGIONE',
  ]);

  const schoolType = pick(raw, [
    'ORDINESCUOLA',
    'DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA',
    'TIPO_SCUOLA',
    'ORDINE_SCUOLA',
  ]);

  const website = normaliseWebsite(
    pick(raw, ['SITOWEBSCUOLA', 'SITOWEB', 'SITO_WEB'])
  );

  if (!name) return null;

  return {
    school_code: schoolCode.toUpperCase(),
    name,
    province: province ? province.toUpperCase() : null,
    region,
    school_type: schoolType,
    website,
  };
}

// ---------------------------------------------------------------------------
// SAMPLE DATASET (100 curated records)
// ---------------------------------------------------------------------------

/**
 * Returns 100 representative records distributed across Italy.
 * Includes Asti (AT), Rome (RM), Milan (MI), and Parma (PR).
 */
function getSampleSchools() {
  const samples = [];

  const add = (code, name, province, region, type, website) => {
    samples.push({
      school_code: code,
      name,
      province,
      region,
      school_type: type,
      website,
    });
  };

  // --- Asti (AT) — 20 records -------------------------------------------
  const atNames = [
    'IIS "Vittorio Alfieri"',
    'Liceo Classico "Vittorio Alfieri"',
    'Liceo Scientifico "F. Vercelli"',
    'IIS "G. Penna"',
    'ITC "G. Penna"',
    'IPSIA "Castigliano"',
    'IC "Asti 1"',
    'IC "Asti 2"',
    'IC "Asti 3"',
    'IC "Costigliole d\'Asti"',
    'IC "Canelli"',
    'IC "Nizza Monferrato"',
    'IC "Villanova d\'Asti"',
    'IIS "Monti"',
    'Liceo Artistico "Benedetto Alfieri"',
    'IIS "Giobert"',
    'IC "San Damiano d\'Asti"',
    'IC "Buttigliera d\'Asti"',
    'IC "Montechiaro d\'Asti"',
    'IIS "Pietro Andriano"',
  ];
  atNames.forEach((name, i) => {
    const code = `ATIS${String(i + 1).padStart(3, '0')}00${String(i + 1).padStart(2, '0')}`.slice(0, 10);
    add(code, name, 'AT', 'Piemonte', i % 3 === 0 ? 'Istituto Comprensivo' : 'Scuola Secondaria di II Grado', `https://www.${code.toLowerCase()}.edu.it`);
  });

  // --- Rome (RM) — 20 records -------------------------------------------
  const rmNames = [
    'Liceo Classico "Ennio Quirino Visconti"',
    'Liceo Scientifico "Farnesina"',
    'Liceo Ginnasio "Virgilio"',
    'IIS "Leonardo da Vinci"',
    'IIS "Galileo Galilei"',
    'ITC "Lucio Anneo Seneca"',
    'IPSIA "Cine TV Roberto Rossellini"',
    'IC "Piazza Winckelmann"',
    'IC "Via delle Carine"',
    'IC "Giulio Cesare"',
    'IC "Daniele Manin"',
    'IC "Federico Torre"',
    'IC "Aldo Fabrizi"',
    'IC "Sandro Pertini"',
    'Liceo Scientifico "Augusto Righi"',
    'Liceo Linguistico "Ninni Cassarà"',
    'IIS "Tommaso Salvini"',
    'IIS "Carlo Emilio Gadda"',
    'IC "Viale dei Consoli"',
    'IC "Largo Orioli"',
  ];
  rmNames.forEach((name, i) => {
    const code = `RMIS${String(100 + i).padStart(3, '0')}00${String(i + 1).padStart(2, '0')}`.slice(0, 10);
    add(code, name, 'RM', 'Lazio', i % 4 === 0 ? 'Istituto Comprensivo' : 'Scuola Secondaria di II Grado', `https://www.${code.toLowerCase()}.edu.it`);
  });

  // --- Milan (MI) — 20 records ------------------------------------------
  const miNames = [
    'Liceo Classico "Giovanni Berchet"',
    'Liceo Scientifico "Luigi Cremona"',
    'Liceo Scientifico "Alessandro Volta"',
    'IIS "Ettore Majorana"',
    'IIS "Cesare Correnti"',
    'ITC "Pietro Verri"',
    'IPSIA "Luigi Einaudi"',
    'IC "Cadorna"',
    'IC "Manzoni"',
    'IC "Carducci"',
    'IC "Pascoli"',
    'IC "Frisi"',
    'IC "Rinnovata Pizzigoni"',
    'IC "Tommaso Grossi"',
    'Liceo Artistico "Brera"',
    'Liceo delle Scienze Umane "Virgilio"',
    'IIS "Giosuè Carducci"',
    'IIS "Alessandro Greppi"',
    'IC "Via De Nicola"',
    'IC "Via Palmieri"',
  ];
  miNames.forEach((name, i) => {
    const code = `MIIS${String(200 + i).padStart(3, '0')}00${String(i + 1).padStart(2, '0')}`.slice(0, 10);
    add(code, name, 'MI', 'Lombardia', i % 4 === 0 ? 'Istituto Comprensivo' : 'Scuola Secondaria di II Grado', `https://www.${code.toLowerCase()}.edu.it`);
  });

  // --- Parma (PR) — 20 records ------------------------------------------
  const prNames = [
    'Liceo Classico "Maria Luigia"',
    'Liceo Scientifico "Guglielmo Marconi"',
    'Liceo delle Scienze Umane "Albertina Sanvitale"',
    'IIS "Giambattista Bodoni"',
    'IIS "Paolo Toschi"',
    'ITC "Macedonio Melloni"',
    'IPSIA "Primo Levi"',
    'IC "Parma Centro"',
    'IC "Parma Ovest"',
    'IC "Parma Est"',
    'IC "Collecchio"',
    'IC "Fidenza"',
    'IC "Salsomaggiore Terme"',
    'IC "Borgo Val di Taro"',
    'IIS "Zappa-Fermi"',
    'Liceo Artistico "Paolo Toschi"',
    'IIS "Galileo Galilei"',
    'IC "Traversetolo"',
    'IC "Langhirano"',
    'IC "Fontanellato"',
  ];
  prNames.forEach((name, i) => {
    const code = `PRIS${String(300 + i).padStart(3, '0')}00${String(i + 1).padStart(2, '0')}`.slice(0, 10);
    add(code, name, 'PR', 'Emilia-Romagna', i % 3 === 0 ? 'Istituto Comprensivo' : 'Scuola Secondaria di II Grado', `https://www.${code.toLowerCase()}.edu.it`);
  });

  // --- Other representative cities — 20 records -------------------------
  const other = [
    ['TOIS00100A', 'Liceo Classico "Massimo D\'Azeglio"', 'TO', 'Piemonte', 'Scuola Secondaria di II Grado'],
    ['TOIC00200B', 'IC "Torino Centro"', 'TO', 'Piemonte', 'Istituto Comprensivo'],
    ['FIIS00300C', 'Liceo Scientifico "Galileo Galilei"', 'FI', 'Toscana', 'Scuola Secondaria di II Grado'],
    ['FIIC00400D', 'IC "Firenze Nord"', 'FI', 'Toscana', 'Istituto Comprensivo'],
    ['BOIS00500E', 'Liceo Classico "Marco Minghetti"', 'BO', 'Emilia-Romagna', 'Scuola Secondaria di II Grado'],
    ['BOIC00600F', 'IC "Bologna Centro"', 'BO', 'Emilia-Romagna', 'Istituto Comprensivo'],
    ['NAIS00700G', 'Liceo Classico "Vittorio Emanuele II"', 'NA', 'Campania', 'Scuola Secondaria di II Grado'],
    ['NAIC00800H', 'IC "Napoli Centro"', 'NA', 'Campania', 'Istituto Comprensivo'],
    ['PAIS00900I', 'Liceo Classico "Giovanni Meli"', 'PA', 'Sicilia', 'Scuola Secondaria di II Grado'],
    ['PAIC01000J', 'IC "Palermo Centro"', 'PA', 'Sicilia', 'Istituto Comprensivo'],
    ['CTIS01100K', 'Liceo Scientifico "Galileo Galilei"', 'CT', 'Sicilia', 'Scuola Secondaria di II Grado'],
    ['CTIC01200L', 'IC "Catania Centro"', 'CT', 'Sicilia', 'Istituto Comprensivo'],
    ['VEIS01300M', 'Liceo Classico "Marco Foscarini"', 'VE', 'Veneto', 'Scuola Secondaria di II Grado'],
    ['VEIC01400N', 'IC "Venezia Centro"', 'VE', 'Veneto', 'Istituto Comprensivo'],
    ['GEIS01500O', 'Liceo Classico "Cristoforo Colombo"', 'GE', 'Liguria', 'Scuola Secondaria di II Grado'],
    ['GEIC01600P', 'IC "Genova Centro"', 'GE', 'Liguria', 'Istituto Comprensivo'],
    ['BAIS01700Q', 'Liceo Classico "Socrate"', 'BA', 'Puglia', 'Scuola Secondaria di II Grado'],
    ['BAIC01800R', 'IC "Bari Centro"', 'BA', 'Puglia', 'Istituto Comprensivo'],
    ['CAIS01900S', 'Liceo Scientifico "Albert Einstein"', 'CA', 'Sardegna', 'Scuola Secondaria di II Grado'],
    ['CAIC02000T', 'IC "Cagliari Centro"', 'CA', 'Sardegna', 'Istituto Comprensivo'],
  ];

  other.forEach(([code, name, province, region, type]) => {
    add(code, name, province, region, type, `https://www.${code.toLowerCase()}.edu.it`);
  });

  return samples.slice(0, 100);
}

// ---------------------------------------------------------------------------
// MIM REGISTRY DOWNLOAD & PARSING
// ---------------------------------------------------------------------------

/**
 * Download the MIM JSON registry.
 * Returns an array of raw school objects.
 */
async function downloadMimRegistry() {
  console.log(`Downloading MIM registry from: ${REGISTRY_URL}`);

  const response = await axios.get(REGISTRY_URL, {
    responseType: 'json',
    timeout: 120_000, // 2 minutes: the file is ~53 MB
    maxContentLength: 200 * 1024 * 1024, // 200 MB safety limit
    headers: {
      'User-Agent': 'ScuoleRadarSeeder/1.0 (+https://scuoleradar.it)',
      Accept: 'application/json',
    },
  });

  const data = response.data;

  // The MIM JSON distribution is normally a JSON array.
  if (Array.isArray(data)) {
    return data;
  }

  // Defensive: some distributions wrap the array in a top-level object.
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;

  // Defensive: fallback to NDJSON if the endpoint ever changes.
  if (typeof data === 'string') {
    return data
      .split('\n')
      .filter((line) => line.trim().startsWith('{'))
      .map((line) => JSON.parse(line));
  }

  throw new Error('Unexpected MIM JSON shape: expected an array of records.');
}

/**
 * Transform raw MIM records into the `radar_schools` schema.
 * Filters for secondary schools and comprehensive institutes.
 */
function transformRecords(rawRecords) {
  const mapped = [];
  let skippedType = 0;
  let skippedInvalid = 0;

  for (const raw of rawRecords) {
    const schoolType = pick(raw, [
      'ORDINESCUOLA',
      'DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA',
      'TIPO_SCUOLA',
      'ORDINE_SCUOLA',
    ]);

    if (!isTargetSchoolType(schoolType)) {
      skippedType += 1;
      continue;
    }

    const record = mapSchool(raw);
    if (!record) {
      skippedInvalid += 1;
      continue;
    }

    mapped.push(record);
  }

  console.log(
    `Transformed ${mapped.length} records ` +
      `(skipped ${skippedType} non-target types, ${skippedInvalid} invalid).`
  );

  return mapped;
}

// ---------------------------------------------------------------------------
// SUPABASE UPSERT
// ---------------------------------------------------------------------------

/**
 * Upsert records in batches. Returns { successCount, failureCount }.
 */
async function upsertSchools(records) {
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const { error, count } = await supabase
      .from('radar_schools')
      .upsert(batch, {
        onConflict: 'school_code',
        ignoreDuplicates: false,
        count: 'exact',
      });

    if (error) {
      failureCount += batch.length;
      console.error(
        `Batch ${batchNumber} failed (${batch.length} records):`,
        error.message
      );
      if (error.details) console.error('  Details:', error.details);
      if (error.hint) console.error('  Hint:', error.hint);
    } else {
      const written = count ?? batch.length;
      successCount += written;
      console.log(
        `Batch ${batchNumber}: upserted ${written}/${batch.length} records.`
      );
    }
  }

  return { successCount, failureCount };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  try {
    let records;

    if (sampleSize !== null) {
      console.log(`Using curated sample dataset (${sampleSize} records).`);
      records = getSampleSchools().slice(0, sampleSize);
      console.log(`Loaded ${records.length} sample schools.`);
    } else {
      const raw = await downloadMimRegistry();
      console.log(`Downloaded ${raw.length} raw MIM records.`);
      records = transformRecords(raw);
    }

    if (records.length === 0) {
      console.warn('No records to upsert. Exiting.');
      process.exit(0);
    }

    const { successCount, failureCount } = await upsertSchools(records);

    console.log('\n--- Seed summary ---');
    console.log(`Records processed : ${records.length}`);
    console.log(`Upserted          : ${successCount}`);
    console.log(`Failed            : ${failureCount}`);

    if (failureCount > 0) {
      console.error('Some batches failed. See logs above.');
      process.exit(1);
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during seeding:');
    console.error(err.stack || err.message || err);
    process.exit(1);
  }
}

main();