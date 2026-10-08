-- Minimal content for Spike 2 encounter flow

insert into public.cards (id, edition_id, card_type, card_number, title, status)
values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'ENCOUNTER', 1, 'Strange Merchant', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'ENCOUNTER', 2, 'Desert Nomads', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'ENCOUNTER', 3, 'City Guard', 'PUBLISHED'),
  ('33333333-3333-4333-8333-333333333304', '11111111-1111-4111-8111-111111111111', 'STATUS', 1, 'Sultan', 'PUBLISHED');

insert into public.reaction_matrices (id, edition_id, matrix_number)
values ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 1);

insert into public.reaction_matrix_cells (matrix_id, row_key, reaction, paragraph_number)
values
  ('44444444-4444-4444-8444-444444444401', 'merchant', 'AID', 101),
  ('44444444-4444-4444-8444-444444444401', 'merchant', 'ATTACK', 102),
  ('44444444-4444-4444-8444-444444444401', 'merchant', 'AVOID', 103);

insert into public.encounter_chart_entries (
  id, edition_id, encounter_key, roll_min, roll_max, descriptor, matrix_id
) values (
  '55555555-5555-4555-8555-555555555501',
  '11111111-1111-4111-8111-111111111111',
  'encounter',
  1,
  6,
  'merchant',
  '44444444-4444-4444-8444-444444444401'
);
