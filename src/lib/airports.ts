import type { AirportRef } from "./types";

export interface Airport extends AirportRef {
  lat: number;
  lon: number;
  metro?: string;
}

export interface Place {
  kind: "airport" | "metro";
  code: string;
  name: string; // airport name or "All airports"
  city: string;
  cc: string;
  airports: string[];
}

// [code, name, city, cc, lat, lon, tz, metro?]
type Row = [string, string, string, string, number, number, string, string?];
const ROWS: Row[] = [
  ["LHR", "Heathrow", "London", "GB", 51.47, -0.4543, "Europe/London", "LON"],
  ["LGW", "Gatwick", "London", "GB", 51.1537, -0.1821, "Europe/London", "LON"],
  ["STN", "Stansted", "London", "GB", 51.886, 0.2389, "Europe/London", "LON"],
  ["CDG", "Charles de Gaulle", "Paris", "FR", 49.0097, 2.5479, "Europe/Paris", "PAR"],
  ["ORY", "Orly", "Paris", "FR", 48.7233, 2.3794, "Europe/Paris", "PAR"],
  ["AMS", "Schiphol", "Amsterdam", "NL", 52.3105, 4.7683, "Europe/Amsterdam"],
  ["FRA", "Frankfurt am Main", "Frankfurt", "DE", 50.0379, 8.5622, "Europe/Berlin"],
  ["MUC", "Munich", "Munich", "DE", 48.3538, 11.7861, "Europe/Berlin"],
  ["BER", "Brandenburg", "Berlin", "DE", 52.3667, 13.5033, "Europe/Berlin"],
  ["MAD", "Barajas", "Madrid", "ES", 40.4983, -3.5676, "Europe/Madrid"],
  ["BCN", "El Prat", "Barcelona", "ES", 41.2974, 2.0833, "Europe/Madrid"],
  ["LIS", "Humberto Delgado", "Lisbon", "PT", 38.7742, -9.1342, "Europe/Lisbon"],
  ["OPO", "Francisco Sá Carneiro", "Porto", "PT", 41.2481, -8.6814, "Europe/Lisbon"],
  ["FCO", "Fiumicino", "Rome", "IT", 41.8003, 12.2389, "Europe/Rome"],
  ["MXP", "Malpensa", "Milan", "IT", 45.6306, 8.7281, "Europe/Rome"],
  ["ZRH", "Zurich", "Zurich", "CH", 47.4647, 8.5492, "Europe/Zurich"],
  ["VIE", "Vienna", "Vienna", "AT", 48.1103, 16.5697, "Europe/Vienna"],
  ["CPH", "Kastrup", "Copenhagen", "DK", 55.618, 12.6508, "Europe/Copenhagen"],
  ["ARN", "Arlanda", "Stockholm", "SE", 59.6519, 17.9186, "Europe/Stockholm"],
  ["OSL", "Gardermoen", "Oslo", "NO", 60.1939, 11.1004, "Europe/Oslo"],
  ["HEL", "Vantaa", "Helsinki", "FI", 60.3172, 24.9633, "Europe/Helsinki"],
  ["DUB", "Dublin", "Dublin", "IE", 53.4213, -6.2701, "Europe/Dublin"],
  ["ATH", "Eleftherios Venizelos", "Athens", "GR", 37.9364, 23.9445, "Europe/Athens"],
  ["IST", "Istanbul", "Istanbul", "TR", 41.2753, 28.7519, "Europe/Istanbul"],
  ["KEF", "Keflavík", "Reykjavík", "IS", 63.985, -22.6056, "Atlantic/Reykjavik"],
  ["JFK", "John F. Kennedy", "New York", "US", 40.6398, -73.7789, "America/New_York", "NYC"],
  ["EWR", "Newark Liberty", "New York", "US", 40.6925, -74.1687, "America/New_York", "NYC"],
  ["LGA", "LaGuardia", "New York", "US", 40.7769, -73.874, "America/New_York", "NYC"],
  ["BOS", "Logan", "Boston", "US", 42.3643, -71.0052, "America/New_York"],
  ["ORD", "O'Hare", "Chicago", "US", 41.9742, -87.9073, "America/Chicago"],
  ["ATL", "Hartsfield–Jackson", "Atlanta", "US", 33.6407, -84.4277, "America/New_York"],
  ["MIA", "Miami", "Miami", "US", 25.7959, -80.287, "America/New_York"],
  ["LAX", "Los Angeles", "Los Angeles", "US", 33.9425, -118.4081, "America/Los_Angeles"],
  ["SFO", "San Francisco", "San Francisco", "US", 37.6213, -122.379, "America/Los_Angeles"],
  ["SEA", "Seattle–Tacoma", "Seattle", "US", 47.4502, -122.3088, "America/Los_Angeles"],
  ["YYZ", "Pearson", "Toronto", "CA", 43.6777, -79.6248, "America/Toronto"],
  ["YVR", "Vancouver", "Vancouver", "CA", 49.1947, -123.1792, "America/Vancouver"],
  ["MEX", "Benito Juárez", "Mexico City", "MX", 19.4363, -99.0721, "America/Mexico_City"],
  ["BOG", "El Dorado", "Bogotá", "CO", 4.7016, -74.1469, "America/Bogota"],
  ["GRU", "Guarulhos", "São Paulo", "BR", -23.4356, -46.4731, "America/Sao_Paulo"],
  ["EZE", "Ezeiza", "Buenos Aires", "AR", -34.8222, -58.5358, "America/Argentina/Buenos_Aires"],
  ["SCL", "Arturo Merino Benítez", "Santiago", "CL", -33.393, -70.7858, "America/Santiago"],
  ["LIM", "Jorge Chávez", "Lima", "PE", -12.0219, -77.1143, "America/Lima"],
  ["DXB", "Dubai", "Dubai", "AE", 25.2532, 55.3657, "Asia/Dubai"],
  ["AUH", "Zayed", "Abu Dhabi", "AE", 24.433, 54.6511, "Asia/Dubai"],
  ["DOH", "Hamad", "Doha", "QA", 25.2731, 51.6081, "Asia/Qatar"],
  ["CPT", "Cape Town", "Cape Town", "ZA", -33.9715, 18.6021, "Africa/Johannesburg"],
  ["JNB", "O. R. Tambo", "Johannesburg", "ZA", -26.1337, 28.242, "Africa/Johannesburg"],
  ["CMN", "Mohammed V", "Casablanca", "MA", 33.3675, -7.5898, "Africa/Casablanca"],
  ["RAK", "Menara", "Marrakech", "MA", 31.6069, -8.0363, "Africa/Casablanca"],
  ["CAI", "Cairo", "Cairo", "EG", 30.1219, 31.4056, "Africa/Cairo"],
  ["NBO", "Jomo Kenyatta", "Nairobi", "KE", -1.3192, 36.9275, "Africa/Nairobi"],
  ["LOS", "Murtala Muhammed", "Lagos", "NG", 6.5774, 3.3212, "Africa/Lagos"],
  ["DEL", "Indira Gandhi", "Delhi", "IN", 28.5562, 77.1, "Asia/Kolkata"],
  ["BOM", "Chhatrapati Shivaji", "Mumbai", "IN", 19.0896, 72.8656, "Asia/Kolkata"],
  ["SIN", "Changi", "Singapore", "SG", 1.3644, 103.9915, "Asia/Singapore"],
  ["BKK", "Suvarnabhumi", "Bangkok", "TH", 13.69, 100.7501, "Asia/Bangkok"],
  ["HKG", "Hong Kong", "Hong Kong", "HK", 22.308, 113.9185, "Asia/Hong_Kong"],
  ["HND", "Haneda", "Tokyo", "JP", 35.5494, 139.7798, "Asia/Tokyo", "TYO"],
  ["NRT", "Narita", "Tokyo", "JP", 35.772, 140.3929, "Asia/Tokyo", "TYO"],
  ["KIX", "Kansai", "Osaka", "JP", 34.4347, 135.244, "Asia/Tokyo"],
  ["ICN", "Incheon", "Seoul", "KR", 37.4602, 126.4407, "Asia/Seoul"],
  ["PEK", "Capital", "Beijing", "CN", 40.0799, 116.5844, "Asia/Shanghai"],
  ["PVG", "Pudong", "Shanghai", "CN", 31.1443, 121.8083, "Asia/Shanghai"],
  ["TPE", "Taoyuan", "Taipei", "TW", 25.0797, 121.2342, "Asia/Taipei"],
  ["KUL", "Kuala Lumpur", "Kuala Lumpur", "MY", 2.7456, 101.7099, "Asia/Kuala_Lumpur"],
  ["CGK", "Soekarno–Hatta", "Jakarta", "ID", -6.1256, 106.6559, "Asia/Jakarta"],
  ["SYD", "Kingsford Smith", "Sydney", "AU", -33.9399, 151.1753, "Australia/Sydney"],
  ["MEL", "Tullamarine", "Melbourne", "AU", -37.669, 144.841, "Australia/Melbourne"],
  ["AKL", "Auckland", "Auckland", "NZ", -37.0082, 174.785, "Pacific/Auckland"],
  // ── Nigeria ────────────────────────────────────────────────────────────────
  // Domestic traffic is ~73% of Nigerian passenger movements, so a Lagos-only
  // database makes the largest part of the market unsearchable.
  ["ABV", "Nnamdi Azikiwe", "Abuja", "NG", 9.0068, 7.2632, "Africa/Lagos"],
  ["PHC", "Port Harcourt International", "Port Harcourt", "NG", 5.0155, 6.9496, "Africa/Lagos"],
  ["KAN", "Mallam Aminu Kano", "Kano", "NG", 12.0476, 8.5246, "Africa/Lagos"],
  ["ENU", "Akanu Ibiam", "Enugu", "NG", 6.4742, 7.5619, "Africa/Lagos"],
  ["QOW", "Sam Mbakwe", "Owerri", "NG", 5.4271, 7.2064, "Africa/Lagos"],
  ["BNI", "Benin City", "Benin City", "NG", 6.3169, 5.5995, "Africa/Lagos"],
  ["CBQ", "Margaret Ekpo", "Calabar", "NG", 4.9757, 8.3472, "Africa/Lagos"],
  ["KAD", "Kaduna International", "Kaduna", "NG", 10.696, 7.3201, "Africa/Lagos"],
  ["JOS", "Yakubu Gowon", "Jos", "NG", 9.6399, 8.8691, "Africa/Lagos"],
  ["SKO", "Sadiq Abubakar III", "Sokoto", "NG", 12.9163, 5.2075, "Africa/Lagos"],
  ["MIU", "Maiduguri International", "Maiduguri", "NG", 11.8553, 13.0809, "Africa/Lagos"],
  ["YOL", "Yola", "Yola", "NG", 9.2575, 12.4304, "Africa/Lagos"],
  ["ILR", "Ilorin International", "Ilorin", "NG", 8.4932, 4.5943, "Africa/Lagos"],
  ["IBA", "Ibadan", "Ibadan", "NG", 7.3625, 3.9783, "Africa/Lagos"],
  ["QRW", "Warri", "Warri", "NG", 5.5982, 5.8187, "Africa/Lagos"],
  ["ABB", "Asaba International", "Asaba", "NG", 6.2042, 6.6653, "Africa/Lagos"],
  // ── West African and regional neighbours ───────────────────────────────────
  ["ACC", "Kotoka International", "Accra", "GH", 5.6052, -0.1668, "Africa/Accra"],
  ["ABJ", "Felix-Houphouet-Boigny", "Abidjan", "CI", 5.2614, -3.9263, "Africa/Abidjan"],
  ["LFW", "Lome-Tokoin", "Lome", "TG", 6.1656, 1.2544, "Africa/Lome"],
  ["COO", "Cadjehoun", "Cotonou", "BJ", 6.3572, 2.3844, "Africa/Porto-Novo"],
  ["DLA", "Douala International", "Douala", "CM", 4.0061, 9.7195, "Africa/Douala"],
  ["ADD", "Bole International", "Addis Ababa", "ET", 8.9779, 38.7993, "Africa/Addis_Ababa"],
  // ── Global coverage pass ───────────────────────────────────────────────────
  // Africa
  ["DAR", "Julius Nyerere", "Dar es Salaam", "TZ", -6.8781, 39.2026, "Africa/Dar_es_Salaam"],
  ["EBB", "Entebbe International", "Entebbe", "UG", 0.0424, 32.4435, "Africa/Kampala"],
  ["KGL", "Kigali International", "Kigali", "RW", -1.9686, 30.1395, "Africa/Kigali"],
  ["HRE", "Robert Gabriel Mugabe", "Harare", "ZW", -17.9318, 31.0928, "Africa/Harare"],
  ["LUN", "Kenneth Kaunda", "Lusaka", "ZM", -15.3308, 28.4526, "Africa/Lusaka"],
  ["MBA", "Moi International", "Mombasa", "KE", -4.0348, 39.5942, "Africa/Nairobi"],
  ["DSS", "Blaise Diagne", "Dakar", "SN", 14.6709, -17.0733, "Africa/Dakar"],
  ["TUN", "Tunis-Carthage", "Tunis", "TN", 36.851, 10.2272, "Africa/Tunis"],
  ["ALG", "Houari Boumediene", "Algiers", "DZ", 36.691, 3.2154, "Africa/Algiers"],
  ["FIH", "N'djili", "Kinshasa", "CD", -4.3857, 15.4446, "Africa/Kinshasa"],
  // Middle East
  ["RUH", "King Khalid", "Riyadh", "SA", 24.9576, 46.6988, "Asia/Riyadh"],
  ["JED", "King Abdulaziz", "Jeddah", "SA", 21.6796, 39.1565, "Asia/Riyadh"],
  ["MCT", "Muscat International", "Muscat", "OM", 23.5933, 58.2844, "Asia/Muscat"],
  ["KWI", "Kuwait International", "Kuwait City", "KW", 29.2266, 47.9689, "Asia/Kuwait"],
  ["BAH", "Bahrain International", "Manama", "BH", 26.2708, 50.6336, "Asia/Bahrain"],
  ["AMM", "Queen Alia", "Amman", "JO", 31.7226, 35.9932, "Asia/Amman"],
  ["TLV", "Ben Gurion", "Tel Aviv", "IL", 32.0114, 34.8867, "Asia/Jerusalem"],
  ["BEY", "Rafic Hariri", "Beirut", "LB", 33.8209, 35.4884, "Asia/Beirut"],
  ["MED", "Prince Mohammad bin Abdulaziz", "Medina", "SA", 24.5534, 39.7051, "Asia/Riyadh"],
  // South and Southeast Asia
  ["BLR", "Kempegowda", "Bengaluru", "IN", 13.1986, 77.7066, "Asia/Kolkata"],
  ["MAA", "Chennai International", "Chennai", "IN", 12.9941, 80.1709, "Asia/Kolkata"],
  ["HYD", "Rajiv Gandhi", "Hyderabad", "IN", 17.2403, 78.4294, "Asia/Kolkata"],
  ["CCU", "Netaji Subhas Chandra Bose", "Kolkata", "IN", 22.6547, 88.4467, "Asia/Kolkata"],
  ["CMB", "Bandaranaike", "Colombo", "LK", 7.1808, 79.8841, "Asia/Colombo"],
  ["KTM", "Tribhuvan", "Kathmandu", "NP", 27.6966, 85.3591, "Asia/Kathmandu"],
  ["DAC", "Hazrat Shahjalal", "Dhaka", "BD", 23.8433, 90.3978, "Asia/Dhaka"],
  ["SGN", "Tan Son Nhat", "Ho Chi Minh City", "VN", 10.8188, 106.652, "Asia/Ho_Chi_Minh"],
  ["HAN", "Noi Bai", "Hanoi", "VN", 21.2212, 105.8072, "Asia/Ho_Chi_Minh"],
  ["MNL", "Ninoy Aquino", "Manila", "PH", 14.5086, 121.0198, "Asia/Manila"],
  ["DPS", "Ngurah Rai", "Denpasar", "ID", -8.7482, 115.1672, "Asia/Makassar"],
  ["TAS", "Islam Karimov", "Tashkent", "UZ", 41.2579, 69.2812, "Asia/Tashkent"],
  ["ALA", "Almaty International", "Almaty", "KZ", 43.3521, 77.0405, "Asia/Almaty"],
  ["ISB", "Islamabad International", "Islamabad", "PK", 33.5607, 72.8516, "Asia/Karachi"],
  ["KHI", "Jinnah International", "Karachi", "PK", 24.9065, 67.1608, "Asia/Karachi"],
  ["CAN", "Baiyun", "Guangzhou", "CN", 23.3924, 113.2988, "Asia/Shanghai"],
  ["SZX", "Bao'an", "Shenzhen", "CN", 22.6393, 113.8107, "Asia/Shanghai"],
  ["CTU", "Tianfu", "Chengdu", "CN", 30.3125, 104.4415, "Asia/Shanghai"],
  // Europe
  ["MAN", "Manchester", "Manchester", "GB", 53.3537, -2.275, "Europe/London"],
  ["EDI", "Edinburgh", "Edinburgh", "GB", 55.95, -3.3725, "Europe/London"],
  ["BHX", "Birmingham", "Birmingham", "GB", 52.4539, -1.748, "Europe/London"],
  ["GLA", "Glasgow", "Glasgow", "GB", 55.8719, -4.4331, "Europe/London"],
  ["BRU", "Brussels", "Brussels", "BE", 50.9014, 4.4844, "Europe/Brussels"],
  ["GVA", "Geneve", "Geneva", "CH", 46.2381, 6.1089, "Europe/Zurich"],
  ["DUS", "Dusseldorf", "Dusseldorf", "DE", 51.2895, 6.7668, "Europe/Berlin"],
  ["HAM", "Hamburg", "Hamburg", "DE", 53.6304, 9.9882, "Europe/Berlin"],
  ["VCE", "Marco Polo", "Venice", "IT", 45.5053, 12.3519, "Europe/Rome"],
  ["NAP", "Capodichino", "Naples", "IT", 40.886, 14.2908, "Europe/Rome"],
  ["WAW", "Chopin", "Warsaw", "PL", 52.1657, 20.9671, "Europe/Warsaw"],
  ["PRG", "Vaclav Havel", "Prague", "CZ", 50.1008, 14.26, "Europe/Prague"],
  ["BUD", "Liszt Ferenc", "Budapest", "HU", 47.4369, 19.2556, "Europe/Budapest"],
  ["OTP", "Henri Coanda", "Bucharest", "RO", 44.5711, 26.085, "Europe/Bucharest"],
  ["BEG", "Nikola Tesla", "Belgrade", "RS", 44.8184, 20.3091, "Europe/Belgrade"],
  ["ATH", "Eleftherios Venizelos", "Athens", "GR", 37.9364, 23.9445, "Europe/Athens"],
  // Americas
  ["IAD", "Dulles", "Washington", "US", 38.9531, -77.4565, "America/New_York", "WAS"],
  ["DCA", "Reagan National", "Washington", "US", 38.8512, -77.0402, "America/New_York", "WAS"],
  ["IAH", "Bush Intercontinental", "Houston", "US", 29.9902, -95.3368, "America/Chicago"],
  ["DFW", "Dallas/Fort Worth", "Dallas", "US", 32.8998, -97.0403, "America/Chicago"],
  ["DEN", "Denver International", "Denver", "US", 39.8561, -104.6737, "America/Denver"],
  ["PHX", "Sky Harbor", "Phoenix", "US", 33.4342, -112.0116, "America/Phoenix"],
  ["LAS", "Harry Reid", "Las Vegas", "US", 36.084, -115.1537, "America/Los_Angeles"],
  ["MCO", "Orlando International", "Orlando", "US", 28.4312, -81.3081, "America/New_York"],
  ["MSP", "Minneapolis-St Paul", "Minneapolis", "US", 44.8848, -93.2223, "America/Chicago"],
  ["DTW", "Detroit Metro", "Detroit", "US", 42.2124, -83.3534, "America/Detroit"],
  ["PHL", "Philadelphia", "Philadelphia", "US", 39.8744, -75.2424, "America/New_York"],
  ["CLT", "Charlotte Douglas", "Charlotte", "US", 35.2144, -80.9473, "America/New_York"],
  ["YUL", "Montreal-Trudeau", "Montreal", "CA", 45.4706, -73.7408, "America/Toronto"],
  ["YYC", "Calgary", "Calgary", "CA", 51.1315, -114.0106, "America/Edmonton"],
  ["CUN", "Cancun International", "Cancun", "MX", 21.0365, -86.8771, "America/Cancun"],
  ["GDL", "Guadalajara", "Guadalajara", "MX", 20.5218, -103.3112, "America/Mexico_City"],
  ["PTY", "Tocumen", "Panama City", "PA", 9.0714, -79.3835, "America/Panama"],
  ["SJO", "Juan Santamaria", "San Jose", "CR", 9.9939, -84.2088, "America/Costa_Rica"],
  ["GIG", "Galeao", "Rio de Janeiro", "BR", -22.8099, -43.2506, "America/Sao_Paulo"],
  ["MDE", "Jose Maria Cordova", "Medellin", "CO", 6.1645, -75.4231, "America/Bogota"],
  ["UIO", "Mariscal Sucre", "Quito", "EC", -0.1292, -78.3575, "America/Guayaquil"],
  // Oceania
  ["BNE", "Brisbane", "Brisbane", "AU", -27.3842, 153.1175, "Australia/Brisbane"],
  ["PER", "Perth", "Perth", "AU", -31.9403, 115.9669, "Australia/Perth"],
  ["ADL", "Adelaide", "Adelaide", "AU", -34.945, 138.5306, "Australia/Adelaide"],
  ["CHC", "Christchurch", "Christchurch", "NZ", -43.4894, 172.5322, "Pacific/Auckland"],
  ["NAN", "Nadi International", "Nadi", "FJ", -17.7554, 177.4434, "Pacific/Fiji"],
];

