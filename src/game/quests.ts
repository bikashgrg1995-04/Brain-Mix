import { parseQuestFile, type QuestFile } from '../../shared/quests';
import raw from '../content/quests.json';

/**
 * Admin (admin.html) le set gareko quest haru. File: src/content/quests.json.
 * Galat entry game rokdaina: tyo level ma auto shabda aaucha, ra console ma warning dekhincha.
 */
const parsed = parseQuestFile(JSON.stringify(raw));
if (parsed.errors.length > 0) console.warn('quests.json: ' + parsed.errors.join(' | '));

export const QUESTS: QuestFile = parsed.file;
