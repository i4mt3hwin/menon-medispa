/**
 * chat-tree.ts — decision-tree content for the built-in ChatAssistant.
 * Replaces Wix Chat (platform-bound). NO AI, NO free-text, NO PHI egress.
 * Answers are drawn ONLY from the site's own captured content + SITE/NAV
 * (Path-2: nothing invented). Auto-drafted by 03-build-replicate; operator
 * may review/tweak. Validated by scripts/validate-chat-tree.mjs.
 */
import site, { NAV } from './site';

export type ChatOption = {
  label: string;
  to?: string;
  action?: 'book' | 'call' | 'maps' | 'lead' | 'link';
  href?: string;
};
export type ChatNode = { message: string; options: ChatOption[] };
export type ChatTree = {
  greeting: string;
  title: string;
  root: string;
  nodes: Record<string, ChatNode>;
};

// Deterministic hours line from SITE.hours (verbatim from the original schema).
const dayMap: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};
const fmt = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
};
const hoursLine = site.hours
  .map((h) => `${dayMap[h.days[0]]}${h.days.length > 1 ? '–' + dayMap[h.days[h.days.length - 1]] : ''} ${fmt(h.opens)}–${fmt(h.closes)}`)
  .join(' · ');

export const CHAT_TREE: ChatTree = {
  greeting: 'Need help?',
  title: `${site.displayName} Assistant`,
  root: 'main',
  nodes: {
    main: {
      message: 'Hi! 👋 How can we help you today?',
      options: [
        { label: 'Hours & location', to: 'hours' },
        { label: 'Our services', to: 'services' },
        { label: 'Common questions', to: 'faq' },
        { label: 'Book an appointment', action: 'book' },
        { label: 'Call us', action: 'call' },
        { label: 'Leave a message', action: 'lead' },
      ],
    },
    hours: {
      message: `We're open: ${hoursLine}. (Sunday closed.)\nWe're at ${site.address.formatted}.`,
      options: [
        { label: 'Get directions', action: 'maps' },
        { label: 'Book an appointment', action: 'book' },
        { label: '← Back', to: 'main' },
      ],
    },
    services: {
      message: 'What are you interested in?',
      options: [
        ...NAV.services.map((c) => ({ label: c.label, action: 'link' as const, href: c.href })),
        { label: '← Back', to: 'main' },
      ],
    },
    faq: {
      message: 'Tap a question:',
      options: [
        { label: 'What services do you offer?', to: 'faq_services' },
        { label: 'How do I schedule an appointment?', to: 'faq_schedule' },
        { label: 'Call us', action: 'call' },
        { label: '← Back', to: 'main' },
      ],
    },
    faq_services: {
      // Verbatim from the home page FAQ (home builder.json section 12).
      message:
        'Menon Medispa offers a comprehensive range of medical spa treatments including advanced facial treatments, chemical peels, dermal fillers, skin rejuvenation procedures, microneedling, and various platelet-rich plasma therapies. Each treatment is personalized to address your specific skin concerns and goals, delivered by our expert team of licensed professionals in a relaxing, clinical environment.',
      options: [
        { label: 'See our service list', action: 'link', href: '/face' },
        { label: '← Back', to: 'faq' },
      ],
    },
    faq_schedule: {
      message:
        'You can request an appointment online or call us — we’ll confirm your time. Tap below to book or call.',
      options: [
        { label: 'Book an appointment', action: 'book' },
        { label: 'Call us', action: 'call' },
        { label: '← Back', to: 'faq' },
      ],
    },
  },
};

export default CHAT_TREE;
