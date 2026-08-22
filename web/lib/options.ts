/**
 * Picklists for the enrollment forms.
 *
 * These deliberately mirror `mobile_flutter/lib/features/onboarding/
 * profile_options.dart` value-for-value. A lead is meant to convert into a
 * real UserProfile later by copying columns across, so if the website offers
 * "Commerce and Business" while the app stores "Commerce & Business", every
 * converted account lands with a value the app's own dropdowns can't render.
 * Keep the two files in sync; when one changes, change both.
 */

export const GENDERS = ["Male", "Female", "Other"] as const;

export const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Others",
] as const;

/** Merged with the degree-stage picklist (was a separate "Degree" field on
 * the aspirant form) so "what stage are you at" is answered in one field. */
export const QUALIFICATIONS = [
  "Higher Secondary (12th)",
  "UG",
  "PG",
  "MD/MS",
  "DNB",
  "Diploma",
  "Doctorate",
  "DM/MCh",
  "Others",
] as const;

/** All 28 states + 8 union territories, alphabetical (with "Other" kept last
 * as the natural fall-through). "Other" reveals a free-text field on both
 * forms rather than losing the answer for anyone outside this list. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Other",
] as const;

/** Every state/UT's own districts, keyed by the exact string used in
 * `INDIAN_STATES` — the city dropdown filters against this instead of one
 * flat nationwide list, so picking "Kerala" doesn't leave "Mumbai" sitting
 * in the city options. "Other" is appended at render time (not stored here)
 * so a state genuinely missing a district still isn't a dead end — see
 * CollegeSearch's own "not in the list is still accepted" precedent. State
 * boundaries/district counts shift occasionally (a few states have split
 * districts further since); this list is current as of when it was
 * written, not pinned to any single official source — the "Other"
 * fallback exists precisely so a stale entry never blocks someone. */
