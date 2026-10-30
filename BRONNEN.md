# Bronnen en verantwoording

Onderzocht op **30 oktober 2026**. Exacte ophaaldatums staan in `data/manifest.json`.

## 1. MaSS

- Website: <https://mass.cultureelerfgoed.nl/>
- API-documentatie: <https://mass.cultureelerfgoed.nl/api/>
- Gebruikte lijst: <https://mass.cultureelerfgoed.nl/api/v1/list/nl/>
- API-respons: 2.724 records. De documentatie gebruikt het veld `label`; de huidige respons gebruikt `name`. Beide worden ondersteund.
- Meegeleverd: lijstvelden en coördinaten, geen volledige verhalen of afbeeldingen. Verhalen worden per record via de bronlink geopend.
- Licentie: CC BY-SA 4.0. Deze is op de MaSS-site en in een detail-API-respons vermeld. De gegevens blijven afzonderlijk van de MIT-gelicentieerde toepassingscode.
- API-limiet volgens de documentatie: onder 720 verzoeken per uur per IP blijven. De normale site gebruikt de snapshot; verversen vraagt één MaSS-lijst op. Er worden niet duizenden detailrecords opgehaald.
- Coördinaten worden overgenomen zonder vermeende nauwkeurigheid toe te voegen. Ontbrekende coördinaten worden niet omgezet naar 0,0.

## 2. Archis

- Ingang: <https://archis.cultureelerfgoed.nl/authenticatie/inloggen>
- Publieke WFS: <https://data.geo.cultureelerfgoed.nl/openbaar/wfs?service=WFS&request=GetCapabilities>
- Featuretype: `openbaar:archeologische_onderzoeksmeldingen_openbaar_wgs84`.
- Selectie: `CQL_FILTER=bodemtype = 'Waterbodem'`.
- Opgehaald in EPSG:4326, `application/json`. De respons bevatte 576 features en `numberMatched=576`; alle zijn opgenomen. De volledige openbare onderzoekslaag had bij de steekproef 104.888 records. Dat is geen omvang van de volledige Archis-database.
- De dienst beschrijft deze laag als afgeronde en openbare archeologische onderzoeksmeldingen, gelegen binnen en buiten Nederland, afkomstig uit Archis.
- Bronattributen en oorspronkelijke geometrieën zijn behouden. Alleen de overzichtssymbolen worden afgeleid uit de rechthoekige begrenzing; de export en objectselectie behouden de contour.
- De afzonderlijke Archis-dataset Waterbodem staat volgens de RCE achter een inlog: <https://kennis.cultureelerfgoed.nl/index.php/Dataset/161>. Die dataset en volledige vondst-, spoor-, structuur- en complexdossiers zijn niet gedownload.
- De geraadpleegde GetCapabilities geeft geen expliciete licentie. Er is geen zelfbedachte CC0-licentie toegekend. Bronvoorwaarden van de RCE blijven van toepassing.

## 3. Rijkswaterstaatviewer / MACHU

- Opgegeven viewer: <https://geoweb.rijkswaterstaat.nl/Moduleviewer/?app=3d6b415eeabd47d9b3da56ebd686f7cf>
- Publieke applicatiemetadata: <https://www.arcgis.com/sharing/rest/content/items/3d6b415eeabd47d9b3da56ebd686f7cf?f=pjson>
- Titel in de applicatiemetadata: **MACHU - Managing Cultural Heritage Underwater (Beveiligd)**.
- Officiële toelichting: <https://www.cultureelerfgoed.nl/onderwerpen/b/bronnen-en-kaarten/overzicht/machu>.
- De RCE geeft aan dat registratie nodig is vanwege de aard van de informatie, waaronder exacte locaties. De geraadpleegde wrakken- en archiefservices uit de publieke applicatieconfiguratie retourneerden HTTP 200 met een ArcGIS-JSON-fout **code 403 / GWM_0003: geen toestemming**. Dit is geen geldige objectrespons.
- Geen inlog omzeild, geen tokens gebruikt, geen afgeschermde objectgegevens gedownload of meegeleverd.
- De website biedt een bronverwijzing, openbare alternatieven en lokale import voor reeds rechtmatig verkregen exports. Een openbare GitHub Pages-site kan niet zelfstandig vertrouwelijke sessies of geheimen beschermen.

## 4. Erfgoedatlas als aanvullende context

- Viewer: <https://rce.webgis.nl/nl/map/erfgoedatlas>
- Toelichting: <https://www.cultureelerfgoed.nl/onderwerpen/b/bronnen-en-kaarten/overzicht/erfgoedatlas>
- Laagnamen, diensten en stijlen zijn uit de openbare viewerconfiguratie gelezen en met GetMap gecontroleerd.

| Kaartlaag | Dienst | Laagnaam / stijl |
|---|---|---|
| AMK 2014 | `https://data.geo.cultureelerfgoed.nl/openbaar/wms` | `Archeologische_Monumentenkaart_2014` / `AMK_2014_archeologische_waarde` |
| Archeologische rijksmonumentcontouren | dezelfde openbare WMS | `rijksmonumentcontouren` / `CHOIrijksmonumentdicosArcheologisch` |
| Onderzoekspotentieel Noordzee 2016 | `https://services.rce.geovoorziening.nl/Noordzee_arch_onderz_potentieel/wms` | `noordzee_arch_onderzoekspotentieel_2016` |

De app gebruikt WMS 1.1.1 in EPSG:3857 voor kaartbeelden, GetLegendGraphic voor legendes en GetFeatureInfo in JSON voor objectinformatie. Niet alle diensten garanderen hetzelfde CORS-gedrag. Bij onbeschikbare attributen meldt de interface dit; zij presenteert een fout niet als een lege dataset.

AMK 2014 is een historische inventarisatie. Onderzoekspotentieel 2016 gaat over potentiële archeologische en paleolandschapsresten in de Noordzeebodem; het is geen inventarisatie van individuele scheepswrakken. Deze lagen vervangen de inhoud van MACHU niet.

## 5. Achtergronden en software

- PDOK / Kadaster BRT Achtergrondkaart, lichtgrijs: <https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?service=WMTS&request=GetCapabilities>
- OpenStreetMap: <https://www.openstreetmap.org/copyright>
- Esri World Imagery: <https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer>
- Leaflet 1.9.4: <https://leafletjs.com/reference.html> (BSD 2-Clause, licentie meegeleverd).
- Leaflet.markercluster 1.5.3 (MIT, licentie meegeleverd).
- GitHub Pages-workflows: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>.

## Integratiebetekenis

Dit is een gezamenlijke kaart- en zoekinterface met expliciete herkomst per record. Er is geen bewezen automatische entiteitskoppeling tussen een MaSS-wrak, Archis-melding en MACHU-object. Naamovereenkomst of ruimtelijke nabijheid bewijst die relatie niet. Beschikbare NCN-nummers blijven zichtbaar, zodat een latere expliciete koppeling mogelijk is.
