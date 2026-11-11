/**
 * Shared marketing content: values, approach, why-VMR, industries,
 * clients, certifications and careers.
 */

export const pillars = [
  {
    title: "Technology",
    text: "SAP, Java, Python, enterprise software and application development.",
  },
  {
    title: "Talent",
    text: "Technology professionals, IT consulting and specialised engineering capabilities.",
  },
  {
    title: "Transformation",
    text: "Digital modernization, business technology solutions and enterprise development.",
  },
] as const;

export const stats = [
  { value: "2017", label: "Year established", note: "Incorporated in Bengaluru" },
  // CONFIRM: management estimate of current team size.
  { value: "~100", countTo: 100, prefix: "~", label: "Team members", note: "Engineers and consultants" },
  { value: "SAP", label: "Enterprise technology", note: "Core platform expertise" },
  { value: "Java & Python", label: "Software engineering", note: "Application development" },
] as const;

export const approach = [
  {
    step: "01",
    title: "Understand",
    text: "We begin by understanding business objectives, existing technology environments, operational challenges and project requirements.",
  },
  {
    step: "02",
    title: "Strategize",
    text: "We identify suitable technologies, technical approaches and implementation strategies aligned with business objectives.",
  },
  {
    step: "03",
    title: "Deliver",
    text: "We bring together engineering capabilities, technical expertise and collaborative execution to deliver technology solutions.",
  },
  {
    step: "04",
    title: "Support",
    text: "We focus on continued improvement, application maintenance and technical support wherever required by the engagement.",
  },
] as const;

export const whyVmr = [
  {
    icon: "calendar",
    title: "Established Experience",
    text: "Operating in the IT and consulting sector since September 2017.",
  },
  {
    icon: "layers",
    title: "Enterprise Technology Expertise",
    text: "Experience across SAP, Java and Python for enterprise and engineering engagements.",
  },
  {
    icon: "compass",
    title: "Consulting-Oriented Approach",
    text: "We understand business requirements before recommending technology.",
  },
  {
    icon: "code",
    title: "Engineering Capabilities",
    text: "A software engineering focus that supports development and implementation.",
  },
  {
    icon: "users",
    title: "Collaborative Execution",
    text: "Clear communication and teamwork with clients and partners throughout delivery.",
  },
  {
    icon: "sprout",
    title: "Continuous Learning",
    text: "Keeping our technical capabilities aligned with an evolving technology landscape.",
  },
] as const;

export const values = [
  { title: "Innovation", text: "Embracing evolving technologies and finding better ways to solve business challenges." },
  { title: "Integrity", text: "Building professional relationships through transparency, accountability and trust." },
  { title: "Collaboration", text: "Working together with clients, teams and technology partners to achieve shared objectives." },
  { title: "Excellence", text: "Maintaining a commitment to quality, continuous improvement and professional delivery." },
  { title: "Adaptability", text: "Evolving alongside changing business requirements and technological advancements." },
] as const;

export const timeline = [
  {
    period: "2017",
    title: "The Beginning",
    text: "VMR Cloud Solutions Private Limited was incorporated in Bengaluru in September 2017, with a focus on information technology and consulting.",
  },
  {
    period: "2017 – Present",
    title: "Growing Through Technology",
    text: "The company has built its experience across enterprise technologies and software engineering, including SAP, Java and Python.",
  },
  {
    period: "Today",
    title: "Enterprise Technology & Consulting",
    text: "VMR continues to focus on technology consulting, engineering capabilities and supporting the technology requirements of its clients.",
  },
] as const;

// CONFIRM: only keep industries where VMR has relevant experience.
export const industries = [
  {
    icon: "cpu",
    title: "Information Technology",
    text: "Engineering capacity, specialist skills and delivery support for technology companies and IT service providers.",
    needs: ["Software engineering", "Technology talent", "Application support"],
  },
  {
    icon: "building",
    title: "Enterprise Businesses",
    text: "Enterprise platforms, integration and modernization for organizations running complex operations.",
    needs: ["SAP & ERP", "System integration", "Modernization"],
  },
  {
    icon: "zap",
    title: "Utilities & Energy",
    text: "Reliable, well-supported business applications for operations that cannot afford downtime.",
    needs: ["Application support", "Enterprise platforms", "Integration"],
  },
  {
    icon: "landmark",
    title: "Financial Services",
    text: "Dependable backend systems, process automation and careful engineering for regulated environments.",
    needs: ["Backend engineering", "Automation", "Quality assurance"],
  },
  {
    icon: "factory",
    title: "Manufacturing",
    text: "ERP-driven processes, plant-to-office integration and applications that support production operations.",
    needs: ["SAP & ERP", "Process optimization", "Integration"],
  },
  {
    icon: "shopping",
    title: "Retail & Commerce",
    text: "Web applications, integrations and scalable backends that support customer-facing operations.",
    needs: ["Web applications", "APIs", "Cloud solutions"],
  },
  {
    icon: "radio",
    title: "Telecommunications",
    text: "Engineering and support for systems that handle high volumes of data and transactions.",
    needs: ["Backend engineering", "Data processing", "Application support"],
  },
] as const;

/** Client logos supplied by VMR ("Our clients" in the logo document). */
export const clients = [
  { name: "Viraj Profiles Limited", logo: "/clients/viraj-profiles.webp", w: 316, h: 160 },
  { name: "Simelabs", logo: "/clients/simelabs.webp", w: 160, h: 160 },
  { name: "Atos Syntel", logo: "/clients/atos-syntel.webp", w: 160, h: 160 },
  { name: "Espouse Technology", logo: "/clients/espouse-technology.webp", w: 551, h: 160 },
  { name: "NeoSOFT Technologies", logo: "/clients/neosoft.webp", w: 509, h: 160 },
  { name: "Altimetrik", logo: "/clients/altimetrik.webp", w: 410, h: 160 },
  { name: "Khatib & Alami", logo: "/clients/khatib-alami.webp", w: 272, h: 160 },
  { name: "Protiviti", logo: "/clients/protiviti.webp", w: 417, h: 160 },
] as const;

/** Certifications and registrations supplied by VMR. */
export const certifications = [
  {
    title: "ISO 9001:2015",
    subtitle: "Quality Management System",
    text: "Certified for quality management, reflecting our commitment to consistent, well-managed delivery.",
    logo: "/certifications/iso-9001-2015.webp",
    w: 502,
    h: 106,
  },
  {
    title: "MSME Registered",
    subtitle: "Ministry of Micro, Small & Medium Enterprises",
    text: "Registered under the Government of India's Udyam registration for micro, small and medium enterprises.",
    logo: "/certifications/msme.webp",
    w: 360,
    h: 348,
  },
  {
    title: "Accredited Certification",
    subtitle: "International Accurate Certification · UASL",
    text: "ISO 9001:2015 certification issued by International Accurate Certification, accredited by UASL (England).",
    logo: "/certifications/iac-iso-badges.webp",
    w: 444,
    h: 384,
  },
] as const;

export const careerAreas = [
  "SAP Consulting",
  "Java Development",
  "Python Development",
  "Software Engineering",
  "Backend Development",
  "Frontend Development",
  "Quality Assurance",
  "IT Consulting",
  "Technical Recruitment",
  "Project Management",
] as const;

export const internshipAreas = [
  "Frontend development",
  "Backend development",
  "API integration",
  "Android application development",
  "iOS application development",
  "Software testing",
  "Debugging",
  "UI/UX collaboration",
  "Code reviews",
  "Deployment",
] as const;
