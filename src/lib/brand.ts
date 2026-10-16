// Product brand. One codebase serves the Rotorua pilot (Outside In ·
// Tourism AI Growth OS) and the commercial product (Findable). The brand is
// a deployment setting so switching it never touches data or permissions.
//
//   PRODUCT_BRAND=findable    → Findable
//   (unset / anything else)   → Outside In (the pilot, today's default)

export type BrandId = "outside-in" | "findable";

export interface Brand {
  id: BrandId;
  /** Wordmark text; rendered with a coloured full stop. */
  name: string;
  /** Product name used in titles and the app chrome. */
  product: string;
  /** Short line under the wordmark on sign-in pages. */
  tagline: string;
  description: string;
}

const BRANDS: Record<BrandId, Brand> = {
  "outside-in": {
    id: "outside-in",
    name: "Outside In",
    product: "Tourism AI Growth OS",
    tagline: "Rotorua Tourism AI Growth Pilot",
    description: "Operating system for the Outside In Rotorua Tourism AI Growth Pilot.",
  },
  findable: {
    id: "findable",
    name: "Findable",
    product: "Findable",
    tagline: "AI visibility for tourism · Aotearoa NZ",
    description: "Findable shows tourism businesses how AI assistants describe and recommend them.",
  },
};

export function brandFor(value: string | undefined): Brand {
  return value?.trim().toLowerCase() === "findable" ? BRANDS.findable : BRANDS["outside-in"];
}

export function getBrand(): Brand {
  return brandFor(process.env.PRODUCT_BRAND);
}
