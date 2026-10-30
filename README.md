# Maritieme erfgoedatlas

Een statische kaartwebsite die openbare gegevens uit MaSS en Archis combineert met contextlagen uit de Erfgoedatlas. Vormgeving geïnspireerd op cultureelerfgoed.nl. De toepassing werkt zonder backend, account, API-sleutel of npm-installatie.

## Direct publiceren op GitHub Pages

1. Pak de ZIP uit.
2. Maak een GitHub-repository, bijvoorbeeld `maritiem-erfgoed-atlas`.
3. Plaats **de inhoud** van de uitgepakte map in de root van die repository. `index.html` moet dus direct in de hoofdmap staan.
4. Kies een van de volgende publicatiemethoden.

### Eenvoudigste methode: publiceren vanaf een branch

Ga naar **Settings → Pages → Build and deployment**:

- Source: **Deploy from a branch**.
- Branch: **main**.
- Folder: **/(root)**.
- Klik **Save**.

De website verschijnt na publicatie op de URL die GitHub in dit scherm toont, doorgaans `https://GEBRUIKERSNAAM.github.io/REPOSITORYNAAM/`. Alle sitepaden zijn relatief en werken dus ook onder een repositorynaam. De site is niet al op jouw GitHub-account gepubliceerd.

Gebruik je deze methode, neem `.github/workflows/pages.yml` dan niet mee, of verwijder die workflow voordat je de repository pusht. Zo draaien er niet twee publicatiemethoden naast elkaar.

### Alternatief: meegeleverde GitHub Actions-workflow

Neem de verborgen map `.github` mee. Kies in **Settings → Pages** als Source **GitHub Actions**. De workflow `Publiceer de erfgoedatlas` controleert de data en publiceert alleen de sitebestanden na een push naar `main`. Je kunt hem ook handmatig starten via **Actions → Publiceer de erfgoedatlas → Run workflow**.

De workflow vernieuwt geen brongegevens: hij publiceert de meegeleverde momentopname. Onderzoek en data zijn daardoor reproduceerbaar.

## Wat is daadwerkelijk geïntegreerd?

| Bron | In deze versie | Toegang / dekking |
|---|---|---|
| MaSS | 2.724 records, namen, typen, locaties, dateringen, links naar verhalen | Volledige Nederlandstalige lijst-API op 30 oktober 2026; wereldwijd |
| Archis openbaar | 576 onderzoeksmeldingen met oorspronkelijke contouren en attributen | Afgeronde, openbare meldingen met `bodemtype = 'Waterbodem'` |
| Erfgoedatlas | AMK 2014, archeologische rijksmonumentcontouren, onderzoekspotentieel Noordzee 2016 | Live WMS-kaartbeelden en waar beschikbaar GetFeatureInfo |
| MACHU / opgegeven RWS-viewer | Bronverwijzing en toelichting; geen objectgegevens | Onderliggende wrakken- en archiefdiensten weigeren toegang (ArcGIS-foutcode 403) |
| Eigen gegevens | Lokale GeoJSON-inleesfunctie | Alleen in het huidige browservenster; niet geüpload of opgeslagen |

De openbare onderzoeksmeldingen zijn **geen volledige kopie van Archis** en ook niet de aparte Archis-dataset Waterbodem. De Erfgoedatlas biedt aanvullende context; deze bevat niet automatisch alle afgeschermde MACHU- of Archis-records. Zie [BRONNEN.md](BRONNEN.md) voor de precieze diensten en beperkingen.

## Gebruik

- Zoek op naam, plaats, bron-ID of meldingsnummer; de resultaten betreffen MaSS, wateronderzoeken en ingelezen eigen gegevens.
- Kies MaSS-soort en periode. Deze filters wijzigen Archis-onderzoeken niet: de uitvoeringsdatum van een onderzoek zegt niets over de ouderdom van het onderzochte erfgoed.
- Gebruik **Resultaten → Alleen in dit kaartbeeld** om de lijst geografisch te beperken. Onderzoeksgebieden worden hierbij beoordeeld op hun begrenzing.
- Klik op een groep om in te zoomen, of op een record voor kenmerken en een link naar de bron.
- Onderzoeksgebieden krijgen een overzichtssymbool op het midden van hun begrenzing. Bij selectie verschijnt de originele geometrie. Dit is geen precieze wraklocatie.
- Contextlagen zijn aan/uit te zetten, hebben een legenda en zijn via klikken op de kaart bevraagbaar. Ze vallen buiten de lijstfilters en downloads.
- **Deel kaart** kopieert de positie, filters, achtergrond en contextlagen in een URL. Eigen ingelezen data wordt niet meegedeeld.
- **Download selectie** exporteert CSV of GeoJSON. GeoJSON behoudt de oorspronkelijke geometrieën. CSV bevat overzichtscoördinaten met hun betekenis. Formuleachtige celwaarden worden als tekst beschermd.

De tellingen zijn **bronrecords, geen unieke wrakken**. Records worden niet automatisch gekoppeld op grond van nabijheid of naam. NCN-nummers worden getoond als ze in de bron voorkomen.

