/**
 * Privacy policy configuration.
 *
 * Bump POLICY_VERSION whenever the policy text changes. The version an
 * applicant agreed to is stored with their application, so a version bump
 * means new applicants agree to the new text — past records keep the old
 * version they actually accepted.
 *
 * NOTE: This text is a plain-language starting point tailored to a small
 * hiring workflow in Rwanda. It is not legal advice. Have it reviewed by a
 * qualified local lawyer before you rely on it.
 */
export const POLICY_VERSION = 'v1.0'
export const POLICY_EFFECTIVE_DATE = '23 October 2026'

export const COMPANY = {
  name: 'Careers Connect',
  contactEmail: 'privacy@example.com',
  country: 'Rwanda',
}

export const PRIVACY_POLICY = {
  version: POLICY_VERSION,
  effectiveDate: POLICY_EFFECTIVE_DATE,
  title: 'Privacy Policy & Applicant Consent',
  intro:
    `This notice explains what personal information ${COMPANY.name} collects when you apply for a job with us, why we collect it, who can see it, and the choices you have. By submitting an application you confirm that you have read and agree to this notice.`,

  sections: [
    {
      heading: '1. Who we are',
      paragraphs: [
        `${COMPANY.name} is the organisation responsible for the personal information described in this notice. We are based in ${COMPANY.country}.`,
        `For any question about this notice or your information, contact us at ${COMPANY.contactEmail}.`,
      ],
    },
    {
      heading: '2. What information we collect',
      list: [
        'Your name, email address, phone number, address, and date of birth.',
        'Two video recordings that you make through this website: one in English and one in French.',
        'Your typed name, given as your electronic signature, together with the date and time you agreed to this notice.',
        'Technical information recorded automatically when you submit: your IP address and your browser/device type. We record these as evidence that consent was given.',
      ],
    },
    {
      heading: '3. Why we collect it',
      paragraphs: [
        'We use your information for one purpose only: to assess your application for the position you applied for, and to communicate with you about it.',
      ],
      list: [
        'To review your qualifications and your video introduction.',
        'To compare your application with other applicants for this role.',
        'To contact you about interviews or next steps.',
      ],
    },
    {
      heading: '4. Who can see your information',
      paragraphs: [
        'Only the internal hiring team for this position can view your application. This includes our staff and any recruiter directly involved in selecting a candidate for this role.',
        'We do not sell your information. We do not share it with advertisers. We do not use your video or personal information for any purpose other than hiring for this position.',
        'Some of our technology providers process the data on our behalf, strictly so the website can operate — for example, our database and hosting providers. They act on our instructions only.',
      ],
    },
    {
      heading: '5. How long we keep it',
      paragraphs: [
        'We keep your application, including your videos and your consent record, for as long as needed to complete the hiring process, and afterwards for a limited period in case of any legal question about the process.',
        'After that, we delete your information. If you ask us to delete it sooner, we will.',
      ],
    },
    {
      heading: '6. Your rights',
      paragraphs: [
        'You have the right to:',
      ],
      list: [
        'Ask us what information we hold about you.',
        'Ask us to correct information that is wrong.',
        'Ask us to delete your application and videos.',
        'Withdraw your consent at any time.',
      ],
      footnotes: [
        `To use any of these rights, contact us at ${COMPANY.contactEmail}. We will respond within a reasonable time.`,
      ],
    },
    {
      heading: '7. Your consent',
      paragraphs: [
        'By ticking the consent box and typing your name as your signature, you confirm that:',
      ],
      list: [
        'You have read and understood this notice.',
        'You agree that your personal information and video recordings may be used by our hiring team for the purpose of this application.',
        'You understand that your typed name, the date and time, your IP address, and your browser type are recorded as evidence of this consent.',
      ],
      footnotes: [
        `The version of this notice you agreed to is stored with your application. Current version: ${POLICY_VERSION}, effective ${POLICY_EFFECTIVE_DATE}.`,
      ],
    },
  ],
}
