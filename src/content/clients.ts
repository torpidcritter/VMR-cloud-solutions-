/**
 * Client showcase data — the single source for the Our Clients page and the
 * client logo strip on other pages.
 *
 * To add a client:
 *   1. Save the logo in /public/clients (SVG, or WebP/PNG about 160px tall,
 *      on a white or transparent background).
 *   2. Add an entry below with the logo's real pixel width and height.
 * Optional fields render automatically when filled in. Order here is the
 * order on the page. Only add organisations that have agreed to be listed.
 */

export type Client = {
  name: string;
  logo: string;
  /** Intrinsic logo size in pixels, used for layout and aspect ratio. */
  w: number;
  h: number;
  /** Optional: sector label shown under the logo, e.g. "Manufacturing". */
  sector?: string;
  /** Optional: link to the client's website. */
  website?: string;
};

/** Client logos supplied by VMR ("Our clients" in the logo document). */
export const clients: readonly Client[] = [
  { name: "Viraj Profiles Limited", logo: "/clients/viraj-profiles.webp", w: 316, h: 160 },
  { name: "Simelabs", logo: "/clients/simelabs.webp", w: 160, h: 160 },
  { name: "Atos Syntel", logo: "/clients/atos-syntel.webp", w: 160, h: 160 },
  { name: "Espouse Technology", logo: "/clients/espouse-technology.webp", w: 551, h: 160 },
  { name: "NeoSOFT Technologies", logo: "/clients/neosoft.webp", w: 509, h: 160 },
  { name: "Altimetrik", logo: "/clients/altimetrik.webp", w: 410, h: 160 },
  { name: "Khatib & Alami", logo: "/clients/khatib-alami.webp", w: 272, h: 160 },
  { name: "Protiviti", logo: "/clients/protiviti.webp", w: 417, h: 160 },
];
