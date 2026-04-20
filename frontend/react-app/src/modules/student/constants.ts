import { Citation, StudentMessage } from './types';

export const PUBLIC_PREVIEW_COURSE = {
  code: 'DEMO101',
  name: 'EduSmart Demo Course',
};

export const NO_COURSE_LABEL = 'General Chat (No course context)';

export const DEFAULT_CHAT_TITLE = 'Chat name';

export const DEMO_AUTH_TOKEN = ((import.meta.env.VITE_DEMO_AUTH_TOKEN as string) || '').trim();

export const DEMO_REFERENCE_CITATIONS: Citation[] = [
  {
    id: 'demo-1',
    title: 'Lecturer Strategy Deck',
    snippet: 'Slides outlining Bloom ladders plus coaching prompts for cell division labs.',
    source: 'StrategyDeck_CellDivision.pdf',
    role: 'lecturer',
  },
  {
    id: 'demo-2',
    title: 'Formative Check Bank',
    snippet: 'Quick checks mapped to competency levels 1–3 for mitosis vs meiosis.',
    source: 'FormativeBank_Mitosis.docx',
    role: 'lecturer',
  },
];

export const buildLocalDemoAssistantReply = (prompt: string): StudentMessage => {
  const sanitizedPrompt = prompt.replace(/\s+/g, ' ').trim();
  const content = `Here is how I'd coach “${sanitizedPrompt}” inside ${PUBLIC_PREVIEW_COURSE.name}:

1. **Bloom focus** — start with a recall nudge (“Summarize ${sanitizedPrompt} in one sentence”), then climb to application (“Give the lab scenario where this breaks”).
2. **Reference packs** — I’ll cite the lecturer decks above so students see the provenance.
3. **Actionable follow-up** — close with a formative check or mini-brief so it lands in your LMS.`;

  return {
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
    citations: DEMO_REFERENCE_CITATIONS,
    hiddenCitationCount: 2,
  };
};
