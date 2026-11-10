/** Nombres de los intents definidos en la Alexa Developer Console. */
export const INTENTS = {
  BUSCAR_PIEZA: 'BuscarPiezaIntent',
  LISTAR_CAJAS: 'ListarCajasIntent',
  STOCK_BAJO: 'StockBajoIntent',
  HELP: 'AMAZON.HelpIntent',
  CANCEL: 'AMAZON.CancelIntent',
  STOP: 'AMAZON.StopIntent',
  FALLBACK: 'AMAZON.FallbackIntent',
} as const;

/** Nombres de los slots del modelo de interacción. */
export const SLOTS = {
  NOMBRE_PIEZA: 'nombrePieza',
} as const;
