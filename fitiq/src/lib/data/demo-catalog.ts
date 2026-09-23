// ---------------------------------------------------------------------------
// DEMO CATALOG
//
// Illustrative product data used when no licensed feed is configured.
// Prices, ratings, availability and history are SIMULATED for demonstration.
// Every record carries source.kind = "demo" and the UI labels it "DEMO DATA".
// Nothing here should be presented as live retailer information.
// ---------------------------------------------------------------------------
import type {
  Category,
  ColorFamily,
  FitType,
  GarmentMeasure,
  Occasion,
  Pattern,
  Product,
  Season,
  StyleTag,
} from "../types";

type Model = {
  code: string;
  brand: string;
  title: string;
  category: Category;
  sub?: string;
  fit?: FitType;
  material?: string;
  color: ColorFamily;
  colorName: string;
  pattern?: Pattern;
  styles: StyleTag[];
  occasions: Occasion[];
  weight?: "light" | "medium" | "heavy";
  structured?: boolean;
  stretch?: boolean;
  seasons?: Season[];
  price: number;
  mrp?: number;
  sizing?: "runs-small" | "true" | "runs-large";
  retailers: string[];
  rating?: number;
  reviews?: number;
  pop?: number;
  length?: "cropped" | "regular" | "long";
  rain?: boolean;
  noChart?: boolean;
  sponsored?: boolean;
};

