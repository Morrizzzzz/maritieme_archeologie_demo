# Verificatie van versie 1.0

Gecontroleerd op 30 oktober 2026:

- Alle 2.724 MaSS-records en 576 Archis-wateronderzoeken zijn ingelezen, met unieke bron-ID’s en coördinaten binnen het WGS84-bereik.
- Zoeken op Pesse gaf de juiste vindplaats, kenmerken, datering en bronlink. Objectselectie en kaartnavigatie zijn in Chrome gecontroleerd.
- De drie WMS-contextlagen laadden in de browser. Een GetFeatureInfo-verzoek voor de Noordzee gaf geldige JSON-objectinformatie en een CORS-header terug.
- Verversen in de browser haalde beide openbare bronnen succesvol op met respectievelijk 2.724 en 576 records.
- Het Python-updatescript is zelfstandig uitgevoerd; paginering, filtering en aantallen slaagden.
- De mobiele interface is bekeken in een viewport van 390 × 844 pixels; de kaartlagenzijbalk opent en sluit.
- De automatische controles voor bron-ID’s, geometriebereik, bronfilters, overlappende dateringsperioden, ontbrekende coördinaten, CRS-validatie, ongeldige geometrieën, CSV-formulebescherming en behoud van onderzoekscontouren bij GeoJSON-export slagen.
- De exportselectie en gegenereerde CSV/GeoJSON-inhoud zijn gecontroleerd. De testbrowser kon de automatische bestandsdownload niet bevestigen; dit onderdeel heeft geen bevestigde end-to-end browsertest.
- Publicatie naar een GitHub-account is niet uitgevoerd. Het pakket bevat de statische site en een Pages-workflow; de gebruiker kan de repository en publicatiebron kiezen.

Herhaal de inhoudelijke controles met `node scripts/validate.mjs` en de syntaxcontrole met `node --check app.js`.