export const AIRPORTS: Airport[] = ROWS.map(([code, name, city, cc, lat, lon, tz, metro]) => ({
  code,
  name,
  city,
  cc,
  lat,
  lon,
  tz,
  metro,
}));

const byCode = new Map(AIRPORTS.map((a) => [a.code, a]));

const metroCodes = [...new Set(AIRPORTS.filter((a) => a.metro).map((a) => a.metro as string))];
const METROS: Place[] = metroCodes.map((m) => {
  const members = AIRPORTS.filter((a) => a.metro === m);
  return {
    kind: "metro",
    code: m,
    name: "All airports",
    city: members[0].city,
    cc: members[0].cc,
    airports: members.map((x) => x.code),
  };
});
const metroByCode = new Map(METROS.map((m) => [m.code, m]));

const AIRPORT_PLACES: Place[] = AIRPORTS.map((a) => ({
  kind: "airport",
  code: a.code,
  name: a.name,
  city: a.city,
  cc: a.cc,
  airports: [a.code],
}));

export function getAirport(code: string): Airport | undefined {
  return byCode.get(code);
}

export function getPlace(code: string): Place | undefined {
  return metroByCode.get(code) ?? AIRPORT_PLACES.find((p) => p.code === code);
}

/** Expand an airport or metro code into concrete airports. */
export function expandCode(code: string): Airport[] {
  const m = metroByCode.get(code);
  if (m) return m.airports.map((c) => byCode.get(c) as Airport);
  const a = byCode.get(code);
  return a ? [a] : [];
}