export const STATE_DISTRICTS: Record<string, readonly string[]> = {
  "Andaman and Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
  "Andhra Pradesh": [
    "Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya", "Bapatla",
    "Chittoor", "East Godavari", "Eluru", "Guntur", "Kakinada", "Konaseema",
    "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu", "Parvathipuram Manyam",
    "Prakasam", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam",
    "Vizianagaram", "West Godavari", "YSR Kadapa", "Nellore",
  ],
  "Arunachal Pradesh": [
    "Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
    "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding",
    "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai",
    "Pakke-Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap",
    "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang",
  ],
  Assam: [
    "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo",
    "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao",
    "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup",
    "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar",
    "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar",
    "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri",
    "West Karbi Anglong",
  ],
  Bihar: [
    "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur",
    "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj",
    "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj",
    "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur",
    "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa",
    "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan",
    "Supaul", "Vaishali", "West Champaran",
  ],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: [
    "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur",
    "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband",
    "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham",
    "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba",
    "Koriya", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur",
    "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh",
    "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma",
    "Surajpur", "Surguja",
  ],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
  Delhi: [
    "Central Delhi", "East Delhi", "New Delhi", "North Delhi",
    "North East Delhi", "North West Delhi", "Shahdara", "South Delhi",
    "South East Delhi", "South West Delhi", "West Delhi",
  ],
  Goa: ["North Goa", "South Goa"],
  Gujarat: [
    "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch",
    "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dang",
    "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar",
    "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi",
    "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot",
    "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad",
  ],
  Haryana: [
    "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad",
    "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal",
    "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat",
    "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar",
  ],
  "Himachal Pradesh": [
    "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu",
    "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una",
  ],
  "Jammu and Kashmir": [
    "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal",
    "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch",
    "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian",
    "Srinagar", "Udhampur",
  ],
  Jharkhand: [
    "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum",
    "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara",
    "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu",
    "Ramgarh", "Ranchi", "Sahebganj", "Seraikela Kharsawan", "Simdega",
    "West Singhbhum",
  ],
  Karnataka: [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
    "Bidar", "Chamarajanagar", "Chikballapur", "Chikkamagaluru",
    "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag",
    "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru",
    "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir",
  ],
  Kerala: [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam",
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad",
  ],
  Ladakh: ["Kargil", "Leh"],
  Lakshadweep: ["Lakshadweep"],
  "Madhya Pradesh": [
    "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat",
    "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur",
    "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna",
    "Gwalior", "Harda", "Hoshangabad (Narmadapuram)", "Indore", "Jabalpur",
    "Jhabua", "Katni", "Khandwa", "Khargone", "Maihar", "Mandla",
    "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Niwari", "Pandhurna",
    "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna",
    "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri",
    "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha",
  ],
  Maharashtra: [
    "Ahmednagar", "Akola", "Amravati", "Chhatrapati Sambhajinagar", "Beed",
    "Bhandara", "Buldhana", "Chandrapur", "Dharashiv", "Dhule",
    "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur",
    "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded",
    "Nandurbar", "Nashik", "Palghar", "Parbhani", "Pune", "Raigad",
    "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane",
    "Wardha", "Washim", "Yavatmal",
  ],
  Manipur: [
    "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West",
    "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl",
    "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul",
  ],
  Meghalaya: [
    "East Garo Hills", "East Jaintia Hills", "East Khasi Hills",
    "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi",
    "South Garo Hills", "South West Garo Hills", "South West Khasi Hills",
    "West Garo Hills", "West Jaintia Hills", "West Khasi Hills",
  ],
  Mizoram: [
    "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai",
    "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip",
  ],
  Nagaland: [
    "Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng",
    "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Shamator",
    "Tseminyu", "Tuensang", "Wokha", "Zunheboto",
  ],
  Odisha: [
    "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh",
    "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam",
    "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal",
    "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri",
    "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada",
    "Sambalpur", "Subarnapur", "Sundargarh",
  ],
  Puducherry: ["Karaikal", "Mahe", "Puducherry", "Yanam"],
  Punjab: [
    "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
    "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
    "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Muktsar",
    "Pathankot", "Patiala", "Rupnagar", "SAS Nagar (Mohali)",
    "Shaheed Bhagat Singh Nagar", "Sangrur", "Tarn Taran",
  ],
  Rajasthan: [
    "Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur",
    "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa",
    "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore",
    "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur",
    "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar",
    "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur",
  ],
  Sikkim: ["East Sikkim", "North Sikkim", "Pakyong", "Soreng", "South Sikkim", "West Sikkim"],
  "Tamil Nadu": [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
    "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
    "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
    "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
    "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
    "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
    "Vellore", "Viluppuram", "Virudhunagar",
  ],
  Telangana: [
    "Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad",
    "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal",
    "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad",
    "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak",
    "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda",
    "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla",
    "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad",
    "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri",
  ],
  Tripura: [
    "Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala",
    "South Tripura", "Unakoti", "West Tripura",
  ],
  "Uttar Pradesh": [
    "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya",
    "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur",
    "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor",
    "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah",
    "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar",
    "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur",
    "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj",
    "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi",
    "Lakhimpur Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj",
    "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur",
    "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj",
    "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
    "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur",
    "Sonbhadra", "Sultanpur", "Unnao", "Varanasi",
  ],
  Uttarakhand: [
    "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar",
    "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag",
    "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi",
  ],
  "West Bengal": [
    "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
    "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram",
    "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia",
    "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur",
    "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas",
    "Uttar Dinajpur",
  ],
};

/** Time-of-day slots — shared shape for both the aspirant's "when do you
 * want to talk" preference and the mentor's "when am I generally free"
 * availability, so the two sides of a booking speak the same vocabulary.
 * Deliberately time-of-day, not day-of-week — a weekday/weekend picker just
 * has everyone pick weekend, which tells the matching logic nothing. */
export const TIME_SLOTS = [
  "Morning (6 AM - 12 PM)",
  "Afternoon (12 PM - 4 PM)",
  "Evening (4 PM - 8 PM)",
  "Night (8 PM - 11 PM)",
] as const;

export const MENTORSHIP_TIMINGS = TIME_SLOTS;

/** Mentor's "days you're generally free". */
export const AVAILABILITY_WINDOWS = TIME_SLOTS;

/** UserProfile.stream — a mentor's field of study, or an aspirant's field of
 * interest. Uniscope covers every academic field, not just medical. */
export const STREAMS = [
  "Medical",
  "Dental",
  "Engineering",
  "Arts & Humanities",
  "Commerce & Business",
  "Law",
  "Design",
  "Others",
] as const;

export const DEGREES = ["UG", "PG", "MD/MS", "DNB", "Diploma", "Doctorate", "DM/MCh", "Others"] as const;

/** UserProfile.specialization picklist — shown for Medical-stream mentors on
 * any degree except UG (which has no specialization yet). */
