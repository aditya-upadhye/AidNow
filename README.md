# AidNow

**A multilingual emergency copilot for Miami: it listens, looks at a photo, works out what is happening, and tells residents who to call and what to say, in English, Spanish or Haitian Creole, even with no internet. Built for hurricanes and flooding, extending to earthquakes.**

Hack for Humanity: Miami. **Eligible for three tracks:**

- **Track 01: Four Forces, One City** (primary).
- **MLH Best Open-Source AI Project**: open-weight AI is the core (Gemma 4, Gemma 3 1B and Whisper), the repo is public under the MIT license, and every model and its license is named below.
- **Gemma** (a separate category): Gemma 4 reads text and photos online, and Gemma 3 1B runs on the phone for offline triage.

Forces covered: **Water** (hurricane surge, king-tide and street flooding), **Air** (winds, power and network outages, air quality), **Land** (fallen trees, blocked streets, trapped people) and **Fire** (house fires and gas leaks).

## The problem

- Miami-Dade's Text-to-911 launched in June 2025 English-only, with a 160-character limit. ([WSVN](https://wsvn.com/news/local/miami-dade/absolute-gamechanger-miami-dade-launches-text-to-911-service-expanding-emergency-access/))
- 75.3% of Miami-Dade residents aged 5+ speak a language other than English at home. ([Census QuickFacts](https://www.census.gov/quickfacts/fact/table/miamidadecountyflorida/POP815222))
- After storms, 911 gets non-emergency calls that belong with 311, FPL or 211, and networks and power fail when people need help most.

## Who it serves

- **Marie, 68, Little Haiti.** Speaks Creole, no mobile data the night after a hurricane, water coming into her home → red screen, an English 911 text with her address, and a Creole line showing what it says.
- **Carlos, 45, Hialeah.** Speaks Spanish. A tree is down and his power is out, but it's not an emergency → two reports, one to 311 and one to FPL, written in English and shown to him in Spanish.

## How it works

1. The resident taps the mic and speaks (tap again to stop, or it stops after 60 seconds), types, adds a photo, or taps one of six big buttons.
2. **Whisper on the phone** transcribes the voice note in their language (editable) and translates it to English.
3. **Triage** classifies the input. Online it uses **Gemma 4** on the Gemini API, with text and photo. Offline it uses **Gemma 3 1B on the phone** via llama.cpp (fed Whisper's English translation, since the 1B is strongest in English), then keywords, then a safety default.
4. **Plain code decides the route** (`src/core/router.ts`). A danger-word override in three languages forces Emergency, and the model can raise urgency but never lower it.
5. **Plain code writes the 911 text** (`src/core/composer.ts`) from a template: English, under 160 characters, abbreviations written out as the County asks, and a confirmation in the resident's language built from the same fields.

## How it looks

1. **Choose your language.** English, Español or Kreyòl, then a short profile: name, home address, emergency contacts, and optional medical notes. It all stays on the phone.
2. **Home.** A soft red **Slide to call 911** bar sits on top. Below it: what is happening? Type, tap the mic to speak, or tap the camera to add a photo, then **Get help**. Six one-tap tiles cover water in the home, someone hurt, fire or gas, power out, a tree or flooding on the street, and shelter or supplies. An active storm shows as a banner.
3. **Result.** An Emergency shows a red screen with a **Call 911** button and a ready 911 text with your address. A non-emergency gets reports for 311, FPL or 211. Each comes with a confirmation in your language, safety steps from the County guide, and a button to read it aloud.
4. **Prepare.** Your storm surge zone, open shelters, the next high tide and the air quality, saved on the phone for when the network drops.
5. **Family and Community.** Check in with family, find nearby blood donors and neighbor volunteers, and see live alerts by ZIP code.
6. **Profile.** A responder card for paramedics, downloads for the offline models, and a log out button.

## Safety rules

- **Escalate, never block.** The red 911 button is on every screen; any doubt routes to Emergency.
- **No automated contact with 911.** AidNow never calls or texts 911 itself, never queues an emergency message, and never talks to a dispatcher. The resident taps call or send.
- **Vetted advice only.** Safety steps come from official sources (`src/data/cards.ts`, each with its source). Models classify and translate; they never write safety or medical advice.
- **Privacy.** The profile, medical notes, recordings and transcripts stay on the phone. Only the text and photo of an online request go to the Gemini API. An Emergency result also tells volunteers within 5 km on its own, without asking at that moment: only the kind of emergency and an area about 1 km wide, never a name, address, photo or medical detail. The resident can switch this off in My role. Urgent results can send the same alert with one tap.
- **Demo mode never contacts 911.** With `EXPO_PUBLIC_DEMO_MODE=1` (the default), every call and text, including 911, goes to `EXPO_PUBLIC_DEMO_RECIPIENT`. If that number is missing, nothing is sent. Misusing 911 is illegal in Florida.

## Open models and libraries

| Model / library | Where | License |
| --- | --- | --- |
| Gemma 4 (`gemma-4-26b-a4b-it`) via the Gemini API | Online triage, text and image | [Gemma 4 license (Apache 2.0)](https://ai.google.dev/gemma/docs/gemma_4_license) |
| Gemma 3 1B, `unsloth/gemma-3-1b-it-GGUF` Q4_K_M (806 MB) | Offline triage on the phone | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| Whisper base (multilingual), `ggerganov/whisper.cpp` ggml | Speech to text and to English, on the phone | [Apache 2.0](https://huggingface.co/openai/whisper-base) |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) via [whisper.rn](https://github.com/mybigday/whisper.rn) | On-device speech runtime | MIT |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) via [llama.rn](https://github.com/mybigday/llama.rn) | On-device Gemma runtime | MIT |
| React Native, Expo, i18next | App | MIT |

## Miami data

| Source | Used for |
| --- | --- |
| [Miami-Dade Open Data: Storm Surge Planning Zones](https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/StormSurgePlanningZone_Multipart/FeatureServer) | Resident's zone, bundled in the app for offline use (`src/data/zones.json`; checked against the County's server at 25 random points) |
| [Miami-Dade Open Data: Evacuation Center Shelters Open](https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/EvacuationCenterShelters_Open/FeatureServer) | Centers the County lists as open, cached for offline use |
| [National Hurricane Center](https://www.nhc.noaa.gov/CurrentStorms.json) | Active Atlantic storms |
| [EPA AirNow API](https://docs.airnowapi.org/) (`/aq/observation/current/ziplatlong/`) | Current air quality near the resident, with a note for sensitive groups on unhealthy days; cached for offline use |
| [NOAA Tides & Currents, Virginia Key 8723214](https://tidesandcurrents.noaa.gov/stationhome.html?id=8723214) | Next high tide (a prediction, not a flood forecast) |
| [Miami-Dade Official Severe Weather and Emergency Readiness Guide](https://www.miamidade.gov/hurricane/library/guide-to-hurricane-readiness.pdf) | Safety cards and Creole vocabulary |
| [U.S. Census QuickFacts](https://www.census.gov/quickfacts/fact/table/miamidadecountyflorida/POP815222) | Impact numbers |

Phone numbers live in one file, `src/data/directory.ts`, each with its official source; last checked Oct 9, 2026.

## Run it

Needs Node 22, Xcode, CocoaPods, and an iPhone with Developer Mode on. Native modules mean Expo Go won't work.

```bash
npm install
cp .env.example .env      # add EXPO_PUBLIC_GEMINI_API_KEY and EXPO_PUBLIC_DEMO_RECIPIENT
npm test                  # triage scenarios, composer, zone lookup
npx expo run:ios --device # development build on a connected iPhone
```

Then open **My profile → Offline models** and download Whisper (148 MB) and Gemma 3 1B (806 MB) on Wi-Fi.

## Future work

Simple extensions, each a data or content change rather than a rewrite:

- **Earthquakes.** Add earthquake situations, danger words and cited safety cards in three languages, and a USGS earthquake feed.
- **Flooding.** Street-level flood alerts from tide and rain data, National Weather Service flood warnings, FEMA flood zones and USGS water gauges.
- **More languages.** Add more of the languages Miami speaks, one string file each, and have fluent speakers review the Spanish and Creole text.
- **More Miami data.** Road closures, cooling centers, a live shelter-bed and food-pantry finder, and Census language data by ZIP for the community map.
- **City partnership.** A structured handoff with Miami-Dade 311 and Emergency Management, and the partner datasets once released.
- **Android and other cities.** Android support, and a new city by swapping the zone file, directory and cards.
- **Newer open models.** The triage model is set by an environment variable, so newer Gemma models drop in as they ship.

## Team

Aditya Upadhye, Kaviya Gopi (GitHub: KaviyaGopi), Prithesh Subramani. Built with Claude Code.

## License

AidNow's code is released under the [MIT License](LICENSE). The repository is public and stays public after the event.

The open models it uses keep their own licenses, linked in the table above: [Gemma 4](https://ai.google.dev/gemma/docs/gemma_4_license) (Apache 2.0), [Gemma 3](https://ai.google.dev/gemma/terms) (Gemma Terms of Use) and [Whisper](https://huggingface.co/openai/whisper-base) (Apache 2.0). Model weights are downloaded on the phone and are not part of this repository.
