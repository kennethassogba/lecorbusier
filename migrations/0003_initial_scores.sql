-- Adjust the initial scores once. Player votes are kept in their own column.
UPDATE proposals
SET demo_votes = CASE id
  WHEN '0421373e-4e62-4fae-ac41-33accf6d6cdb' THEN 93
  WHEN '24f1cef0-61f0-4807-aef1-225dd89163bb' THEN 9
  WHEN '867245b4-85c7-4d0f-bc07-4405bea8d869' THEN 80
  WHEN '31d2bff1-1a2f-469c-a0c9-26bb5b4ad8ff' THEN 107
  WHEN '96ca12f9-c207-4e4c-9564-3b70bd9c28b0' THEN 130
  WHEN '5d3c7e54-a467-482b-9d39-246b4406772a' THEN 81
  WHEN 'bbc0c3b2-52f7-4f8b-ac6f-69af7e4d8158' THEN 116
  WHEN '1a5b9296-7d68-4415-93cf-9bd2441c33cb' THEN 54
  WHEN '6c3bade3-15ea-49c1-a471-bde68c2a221e' THEN 68
  WHEN '88c7a137-4136-497b-819f-3519d72c311b' THEN 46
  WHEN 'f9611dfc-e8fe-4ee9-b118-c3fe0307d54c' THEN 79
  WHEN '70030cef-ec2b-43b0-a2ec-f6b34a3a71c3' THEN 63
  WHEN 'fa893351-fed8-4ed5-b677-fb70b8f5a56f' THEN 128
  WHEN '5d76aa58-efcc-4549-b6b1-bc96cd346c42' THEN 123
  WHEN '4f5a6448-2b77-4cb0-966a-e96391b1c143' THEN 125
  WHEN '84f1ae7d-e30b-4191-a70c-38c6128ea0fe' THEN 149
  WHEN 'b73277c3-102a-440d-b90d-cc50d6fd743d' THEN 43
  WHEN 'e374cd5c-7337-4c26-be09-6eda04f65d02' THEN 109
  WHEN '29579fc1-cc3f-40fd-a44d-b34b03a501ca' THEN 65
  WHEN 'ea2b3525-8082-4a08-995a-7588f90dae72' THEN 77
  ELSE demo_votes
END
WHERE demo_votes > 150 AND id IN (
  '0421373e-4e62-4fae-ac41-33accf6d6cdb',
  '24f1cef0-61f0-4807-aef1-225dd89163bb',
  '867245b4-85c7-4d0f-bc07-4405bea8d869',
  '31d2bff1-1a2f-469c-a0c9-26bb5b4ad8ff',
  '96ca12f9-c207-4e4c-9564-3b70bd9c28b0',
  '5d3c7e54-a467-482b-9d39-246b4406772a',
  'bbc0c3b2-52f7-4f8b-ac6f-69af7e4d8158',
  '1a5b9296-7d68-4415-93cf-9bd2441c33cb',
  '6c3bade3-15ea-49c1-a471-bde68c2a221e',
  '88c7a137-4136-497b-819f-3519d72c311b',
  'f9611dfc-e8fe-4ee9-b118-c3fe0307d54c',
  '70030cef-ec2b-43b0-a2ec-f6b34a3a71c3',
  'fa893351-fed8-4ed5-b677-fb70b8f5a56f',
  '5d76aa58-efcc-4549-b6b1-bc96cd346c42',
  '4f5a6448-2b77-4cb0-966a-e96391b1c143',
  '84f1ae7d-e30b-4191-a70c-38c6128ea0fe',
  'b73277c3-102a-440d-b90d-cc50d6fd743d',
  'e374cd5c-7337-4c26-be09-6eda04f65d02',
  '29579fc1-cc3f-40fd-a44d-b34b03a501ca',
  'ea2b3525-8082-4a08-995a-7588f90dae72'
);
