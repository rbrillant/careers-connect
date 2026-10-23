/**
 * Job positions and site copy.
 *
 * To open or close a role, add or remove an entry in POSITIONS. The home page,
 * the application form and the admin dashboard all read from this list, so the
 * only thing that also needs updating is POSITION_IDS in server/index.js —
 * the API rejects position values it does not recognise.
 */
export const POSITIONS = [
  {
    id: 'front-desk',
    title: 'Front Desk Officer',
    tagline: 'Now Recruiting',
    summary: 'The first face and voice of our team — in English and French.',
    description:
      'We are looking for a warm, organised Front Desk Officer to welcome visitors, answer calls and handle enquiries confidently in both English and French.',
    responsibilities: [
      'Welcome visitors and manage the front desk',
      'Answer phone calls and respond to enquiries in English and French',
      'Provide excellent customer care to every visitor and caller',
      'Support scheduling, records and day-to-day administration',
      'Direct messages and requests to the right team members',
    ],
    requirements: [
      'Fluent in both English and French (spoken and written)',
      'Proven customer care, reception or front-office experience',
      'Professional, friendly and calm under pressure',
      'Strong organisation and attention to detail',
    ],
  },
  {
    id: 'content-manager',
    title: 'Content Manager',
    tagline: 'Now Recruiting',
    summary: 'Film it, edit it, publish it — and grow our audience.',
    description:
      'We are looking for a hands-on Content Manager to film, edit and publish content across our channels, and to manage our social media presence from idea to upload.',
    responsibilities: [
      'Plan, film and produce content for our social media channels',
      'Edit video and photo content to a high standard',
      'Manage our social media accounts and publishing schedule',
      'Operate cameras, lighting and basic audio equipment',
      'Keep every piece of content consistent with our brand and tone',
    ],
    requirements: [
      'Strong editing skills in Premiere Pro, CapCut, DaVinci Resolve and Photoshop',
      'Confident operating cameras',
      'Experience running social media accounts',
      'A portfolio of previous content or editing work',
      'Able to meet deadlines and take creative feedback',
    ],
  },
]

/** Look up a position by id. Returns undefined when the id is unknown. */
export function getPosition(id) {
  return POSITIONS.find((position) => position.id === id)
}

export const SITE = {
  // Application process steps shown on the home page
  processSteps: [
    {
      number: 1,
      title: 'Personal Information',
      description: 'Fill in your details and choose the position you are applying for.',
    },
    {
      number: 2,
      title: 'English Video',
      description: 'Record a short video in English introducing yourself and why you want the role.',
    },
    {
      number: 3,
      title: 'French Video',
      description: 'Record a second video in French covering the same content.',
    },
  ],
  // Video guidelines shown on the home page
  videoGuidelines: [
    {
      strong: 'Introduce yourself',
      text: 'Tell us your name, background, and what makes you a strong candidate.',
    },
    {
      strong: 'Why this position?',
      text: 'Explain why you want the role and what you would bring to it.',
    },
    {
      strong: 'Why us?',
      text: 'Share why you want to work with us and how you will stand out.',
    },
    {
      strong: 'Keep it under 3 minutes',
      text: 'per video.',
    },
    {
      strong: 'File size limit:',
      text: '25MB per video (MP4, MOV, or WebM format).',
    },
  ],
  ctaHeading: 'Ready to Apply?',
  ctaDescription: 'Choose the position that fits you and send us your application.',
  ctaButtonLabel: 'Start Your Application',
  footerNote: 'An equal opportunity employer.',
}