export const MEDICAL_SPECIALIZATIONS = [
  "General Medicine",
  "Anaesthesiology",
  "General Surgery",
  "Orthopaedics",
  "Paediatrics",
  "Obstetrics and Gynaecology",
  "Cardiology",
  "Radio Diagnosis",
  "Critical Care Medicine",
  "Ophthalmology",
  "Emergency Medicine",
  "Neurology",
  "Urology",
  "Medical Gastroenterology",
  "Nephrology",
  "Medical Oncology",
  "Respiratory Medicine",
  "Pathology",
  "Surgical Oncology",
  "Radiation Oncology",
  "Otorhinolaryngology (ENT)",
  "Family Medicine",
  "Neuro Surgery",
  "Surgical Gastroenterology",
  "Cardio Vascular & Thoracic Surgery (Direct 6 Years Course)",
  "Neuro Surgery (Direct 6 Years Course)",
  "Reproductive Medicine",
  "Minimal Access Surgery",
  "Arthroplasty",
  "Dermatology, Venereology and Leprosy",
  "Psychiatry",
  "Cardiac Anaesthesia",
  "Spine Surgery",
  "Interventional Cardiology",
  "Clinical Haematology",
  "Endocrinology",
  "Microbiology",
  "Nuclear Medicine",
  "Vascular Surgery",
  "Neonatology",
  "Paediatric Cardiology",
  "Interventional Radiology",
  "Plastic & Reconstructive Surgery",
  "Head & Neck Oncology",
  "Paediatric Hemato-Oncology",
  "Clinical Immunology and Rheumatology",
  "Onco-Anaesthesia",
  "Paediatric Critical Care",
  "Gynaecological Oncology",
  "Biochemistry",
  "Immunohematology and Blood Transfusion",
  "Maternal & Foetal Medicine",
  "Plastic & Reconstructive Surgery (Direct 6 Years Course)",
  "Cardio Vascular & Thoracic Surgery",
  "Neuro Anaesthesia",
  "Cardiac Electrophysiology",
  "Paediatric Surgery (Direct 6 Years Course)",
  "Transplant Anaesthesia",
  "Palliative Medicine",
  "Vitreo Retinal Surgery",
  "Community Medicine",
  "Neurovascular Intervention",
  "Paediatric Anaesthesia",
  "Hand & Micro Surgery",
  "Paediatric Gastroenterology",
  "Pain Medicine",
  "Renal Transplant",
  "Thoracic Surgery",
  "Trauma & Acute Care Surgery",
  "Hospital Administration",
  "Paediatric Nephrology",
  "Paediatric Neurology",
  "Physiology",
  "Sports Medicine",
  "Anatomy",
  "Infectious Diseases",
  "Minimally Invasive Gynaecologic Surgery",
  "Pharmacology",
  "Colorectal Surgery",
  "Forensic Medicine",
  "Minimal Access Urology",
  "Paediatric Surgery",
  "Paediatric Urology",
  "Trauma Anaesthesia & Critical Care",
  "Addiction Psychiatry",
  "Liver Transplantation",
  "Physical Medicine and Rehabilitation",
  "Stroke Medicine",
  "Bariatric Surgery",
  "Breast Imaging",
  "Fetal Radiology",
  "Geriatric Medicine",
  "Medical Genetics",
  "Musculoskeletal Radiology (MSK Radiology)",
  "Paediatric Endocrinology",
  "Child and Adolescent Psychiatry",
  "Paediatric Emergency Medicine",
  "Paediatric Orthopaedics",
] as const;

export const CURRENT_STATUSES = ["Currently Studying", "Graduated"] as const;

/** Some medical/dental degrees run 6 years, so this goes to 6th rather than
 * capping at "5th Year+" the way a typical 4-year UG picklist would. "Intern"
 * covers the compulsory rotatory internship year that follows final-year
 * MBBS/BDS before graduation — not a numbered academic year, but still part
 * of "Currently Studying". */
export const YEARS_OF_STUDY = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
  "Intern",
] as const;

/** Past `count` years including the current one, newest first — used for the
 * mentor form's graduation-year picker instead of free-text entry. Computed
 * at render time so it never needs a yearly update. */
export function recentYears(count = 10): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => current - i);
}

/** Matches the backend's DocumentType enum (`CreateMentorLeadDto.documentType`)
 * — only the display labels below are free to change, the `value`s must stay
 * in sync with the Prisma enum. Labels were genericized (was "NMC
 * registration", medical-only) since mentors now come from every stream. */
export const DOCUMENT_TYPES = [
  { value: "STUDENT_ID", label: "College / Student ID card" },
  { value: "STUDENT_PORTAL_SCREENSHOT", label: "Admission order" },
  { value: "DEGREE_CERTIFICATE", label: "Degree certificate" },
  { value: "NMC_REGISTRATION", label: "Registration certificate" },
] as const;
