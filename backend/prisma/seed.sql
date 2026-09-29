-- GearTrace: Seed de datos iniciales para desarrollo y pruebas
-- Ejecutar con: npx prisma db seed
-- (o después de: npx prisma migrate dev)

-- 5 Cajas físicas, cada una con su ledIndex (0-4)
INSERT INTO boxes (name, description, led_index, location, color_hex, created_at, updated_at)
VALUES
  ('Caja A - Filtros',       'Filtros de aceite, aire y combustible',   0, 'Estante 1, Nivel A', '#FF4500', NOW(), NOW()),
  ('Caja B - Frenos',        'Pastillas, discos y lainas de freno',     1, 'Estante 1, Nivel B', '#1E90FF', NOW(), NOW()),
  ('Caja C - Correas',       'Correas de distribución y alternador',    2, 'Estante 2, Nivel A', '#32CD32', NOW(), NOW()),
  ('Caja D - Eléctrico',     'Fusibles, relés y bombillas',             3, 'Estante 2, Nivel B', '#FFD700', NOW(), NOW()),
  ('Caja E - Lubricantes',   'Aceites, grasas y líquidos de freno',     4, 'Estante 3, Nivel A', '#9400D3', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Piezas de ejemplo por caja
INSERT INTO parts (name, code, quantity, description, keywords, min_stock, box_id, created_at, updated_at)
VALUES
  -- Caja 1 (Filtros)
  ('Filtro de aceite Toyota',  'FLT-OIL-001', 15, 'Filtro de aceite para motores Toyota 1.6-2.0', ARRAY['filtro aceite', 'filtro toyota', 'filtro'], 3, 1, NOW(), NOW()),
  ('Filtro de aire universal', 'FLT-AIR-001', 8,  'Filtro de aire rectangular universal',           ARRAY['filtro aire', 'filtro', 'aire'],          2, 1, NOW(), NOW()),
  -- Caja 2 (Frenos)
  ('Pastillas de freno Brembo','BRK-PAD-001', 6,  'Juego de pastillas delanteras Brembo',           ARRAY['pastillas', 'frenos', 'pastillas freno'], 2, 2, NOW(), NOW()),
  ('Disco de freno ventilado', 'BRK-DSC-001', 4,  'Disco ventilado 280mm diámetro',                 ARRAY['disco', 'disco freno', 'rotor'],          1, 2, NOW(), NOW()),
  -- Caja 3 (Correas)
  ('Correa de distribución',   'BLT-TIM-001', 5,  'Correa dentada de distribución 120 dientes',     ARRAY['correa', 'distribución', 'timing'],       2, 3, NOW(), NOW()),
  -- Caja 4 (Eléctrico)
  ('Fusible 20A',              'ELC-FUS-020', 50, 'Fusible de cuchilla 20 amperios',                ARRAY['fusible', 'fusible 20', 'plano'],         10, 4, NOW(), NOW()),
  -- Caja 5 (Lubricantes)
  ('Aceite 5W-30 Sintético',   'LUB-OIL-530', 20, 'Aceite de motor sintético 5W-30 1 litro',       ARRAY['aceite', 'aceite motor', '5w30'],         5, 5, NOW(), NOW())
ON CONFLICT DO NOTHING;
