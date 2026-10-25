-- Give the existing examples distinct builder names.
UPDATE proposals SET author = CASE id
  WHEN 'ea2b3525-8082-4a08-995a-7588f90dae72' THEN 'Malo'
  WHEN '867245b4-85c7-4d0f-bc07-4405bea8d869' THEN 'Zoé'
  WHEN '0421373e-4e62-4fae-ac41-33accf6d6cdb' THEN 'Mina M.'
  WHEN '24f1cef0-61f0-4807-aef1-225dd89163bb' THEN 'ArchiLou'
  WHEN '96ca12f9-c207-4e4c-9564-3b70bd9c28b0' THEN 'Léa béton'
  WHEN '5d3c7e54-a467-482b-9d39-246b4406772a' THEN 'Basile'
  WHEN 'bbc0c3b2-52f7-4f8b-ac6f-69af7e4d8158' THEN 'Nora'
  WHEN '88c7a137-4136-497b-819f-3519d72c311b' THEN 'Romain'
  WHEN '6c3bade3-15ea-49c1-a471-bde68c2a221e' THEN 'Jules'
  WHEN 'f9611dfc-e8fe-4ee9-b118-c3fe0307d54c' THEN 'Inès'
  WHEN '70030cef-ec2b-43b0-a2ec-f6b34a3a71c3' THEN 'PixelMaçon'
  WHEN 'fa893351-fed8-4ed5-b677-fb70b8f5a56f' THEN 'Iris'
  WHEN '5d76aa58-efcc-4549-b6b1-bc96cd346c42' THEN 'Max B.'
  WHEN '4f5a6448-2b77-4cb0-966a-e96391b1c143' THEN 'Samir'
  WHEN '84f1ae7d-e30b-4191-a70c-38c6128ea0fe' THEN 'Ada sur Seine'
  WHEN 'b73277c3-102a-440d-b90d-cc50d6fd743d' THEN 'Nico'
  WHEN 'e374cd5c-7337-4c26-be09-6eda04f65d02' THEN 'Sacha'
  WHEN '29579fc1-cc3f-40fd-a44d-b34b03a501ca' THEN 'Lou'
  ELSE author
END
WHERE is_demo = 1 AND author = 'Atelier Le Corbusier' AND id IN (
  'ea2b3525-8082-4a08-995a-7588f90dae72',
  '867245b4-85c7-4d0f-bc07-4405bea8d869',
  '0421373e-4e62-4fae-ac41-33accf6d6cdb',
  '24f1cef0-61f0-4807-aef1-225dd89163bb',
  '96ca12f9-c207-4e4c-9564-3b70bd9c28b0',
  '5d3c7e54-a467-482b-9d39-246b4406772a',
  'bbc0c3b2-52f7-4f8b-ac6f-69af7e4d8158',
  '88c7a137-4136-497b-819f-3519d72c311b',
  '6c3bade3-15ea-49c1-a471-bde68c2a221e',
  'f9611dfc-e8fe-4ee9-b118-c3fe0307d54c',
  '70030cef-ec2b-43b0-a2ec-f6b34a3a71c3',
  'fa893351-fed8-4ed5-b677-fb70b8f5a56f',
  '5d76aa58-efcc-4549-b6b1-bc96cd346c42',
  '4f5a6448-2b77-4cb0-966a-e96391b1c143',
  '84f1ae7d-e30b-4191-a70c-38c6128ea0fe',
  'b73277c3-102a-440d-b90d-cc50d6fd743d',
  'e374cd5c-7337-4c26-be09-6eda04f65d02',
  '29579fc1-cc3f-40fd-a44d-b34b03a501ca'
);
