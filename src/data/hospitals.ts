import type { Hospital } from '../core/hospitals';

/**
 * Miami-Dade hospitals, a snapshot bundled so the list works offline.
 *
 * Names, addresses, main phone numbers and the emergency-services flag: CMS "Hospital General Information"
 * (data.cms.gov, dataset xubh-q36u), filtered to Florida / Miami-Dade, retrieved 2026-10-10. These are
 * hospital switchboards, not blood-bank lines. The registry lists only hospitals that report to Medicare.
 * Coordinates: US Census geocoder from the street address; the four marked "OSM" were not matched by the
 * Census geocoder and use OpenStreetMap Nominatim (data © OpenStreetMap contributors, ODbL).
 *
 * Nothing here says whether a hospital has blood in stock: hospitals do not publish that.
 */
export const HOSPITALS: Hospital[] = [
  { id: "100008", name: "Baptist Hospital of Miami", address: "8900 N Kendall Dr", city: "Miami", zip: "33176", phone: "(786) 596-1960", emergency: true, coords: { lat: 25.6879, lon: -80.3366 } },
  { id: "100183", name: "Coral Gables Hospital", address: "3100 Douglas Rd", city: "Coral Gables", zip: "33134", phone: "(305) 445-8461", emergency: true, coords: { lat: 25.7334, lon: -80.254 } },
  { id: "100296", name: "Doctors Hospital", address: "5000 University Dr", city: "Coral Gables", zip: "33146", phone: "(786) 308-3000", emergency: true, coords: { lat: 25.7246, lon: -80.2732 } },
  { id: "100277", name: "Douglas Gardens Hospital", address: "5200 NE 2nd Ave", city: "Miami", zip: "33137", phone: "(305) 751-8626", emergency: false, coords: { lat: 25.8237, lon: -80.1919 } },
  { id: "100131", name: "HCA Florida Aventura Hospital", address: "20900 Biscayne Blvd", city: "Aventura", zip: "33180", phone: "(305) 682-7000", emergency: true, coords: { lat: 25.9691, lon: -80.1445 } },
  { id: "100209", name: "HCA Florida Kendall Hospital", address: "11750 Bird Rd", city: "Miami", zip: "33175", phone: "(305) 223-3000", emergency: true, coords: { lat: 25.731, lon: -80.3863 } }, // OSM
  { id: "100053", name: "Hialeah Hospital", address: "651 E 25th St", city: "Hialeah", zip: "33013", phone: "(305) 693-6100", emergency: true, coords: { lat: 25.8455, lon: -80.2686 } }, // OSM
  { id: "100125", name: "Homestead Hospital", address: "975 Baptist Way", city: "Homestead", zip: "33033", phone: "(786) 243-8000", emergency: true, coords: { lat: 25.4796, lon: -80.4302 } }, // OSM
  { id: "100022", name: "Jackson Health System", address: "1611 NW 12th Ave", city: "Miami", zip: "33136", phone: "(305) 585-1111", emergency: true, coords: { lat: 25.7906, lon: -80.215 } },
  { id: "100284", name: "Keralty Hospital", address: "2500 SW 75th Ave", city: "Miami", zip: "33155", phone: "(305) 263-9270", emergency: true, coords: { lat: 25.748, lon: -80.3173 } },
  { id: "100181", name: "Larkin Community Hospital", address: "7031 SW 62nd Ave", city: "South Miami", zip: "33143", phone: "(305) 284-7500", emergency: true, coords: { lat: 25.7056, lon: -80.2934 } },
  { id: "100050", name: "Larkin Community Hospital Palm Springs Campus", address: "1475 W 49th St", city: "Hialeah", zip: "33012", phone: "(305) 558-2500", emergency: true, coords: { lat: 25.8666, lon: -80.3123 } },
  { id: "10064F", name: "Miami VA Medical Center", address: "1201 N W 16th Street", city: "Miami", zip: "33125", phone: "(305) 324-4455", emergency: true, coords: { lat: 25.7905, lon: -80.2151 } },
  { id: "100034", name: "Mount Sinai Medical Center of Florida", address: "4300 Alton Rd", city: "Miami Beach", zip: "33140", phone: "(305) 674-2121", emergency: true, coords: { lat: 25.815, lon: -80.138 } },
  { id: "103301", name: "Nicklaus Children's Hospital", address: "3100 SW 62nd Ave", city: "Miami", zip: "33155", phone: "(305) 666-6511", emergency: true, coords: { lat: 25.7425, lon: -80.2952 } },
  { id: "100029", name: "North Shore Medical Center", address: "1100 NW 95th St", city: "Miami", zip: "33150", phone: "(305) 835-6000", emergency: true, coords: { lat: 25.8616, lon: -80.2148 } },
  { id: "100187", name: "Palmetto General Hospital", address: "2001 W 68th St", city: "Hialeah", zip: "33016", phone: "(305) 823-5000", emergency: true, coords: { lat: 25.8869, lon: -80.3261 } }, // OSM
  { id: "100154", name: "South Miami Hospital", address: "6200 SW 73rd St", city: "Miami", zip: "33143", phone: "(786) 662-4000", emergency: true, coords: { lat: 25.703, lon: -80.2934 } },
  { id: "104049", name: "Southern Winds Hospital", address: "4225 W 20th Ave", city: "Hialeah", zip: "33012", phone: "(305) 558-9700", emergency: false, coords: { lat: 25.8602, lon: -80.3223 } },
  { id: "100314", name: "West Kendall Baptist Hospital", address: "9555 SW 162 Ave", city: "Miami", zip: "33196", phone: "(786) 467-2000", emergency: true, coords: { lat: 25.6776, lon: -80.4573 } },
];
