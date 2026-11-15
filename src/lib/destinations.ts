import { distanceKm, expandCode } from "./airports";

export interface Destination {
  slug: string;
  code: string;
  city: string;
  country: string;
  image: string;
  from: string; // origin code used for "fly to" prefill
  fromCity: string;
  best: string;
  note: string;
  tags: string[];
}

export const DESTINATIONS: Destination[] = [
  { slug: "lisbon", code: "LIS", city: "Lisbon", country: "Portugal", image: "/images/lisbon.jpg", from: "LON", fromCity: "London", best: "Apr–Jun, Sep–Oct", note: "Steep, tiled and walkable if you like hills. Shoulder months are warm without the August crowds.", tags: ["Long weekend", "City"] },
  { slug: "tokyo", code: "TYO", city: "Tokyo", country: "Japan", image: "/images/tokyo.jpg", from: "SFO", fromCity: "San Francisco", best: "Mar–May, Oct–Nov", note: "Two airports, one city: Haneda sits close to the centre, Narita is cheaper more often. Search both at once.", tags: ["Big city", "Far-flung"] },
  { slug: "mexico-city", code: "MEX", city: "Mexico City", country: "Mexico", image: "/images/mexico-city.jpg", from: "NYC", fromCity: "New York", best: "Mar–May, Oct–Nov", note: "High altitude, wide avenues and jacaranda in spring. A short nonstop from most US hubs.", tags: ["Big city", "Long weekend"] },
  { slug: "cape-town", code: "CPT", city: "Cape Town", country: "South Africa", image: "/images/cape-town.jpg", from: "AMS", fromCity: "Amsterdam", best: "Nov–Mar", note: "An overnight flight from Europe that lands you in the southern summer, in the same time zone family.", tags: ["Winter sun"] },
  { slug: "marrakech", code: "RAK", city: "Marrakech", country: "Morocco", image: "/images/marrakech.jpg", from: "LON", fromCity: "London", best: "Mar–May, Oct–Nov", note: "Winter sun that is mild, not hot. Low-cost carriers often fly it with checked bags priced separately.", tags: ["Winter sun", "Long weekend"] },
  { slug: "reykjavik", code: "KEF", city: "Reykjavík", country: "Iceland", image: "/images/reykjavik.jpg", from: "LON", fromCity: "London", best: "Sep–Oct, Feb–Mar", note: "Under three hours from London. Shoulder season trades midnight sun for aurora odds and fewer crowds.", tags: ["Long weekend"] },
];

/** Great-circle estimate only. Never presented as a schedule or fare. */
export function estimateFlight(fromCode: string, toCode: string) {
  const a = expandCode(fromCode)[0];
  const b = expandCode(toCode)[0];
  if (!a || !b) return { km: 0, min: 0 };
  const km = distanceKm(a, b);
  const min = Math.round(32 + (km / (km > 2500 ? 845 : km > 800 ? 780 : 700)) * 60);
  return { km: Math.round(km / 10) * 10, min };
}

export const ROUTES: { from: string; to: string; note: string }[] = [
  { from: "LON", to: "NYC", note: "Three airports on each side. The all-airports search compares every pairing." },
  { from: "PAR", to: "LIS", note: "Short-haul: check what the cheapest fare leaves out, usually the checked bag." },
  { from: "NYC", to: "MEX", note: "International: passport details are required for every traveller." },
  { from: "SFO", to: "TYO", note: "Crosses the date line, so you land the next calendar day." },
  { from: "SIN", to: "SYD", note: "Eight hours; Sydney is two to three hours ahead of Singapore." },
  { from: "DXB", to: "DEL", note: "A short Gulf–India sector, busiest around school holidays." },
  { from: "AMS", to: "CPT", note: "Overnight southbound: you typically arrive the next morning." },
  { from: "MAD", to: "BOG", note: "A long transatlantic crossing. Layover flags matter on one-stop fares." },
];

export const INSPIRATION: { id: string; label: string; items: { from: string; to: string; fromCity: string; toCity: string; line: string }[] }[] = [
  {
    id: "weekend",
    label: "Long weekend",
    items: [
      { from: "LON", to: "LIS", fromCity: "London", toCity: "Lisbon", line: "Friday evening out, Monday morning back. Pick Lisbon for hills and custard tarts." },
      { from: "PAR", to: "OPO", fromCity: "Paris", toCity: "Porto", line: "A river city that is easy on foot and easier on the budget." },
      { from: "LON", to: "KEF", fromCity: "London", toCity: "Reykjavík", line: "Under three hours to somewhere that feels entirely elsewhere." },
    ],
  },
  {
    id: "sun",
    label: "Winter sun",
    items: [
      { from: "LON", to: "RAK", fromCity: "London", toCity: "Marrakech", line: "Warm days, cool evenings, a medina to get lost in." },
      { from: "AMS", to: "CPT", fromCity: "Amsterdam", toCity: "Cape Town", line: "Trade a European January for a southern summer." },
      { from: "FRA", to: "DXB", fromCity: "Frankfurt", toCity: "Dubai", line: "Seven hours to reliable heat; compare nonstop with one-stop options." },
    ],
  },
  {
    id: "city",
    label: "Big-city week",
    items: [
      { from: "SFO", to: "TYO", fromCity: "San Francisco", toCity: "Tokyo", line: "Search Haneda and Narita together to see which suits your dates." },
      { from: "LON", to: "NYC", fromCity: "London", toCity: "New York", line: "Three airports each side, so the cheapest pairing is rarely the obvious one." },
      { from: "NYC", to: "MEX", fromCity: "New York", toCity: "Mexico City", line: "Museums, markets and a very good breakfast culture." },
    ],
  },
  {
    id: "far",
    label: "Far-flung",
    items: [
      { from: "SIN", to: "AKL", fromCity: "Singapore", toCity: "Auckland", line: "Long sectors reward a careful look at layover length and bags." },
      { from: "MAD", to: "EZE", fromCity: "Madrid", toCity: "Buenos Aires", line: "An overnight crossing into the southern hemisphere." },
      { from: "LON", to: "SYD", fromCity: "London", toCity: "Sydney", line: "Typically one stop. Overnight layovers are flagged so they never surprise you." },
    ],
  },
];