const M: Model[] = [
  // ---------------- SHIRTS ----------------
  { code: "UQ-OXF-WHT", brand: "Uniqlo", title: "Oxford Button-Down Shirt", category: "shirt", sub: "oxford", fit: "regular", material: "Cotton", color: "white", colorName: "White", styles: ["smart-casual", "minimal", "old-money"], occasions: ["office", "interview", "college", "date", "first-day", "business-meeting"], price: 1990, mrp: 1990, retailers: ["uniqlo", "myntra"], rating: 4.5, reviews: 3120, pop: 88 },
  { code: "UQ-OXF-LBL", brand: "Uniqlo", title: "Oxford Button-Down Shirt", category: "shirt", sub: "oxford", fit: "regular", material: "Cotton", color: "light-blue", colorName: "Light Blue", styles: ["smart-casual", "minimal", "old-money"], occasions: ["office", "interview", "college", "date", "first-day", "business-meeting"], price: 1990, mrp: 1990, retailers: ["uniqlo", "myntra"], rating: 4.5, reviews: 2210, pop: 84 },
  { code: "HM-OXF-SLM-BLU", brand: "H&M", title: "Slim Fit Oxford Shirt", category: "shirt", sub: "oxford", fit: "slim", material: "Cotton", color: "light-blue", colorName: "Pale Blue", styles: ["smart-casual", "minimal"], occasions: ["office", "college", "date", "first-day"], price: 1299, mrp: 1499, stretch: true, retailers: ["hm", "myntra"], rating: 4.1, reviews: 1840, pop: 76, sizing: "runs-small" },
  { code: "AR-OXF-REL-BEI", brand: "Arrow", title: "Relaxed Oxford Shirt", category: "shirt", sub: "oxford", fit: "relaxed", material: "Cotton", color: "beige", colorName: "Sand", styles: ["smart-casual", "old-money", "minimal"], occasions: ["office", "date", "casual", "business-meeting"], price: 1499, mrp: 2499, weight: "medium", retailers: ["myntra", "ajio", "tatacliq"], rating: 4.2, reviews: 640, pop: 61 },
  { code: "VH-FRM-WHT", brand: "Van Heusen", title: "Regular Fit Formal Shirt", category: "shirt", sub: "formal", fit: "regular", material: "Cotton blend", color: "white", colorName: "White", styles: ["formal", "minimal"], occasions: ["office", "interview", "business-meeting", "first-day"], price: 1199, mrp: 1999, structured: true, retailers: ["myntra", "amazon", "flipkart", "ajio"], rating: 4.3, reviews: 5400, pop: 90 },
  { code: "VH-FRM-SLM-NVY", brand: "Van Heusen", title: "Slim Fit Formal Shirt", category: "shirt", sub: "formal", fit: "slim", material: "Cotton blend", color: "navy", colorName: "Navy", styles: ["formal"], occasions: ["office", "interview", "business-meeting", "party"], price: 1299, mrp: 2199, structured: true, stretch: true, retailers: ["myntra", "amazon"], rating: 4.2, reviews: 2300, pop: 72 },
  { code: "LP-LIN-OLV", brand: "Louis Philippe", title: "Linen Blend Shirt", category: "shirt", sub: "linen", fit: "regular", material: "Linen blend", color: "olive", colorName: "Olive", weight: "light", styles: ["smart-casual", "old-money"], occasions: ["office", "date", "vacation", "casual", "haldi"], seasons: ["summer", "all"], price: 1899, mrp: 2999, retailers: ["myntra", "tatacliq", "ajio"], rating: 4.4, reviews: 910, pop: 70 },
  { code: "SN-CUB-BLK", brand: "Snitch", title: "Cuban Collar Printed Shirt", category: "shirt", sub: "cuban", fit: "relaxed", material: "Viscose", color: "black", colorName: "Black", pattern: "print", weight: "light", styles: ["streetwear", "casual"], occasions: ["party", "vacation", "date", "casual"], price: 999, mrp: 1799, retailers: ["snitch", "myntra"], rating: 4.0, reviews: 1320, pop: 79, noChart: true },
  { code: "SN-OVR-SHT-CRM", brand: "Snitch", title: "Oversized Textured Shirt", category: "shirt", sub: "textured", fit: "oversized", material: "Cotton", color: "cream", colorName: "Cream", pattern: "texture", styles: ["streetwear", "korean", "casual"], occasions: ["college", "casual", "date", "party"], price: 1099, mrp: 1999, retailers: ["snitch", "myntra", "ajio"], rating: 4.1, reviews: 980, pop: 83, length: "long" },
  { code: "HM-REL-STR-BLU", brand: "H&M", title: "Relaxed Fit Striped Shirt", category: "shirt", sub: "striped", fit: "relaxed", material: "Cotton", color: "blue", colorName: "Blue Stripe", pattern: "stripe", styles: ["smart-casual", "korean", "casual"], occasions: ["office", "college", "date", "casual"], price: 1499, mrp: 1499, retailers: ["hm"], rating: 4.0, reviews: 450, pop: 64 },
  { code: "PE-CHK-MRN", brand: "Peter England", title: "Checked Casual Shirt", category: "shirt", sub: "check", fit: "regular", material: "Cotton", color: "maroon", colorName: "Maroon Check", pattern: "check", styles: ["casual", "smart-casual"], occasions: ["college", "casual", "travel", "festival"], price: 849, mrp: 1699, retailers: ["myntra", "flipkart", "amazon"], rating: 4.0, reviews: 3100, pop: 66 },
  { code: "RL-OXF-PNK", brand: "Allen Solly", title: "Pastel Oxford Shirt", category: "shirt", sub: "oxford", fit: "regular", material: "Cotton", color: "pink", colorName: "Blush", styles: ["smart-casual", "old-money"], occasions: ["office", "date", "reception", "party"], price: 1149, mrp: 1999, retailers: ["myntra", "ajio", "flipkart"], rating: 4.2, reviews: 1100, pop: 62 },
  { code: "WS-DNM-SHT", brand: "Westside WES", title: "Denim Shirt", category: "shirt", sub: "denim", fit: "regular", material: "Denim", color: "indigo", colorName: "Indigo", weight: "medium", styles: ["casual", "smart-casual", "streetwear"], occasions: ["college", "casual", "travel", "date"], price: 999, mrp: 999, retailers: ["westside"], rating: 4.1, reviews: 270, pop: 55 },

  { code: "RT-OXF-WHT", brand: "Roadster", title: "Cotton Oxford Shirt", category: "shirt", sub: "oxford", fit: "regular", material: "Cotton", color: "white", colorName: "White", styles: ["smart-casual", "minimal", "casual"], occasions: ["office", "college", "date", "casual", "first-day"], price: 699, mrp: 1599, retailers: ["myntra"], rating: 4.0, reviews: 7400, pop: 78 },
  { code: "HL-OXF-SLM-LBL", brand: "Highlander", title: "Slim Fit Oxford Shirt", category: "shirt", sub: "oxford", fit: "slim", material: "Cotton", color: "light-blue", colorName: "Sky Blue", stretch: true, styles: ["smart-casual", "casual"], occasions: ["office", "college", "date", "casual"], price: 649, mrp: 1499, retailers: ["myntra", "flipkart"], rating: 3.9, reviews: 5200, pop: 70, sizing: "runs-small" },
  { code: "DL-SHT-OLV", brand: "Dennis Lingo", title: "Solid Casual Shirt", category: "shirt", sub: "casual", fit: "regular", material: "Cotton", color: "olive", colorName: "Olive", styles: ["smart-casual", "casual"], occasions: ["office", "college", "casual", "date", "travel"], price: 599, mrp: 1999, retailers: ["amazon", "myntra"], rating: 3.9, reviews: 11200, pop: 72, noChart: true },

  // ---------------- T-SHIRTS / POLOS ----------------
  { code: "UQ-UT-WHT", brand: "Uniqlo", title: "Supima Cotton Crew Neck T-shirt", category: "tshirt", fit: "regular", material: "Supima cotton", color: "white", colorName: "White", styles: ["minimal", "casual", "korean"], occasions: ["college", "casual", "travel", "date"], price: 790, mrp: 790, retailers: ["uniqlo"], rating: 4.6, reviews: 5200, pop: 92 },
  { code: "UQ-UT-BLK", brand: "Uniqlo", title: "Supima Cotton Crew Neck T-shirt", category: "tshirt", fit: "regular", material: "Supima cotton", color: "black", colorName: "Black", styles: ["minimal", "casual", "streetwear"], occasions: ["college", "casual", "travel", "party"], price: 790, mrp: 790, retailers: ["uniqlo"], rating: 4.6, reviews: 4800, pop: 90 },
  { code: "BW-OVR-TEE-OLV", brand: "Bewakoof", title: "Oversized Heavyweight T-shirt", category: "tshirt", fit: "oversized", material: "Cotton", color: "olive", colorName: "Olive", weight: "heavy", styles: ["streetwear", "casual", "korean"], occasions: ["college", "casual", "travel"], price: 599, mrp: 1099, retailers: ["bewakoof", "myntra", "amazon"], rating: 4.2, reviews: 6100, pop: 87, length: "long" },
  { code: "BW-OVR-TEE-BEI", brand: "Bewakoof", title: "Oversized Heavyweight T-shirt", category: "tshirt", fit: "oversized", material: "Cotton", color: "beige", colorName: "Beige", weight: "heavy", styles: ["streetwear", "casual", "korean"], occasions: ["college", "casual", "travel"], price: 599, mrp: 1099, retailers: ["bewakoof", "myntra"], rating: 4.2, reviews: 3900, pop: 80, length: "long" },
  { code: "HM-SLM-TEE-GRY", brand: "H&M", title: "Slim Fit T-shirt", category: "tshirt", fit: "slim", material: "Cotton jersey", color: "grey", colorName: "Grey Melange", weight: "light", stretch: true, styles: ["minimal", "casual", "athleisure"], occasions: ["college", "casual", "travel"], price: 399, mrp: 499, retailers: ["hm", "myntra"], rating: 3.9, reviews: 2700, pop: 71, sizing: "runs-small" },
  { code: "TSS-REL-TEE-NVY", brand: "The Souled Store", title: "Relaxed Fit Solid T-shirt", category: "tshirt", fit: "relaxed", material: "Cotton", color: "navy", colorName: "Navy", styles: ["casual", "streetwear"], occasions: ["college", "casual", "travel"], price: 699, mrp: 899, retailers: ["myntra", "amazon"], rating: 4.3, reviews: 1500, pop: 68 },
  { code: "US-POLO-NVY", brand: "U.S. Polo Assn.", title: "Classic Piqué Polo", category: "polo", fit: "regular", material: "Cotton piqué", color: "navy", colorName: "Navy", styles: ["smart-casual", "old-money", "casual"], occasions: ["office", "college", "date", "travel", "casual"], price: 1199, mrp: 1999, retailers: ["myntra", "ajio", "amazon", "flipkart"], rating: 4.3, reviews: 4200, pop: 81 },
  { code: "US-POLO-WHT", brand: "U.S. Polo Assn.", title: "Classic Piqué Polo", category: "polo", fit: "regular", material: "Cotton piqué", color: "white", colorName: "White", styles: ["smart-casual", "old-money", "casual"], occasions: ["office", "college", "date", "travel"], price: 1199, mrp: 1999, retailers: ["myntra", "ajio", "amazon"], rating: 4.3, reviews: 3100, pop: 78 },
  { code: "UQ-KNIT-POLO-BEI", brand: "Uniqlo", title: "Knitted Polo", category: "polo", fit: "regular", material: "Cotton knit", color: "beige", colorName: "Oatmeal", pattern: "texture", styles: ["old-money", "korean", "smart-casual"], occasions: ["date", "office", "party", "reception"], price: 1990, mrp: 1990, retailers: ["uniqlo"], rating: 4.4, reviews: 610, pop: 77 },
  { code: "PUMA-POLO-BLK", brand: "Puma", title: "Essentials Slim Polo", category: "polo", fit: "slim", material: "Poly-cotton", color: "black", colorName: "Black", stretch: true, styles: ["athleisure", "casual"], occasions: ["college", "travel", "casual"], price: 899, mrp: 1799, retailers: ["amazon", "flipkart", "myntra"], rating: 4.2, reviews: 2600, pop: 69 },

  // ---------------- LAYERS ----------------
  { code: "HM-OVS-BEI", brand: "H&M", title: "Relaxed Twill Overshirt", category: "overshirt", fit: "relaxed", material: "Cotton twill", color: "beige", colorName: "Beige", weight: "heavy", structured: true, styles: ["smart-casual", "minimal", "korean", "streetwear"], occasions: ["office", "college", "date", "casual", "travel"], seasons: ["winter", "monsoon", "all"], price: 1999, mrp: 2299, retailers: ["hm", "myntra"], rating: 4.3, reviews: 820, pop: 86 },
  { code: "SN-OVS-OLV", brand: "Snitch", title: "Utility Overshirt", category: "overshirt", fit: "regular", material: "Cotton", color: "olive", colorName: "Olive", weight: "medium", structured: true, styles: ["smart-casual", "streetwear", "casual"], occasions: ["college", "date", "casual", "travel", "office"], price: 1299, mrp: 2299, retailers: ["snitch", "myntra", "ajio"], rating: 4.1, reviews: 760, pop: 82 },
  { code: "RT-OVS-CHK", brand: "Roadster", title: "Checked Flannel Overshirt", category: "overshirt", fit: "regular", material: "Flannel", color: "brown", colorName: "Brown Check", pattern: "check", weight: "heavy", styles: ["casual", "streetwear"], occasions: ["college", "casual", "travel"], seasons: ["winter"], price: 899, mrp: 1999, retailers: ["myntra"], rating: 4.0, reviews: 1900, pop: 65 },
  { code: "LEV-TRK-JKT", brand: "Levi's", title: "Trucker Denim Jacket", category: "jacket", fit: "regular", material: "Denim", color: "blue", colorName: "Mid Blue", weight: "heavy", structured: true, styles: ["casual", "streetwear", "smart-casual"], occasions: ["college", "date", "travel", "casual"], seasons: ["winter", "all"], price: 3999, mrp: 5999, retailers: ["levis", "myntra", "ajio"], rating: 4.5, reviews: 1400, pop: 80 },
  { code: "ZR-BOM-BLK", brand: "Highlander", title: "Bomber Jacket", category: "jacket", fit: "regular", material: "Polyester", color: "black", colorName: "Black", weight: "medium", structured: true, styles: ["streetwear", "casual"], occasions: ["college", "party", "travel", "casual"], seasons: ["winter"], price: 1299, mrp: 2999, retailers: ["myntra", "flipkart"], rating: 4.0, reviews: 2100, pop: 67, length: "cropped" },
  { code: "BLZ-UNS-NVY", brand: "Mango Man", title: "Unstructured Cotton Blazer", category: "blazer", fit: "slim", material: "Cotton blend", color: "navy", colorName: "Navy", weight: "medium", structured: true, styles: ["smart-casual", "formal", "old-money"], occasions: ["office", "interview", "business-meeting", "reception", "date", "party"], price: 4499, mrp: 6990, retailers: ["myntra", "ajio"], rating: 4.2, reviews: 380, pop: 63 },
  { code: "BLZ-REG-BEI", brand: "Louis Philippe", title: "Regular Fit Linen Blazer", category: "blazer", fit: "regular", material: "Linen blend", color: "beige", colorName: "Stone", weight: "light", structured: true, styles: ["old-money", "smart-casual", "formal"], occasions: ["reception", "wedding", "party", "business-meeting", "date"], seasons: ["summer", "all"], price: 5999, mrp: 8999, retailers: ["tatacliq", "myntra"], rating: 4.4, reviews: 210, pop: 58 },
  { code: "UQ-CREW-SWT-NVY", brand: "Uniqlo", title: "Merino Crew Neck Sweater", category: "sweater", fit: "regular", material: "Merino wool", color: "navy", colorName: "Navy", weight: "medium", styles: ["old-money", "minimal", "smart-casual"], occasions: ["office", "date", "travel"], seasons: ["winter"], price: 2990, mrp: 2990, retailers: ["uniqlo"], rating: 4.6, reviews: 900, pop: 60 },

  // ---------------- ETHNIC ----------------
  { code: "MNY-KUR-CRM", brand: "Manyavar", title: "Silk Blend Kurta", category: "kurta", fit: "regular", material: "Silk blend", color: "cream", colorName: "Ivory", pattern: "texture", styles: ["traditional", "indo-western"], occasions: ["wedding", "reception", "diwali", "eid", "festival"], price: 2499, mrp: 3999, retailers: ["myntra", "ajio", "tatacliq"], rating: 4.4, reviews: 1300, pop: 84, length: "long" },
  { code: "FB-KUR-MUS", brand: "Fabindia", title: "Cotton Straight Kurta", category: "kurta", fit: "straight", material: "Cotton", color: "yellow", colorName: "Mustard", weight: "light", styles: ["traditional", "casual"], occasions: ["haldi", "festival", "diwali", "casual"], seasons: ["summer", "all"], price: 1290, mrp: 1790, retailers: ["myntra", "tatacliq"], rating: 4.3, reviews: 860, pop: 72, length: "long" },
  { code: "SJ-KUR-NVY", brand: "Sojanya", title: "Short Kurta", category: "kurta", fit: "slim", material: "Cotton blend", color: "navy", colorName: "Navy", styles: ["indo-western", "traditional"], occasions: ["festival", "diwali", "eid", "party", "wedding"], price: 899, mrp: 2499, retailers: ["myntra", "amazon", "flipkart"], rating: 4.0, reviews: 2400, pop: 69, length: "regular" },
  { code: "MNY-KUR-MRN", brand: "Manyavar", title: "Jacquard Kurta", category: "kurta", fit: "regular", material: "Jacquard", color: "maroon", colorName: "Wine", pattern: "texture", styles: ["traditional"], occasions: ["wedding", "reception", "diwali"], price: 2999, mrp: 4499, retailers: ["myntra", "ajio"], rating: 4.5, reviews: 700, pop: 75, length: "long" },
  { code: "TH-KUR-WHT", brand: "Tasva", title: "Chikankari Kurta", category: "kurta", fit: "relaxed", material: "Cotton", color: "white", colorName: "White", pattern: "embroidered", weight: "light", styles: ["traditional", "indo-western"], occasions: ["eid", "haldi", "festival", "wedding"], seasons: ["summer", "all"], price: 1999, mrp: 2999, retailers: ["tatacliq", "myntra"], rating: 4.4, reviews: 510, pop: 73, length: "long" },
  { code: "NJ-BEI", brand: "Manyavar", title: "Textured Nehru Jacket", category: "nehru-jacket", fit: "slim", material: "Poly-viscose", color: "beige", colorName: "Beige", pattern: "texture", structured: true, styles: ["indo-western", "traditional", "old-money"], occasions: ["wedding", "reception", "diwali", "festival", "eid"], price: 1999, mrp: 2999, retailers: ["myntra", "ajio"], rating: 4.3, reviews: 640, pop: 70 },
  { code: "NJ-NVY", brand: "Vastramay", title: "Solid Nehru Jacket", category: "nehru-jacket", fit: "regular", material: "Cotton blend", color: "navy", colorName: "Navy", structured: true, styles: ["indo-western", "traditional", "formal"], occasions: ["wedding", "reception", "diwali", "festival", "eid", "business-meeting"], price: 1299, mrp: 2999, retailers: ["myntra", "amazon", "flipkart"], rating: 4.1, reviews: 1850, pop: 71 },

  // ---------------- BOTTOMS ----------------
  { code: "LEV-511-IND", brand: "Levi's", title: "511 Slim Fit Jeans", category: "jeans", fit: "slim", material: "Stretch denim", color: "indigo", colorName: "Dark Indigo", stretch: true, styles: ["casual", "smart-casual", "minimal"], occasions: ["college", "date", "casual", "travel", "party"], price: 2999, mrp: 3999, retailers: ["levis", "myntra", "ajio", "amazon"], rating: 4.4, reviews: 8400, pop: 93 },
  { code: "LEV-502-IND", brand: "Levi's", title: "502 Taper Fit Jeans", category: "jeans", fit: "tapered", material: "Denim", color: "indigo", colorName: "Dark Indigo", styles: ["casual", "smart-casual"], occasions: ["college", "date", "casual", "travel", "party"], price: 3199, mrp: 4299, retailers: ["levis", "myntra", "ajio"], rating: 4.5, reviews: 2900, pop: 81 },
  { code: "LEV-505-BLK", brand: "Levi's", title: "505 Regular Straight Jeans", category: "jeans", fit: "straight", material: "Denim", color: "black", colorName: "Black", styles: ["casual", "minimal"], occasions: ["college", "casual", "travel", "party"], price: 2799, mrp: 3999, retailers: ["levis", "myntra", "amazon"], rating: 4.3, reviews: 1700, pop: 74 },
  { code: "RT-SKN-BLU", brand: "Roadster", title: "Skinny Fit Stretch Jeans", category: "jeans", fit: "skinny", material: "Stretch denim", color: "blue", colorName: "Mid Blue", stretch: true, styles: ["casual"], occasions: ["college", "casual"], price: 799, mrp: 1999, retailers: ["myntra"], rating: 3.9, reviews: 9800, pop: 70 },
  { code: "SN-BAG-JNS-BLU", brand: "Snitch", title: "Baggy Wide Leg Jeans", category: "jeans", fit: "relaxed", material: "Denim", color: "light-blue", colorName: "Light Wash", styles: ["streetwear", "korean"], occasions: ["college", "casual", "party"], price: 1499, mrp: 2599, retailers: ["snitch", "myntra"], rating: 4.0, reviews: 1100, pop: 85, noChart: true },
  { code: "UQ-STR-JNS-BLU", brand: "Uniqlo", title: "Straight Jeans", category: "jeans", fit: "straight", material: "Denim", color: "blue", colorName: "Blue", styles: ["minimal", "casual", "korean", "smart-casual"], occasions: ["college", "casual", "travel", "date", "office"], price: 2990, mrp: 2990, retailers: ["uniqlo"], rating: 4.4, reviews: 1300, pop: 77 },
  { code: "MH-STR-CHN-NVY", brand: "Mast & Harbour", title: "Straight Fit Chinos", category: "chinos", fit: "straight", material: "Cotton", color: "navy", colorName: "Navy", styles: ["smart-casual", "casual", "minimal"], occasions: ["office", "college", "casual", "date", "first-day"], price: 799, mrp: 1999, retailers: ["myntra"], rating: 4.0, reviews: 2600, pop: 69 },
  { code: "UQ-CHN-BEI", brand: "Uniqlo", title: "Slim Fit Chino Pants", category: "chinos", fit: "slim", material: "Cotton", color: "beige", colorName: "Beige", stretch: true, styles: ["smart-casual", "minimal", "old-money"], occasions: ["office", "college", "date", "first-day", "business-meeting"], price: 1990, mrp: 1990, retailers: ["uniqlo"], rating: 4.4, reviews: 2600, pop: 82 },
  { code: "HM-STR-CHN-NVY", brand: "H&M", title: "Straight Fit Chinos", category: "chinos", fit: "straight", material: "Cotton twill", color: "navy", colorName: "Navy", styles: ["smart-casual", "minimal", "casual"], occasions: ["office", "college", "date", "first-day", "travel"], price: 1499, mrp: 1799, retailers: ["hm", "myntra"], rating: 4.2, reviews: 1400, pop: 78 },
  { code: "HM-STR-CHN-BEI", brand: "H&M", title: "Straight Fit Chinos", category: "chinos", fit: "straight", material: "Cotton twill", color: "beige", colorName: "Beige", styles: ["smart-casual", "minimal", "casual", "old-money"], occasions: ["office", "college", "date", "first-day", "travel"], price: 1499, mrp: 1799, retailers: ["hm", "myntra"], rating: 4.2, reviews: 1900, pop: 80 },
  { code: "MAR-CHN-OLV", brand: "Marks & Spencer", title: "Regular Fit Stretch Chinos", category: "chinos", fit: "regular", material: "Cotton stretch", color: "olive", colorName: "Olive", stretch: true, styles: ["smart-casual", "casual"], occasions: ["office", "date", "travel", "casual"], price: 1799, mrp: 2499, retailers: ["myntra", "ajio", "tatacliq"], rating: 4.3, reviews: 890, pop: 64 },
  { code: "RT-CHN-KHK", brand: "Roadster", title: "Slim Tapered Chinos", category: "chinos", fit: "tapered", material: "Cotton", color: "tan", colorName: "Khaki", stretch: true, styles: ["casual", "smart-casual"], occasions: ["college", "casual", "office", "travel"], price: 699, mrp: 1799, retailers: ["myntra"], rating: 3.9, reviews: 5200, pop: 73 },
  { code: "WS-REL-CHN-CRM", brand: "Westside ETA", title: "Relaxed Pleated Chinos", category: "chinos", fit: "relaxed", material: "Cotton", color: "cream", colorName: "Ecru", styles: ["korean", "old-money", "smart-casual"], occasions: ["date", "office", "casual", "vacation"], price: 1299, mrp: 1299, retailers: ["westside"], rating: 4.1, reviews: 210, pop: 60 },
  { code: "VH-TRS-GRY", brand: "Van Heusen", title: "Slim Fit Formal Trousers", category: "trousers", fit: "slim", material: "Poly-viscose", color: "grey", colorName: "Charcoal", structured: true, styles: ["formal", "smart-casual"], occasions: ["office", "interview", "business-meeting", "first-day", "reception"], price: 1299, mrp: 2299, retailers: ["myntra", "amazon", "flipkart", "ajio"], rating: 4.2, reviews: 3700, pop: 79 },
  { code: "AS-TRS-REG-BLK", brand: "Allen Solly", title: "Regular Fit Trousers", category: "trousers", fit: "regular", material: "Poly-viscose", color: "black", colorName: "Black", structured: true, styles: ["formal", "minimal"], occasions: ["office", "interview", "business-meeting", "wedding", "reception"], price: 1199, mrp: 1999, retailers: ["myntra", "ajio", "amazon"], rating: 4.1, reviews: 2200, pop: 68 },
  { code: "PL-TRS-STR-BEI", brand: "Park Avenue", title: "Straight Pleated Trousers", category: "trousers", fit: "straight", material: "Wool blend", color: "beige", colorName: "Stone", structured: true, styles: ["old-money", "formal", "smart-casual"], occasions: ["office", "reception", "business-meeting", "wedding", "date"], price: 1799, mrp: 2999, retailers: ["myntra", "tatacliq"], rating: 4.3, reviews: 420, pop: 62 },
  { code: "KT-PYJ-WHT", brand: "Manyavar", title: "Cotton Churidar", category: "trousers", sub: "churidar", fit: "slim", material: "Cotton", color: "white", colorName: "Off-white", styles: ["traditional"], occasions: ["wedding", "reception", "diwali", "eid", "festival", "haldi"], price: 799, mrp: 1199, retailers: ["myntra", "ajio"], rating: 4.2, reviews: 900, pop: 66 },
  { code: "FB-PYJ-STR", brand: "Fabindia", title: "Straight Cotton Pyjama", category: "trousers", sub: "pyjama", fit: "straight", material: "Cotton", color: "cream", colorName: "Natural", styles: ["traditional", "casual"], occasions: ["haldi", "festival", "diwali", "eid", "wedding"], price: 690, mrp: 890, retailers: ["myntra", "tatacliq"], rating: 4.3, reviews: 480, pop: 58 },
  { code: "ADI-JOG-BLK", brand: "Adidas", title: "Essentials Tapered Joggers", category: "joggers", fit: "tapered", material: "Cotton fleece", color: "black", colorName: "Black", styles: ["athleisure", "streetwear", "casual"], occasions: ["college", "travel", "casual"], price: 1799, mrp: 2999, retailers: ["myntra", "amazon", "ajio"], rating: 4.4, reviews: 3300, pop: 76 },
  { code: "HM-SHR-BEI", brand: "H&M", title: "Relaxed Linen Shorts", category: "shorts", fit: "relaxed", material: "Linen blend", color: "beige", colorName: "Beige", weight: "light", styles: ["casual", "old-money"], occasions: ["vacation", "casual", "travel"], seasons: ["summer"], price: 999, mrp: 1299, retailers: ["hm"], rating: 4.0, reviews: 300, pop: 59 },

  // ---------------- FOOTWEAR ----------------
  { code: "RB-MIN-SNK-WHT", brand: "Red Tape", title: "Minimal Leather Sneakers", category: "sneakers", material: "Synthetic leather", color: "white", colorName: "White", styles: ["minimal", "smart-casual", "casual", "korean"], occasions: ["office", "college", "date", "casual", "travel", "first-day"], price: 1499, mrp: 4999, retailers: ["amazon", "myntra", "flipkart"], rating: 4.1, reviews: 12400, pop: 91 },
  { code: "CMP-MIN-SNK-WHT", brand: "Campus", title: "Minimal Low-Top Sneakers", category: "sneakers", material: "Synthetic", color: "white", colorName: "White", styles: ["minimal", "casual", "smart-casual"], occasions: ["office", "college", "casual", "travel", "date"], price: 899, mrp: 1499, retailers: ["amazon", "flipkart", "myntra"], rating: 4.0, reviews: 8900, pop: 74 },
  { code: "ADI-STAN-WHT", brand: "Adidas", title: "Stan Smith Sneakers", category: "sneakers", material: "Leather", color: "white", colorName: "White/Green", styles: ["minimal", "smart-casual", "casual", "korean"], occasions: ["office", "college", "date", "casual", "travel"], price: 7999, mrp: 9999, retailers: ["myntra", "ajio", "amazon"], rating: 4.6, reviews: 5100, pop: 85 },
  { code: "PUMA-SMASH-WHT", brand: "Puma", title: "Smash Leather Sneakers", category: "sneakers", material: "Leather", color: "white", colorName: "White", styles: ["minimal", "casual", "smart-casual"], occasions: ["college", "casual", "travel", "office", "date"], price: 2799, mrp: 4999, retailers: ["myntra", "amazon", "flipkart", "ajio"], rating: 4.4, reviews: 7800, pop: 83 },
  { code: "NIKE-AF1-WHT", brand: "Nike", title: "Air Force 1 '07", category: "sneakers", material: "Leather", color: "white", colorName: "White", styles: ["streetwear", "casual", "korean"], occasions: ["college", "casual", "party", "date"], price: 7495, mrp: 7495, retailers: ["myntra", "ajio"], rating: 4.7, reviews: 6100, pop: 94 },
  { code: "BATA-CNV-BLK", brand: "North Star", title: "Canvas Low Top Sneakers", category: "sneakers", material: "Canvas", color: "black", colorName: "Black", styles: ["casual", "streetwear", "minimal"], occasions: ["college", "casual", "travel"], price: 999, mrp: 1499, retailers: ["amazon", "flipkart", "myntra"], rating: 4.0, reviews: 2300, pop: 62 },
  { code: "CL-LOAF-BRN", brand: "Carlton London", title: "Suede Penny Loafers", category: "loafers", material: "Suede", color: "brown", colorName: "Tan Brown", styles: ["smart-casual", "old-money", "formal"], occasions: ["office", "date", "reception", "party", "business-meeting"], price: 1799, mrp: 3999, retailers: ["myntra", "ajio", "amazon"], rating: 4.1, reviews: 1500, pop: 74 },
  { code: "LS-LOAF-BLK", brand: "Louis Philippe", title: "Leather Tassel Loafers", category: "loafers", material: "Leather", color: "black", colorName: "Black", styles: ["formal", "smart-casual"], occasions: ["office", "reception", "business-meeting", "wedding"], price: 3499, mrp: 4999, retailers: ["myntra", "tatacliq"], rating: 4.3, reviews: 420, pop: 61 },
  { code: "HP-LOAF-TAN", brand: "Hush Puppies", title: "Leather Driving Loafers", category: "loafers", material: "Leather", color: "tan", colorName: "Tan", styles: ["smart-casual", "old-money", "casual"], occasions: ["date", "office", "vacation", "casual"], price: 2999, mrp: 4499, retailers: ["myntra", "amazon", "ajio"], rating: 4.4, reviews: 900, pop: 66, sizing: "runs-large" },
  { code: "BATA-DERBY-BLK", brand: "Bata", title: "Leather Derby Formal Shoes", category: "formal-shoes", material: "Leather", color: "black", colorName: "Black", styles: ["formal"], occasions: ["office", "interview", "business-meeting", "first-day", "reception"], price: 1999, mrp: 2499, retailers: ["amazon", "flipkart", "myntra"], rating: 4.2, reviews: 4400, pop: 72 },
  { code: "CL-OXF-BRN", brand: "Carlton London", title: "Brogue Oxford Shoes", category: "formal-shoes", material: "Leather", color: "brown", colorName: "Brown", styles: ["formal", "old-money"], occasions: ["office", "reception", "business-meeting", "wedding", "interview"], price: 2299, mrp: 4499, retailers: ["myntra", "ajio"], rating: 4.1, reviews: 800, pop: 64 },
  { code: "MOJ-GLD", brand: "Anouk", title: "Embroidered Mojaris", category: "mojaris", material: "Synthetic", color: "gold", colorName: "Gold", pattern: "embroidered", styles: ["traditional", "indo-western"], occasions: ["wedding", "reception", "diwali", "eid", "festival"], price: 1199, mrp: 2199, retailers: ["myntra", "amazon"], rating: 4.0, reviews: 1600, pop: 73, sizing: "runs-small" },
  { code: "MOJ-TAN", brand: "Fabindia", title: "Leather Mojaris", category: "mojaris", material: "Leather", color: "tan", colorName: "Tan", styles: ["traditional", "indo-western"], occasions: ["wedding", "reception", "diwali", "eid", "festival", "haldi"], price: 1499, mrp: 1790, retailers: ["tatacliq", "myntra"], rating: 4.3, reviews: 520, pop: 67 },
  { code: "MOJ-BLK", brand: "Mochi", title: "Velvet Mojaris", category: "mojaris", material: "Velvet", color: "black", colorName: "Black", pattern: "embroidered", styles: ["traditional", "indo-western"], occasions: ["wedding", "reception", "diwali"], price: 1699, mrp: 2490, retailers: ["myntra", "ajio"], rating: 4.2, reviews: 310, pop: 55 },
  { code: "WS-CHL-BRN", brand: "Woodland", title: "Suede Chelsea Boots", category: "boots", material: "Suede", color: "brown", colorName: "Brown", rain: false, styles: ["smart-casual", "casual", "old-money"], occasions: ["date", "party", "travel", "casual"], seasons: ["winter"], price: 3999, mrp: 5495, retailers: ["myntra", "amazon"], rating: 4.2, reviews: 700, pop: 58 },
  { code: "CROC-SAN-BLK", brand: "Crocs", title: "Classic Clog", category: "sandals", material: "Croslite", color: "black", colorName: "Black", rain: true, styles: ["casual"], occasions: ["casual", "travel", "vacation"], seasons: ["monsoon", "summer"], price: 2995, mrp: 3995, retailers: ["myntra", "amazon"], rating: 4.5, reviews: 5200, pop: 70 },
  { code: "BATA-RAIN-SNK", brand: "Bata", title: "Water-Resistant Sneakers", category: "sneakers", material: "PU", color: "grey", colorName: "Grey", rain: true, styles: ["casual", "athleisure"], occasions: ["college", "casual", "travel", "office"], seasons: ["monsoon", "all"], price: 1299, mrp: 1799, retailers: ["amazon", "flipkart"], rating: 4.0, reviews: 900, pop: 57 },

  // ---------------- ACCESSORIES ----------------
  { code: "TMX-MIN-WCH", brand: "Timex", title: "Minimal Analog Watch, Leather Strap", category: "watch", material: "Leather strap", color: "brown", colorName: "Brown / White dial", styles: ["minimal", "smart-casual", "old-money"], occasions: ["office", "date", "interview", "business-meeting", "first-day", "reception"], price: 1995, mrp: 2995, retailers: ["amazon", "myntra", "flipkart"], rating: 4.3, reviews: 3100, pop: 75 },
  { code: "FST-MIN-WCH", brand: "Fastrack", title: "Minimalist Analog Watch", category: "watch", material: "Mesh strap", color: "silver", colorName: "Silver", styles: ["minimal", "smart-casual", "korean"], occasions: ["office", "college", "date", "casual", "party"], price: 1295, mrp: 1795, retailers: ["amazon", "myntra", "flipkart"], rating: 4.1, reviews: 6200, pop: 79 },
  { code: "SNT-GLD-WCH", brand: "Sonata", title: "Gold-Tone Analog Watch", category: "watch", material: "Metal", color: "gold", colorName: "Gold", styles: ["traditional", "formal", "indo-western"], occasions: ["wedding", "reception", "diwali", "festival", "eid"], price: 599, mrp: 999, retailers: ["amazon", "flipkart"], rating: 4.0, reviews: 4100, pop: 64 },
  { code: "CAS-DIG-BLK", brand: "Casio", title: "Vintage Digital Watch", category: "watch", material: "Resin", color: "black", colorName: "Black", styles: ["streetwear", "casual", "korean"], occasions: ["college", "casual", "travel"], price: 1695, mrp: 1695, retailers: ["amazon", "myntra"], rating: 4.5, reviews: 9800, pop: 86 },
  { code: "BLT-LTH-BRN", brand: "Tommy Hilfiger", title: "Reversible Leather Belt", category: "belt", material: "Leather", color: "brown", colorName: "Brown/Black", styles: ["smart-casual", "formal", "old-money", "minimal"], occasions: ["office", "interview", "date", "business-meeting", "first-day", "reception"], price: 1599, mrp: 2499, retailers: ["myntra", "ajio", "amazon"], rating: 4.4, reviews: 1200, pop: 66 },
  { code: "BLT-LTH-BLK", brand: "Allen Solly", title: "Leather Formal Belt", category: "belt", material: "Leather", color: "black", colorName: "Black", styles: ["formal", "minimal", "smart-casual"], occasions: ["office", "interview", "business-meeting", "first-day", "wedding"], price: 599, mrp: 999, retailers: ["myntra", "amazon", "flipkart"], rating: 4.1, reviews: 2600, pop: 63 },
  { code: "SUN-WAY-BLK", brand: "Vincent Chase", title: "Wayfarer Sunglasses", category: "sunglasses", material: "Acetate", color: "black", colorName: "Black", styles: ["casual", "streetwear", "minimal"], occasions: ["vacation", "travel", "casual", "date"], price: 1100, mrp: 2000, retailers: ["myntra", "amazon"], rating: 4.2, reviews: 2100, pop: 60 },
  { code: "BAG-TOTE-BEI", brand: "Uniqlo", title: "Canvas Tote Bag", category: "bag", material: "Canvas", color: "beige", colorName: "Natural", styles: ["minimal", "korean", "casual"], occasions: ["college", "casual", "travel"], price: 990, mrp: 990, retailers: ["uniqlo"], rating: 4.3, reviews: 300, pop: 52 },
  // Clearly labelled sponsored placement (never affects fit scoring)
  { code: "SP-OVS-NVY", brand: "Snitch", title: "Corduroy Overshirt", category: "overshirt", fit: "regular", material: "Corduroy", color: "navy", colorName: "Navy", pattern: "texture", weight: "heavy", structured: true, styles: ["smart-casual", "streetwear", "old-money"], occasions: ["college", "date", "casual", "office"], seasons: ["winter", "all"], price: 1499, mrp: 2499, retailers: ["snitch"], rating: 4.0, reviews: 240, pop: 60, sponsored: true },
];

