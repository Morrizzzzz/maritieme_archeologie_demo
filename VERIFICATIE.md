# Verificatie van versie 1.1

Aanvullend gecontroleerd op 31 oktober 2026:

- De drievoudige klik op het anker is in de desktopbrowser gecontroleerd: na twee klikken blijft het schip verborgen, de derde klik start het easter egg.
- Dezelfde oorspronkelijke 3D-geometrie is met SVG zichtbaar gemaakt op de 2D-kaart. Beweging is bevestigd aan veranderende kaartpositie; pauzeren, stabiele positie tijdens pauze, hervatten en verwijderen van het schip zijn gecontroleerd.
- De mobiele indeling is gecontroleerd op 390 × 844 pixels: het schip, de pauzeknop, verbergen en de zijbalk zijn bereikbaar. Zoeken op Pesse levert na het easter egg nog steeds de juiste vindplaats op.
- Automatische controles slagen voor de drievoudige klik en het verlopen van een onvolledige reeks, pauze/hervatten, een verborgen venster, de gesloten Noordzeeroute, eindige 3D-modelgeometrie en de benodigde modulepaden in de GitHub Pages-workflow.
- De bestaande gegevenscontroles blijven slagen: 2.724 MaSS-records en 576 Archis-wateronderzoeken. De bronbestanden zijn niet vernieuwd of inhoudelijk gewijzigd.
- **Verificatiebeperking:** de beschikbare cloudbrowser meldt WebGL als uitgeschakeld. Daardoor konden de MapLibre-kaart, het 3D-schip in de WebGL-kaartlaag en het wisselen tussen twee daadwerkelijk gerenderde kaartmodi niet visueel worden getest. De terugval naar 2D met het SVG-schip is wel bevestigd. Er zijn geen browserbeveiligingen of instellingen gewijzigd om dit te omzeilen.
- Publicatie naar GitHub is niet uitgevoerd. De statische bestanden, lokale libraries, licenties en aangepaste Pages-workflow zijn meegeleverd. Er is geen extra bouwstap of API-sleutel nodig.

Controles: `npm test` of `node scripts/validate.mjs` en `node scripts/validate-3d.mjs`. De vier nieuwe/aangepaste browsermodules zijn ook met `node --check` gecontroleerd.

---

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
