import { registerAs } from '@nestjs/config';

export interface AlexaConfig {
  /**
   * Skill ID autorizado. `null` = no se valida (desarrollo: variable vacía o
   * con el valor de ejemplo).
   */
  skillId: string | null;
}

const SKILL_ID_PREFIX = 'amzn1.ask.skill.';
/** Marca del valor de ejemplo de .env.example (amzn1.ask.skill.XXXXXXXX-…). */
const PLACEHOLDER_MARK = 'XXXX';
const SKILL_ID_PATTERN = /^amzn1\.ask\.skill\.[a-z0-9-]{7,}$/i;

export function loadAlexaConfig(
  env: Record<string, string | undefined> = process.env,
): AlexaConfig {
  const skillId = env.ALEXA_SKILL_ID?.trim() ?? '';
  const isRealSkillId =
    SKILL_ID_PATTERN.test(skillId) &&
    skillId.startsWith(SKILL_ID_PREFIX) &&
    !skillId.includes(PLACEHOLDER_MARK);
  if (env.NODE_ENV === 'production' && !isRealSkillId) {
    throw new Error(
      'ALEXA_SKILL_ID debe contener el Application ID real de Alexa en producción',
    );
  }
  return { skillId: isRealSkillId ? skillId : null };
}

/** Inyectar con `@Inject(alexaConfig.KEY) config: AlexaConfig`. */
export const alexaConfig = registerAs('alexa', () => loadAlexaConfig());