// ---------------------------------------------------------------------------
// Deterministic pseudo-random generator so demo data is stable across renders.
// ---------------------------------------------------------------------------
export function seeded(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];
const WAIST_SIZES = ["28", "30", "32", "34", "36", "38", "40"];
const SHOE_SIZES = ["6", "7", "8", "9", "10", "11"];

const FIT_EASE_TOP: Partial<Record<FitType, number>> = { skinny: -2, slim: -1.5, regular: 0, straight: 0.5, tapered: 0, relaxed: 2.5, oversized: 6 };

function sizeChartFor(m: Model): Record<string, GarmentMeasure> | undefined {
  const slot = m.category;
  if (["watch", "sunglasses", "bag"].includes(slot)) return undefined;
  if (["sneakers", "loafers", "formal-shoes", "mojaris", "boots", "sandals"].includes(slot)) {
    return Object.fromEntries(SHOE_SIZES.map((s) => [s, {}]));
  }
  if (slot === "belt") {
    return Object.fromEntries(WAIST_SIZES.map((w) => [w, { waist: Number(w) }]));
  }
  if (["jeans", "chinos", "trousers", "joggers", "shorts"].includes(slot)) {
    const ease = m.fit === "skinny" ? -0.5 : m.fit === "slim" ? -0.25 : m.fit === "relaxed" ? 0.75 : 0;
    const inseam = m.category === "shorts" ? 8 : m.length === "cropped" ? 29 : 31;
    return Object.fromEntries(WAIST_SIZES.map((w) => [w, { waist: Number(w) + ease, inseam }]));
  }
  const ease = FIT_EASE_TOP[m.fit ?? "regular"] ?? 0;
  const lenAdj = m.length === "long" ? 2 : m.length === "cropped" ? -2 : 0;
  // Garment chest = body chest + ~4" standard ease + fit-specific ease.
  return Object.fromEntries(
    TOP_SIZES.map((s, i) => [
      s,
      {
        chest: 38 + i * 2 + 4 + ease,
        length: 28 + i + lenAdj,
        sleeve: 24 + i * 0.5 + (m.fit === "oversized" ? 1 : 0),
        shoulder: 17 + i * 0.75 + (m.fit === "oversized" ? 2 : m.fit === "relaxed" ? 0.75 : 0),
      },
    ]),
  );
}

