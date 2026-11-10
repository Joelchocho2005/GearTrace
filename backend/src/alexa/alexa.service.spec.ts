import { BadRequestException } from '@nestjs/common';
import { tell } from './alexa-response';
import { plain } from './alexa-speech';
import { INTENTS } from './alexa.constants';
import { FOLLOW_UP } from './alexa.messages';
import { AlexaService } from './alexa.service';
import { AlexaRequestEnvelope } from './alexa.types';
import { AlexaIntentHandler } from './intents/alexa-intent-handler';

const SKILL_ID = 'amzn1.ask.skill.real-id';

function envelope(request: object, applicationId = SKILL_ID): AlexaRequestEnvelope {
  return {
    version: '1.0',
    session: { new: false, sessionId: 's', application: { applicationId }, user: { userId: 'u' } },
    context: { System: { application: { applicationId }, user: { userId: 'u' }, device: { deviceId: 'd' } } },
    request,
  } as AlexaRequestEnvelope;
}

const intentRequest = (name: string) => ({
  type: 'IntentRequest',
  requestId: 'r',
  timestamp: '',
  locale: 'es-MX',
  intent: { name, confirmationStatus: 'NONE' },
});

describe('AlexaService', () => {
  const handled = tell(plain('ok'));
  const handler: AlexaIntentHandler = { intents: [INTENTS.LISTAR_CAJAS], handle: jest.fn(() => handled) };
  const service = new AlexaService({ skillId: SKILL_ID }, [handler]);

  it('enruta un intent a su handler registrado', async () => {
    await expect(service.handleRequest(envelope(intentRequest(INTENTS.LISTAR_CAJAS)))).resolves.toBe(handled);
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('responde el mensaje de no entendido para un intent sin handler y sigue escuchando', async () => {
    const { response } = await service.handleRequest(envelope(intentRequest('IntentDesconocido')));

    expect(response.shouldEndSession).toBe(false);
    expect(response.reprompt?.outputSpeech.text).toBe(FOLLOW_UP);
  });

  it('da la bienvenida y deja la sesión abierta en LaunchRequest', async () => {
    const { response } = await service.handleRequest(envelope({ type: 'LaunchRequest' }));

    expect(response.outputSpeech.ssml).toContain('GearTrace');
    expect(response.shouldEndSession).toBe(false);
  });

  it('rechaza requests de otra skill cuando hay un Skill ID configurado', async () => {
    await expect(
      service.handleRequest(envelope(intentRequest(INTENTS.LISTAR_CAJAS), 'amzn1.ask.skill.otra')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no valida la skill cuando no hay Skill ID configurado', async () => {
    const open = new AlexaService({ skillId: null }, [handler]);
    await expect(
      open.handleRequest(envelope(intentRequest(INTENTS.LISTAR_CAJAS), 'cualquiera')),
    ).resolves.toBe(handled);
  });

  it('rechaza un cuerpo sin request', async () => {
    await expect(service.handleRequest({} as AlexaRequestEnvelope)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falla al arrancar si dos handlers reclaman el mismo intent', () => {
    expect(() => new AlexaService({ skillId: null }, [handler, { ...handler }])).toThrow(/más de un handler/);
  });
});
