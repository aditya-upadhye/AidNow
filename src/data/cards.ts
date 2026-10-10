import type { Lang, Situation } from '../core/types';

/**
 * The 10 guidance cards. Safety steps come only from official sources (aidnow-prep/02-card-research.md);
 * models never write advice. English paraphrases those sources.
 * Spanish and Creole are DRAFTS using the County guide's vocabulary (aidnow-prep/06): replace with the
 * County guide's own wording where it exists, and get a fluent reader to check the rest (NATIVE REVIEW).
 */
export type Card = {
  title: Record<Lang, string>;
  steps: Record<Lang, string[]>;
  sources: string[];
};

const GUIDE = 'https://www.miamidade.gov/hurricane/library/guide-to-hurricane-readiness.pdf';

export const CARDS: Record<Exclude<Situation, 'other'>, Card> = {
  water_in_home: {
    title: { en: 'Water entering your home', es: 'Entra agua en su casa', ht: 'Dlo ap antre lakay ou' },
    steps: {
      en: [
        'Go to the highest floor. Do not go into a closed attic.',
        'Never walk, swim or drive through floodwater.',
        'Call 911. Text only if you cannot call.',
      ],
      es: [
        'Suba al piso más alto. No entre a un ático cerrado.',
        'Nunca camine, nade ni maneje por aguas de inundación.',
        'Llame al 911. Envíe un texto solo si no puede llamar.',
      ],
      ht: [
        'Monte nan etaj ki pi wo a. Pa antre nan yon grenye ki fèmen.',
        'Pa janm mache, naje oswa kondui nan dlo inondasyon. Retounen, Pa Nwaye.',
        'Rele 911. Voye tèks sèlman si ou pa ka rele.',
      ],
    },
    sources: ['https://www.fema.gov/sites/default/files/documents/fema_shelter-in-place_guidance-hurricane.pdf', `${GUIDE} (p.20 / 32 / 43)`],
  },
  injury_trapped: {
    title: { en: 'Someone is hurt or trapped', es: 'Alguien está herido o atrapado', ht: 'Yon moun blese oswa bloke' },
    steps: {
      en: ['Call 911 now and follow the dispatcher.', 'Give your exact address and city.', 'If you text, keep it simple and answer the dispatcher.'],
      es: ['Llame al 911 ahora y siga las indicaciones del operador.', 'Dé su dirección exacta y la ciudad.', 'Si envía un texto, sea breve y responda al operador.'],
      ht: ['Rele 911 kounye a epi suiv sa operatè a di.', 'Bay adrès egzak ou ak vil la.', 'Si ou voye tèks, fè l senp epi reponn operatè a.'],
    },
    sources: ['https://wsvn.com/news/local/miami-dade/absolute-gamechanger-miami-dade-launches-text-to-911-service-expanding-emergency-access/'],
  },
  fire_gas: {
    title: { en: 'Fire or gas smell', es: 'Incendio u olor a gas', ht: 'Dife oswa odè gaz' },
    steps: {
      en: ['Leave the home now.', 'Call 911 from a safe place.', 'Do not go back inside until you are told it is safe.'],
      es: ['Salga de la casa ahora.', 'Llame al 911 desde un lugar seguro.', 'No vuelva a entrar hasta que le digan que es seguro.'],
      ht: ['Soti nan kay la kounye a.', 'Rele 911 depi yon kote ki an sekirite.', 'Pa retounen anndan jiskaske yo di ou li an sekirite.'],
    },
    sources: ['https://www.floridacitygas.com/new-form/', `${GUIDE} (p.18 / 30 / 41)`],
  },
  generator_fumes: {
    title: { en: 'Generator fumes', es: 'Gases del generador', ht: 'Lafimen dèlko' },
    steps: {
      en: [
        'Get everyone, pets too, outside into fresh air now.',
        'Then call 911.',
        'Opening windows or running fans does not make the room safe.',
      ],
      es: [
        'Saque a todos, también a las mascotas, al aire libre ahora.',
        'Después llame al 911.',
        'Abrir ventanas o usar ventiladores no hace segura la habitación.',
      ],
      ht: [
        'Fè tout moun, ak bèt kay yo, soti deyò nan lè fre kounye a.',
        'Apre sa, rele 911.',
        'Louvri fenèt oswa limen vantilatè pa fè chanm nan an sekirite.',
      ],
    },
    sources: ['https://www.cpsc.gov/s3fs-public/Hurricane%20Safety%20tri-fold%20082818_0.pdf', `${GUIDE} (p.13 / 25 / 37; p.19 / 31 / 42)`],
  },
  downed_line: {
    title: { en: 'Downed power line', es: 'Cable eléctrico caído', ht: 'Kab elektrisite ki tonbe' },
    steps: {
      en: [
        'Stay far away and assume it is live. Keep others away.',
        'Sparking, fire, someone hurt, or blocking the road: call 911.',
        'Otherwise, report it to FPL at 1-800-4-OUTAGE.',
      ],
      es: [
        'Manténgase lejos y suponga que tiene corriente. Mantenga a otros lejos.',
        'Si echa chispas, hay fuego, alguien está herido o bloquea la calle: llame al 911.',
        'Si no, repórtelo a FPL al 1-800-4-OUTAGE.',
      ],
      ht: [
        'Rete byen lwen epi konsidere li gen kouran. Kenbe lòt moun lwen.',
        'Si l ap fè etensèl, gen dife, yon moun blese, oswa li bloke lari a: rele 911.',
        'Sinon, rapòte l bay FPL nan 1-800-4-OUTAGE.',
      ],
    },
    sources: ['https://www.fpl.com/support/report-concerns.html', `${GUIDE} (p.18 / 30 / 41)`],
  },
  medical_device: {
    title: { en: 'Medical device without power', es: 'Equipo médico sin electricidad', ht: 'Aparèy medikal san kouran' },
    steps: {
      en: [
        'If someone cannot breathe or the device has failed, call 911.',
        'For help evacuating, call 311 about the Emergency and Evacuation Assistance Program.',
        'FPL does not restore power sooner for medical devices. Keep the backup ready.',
      ],
      es: [
        'Si alguien no puede respirar o el equipo falló, llame al 911.',
        'Para ayuda al evacuar, llame al 311 sobre el Programa de Emergencia y Asistencia para Evacuación.',
        'FPL no restablece la electricidad antes por equipos médicos. Tenga lista la batería de respaldo.',
      ],
      ht: [
        'Si yon moun pa ka respire oswa aparèy la sispann mache, rele 911.',
        'Pou èd pou evakye, rele 311 pou Pwogram Asistans Evakyasyon ak Ijans.',
        'FPL pa remèt kouran pi vit pou aparèy medikal. Kenbe batri rezèv la pare.',
      ],
    },
    sources: ['https://www.fpl.com/mesp', `${GUIDE} (pp.3-4; p.14 / 26 / 38)`],
  },
  power_outage: {
    title: { en: 'Power outage', es: 'Apagón', ht: 'Blakawout' },
    steps: {
      en: ['Report or check the outage with FPL.', 'Use flashlights, not candles. Turn off major appliances.', 'Run generators outdoors only.'],
      es: ['Reporte o consulte el apagón con FPL.', 'Use linternas, no velas. Apague los electrodomésticos grandes.', 'Use generadores solo al aire libre.'],
      ht: ['Rapòte oswa tcheke blakawout la ak FPL.', 'Sèvi ak flach, pa chandèl. Etenn gwo aparèy elektrik yo.', 'Fè dèlko mache deyò sèlman.'],
    },
    sources: ['https://www.fpl.com/support/report-concerns.html', `${GUIDE} (p.17 / 29 / 40; p.19 / 31 / 42)`],
  },
  street_hazard: {
    title: { en: 'Tree, debris or flooding on the street', es: 'Árbol, escombros o inundación en la calle', ht: 'Pyebwa, debri oswa dlo nan lari' },
    steps: {
      en: ["Report it to 311, or to your city's line.", 'Stay away from deep or moving water. Never open manholes.', 'Do not walk or drive through floodwater.'],
      es: ['Repórtelo al 311 o a la línea de su ciudad.', 'Aléjese del agua profunda o en movimiento. Nunca abra las alcantarillas.', 'No camine ni maneje por aguas de inundación.'],
      ht: ['Rapòte l bay 311, oswa liy vil ou a.', 'Rete lwen dlo ki fon oswa k ap koule. Pa janm louvri bouch egou.', 'Pa mache ni kondui nan dlo inondasyon. Retounen, Pa Nwaye.'],
    },
    sources: ['https://miamidade.gov/global/public-information-guide/311-contact-center/home.page', `${GUIDE} (p.5-8; p.18-20)`],
  },
  need_shelter: {
    title: { en: 'Shelter and evacuation', es: 'Refugio y evacuación', ht: 'Abri ak evakyasyon' },
    steps: {
      en: [
        'Evacuation centers are a last resort, and not every center opens for every storm.',
        'Check which are open: miamidade.gov/emergency, 311, or the SAFE app.',
        'Bring your medicines and documents. Mobile homes: leave on any evacuation order.',
      ],
      es: [
        'Los centros de evacuación son el último recurso, y no todos abren en cada tormenta.',
        'Vea cuáles están abiertos: miamidade.gov/emergency, el 311 o la app SAFE.',
        'Lleve sus medicinas y documentos. Casas móviles: salga con cualquier orden de evacuación.',
      ],
      ht: [
        'Sant evakyasyon se dènye resò, epi se pa tout sant ki louvri pou chak tanpèt.',
        'Tcheke kilès ki louvri: miamidade.gov/emergency, 311, oswa app SAFE la.',
        'Pote medikaman ak dokiman ou. Mezon mobil: soti nan nenpòt lòd evakyasyon.',
      ],
    },
    sources: [`${GUIDE} (p.14-16 / 26-28 / 38-39)`, 'https://www.miamidade.gov/fire/storm-aides-for-everyone.asp'],
  },
  need_supplies: {
    title: { en: 'Food, water or medicine', es: 'Comida, agua o medicinas', ht: 'Manje, dlo oswa medikaman' },
    steps: {
      en: ['Call 211, open 24/7 in English, Spanish and Creole.', 'The SAFE app lists food and water sites.', 'If someone is sick or struggling, call 911.'],
      es: ['Llame al 211, abierto 24/7 en inglés, español y criollo.', 'La app SAFE muestra sitios de comida y agua.', 'Si alguien está enfermo o en apuros, llame al 911.'],
      ht: ['Rele 211, louvri 24/7 an angle, panyòl ak kreyòl.', 'App SAFE la montre kote ki gen manje ak dlo.', 'Si yon moun malad oswa ap soufri, rele 911.'],
    },
    sources: ['https://jcsfl.org/rp811', 'https://www.miamidade.gov/fire/storm-aides-for-everyone.asp'],
  },
};