## Lokaal bekijken op Windows

Open een terminal in de map met `index.html`:

```powershell
py -m http.server 8000
```

Open daarna `http://localhost:8000`. Met Anaconda kan ook `python -m http.server 8000`. In VS Code kun je een bestaande Live Server-extensie gebruiken. Rechtstreeks dubbelklikken op `index.html` werkt niet betrouwbaar, omdat browsers bij `file://` het inlezen van JSON en JavaScript-modules beperken.

## Momentopname verversen

Gebruik Python 3.10 of nieuwer; extra pakketten zijn niet nodig:

```powershell
py scripts/update_data.py
```

Het script haalt de volledige MaSS-lijst op en doorloopt alle pagina’s van de openbare Archis-WFS met het Waterbodem-filter. Het controleert aantallen, dubbele ID’s en de selectie. Na succesvolle validatie worden `data/mass.json`, `data/archis-water.geojson` en `data/manifest.json` vervangen. Commit en publiceer de bijgewerkte data-map.

Bij een download- of validatiefout blijven bestaande bestanden behouden. De netwerkdownloads gebeuren vóór het vervangen; bestandvervanging is per bestand atomair, niet als drie-bestandstransactie. Er is geen automatische periodieke taak ingesteld.

Via **Bronnen & gegevens → Openbare gegevens verversen** kunnen bezoekers nieuwe gegevens voor hun huidige venster ophalen. Als een bron faalt, blijven de eerder geladen gegevens staan. MaSS gebruikt de door de bron gedocumenteerde JSONP-wrapper omdat de API geen algemene CORS-header meegeeft. Er is geen externe CORS-proxy gebruikt. De WFS wordt rechtstreeks opgehaald. Verversen op de website wijzigt de repository niet.

## Eigen Archis- of MACHU-export bekijken

1. Exporteer gegevens waarvoor je toegang hebt naar GeoJSON.
2. Gebruik in QGIS **Objecten opslaan als… → GeoJSON → CRS EPSG:4326**.
3. Klik **Eigen GeoJSON openen**.

Ondersteund: punten, lijnen, polygonen, Multi-geometrieën en GeometryCollections; maximaal 20 MB en 10.000 objecten. De toepassing verwacht lengtegraad vóór breedtegraad, valideert geometrieën en weigert expliciet opgegeven andere CRS’en. Er vindt geen repro­jectie plaats. Veldnamen `naam`, `name`, `title`, `plaats`, `location`, `meldingsnummer` en `nationaal_contact_nummer` worden herkend. Eigenschappen worden als tekst weergegeven.

Eigen bestanden blijven in het werkgeheugen van de browser en verdwijnen bij herladen. Voeg geen afgeschermde exports, gebruikerswachtwoorden of toegangstokens toe aan een openbare GitHub-repository. Publicatie van afgeschermde gegevens is niet nodig om de lokale import te gebruiken.

## Bestanden aanpassen

| Bestand | Functie |
|---|---|
| `index.html` | Nederlandstalige interface en toelichtingen |
| `style.css` | Blauw/geel kleurgebruik, responsive lay-out |
| `app.js` | Kaart, filters, objectinformatie, export en browserverversing |
| `core.mjs` | Normalisatie, geometrie, datumfilters, importvalidatie en export |
| `config.js` | Bron-URL’s, WMS-laagnamen, stijlen en achtergronden |
| `data/manifest.json` | Ophaaldatums, aantallen, selectie en herkomst |
| `scripts/update_data.py` | Reproduceerbaar bijwerken van openbare snapshots |
| `scripts/validate.mjs` | Controle op data, geometrie en kernfunctionaliteit |
| `vendor/` | Lokaal meegeleverde Leaflet en markercluster met licenties |

Er is geen bouwstap. Voor controles met Node.js 22 of nieuwer:

```sh
node --check app.js
node scripts/validate.mjs
```

## Afhankelijkheden en grenzen

De bronbestanden laden vanaf je eigen website. Achtergrondkaarten en WMS-lagen hebben internet nodig en blijven afhankelijk van hun aanbieders, bereikbaarheid, limieten en CORS-instellingen. De lichte PDOK-kaart dekt Nederland; de wereldknop schakelt naar OpenStreetMap. De site gebruikt alleen lokale JavaScript-bibliotheken, geen tracking of analytics.

Kaartlagen en relaties zijn op 30 oktober 2026 gecontroleerd. Overheidsdiensten kunnen later van adres of laagnaam veranderen; pas in dat geval `config.js` aan. De MaSS-lijst bevat geen onzekerheidsmaat voor alle locaties. Decimalen worden daarom niet gelijkgesteld aan positienauwkeurigheid. Datakwaliteit, identificatie en eventuele juridische status moeten aan de bron worden beoordeeld.

Dit is een zelfstandige toepassing, geen officiële RCE-publicatie. Er is geen Rijkswapen gebruikt. De nieuwe code valt onder de MIT-licentie; gegevens en externe kaartbeelden behouden hun eigen voorwaarden.
