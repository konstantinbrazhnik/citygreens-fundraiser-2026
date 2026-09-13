/**
 * Everything the app says about the fundraiser, in one place. Facts here are
 * taken from stlcitygreens.org, the Givebutter event page and City Greens'
 * LinkedIn announcement. Change them here, not in components.
 */
export const ORG = {
  name: 'City Greens Market',
  tagline: 'A Community that Serves',
  website: 'https://www.stlcitygreens.org',
  membershipUrl: 'https://www.stlcitygreens.org/become-a-member',
  donatePageUrl: 'https://www.stlcitygreens.org/donate',
  newsletterUrl: 'https://www.stlcitygreens.org/newsletter-sign-up',
  instagram: 'https://www.instagram.com/stlcitygreens/',
  facebook: 'https://www.facebook.com/stlcitygreens/',
  address: '4260 Manchester Ave, St. Louis, MO 63110',
  neighborhood: 'The Grove',
  founded: 2008,
} as const;

export const EVENT = {
  name: "Growing City Greens '26",
  shortName: 'Growing City Greens',
  dateLabel: 'Tuesday, September 22, 2026',
  timeLabel: '6:30 PM',
  /** ISO, America/Chicago (CDT, UTC-5) */
  startsAt: '2026-09-22T18:30:00-05:00',
  venue: 'Contemporary Art Museum St. Louis',
  venueShort: 'The CAM',
  venueAddress: '3750 Washington Ave, St. Louis, MO 63108',
  ticketsUrl: 'https://givebutter.com/growing-city-greens-26-3gfmqc',
  hashtag: '#GrowingCityGreens',
} as const;

/** The capital campaign this year: a second store. */
export const CAMPAIGN = {
  headline: 'Help us continue to grow a community-powered food system in St. Louis.',
  neighborhood: 'Dutchtown',
  /**
   * Short, true, and said the same way everywhere. Numbers come from the
   * 2025 annual report and the website's impact section.
   */
  story: [
    'For the past 18 years, City Greens Market has made fresh, local food more accessible and affordable for families while supporting the farmers who grow it. We buy from local farmers at a fair price, sell food to our members at cost, and use a sliding membership scale so everyone can afford to buy groceries.',
    'City Greens is working to bring fresh, affordable food to more St. Louis neighborhoods through online ordering and grocery delivery, while laying the groundwork for our expansion into Dutchtown.',
    'Your support makes this possible.',
  ],
  proof: [
    { stat: '500+', label: 'households shop City Greens every week' },
    { stat: '100', label: 'local farmers get a fair price' },
    { stat: '~0%', label: 'food waste, vs. 30% at a typical grocer' },
    { stat: '50%', label: 'off fresh produce bought with SNAP' },
  ],
} as const;
