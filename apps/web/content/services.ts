import { images } from "./images";

export type MarketingService = {
  slug: string; name: string; description: string; promise: string; image: { src: string; alt: string };
  bookingServiceId?: string; problems: string[]; included: string[]; preparation: string;
};

const common = {
  included: ["A clear assessment of the requested work", "Professional care for your home and work area", "A tidy handover and clear next steps"],
  preparation: "Keep the work area accessible and share any useful access or safety details during booking.",
};

export const marketingServices: MarketingService[] = [
  { slug:"plumbing", name:"Plumbing", description:"Help with leaks, fixtures, drains and everyday plumbing faults.", promise:"Stop small plumbing problems becoming big ones.", image:images.plumbing, bookingServiceId:"plumbing", problems:["Leaking taps or pipework","Slow or blocked drains","Faulty fixtures and toilets"], ...common },
  { slug:"electrical", name:"Electrical", description:"Qualified help with outlets, switches, lighting and troubleshooting.", promise:"Safe, careful help for the electrical jobs around your home.", image:images.electrical, bookingServiceId:"electrical", problems:["Outlets or switches not working","Lighting faults","Electrical troubleshooting"], ...common },
  { slug:"handyman", name:"Handyman", description:"Practical help with mounting, assembly, repairs and home projects.", promise:"Get the list done properly.", image:images.handyman, bookingServiceId:"handyman", problems:["Furniture assembly","Shelving and mounting","Minor repairs"], ...common },
  { slug:"heating", name:"Heating", description:"Heating checks, troubleshooting and maintenance information.", promise:"Keep your home comfortable when it matters.", image:images.heating, problems:["Uneven heat","Heating controls","Maintenance questions"], ...common },
  { slug:"cooling", name:"Cooling", description:"Cooling-system checks and household comfort support.", promise:"A calmer way to keep your home cool.", image:images.cooling, problems:["Poor cooling performance","Controls and airflow","Seasonal maintenance"], ...common },
  { slug:"appliance-repair", name:"Appliance repair", description:"Diagnosis and repair for common household appliances.", promise:"Give essential appliances a practical path back to working order.", image:images.applianceRepair, bookingServiceId:"appliance", problems:["Appliance not starting","Unusual noise or behaviour","Performance problems"], ...common },
  { slug:"cleaning", name:"Cleaning", description:"Reliable, detail-focused home cleaning shaped around your needs.", promise:"Come home to a space that feels cared for.", image:images.cleaning, bookingServiceId:"cleaning", problems:["Regular home cleaning","Deep-clean priorities","Move-in or move-out cleaning"], ...common },
  { slug:"locksmith", name:"Locksmith", description:"Information and help finding appropriate support for locks and access.", promise:"Clear next steps when access cannot wait.", image:images.locksmith, problems:["Lock faults","Lost-key guidance","Door security questions"], ...common },
  { slug:"painting", name:"Painting", description:"Careful preparation and painting support for everyday rooms.", promise:"A cleaner route to a fresh-looking home.", image:images.painting, problems:["Room refreshes","Preparation and patching","Trim and detail work"], ...common },
  { slug:"carpentry", name:"Carpentry", description:"Practical support for woodwork, fittings and smaller home projects.", promise:"Skilled help for the details that make a home work.", image:images.carpentry, problems:["Door and trim adjustments","Shelving and fittings","Minor wood repairs"], ...common },
  { slug:"moving-help", name:"Moving help", description:"Extra hands and practical support for moving day.", promise:"Make moving day feel more manageable.", image:images.movingHelp, problems:["Lifting and moving","Furniture setup","Move-in practical tasks"], ...common },
  { slug:"home-maintenance", name:"Home maintenance", description:"Planned help with the small jobs that keep your home in shape.", promise:"Stay ahead of the household to-do list.", image:images.homeMaintenance, problems:["Seasonal checks","Preventive maintenance","A mixed list of small jobs"], ...common },
  // International expansion directory: informational pages only until live serviceability is approved.
  { slug:"hvac", name:"HVAC", description:"Heating, ventilation and air-conditioning service options, from airflow problems to system replacement.", promise:"Understand your heating and cooling options before arranging a local inspection.", image:images.cooling, problems:["Air conditioning not cooling effectively","Heating or airflow issues","Seasonal maintenance and system upgrades"], ...common },
  { slug:"windows-doors", name:"Windows & Doors", description:"Repairs, replacements, weather sealing and installation guidance for doors and windows.", promise:"Make your home more comfortable, secure and weather-ready.", image:images.carpentry, problems:["Drafts, leaks or damaged frames","Door alignment and hardware issues","Replacement windows and doors"], ...common },
  { slug:"roofing", name:"Roofing", description:"Roof leak evaluation, roofing repairs and replacement planning.", promise:"Find the right next step for your roof.", image:images.homeMaintenance, problems:["Water stains and suspected leaks","Storm-related roof damage","Shingles, flashing and roof replacement"], ...common },
  { slug:"pest-control", name:"Pest Control & Termites", description:"Help understanding pest inspections, insect treatments and rodent prevention.", promise:"Address pest concerns with a qualified local specialist.", image:images.homeMaintenance, problems:["Termite or wood-damage concerns","Rodents, ants, cockroaches or mosquitoes","Recurring prevention and exclusion"], ...common },
  { slug:"landscaping-lawn-care", name:"Landscaping & Lawn Care", description:"Lawn maintenance, planting, garden design and regular outdoor upkeep.", promise:"Keep your outdoor spaces looking their best.", image:images.homeMaintenance, problems:["Overgrown lawns or garden beds","Seasonal planting and maintenance","Landscape redesign and lawn recovery"], ...common },
  { slug:"tree-services", name:"Tree Services", description:"Assessment of tree pruning, removal, emergency hazards and stump work.", promise:"Care for trees while protecting people and property.", image:images.homeMaintenance, problems:["Overhanging or damaged branches","Storm-damaged trees","Stump removal and tree health"], ...common },
  { slug:"pool-spa", name:"Pool & Spa Services", description:"Pool cleaning, filtration, water treatment and equipment repair coordination.", promise:"Keep your pool and spa ready for the season.", image:images.homeMaintenance, problems:["Cloudy water or chemical balance","Pump and filter malfunctions","Recurring pool maintenance"], ...common },
  { slug:"garage-door", name:"Garage Door Services", description:"Garage door opener, spring, panel and installation service information.", promise:"Restore convenient and safer garage access.", image:images.carpentry, problems:["Door will not open or close","Noisy opener or damaged tracks","Panel and door replacement"], ...common },
  { slug:"gutter-services", name:"Gutter Services", description:"Gutter clearing, guards, downspouts and drainage repair.", promise:"Help protect your home from avoidable water damage.", image:images.homeMaintenance, problems:["Blocked or overflowing gutters","Loose gutters or leaking joints","Downspout drainage problems"], ...common },
  { slug:"water-damage-restoration", name:"Water Damage Restoration", description:"Assessment, cleanup and drying support after household water incidents.", promise:"Understand urgent restoration steps and available professional help.", image:images.cleaning, problems:["Burst pipes or interior flooding","Wet flooring, ceilings and walls","Moisture drying and post-loss restoration"], ...common },
  { slug:"pressure-washing", name:"Pressure Washing", description:"Exterior pressure and soft washing for suitable surfaces.", promise:"Refresh outdoor surfaces with the right cleaning method.", image:images.cleaning, problems:["Dirty drives, walkways or patios","Exterior wall and fence buildup","Soft-wash and surface care options"], ...common },
  { slug:"junk-removal", name:"Junk Removal", description:"Hauling, bulky-item removal and property cleanout coordination.", promise:"Make space without the hauling hassle.", image:images.movingHelp, problems:["Old furniture and appliances","Garage, attic and property cleanouts","Renovation debris removal"], ...common },
  { slug:"mold-remediation", name:"Mold Inspection & Remediation", description:"Moisture investigation, mold assessment and qualified remediation options.", promise:"Address moisture concerns before they grow.", image:images.cleaning, problems:["Visible growth or musty odors","Repeated leaks and damp areas","Professional remediation planning"], ...common },
  { slug:"flooring-tile", name:"Flooring & Tile", description:"Flooring installation, tile replacement and surface repair guidance.", promise:"Plan the right floor for your home and budget.", image:images.carpentry, problems:["Cracked tile or damaged grout","New flooring installation","Uneven or worn floor surfaces"], ...common },
  { slug:"kitchen-bath-remodeling", name:"Kitchen & Bathroom Remodeling", description:"Kitchen and bathroom renovation planning, fixtures and contractor coordination.", promise:"Create a practical plan for your next renovation.", image:images.carpentry, problems:["Bathroom upgrades and shower renovations","Kitchen cabinets and countertop projects","Layout changes and fixture replacement"], ...common },
  { slug:"fence-gate", name:"Fence & Gate Services", description:"Fence construction, gate repairs and access hardware improvements.", promise:"Improve privacy, access and outdoor protection.", image:images.carpentry, problems:["Broken or leaning fences","Gate alignment and hardware","New perimeter fencing"], ...common },
  { slug:"deck-patio", name:"Deck & Patio Construction", description:"Outdoor living improvements, deck construction and patio repairs.", promise:"Make better use of your outdoor space.", image:images.carpentry, problems:["Damaged deck boards and railings","New patios and outdoor seating areas","Deck repair and refinishing"], ...common },
  { slug:"foundation-structural-repair", name:"Foundation & Structural Repair", description:"Structural assessments and repair coordination for foundations and load-bearing concerns.", promise:"Get specialist guidance for structural warning signs.", image:images.homeMaintenance, problems:["Cracks, settlement or sloping floors","Foundation moisture and movement","Engineer-led repair recommendations"], ...common },
  { slug:"insulation-weatherization", name:"Insulation & Weatherization", description:"Attic insulation, draft reduction and home-energy-efficiency improvements.", promise:"Help your home stay comfortable through the seasons.", image:images.homeMaintenance, problems:["Drafty rooms or uneven temperatures","Insulation upgrades","Air sealing and weatherproofing"], ...common },
  { slug:"generators-backup-power", name:"Generators & Backup Power", description:"Backup power planning, generator service and installation support.", promise:"Prepare for interruptions with the right power solution.", image:images.electrical, problems:["Generator maintenance and repair","Transfer-switch installation planning","Backup power sizing"], ...common },
  { slug:"irrigation-sprinklers", name:"Irrigation & Sprinkler Systems", description:"Residential irrigation installation, troubleshooting and scheduled watering.", promise:"Support healthy landscaping without unnecessary water waste.", image:images.homeMaintenance, problems:["Broken sprinklers or leaks","Uneven irrigation coverage","Controller and system upgrades"], ...common },
  { slug:"chimney-fireplace", name:"Chimney & Fireplace Services", description:"Fireplace, flue and chimney inspection, cleaning and repair.", promise:"Prepare fireplaces and chimneys for safer use.", image:images.heating, problems:["Chimney inspection and cleaning","Smoke or venting problems","Masonry and fireplace repairs"], ...common },
  { slug:"home-security-smart-home", name:"Home Security & Smart Homes", description:"Security cameras, smart locks and connected-home installation information.", promise:"Make your home more convenient and secure.", image:images.electrical, problems:["Camera and alarm installation","Smart locks and connected access","Home automation setup"], ...common },
];

