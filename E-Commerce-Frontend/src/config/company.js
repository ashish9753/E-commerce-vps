// Central place for company contact info — update here once and every screen
// (footer, support page, invoice PDF, etc.) picks it up. Keep keys stable;
// the rest of the codebase imports from here.

export const COMPANY = {
  name:    'TradeEngine',
  // Registered legal entity name + company registration number — shown on the
  // invoice header. Update these to match your official registration.
  legalName: 'Trade Engine Pvt. Ltd.',
  regNo:     '609749436',
  tagline: 'Your one-stop online store',

  office:  'Dhalko, Kathmandu',

  // Phone numbers — split by purpose so different screens can show the right one.
  salesPhone:   '9801904704',
  supportPhone: '9801904706',

  email:   'Info.tradengine@gmail.com',

  // Business hours — keep human-readable; consumed as-is for display.
  hours:   'Sun – Fri · 10am – 6pm',
  hoursShort: 'Sun – Fri 10–6',

  website: 'tradengine.com',
};

// Pre-built tel: / mailto: hrefs so JSX stays clean.
export const COMPANY_LINKS = {
  salesTel:    `tel:${COMPANY.salesPhone}`,
  supportTel:  `tel:${COMPANY.supportPhone}`,
  emailLink:   `mailto:${COMPANY.email}`,
};
