/**
 * Service catalogue.
 * The "capabilities" lists come from the proposed service areas in the
 * content brief. CONFIRM the exact catalogue, SAP modules, frameworks and
 * staffing models with management before launch (see CONTENT-CHECKLIST.md).
 */

export type ServiceIcon =
  | "sap"
  | "java"
  | "python"
  | "transform"
  | "cloud"
  | "talent"
  | "engineering"
  | "support";

export type Service = {
  slug: string;
  number: string;
  title: string;
  navTitle: string;
  icon: ServiceIcon;
  headline: string;
  summary: string;
  intro: string[];
  challenges: { title: string; text: string }[];
  capabilities: { title: string; text: string }[];
  landscapeTitle: string;
  landscapeIntro: string;
  landscape: string[];
  engagement: { title: string; text: string }[];
  outcomes: string[];
  related: string[];
  /** Small layout variation so each service page has its own rhythm. */
  layout: "split" | "panel" | "columns";
};

export const services: Service[] = [
  {
    slug: "sap-consulting",
    number: "01",
    title: "SAP Consulting",
    navTitle: "SAP Consulting",
    icon: "sap",
    headline: "Driving Enterprise Efficiency Through SAP.",
    summary:
      "Consulting, development and support for SAP-based enterprise environments and business processes.",
    intro: [
      "SAP technologies play an important role in helping organizations manage business processes, enterprise resources and operational workflows.",
      "VMR Cloud Solutions has technical experience in SAP-related enterprise environments and supports business technology requirements through specialized expertise, from development and integration to ongoing application support.",
    ],
    challenges: [
      {
        title: "Complex enterprise processes",
        text: "Finance, supply chain and operations processes that need to work consistently across the organization.",
      },
      {
        title: "Customisation and integration",
        text: "Business-specific requirements that call for development work and integration with other systems.",
      },
      {
        title: "Keeping systems healthy",
        text: "SAP landscapes that need regular maintenance, optimization and responsive technical support.",
      },
    ],
    capabilities: [
      { title: "SAP Consulting", text: "Understanding requirements and advising on SAP-based approaches." },
      { title: "SAP Development", text: "Building enhancements, reports and custom functionality." },
      { title: "SAP Application Support", text: "Day-to-day support for SAP applications and users." },
      { title: "Enterprise Resource Planning", text: "Supporting ERP processes across business functions." },
      { title: "SAP Technical Services", text: "Technical configuration and system-level assistance." },
      { title: "SAP Integration", text: "Connecting SAP with surrounding applications and data flows." },
      { title: "SAP System Maintenance", text: "Keeping SAP environments stable, current and reliable." },
      { title: "Application Optimization", text: "Improving performance and usability of enterprise applications." },
    ],
    landscapeTitle: "The SAP landscape",
    landscapeIntro:
      "Our SAP work is centred on enterprise environments built around SAP's ERP platform and its surrounding technologies.",
    // CONFIRM: list only modules and products the team actively supports.
    landscape: ["SAP S/4HANA", "SAP ABAP", "SAP Fiori", "SAP BTP", "SAP Basis"],
    engagement: [
      { title: "Assess", text: "Review the current SAP landscape, processes and requirements." },
      { title: "Plan", text: "Define scope, technical approach and the right mix of expertise." },
      { title: "Build & integrate", text: "Develop, configure and connect the required functionality." },
      { title: "Support", text: "Maintain, optimise and assist users where the engagement requires it." },
    ],
    outcomes: [
      "Clearer, better-supported business processes",
      "SAP systems aligned with current requirements",
      "Access to specialised SAP technical expertise",
    ],
    related: ["digital-transformation", "application-support", "it-staffing"],
    layout: "split",
  },
  {
    slug: "java-development",
    number: "02",
    title: "Java Development",
    navTitle: "Java Development",
    icon: "java",
    headline: "Building Reliable Enterprise Software With Java.",
    summary:
      "Scalable Java applications, backend systems and APIs for business-critical software.",
    intro: [
      "Java remains an important technology for developing scalable enterprise applications, backend systems and business-critical software solutions.",
      "Our Java engineering capabilities support application development, backend engineering and enterprise software requirements, including the modernization of existing applications.",
    ],
    challenges: [
      {
        title: "Scale and reliability",
        text: "Applications that must handle growing users, data and transactions without losing stability.",
      },
      {
        title: "Ageing codebases",
        text: "Older Java applications that are difficult to change, extend or maintain.",
      },
      {
        title: "Connected systems",
        text: "Software that needs to exchange data cleanly with other enterprise platforms.",
      },
    ],
    capabilities: [
      { title: "Java Application Development", text: "Designing and building enterprise applications in Java." },
      { title: "Backend Development", text: "Server-side logic, services and data handling." },
      { title: "Enterprise Software Engineering", text: "Structured engineering for business-critical systems." },
      { title: "API Development", text: "Well-defined APIs that let systems communicate reliably." },
      { title: "Application Integration", text: "Connecting Java applications with surrounding platforms." },
      { title: "Application Maintenance", text: "Fixes, enhancements and ongoing improvement." },
      { title: "Software Modernization", text: "Refactoring and updating existing Java applications." },
    ],
    landscapeTitle: "Engineering focus",
    landscapeIntro:
      "Java engagements typically span the following areas of backend and enterprise engineering.",
    // CONFIRM: add specific frameworks (e.g. Spring Boot) once verified.
    landscape: ["Core Java", "Backend services", "REST APIs", "Relational databases", "Application integration"],
    engagement: [
      { title: "Requirements", text: "Clarify functional needs, constraints and existing architecture." },
      { title: "Design", text: "Agree the application structure, interfaces and data model." },
      { title: "Engineer", text: "Build, review and test in short, visible iterations." },
      { title: "Evolve", text: "Maintain and enhance the application as needs change." },
    ],
    outcomes: [
      "Maintainable, well-structured Java code",
      "Backend systems designed to scale",
      "Smoother integration across applications",
    ],
    related: ["digital-engineering", "python-development", "application-support"],
    layout: "panel",
  },
  {
    slug: "python-development",
    number: "03",
    title: "Python Development",
    navTitle: "Python Development",
    icon: "python",
    headline: "Building Intelligent and Scalable Software Solutions.",
    summary:
      "Flexible Python software for backend engineering, automation and data processing.",
    intro: [
      "Python enables organizations to develop flexible software solutions across backend engineering, automation, data processing and intelligent applications.",
      "Our Python-related technical expertise supports a range of software engineering requirements, from APIs and backend services to the automation of repetitive business processes.",
    ],
    challenges: [
      {
        title: "Manual, repetitive work",
        text: "Business processes that consume time and are prone to error when done by hand.",
      },
      {
        title: "Data in many places",
        text: "Information that needs to be collected, transformed and moved between systems.",
      },
      {
        title: "Speed of delivery",
        text: "The need to build and iterate on software quickly without compromising quality.",
      },
    ],
    capabilities: [
      { title: "Python Development", text: "Applications and services built in Python." },
      { title: "Backend Engineering", text: "Server-side services, logic and data handling." },
      { title: "API Development", text: "Clean, documented interfaces between systems." },
      { title: "Business Process Automation", text: "Scripts and services that remove repetitive manual work." },
      { title: "Data Processing", text: "Collecting, cleaning and transforming business data." },
      { title: "Application Integration", text: "Connecting Python services with existing platforms." },
      { title: "Software Development", text: "End-to-end development of Python-based solutions." },
    ],
    landscapeTitle: "Where Python fits",
    landscapeIntro:
      "Python is well suited to the following kinds of engineering work.",
    // CONFIRM: AI / ML and data engineering only if offered commercially.
    landscape: ["Backend services", "REST APIs", "Automation scripts", "Data processing pipelines", "Integrations"],
    engagement: [
      { title: "Discover", text: "Identify the process, data or product need to address." },
      { title: "Prototype", text: "Validate the approach quickly with a working first version." },
      { title: "Build", text: "Harden, test and integrate the solution." },
      { title: "Improve", text: "Monitor, maintain and extend over time." },
    ],
    outcomes: [
      "Less time spent on repetitive tasks",
      "Faster movement of data between systems",
      "Flexible software that is easy to extend",
    ],
    related: ["java-development", "digital-engineering", "cloud-solutions"],
    layout: "columns",
  },
  {
    slug: "digital-transformation",
    number: "04",
    title: "Digital Transformation",
    navTitle: "Digital Transformation",
    icon: "transform",
    headline: "Modernizing Businesses Through Technology.",
    summary:
      "Consulting and engineering that help organizations modernize processes and platforms.",
    intro: [
      "Digital transformation involves more than implementing new technologies. It requires understanding business requirements, identifying opportunities for improvement and developing technology solutions that support organizational objectives.",
      "VMR helps businesses navigate their technology modernization requirements through a combination of consulting and engineering capabilities.",
    ],
    challenges: [
      {
        title: "Legacy systems",
        text: "Older applications that slow down change and are costly to maintain.",
      },
      {
        title: "Disconnected processes",
        text: "Workflows split across tools, spreadsheets and manual hand-offs.",
      },
      {
        title: "Unclear priorities",
        text: "Many possible improvements, but no clear plan for where to start.",
      },
    ],
    capabilities: [
      { title: "Technology Modernization", text: "Updating platforms and applications for current needs." },
      { title: "Digital Strategy", text: "Prioritising technology initiatives around business goals." },
      { title: "Business Process Optimization", text: "Simplifying and digitising key workflows." },
      { title: "Enterprise Application Modernization", text: "Re-platforming or refactoring business applications." },
      { title: "System Integration", text: "Connecting systems so data flows where it is needed." },
      { title: "Technology Consulting", text: "Independent advice on technology choices and approach." },
    ],
    landscapeTitle: "Transformation areas",
    landscapeIntro: "Modernization programmes usually touch several of these areas at once.",
    landscape: ["Process digitisation", "Application modernization", "Systems integration", "Enterprise platforms", "Software engineering"],
    engagement: [
      { title: "Understand", text: "Map current processes, systems and pain points." },
      { title: "Prioritise", text: "Agree a practical roadmap with clear, achievable steps." },
      { title: "Modernise", text: "Deliver changes incrementally to reduce disruption." },
      { title: "Sustain", text: "Support adoption and continued improvement." },
    ],
    outcomes: [
      "A practical, prioritised modernization roadmap",
      "Fewer manual and disconnected processes",
      "Technology aligned with business objectives",
    ],
    related: ["sap-consulting", "cloud-solutions", "digital-engineering"],
    layout: "panel",
  },
  {
    slug: "cloud-solutions",
    number: "05",
    title: "Cloud Solutions",
    navTitle: "Cloud Solutions",
    icon: "cloud",
    headline: "Enabling Modern Business Infrastructure.",
    summary:
      "Helping organizations understand, adopt and build on appropriate cloud technologies.",
    intro: [
      "Cloud technologies enable businesses to develop flexible, scalable and accessible technology environments.",
      "Our cloud services focus on helping organizations understand and adopt the cloud technologies that fit their requirements, from building cloud-ready applications to moving and integrating existing workloads.",
    ],
    challenges: [
      {
        title: "Choosing the right approach",
        text: "Deciding what to move, what to rebuild and what to leave in place.",
      },
      {
        title: "Migration risk",
        text: "Moving applications and data without disrupting day-to-day operations.",
      },
      {
        title: "Hybrid environments",
        text: "Keeping cloud and on-premise systems working together reliably.",
      },
    ],
    capabilities: [
      { title: "Cloud Consulting", text: "Assessing readiness and recommending a suitable approach." },
      { title: "Cloud Application Development", text: "Building applications designed to run in the cloud." },
      { title: "Cloud Migration", text: "Planning and moving workloads with care." },
      { title: "Cloud Integration", text: "Connecting cloud services with existing systems." },
      { title: "Infrastructure Modernization", text: "Updating infrastructure for flexibility and scale." },
      { title: "Cloud Application Support", text: "Ongoing support for cloud-hosted applications." },
    ],
    landscapeTitle: "Cloud focus areas",
    landscapeIntro: "Our cloud work is organised around the following areas.",
    // CONFIRM: name AWS / Azure / Google Cloud only once expertise or partnerships are verified.
    landscape: ["Cloud readiness", "Cloud-native applications", "Workload migration", "Hybrid integration", "Application support"],
    engagement: [
      { title: "Assess", text: "Understand current infrastructure, applications and goals." },
      { title: "Design", text: "Define the target environment and migration path." },
      { title: "Migrate & build", text: "Move or build workloads in planned stages." },
      { title: "Operate", text: "Support and refine the environment after go-live." },
    ],
    outcomes: [
      "A clear, risk-aware cloud approach",
      "Applications ready to scale with demand",
      "Cloud and existing systems working together",
    ],
    related: ["digital-transformation", "python-development", "application-support"],
    layout: "split",
  },
  {
    slug: "it-staffing",
    number: "06",
    title: "IT Staffing & Talent",
    navTitle: "IT Staffing & Talent",
    icon: "talent",
    headline: "Connecting Businesses With Technology Expertise.",
    summary:
      "Access to skilled technology professionals to strengthen teams and deliver projects.",
    intro: [
      "Organizations need access to skilled technology professionals to execute projects, strengthen engineering teams and support business-critical initiatives.",
      "VMR's technology talent capabilities focus on providing access to specialized IT professionals and supporting enterprise technology requirements across SAP, Java, Python and broader software engineering.",
    ],
    challenges: [
      {
        title: "Skills gaps",
        text: "Projects that need specialised expertise the in-house team does not have.",
      },
      {
        title: "Changing demand",
        text: "Workloads that rise and fall, making permanent hiring difficult.",
      },
      {
        title: "Time to hire",
        text: "Long recruitment cycles that delay important initiatives.",
      },
    ],
    // CONFIRM: which staffing models are offered commercially.
    capabilities: [
      { title: "IT Staffing", text: "Technology professionals matched to project needs." },
      { title: "Technical Recruitment", text: "Sourcing and screening for technical roles." },
      { title: "Resource Augmentation", text: "Extending existing teams with additional capacity." },
      { title: "Contract Staffing", text: "Professionals engaged for a defined period." },
      { title: "Project-Based Resources", text: "Technical specialists for specific initiatives." },
      { title: "Enterprise Technology Talent", text: "Specialists across SAP, Java, Python and more." },
    ],
    landscapeTitle: "Talent areas",
    landscapeIntro: "We focus on the technology skills where our own team has hands-on experience.",
    landscape: ["SAP professionals", "Java developers", "Python developers", "Software engineers", "QA & testing"],
    engagement: [
      { title: "Define", text: "Agree the role, skills, duration and working model." },
      { title: "Source", text: "Identify and technically screen suitable professionals." },
      { title: "Onboard", text: "Support a smooth start within the client team." },
      { title: "Support", text: "Stay engaged to ensure the arrangement works well." },
    ],
    outcomes: [
      "Faster access to the right technical skills",
      "Flexible capacity for changing workloads",
      "Teams strengthened for critical initiatives",
    ],
    related: ["sap-consulting", "java-development", "digital-engineering"],
    layout: "columns",
  },
  {
    slug: "digital-engineering",
    number: "07",
    title: "Digital Engineering",
    navTitle: "Digital Engineering",
    icon: "engineering",
    headline: "Engineering Software for Evolving Business Needs.",
    summary:
      "Custom software, web applications and quality engineering for modern business needs.",
    intro: [
      "Digital engineering focuses on developing, integrating and maintaining software applications that support modern business requirements.",
      "We bring software development, integration and quality assurance together so that applications are built carefully, tested thoroughly and ready to evolve.",
    ],
    challenges: [
      {
        title: "Off-the-shelf limits",
        text: "Packaged software that does not fit specific business workflows.",
      },
      {
        title: "Quality and stability",
        text: "Releases that introduce defects or are difficult to test.",
      },
      {
        title: "Fragmented applications",
        text: "Tools that do not share data or provide a consistent experience.",
      },
    ],
    capabilities: [
      { title: "Custom Software Development", text: "Software built around specific business needs." },
      { title: "Web Application Development", text: "Responsive, accessible web applications." },
      { title: "Backend Engineering", text: "Services, logic and data layers behind applications." },
      { title: "API Development", text: "Interfaces that connect products and platforms." },
      { title: "Application Integration", text: "Bringing separate systems together." },
      { title: "Software Testing", text: "Functional and regression testing of applications." },
      { title: "Quality Assurance", text: "Processes that keep quality consistent across releases." },
      { title: "Application Modernization", text: "Updating existing applications for today's needs." },
    ],
    landscapeTitle: "Engineering practices",
    landscapeIntro: "Our engineering work draws on the following practices.",
    landscape: ["Frontend development", "Backend development", "API integration", "Testing & QA", "Code reviews", "Deployment"],
    engagement: [
      { title: "Scope", text: "Shape requirements into a clear, testable scope." },
      { title: "Design", text: "Plan architecture, interfaces and user experience." },
      { title: "Build & test", text: "Develop with continuous testing and review." },
      { title: "Release", text: "Deploy carefully and support what follows." },
    ],
    outcomes: [
      "Software that fits how the business works",
      "More predictable, higher-quality releases",
      "Applications that are easier to extend",
    ],
    related: ["java-development", "python-development", "application-support"],
    layout: "split",
  },
  {
    slug: "application-support",
    number: "08",
    title: "Application Support",
    navTitle: "Application Support",
    icon: "support",
    headline: "Keeping Business-Critical Technology Running.",
    summary:
      "Maintenance, troubleshooting and ongoing engineering support for business applications.",
    intro: [
      "Technology systems require continuous monitoring, maintenance and improvement to remain reliable and aligned with business requirements.",
      "Our application support helps organizations keep important applications stable, resolve issues and make steady improvements over time.",
    ],
    challenges: [
      {
        title: "Unplanned issues",
        text: "Defects and incidents that disrupt users and business operations.",
      },
      {
        title: "Stretched internal teams",
        text: "In-house teams busy with new work and unable to focus on maintenance.",
      },
      {
        title: "Gradual decline",
        text: "Applications that slow down or fall behind changing requirements.",
      },
    ],
    // CONFIRM: use "managed services" / "SLA" language only if formally offered.
    capabilities: [
      { title: "Application Maintenance", text: "Planned updates and fixes to keep applications current." },
      { title: "Technical Support", text: "Responsive help when users or systems have issues." },
      { title: "Software Debugging", text: "Diagnosing and resolving defects at the root." },
      { title: "Application Optimization", text: "Improving performance and reliability." },
      { title: "System Maintenance", text: "Routine care of the systems applications depend on." },
      { title: "Ongoing Engineering Support", text: "Continued enhancements as needs evolve." },
    ],
    landscapeTitle: "Applications we support",
    landscapeIntro: "Support is available across the technologies we build with.",
    landscape: ["SAP applications", "Java applications", "Python applications", "Web applications", "Integrations"],
    engagement: [
      { title: "Onboard", text: "Understand the application, users and support needs." },
      { title: "Stabilise", text: "Address known issues and priority defects." },
      { title: "Maintain", text: "Provide agreed ongoing support and maintenance." },
      { title: "Improve", text: "Recommend and deliver incremental improvements." },
    ],
    outcomes: [
      "More stable, dependable applications",
      "Faster resolution of issues",
      "Internal teams freed to focus on new work",
    ],
    related: ["sap-consulting", "digital-engineering", "cloud-solutions"],
    layout: "panel",
  },
];

export const getService = (slug: string) => services.find((s) => s.slug === slug);
