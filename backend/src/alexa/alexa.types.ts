// ══════════════════════════════════════════════════════════════════════════
// Tipos TypeScript que mapean el JSON real que Amazon envía al webhook.
// Basado en la especificación oficial del Alexa Skills Kit (ASK).
// Referencia: https://developer.amazon.com/docs/custom-skills/request-and-response-json-reference.html
// ══════════════════════════════════════════════════════════════════════════

/** Estructura raíz de cualquier request que llega desde Alexa */
export interface AlexaRequestEnvelope {
  version: string;
  session?: AlexaSession;
  context: AlexaContext;
  request: AlexaRequest;
}

export interface AlexaSession {
  new: boolean;
  sessionId: string;
  application: { applicationId: string };
  user: { userId: string };
}

export interface AlexaContext {
  System: {
    application: { applicationId: string };
    user: { userId: string };
    device: { deviceId: string };
  };
}

/** Un request puede ser de tipo LaunchRequest, IntentRequest o SessionEndedRequest */
export type AlexaRequest =
  | AlexaLaunchRequest
  | AlexaIntentRequest
  | AlexaSessionEndedRequest;

export interface AlexaLaunchRequest {
  type: 'LaunchRequest';
  requestId: string;
  timestamp: string;
  locale: string;
}

export interface AlexaIntentRequest {
  type: 'IntentRequest';
  requestId: string;
  timestamp: string;
  locale: string;
  intent: AlexaIntent;
}

export interface AlexaSessionEndedRequest {
  type: 'SessionEndedRequest';
  requestId: string;
  timestamp: string;
  reason: 'USER_INITIATED' | 'ERROR' | 'EXCEEDED_MAX_REPROMPTS';
}

export interface AlexaIntent {
  name: string;
  confirmationStatus: 'NONE' | 'CONFIRMED' | 'DENIED';
  slots?: Record<string, AlexaSlot>;
}

export interface AlexaSlot {
  name: string;
  value?: string;        // El valor que el usuario pronunció
  confirmationStatus: 'NONE' | 'CONFIRMED' | 'DENIED';
  resolutions?: {
    resolutionsPerAuthority: Array<{
      authority: string;
      status: { code: 'ER_SUCCESS_MATCH' | 'ER_SUCCESS_NO_MATCH' | string };
      values?: Array<{ value: { name: string; id: string } }>;
    }>;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos de RESPUESTA que GearTrace devuelve a Alexa
// ──────────────────────────────────────────────────────────────────────────

export interface AlexaResponseEnvelope {
  version: '1.0';
  response: AlexaResponse;
}

export interface AlexaResponse {
  outputSpeech: AlexaOutputSpeech;
  card?: AlexaCard;
  shouldEndSession: boolean;
  reprompt?: { outputSpeech: AlexaOutputSpeech };
}

export interface AlexaOutputSpeech {
  type: 'PlainText' | 'SSML';
  text?: string;   // Para tipo PlainText
  ssml?: string;   // Para tipo SSML (permite control de pronunciación)
}

export interface AlexaCard {
  type: 'Simple' | 'Standard';
  title: string;
  text?: string;
  content?: string;
}