export const marketingServiceBySlug = (slug: string) => marketingServices.find((service) => service.slug === slug);

// Intake choices are independent from publication of dedicated marketing pages.
// Every entry is also seeded by the API.
export const intakeServices = [
  { slug: "plumbing", name: "Plumbing" },
  { slug: "electrical", name: "Electrical" },
  { slug: "heating", name: "Heating" },
  { slug: "cooling", name: "Cooling & air conditioning" },
  { slug: "appliance-repair", name: "Appliance repair" },
  { slug: "handyman", name: "Handyman & small repairs" },
  { slug: "home-maintenance", name: "Home maintenance" },
  { slug: "cleaning", name: "Home cleaning" },
  { slug: "locksmith", name: "Locksmith" },
  { slug: "painting", name: "Painting" },
  { slug: "carpentry", name: "Carpentry" },
  { slug: "flooring", name: "Flooring" },
  { slug: "roofing", name: "Roofing" },
  { slug: "gutters", name: "Gutter cleaning & repair" },
  { slug: "windows-doors", name: "Windows & doors" },
  { slug: "garage-door", name: "Garage door service" },
  { slug: "pest-control", name: "Pest control" },
  { slug: "lawn-landscaping", name: "Lawn & landscaping" },
  { slug: "pressure-washing", name: "Pressure washing" },
  { slug: "moving-help", name: "Moving help" },
] as const;