function sizesFor(m: Model, rand: () => number): string[] {
  const chart = sizeChartFor(m);
  if (["watch", "sunglasses", "bag"].includes(m.category)) return ["One size"];
  const all = chart ? Object.keys(chart) : TOP_SIZES;
  // Simulate a couple of sizes being out of stock at a given retailer.
  return all.filter(() => rand() > 0.12);
}

const RETAILER_DOMAIN: Record<string, string> = {
  myntra: "https://www.myntra.com",
  ajio: "https://www.ajio.com",
  amazon: "https://www.amazon.in",
  flipkart: "https://www.flipkart.com",
  tatacliq: "https://www.tatacliq.com",
  nykaafashion: "https://www.nykaafashion.com",
  hm: "https://www2.hm.com/en_in",
  uniqlo: "https://www.uniqlo.com/in",
  westside: "https://www.westside.com",
  snitch: "https://www.snitch.co.in",
  bewakoof: "https://www.bewakoof.com",
  levis: "https://www.levi.in",
};

/** A fixed demo "snapshot" time relative to process start, so freshness labels are exercisable. */
const SNAPSHOT = Date.now();

function round9(n: number) {
  if (n < 100) return Math.round(n);
  return Math.max(99, Math.round(n / 10) * 10 - 1);
}

function buildCatalog(): Product[] {
  const out: Product[] = [];
  for (const m of M) {
    m.retailers.forEach((r, idx) => {
      const rand = seeded(`${m.code}:${r}`);
      // Retailer-level price variation, simulated.
      const variation = idx === 0 ? 0 : (rand() - 0.45) * 0.16;
      const price = round9(m.price * (1 + variation));
      const mrp = m.mrp ? Math.max(m.mrp, price) : undefined;
      const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined;
      const hoursAgo = Math.floor(rand() * rand() * 96) + 1; // mostly fresh, some stale
      const available = rand() > 0.07;
      const id = `${m.code}-${r}`.toLowerCase();
      const chart = m.noChart ? undefined : sizeChartFor(m);
      out.push({
        id,
        retailer: r,
        brand: m.brand,
        title: `${m.brand} ${m.title}`.replace(`${m.brand} ${m.brand}`, m.brand),
        category: m.category,
        subcategory: m.sub,
        price,
        mrp,
        discountPercent: discount,
        currency: "INR",
        sizes: available ? sizesFor(m, rand) : [],
        colors: [m.colorName],
        fit: m.fit,
        material: m.material,
        rating: m.rating ? Math.round((m.rating + (rand() - 0.5) * 0.2) * 10) / 10 : undefined,
        reviewCount: m.reviews ? Math.round(m.reviews * (idx === 0 ? 1 : 0.2 + rand() * 0.6)) : undefined,
        imageUrl: `/api/art/${id}`,
        productUrl: RETAILER_DOMAIN[r] ?? "#",
        availability: available,
        lastCheckedAt: new Date(SNAPSHOT - hoursAgo * 3600_000).toISOString(),
        attrs: {
          modelCode: m.code,
          sku: `${m.code}-${r.toUpperCase()}`,
          colorFamily: m.color,
          pattern: m.pattern ?? "solid",
          styles: m.styles,
          occasions: m.occasions,
          fabricWeight: m.weight ?? "medium",
          structured: m.structured ?? false,
          stretch: m.stretch ?? false,
          rainFriendly: m.rain,
          seasons: m.seasons ?? ["all"],
          brandSizing: m.sizing ?? "true",
          sizeChart: chart,
          popularity: m.pop,
          lengthProfile: m.length ?? "regular",
        },
        source: { providerId: "demo", kind: "demo", realtime: false, sponsored: m.sponsored },
      });
    });
  }
  return out;
}

export const DEMO_PRODUCTS: Product[] = buildCatalog();
export const DEMO_MODEL_COUNT = M.length;