export function isKnownCode(code: string): boolean {
  return byCode.has(code) || metroByCode.has(code);
}

export function toRef(a: Airport): AirportRef {
  return { code: a.code, name: a.name, city: a.city, cc: a.cc, tz: a.tz };
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Suggestions when the field is empty: domestic first, where the volume is. */
export const POPULAR_CODES = ["LON", "NYC", "DXB", "IST", "PAR", "LOS", "JNB", "SIN", "FRA", "LAX"];

export function searchPlaces(q: string, limit = 8): Place[] {
  const n = norm(q);
  if (!n) return POPULAR_CODES.map((c) => getPlace(c) as Place);
  const scored: { p: Place; s: number }[] = [];
  for (const p of [...METROS, ...AIRPORT_PLACES]) {
    const code = p.code.toLowerCase();
    const city = norm(p.city);
    const name = norm(p.name);
    let s = 0;
    if (code === n) s = 100;
    else if (city.startsWith(n)) s = 80;
    else if (code.startsWith(n)) s = 75;
    else if (name.startsWith(n)) s = 60;
    else if (city.includes(n)) s = 45;
    else if (name.includes(n)) s = 35;
    else if (norm(p.cc) === n) s = 20;
    if (s) scored.push({ p, s: s + (p.kind === "metro" ? 3 : 0) });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.p.city.localeCompare(b.p.city))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Typical hubs for connecting itineraries in demo mode. */
export const HUBS = ["AMS", "FRA", "IST", "DXB", "DOH", "LHR", "CDG", "MAD", "JFK", "ATL", "SIN", "HKG", "ICN", "YYZ", "ZRH", "ADD", "ACC", "ABJ", "CAI", "NBO"];

export function sameCity(a: string, b: string): boolean {
  const ea = expandCode(a);
  const eb = expandCode(b);
  return ea.some((x) => eb.some((y) => x.code === y.code || (x.metro && x.metro === y.metro)));
}
