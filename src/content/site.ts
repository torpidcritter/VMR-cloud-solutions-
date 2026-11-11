/**
 * Central company information.
 * Everything that appears in more than one place lives here so it only
 * has to be updated once. Items marked CONFIRM should be checked with
 * management before the site goes live (see CONTENT-CHECKLIST.md).
 */

export const site = {
  name: "VMR Cloud Solutions",
  legalName: "VMR Cloud Solutions Private Limited",
  brand: "VMR Cloud",
  tagline: "Technology. Talent. Transformation.",
  url: "https://vmrcloudsolutions.com",
  description:
    "VMR Cloud Solutions is a Bengaluru-based IT and consulting company, established in 2017, with expertise in SAP, Java, Python, enterprise software development and IT consulting.",
  shortAbout:
    "VMR Cloud Solutions Private Limited is an IT and consulting company based in Bengaluru, India, with technical experience across SAP, Java, Python and enterprise software development.",

  established: "September 2017",
  establishedYear: 2017,
  incorporationDate: "7 September 2017",
  // CONFIRM: management-provided estimate.
  teamSize: "~100",

  registration: {
    cin: "U72200KA2017PTC106210", // CONFIRM against MCA records
    gstin: "29AAGCV0903J1Z8", // matches GST registration certificate
    udyam: "UDYAM-KR-02-0014881", // matches Udyam registration certificate
    roc: "Bangalore",
    type: "Private Limited Company",
  },

  address: {
    lines: [
      "#94, 2nd Floor, 21st Cross, Gayathri Layout",
      "Basavanapura Main Road, K.R. Puram",
      "Bengaluru – 560036, Karnataka, India",
    ],
    street: "#94, 2nd Floor, 21st Cross, Gayathri Layout, Basavanapura Main Road, K.R. Puram",
    city: "Bengaluru",
    region: "Karnataka",
    postalCode: "560036",
    country: "IN",
    short: "Bengaluru, Karnataka, India",
    mapQuery: "Gayathri Layout, Basavanapura Main Road, K.R. Puram, Bengaluru 560036",
  },

  /** All offices, head office first. Used on the Contact page and in the footer. */
  offices: [
    {
      name: "Head Office",
      city: "Bengaluru, Karnataka",
      lines: [
        "#94, 2nd Floor, 21st Cross, Gayathri Layout",
        "Basavanapura Main Road, K.R. Puram",
        "Bengaluru – 560036, Karnataka, India",
      ],
      gstin: "29AAGCV0903J1Z8",
      mapQuery: "Gayathri Layout, Basavanapura Main Road, K.R. Puram, Bengaluru 560036",
    },
    {
      name: "Andhra Pradesh Branch",
      city: "Pileru, Andhra Pradesh",
      lines: ["1-151/1, 2nd Floor, Near Kotapalli", "Pileru, Chittoor District", "Andhra Pradesh – 517294, India"],
      gstin: "37AAGCV0903J1ZB", // from company invoice
      mapQuery: "Kotapalli, Pileru, Chittoor, Andhra Pradesh 517294",
    },
  ],

  email: {
    general: "info@vmrcloudsolutions.com",
    hr: "hr@vmrcloudsolutions.com",
    hrContact: "rajesh.v@vmrcloudsolutions.com",
  },

  phone: {
    mobile: { display: "+91 93926 70130", href: "tel:+919392670130" },
    office: [
      { display: "080-25610-444", href: "tel:+918025610444" },
      { display: "080-25610-777", href: "tel:+918025610777" },
      { display: "080-25610-888", href: "tel:+918025610888" },
    ],
  },

  /**
   * CONFIRM: add the company's official profiles here. Icons only render
   * for entries that have a URL, so nothing shows until these are filled in.
   */
  social: {
    linkedin: "",
    x: "",
    facebook: "",
    instagram: "",
    youtube: "",
  },
} as const;

export const mainNav = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services", hasMenu: true },
  { label: "Industries", href: "/industries" },
  { label: "Careers", href: "/careers" },
] as const;

export const footerQuickLinks = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Technology Expertise", href: "/technology" },
  { label: "Industries", href: "/industries" },
  { label: "Careers", href: "/careers" },
  { label: "Contact Us", href: "/contact" },
] as const;

export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;
