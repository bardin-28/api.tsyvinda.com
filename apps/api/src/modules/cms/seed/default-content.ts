// Generated from the website's copy (fe/src/messages + about/const) when the CMS was introduced.
// It is only the first content of each page: the CMS seed inserts it for pages that don't exist
// yet and never overwrites what editors changed. Edit content in the admin panel.
import type { FieldValues, PageContent, PageKey } from '@tsyvinda/shared-types';

/** Content several pages start with (each page keeps its own copy once seeded). */
const DEFAULT_GROUPS = {
  industries: {
    items: ['MedTech', 'FinTech', 'PropTech', 'TravelTech', 'EdTech', 'InsurTech'],
  },
  experience: {
    roles: [
      {
        title: {
          en: 'Full-Stack Lead Developer',
          uk: 'Full-Stack Lead Developer',
        },
        org: 'Tallium Inc.',
        type: {
          en: 'Full-time',
          uk: 'Повна зайнятість',
        },
        period: {
          en: 'Sep 2025 — Present · 10 mos',
          uk: 'вер. 2025 — дотепер · 10 міс.',
        },
        location: {
          en: 'Remote · Kyiv, Ukraine',
          uk: 'Віддалено · Київ, Україна',
        },
        bullets: {
          en: [
            'Created and maintained internal engineering standards, security guidelines, and technical best-practice documentation, improving development consistency and reducing security risks.',
            "Led the frontend team's adoption of Claude Code, establishing usage guidelines, sharing best practices, and supporting engineers in integrating AI-assisted development into their daily workflows.",
            'Developed an investment platform enabling large-scale investments into business projects, with built-in analytics and automated generation of investment documents.',
          ],
          uk: [
            'Створив і підтримую внутрішні інженерні стандарти, правила безпеки та документацію з технічних практик, що зробило розробку узгодженішою та знизило ризики безпеки.',
            'Керував упровадженням Claude Code у фронтенд-команді: сформулював правила використання, ділився найкращими практиками й допомагав інженерам інтегрувати розробку з AI у щоденну роботу.',
            'Розробив інвестиційну платформу для масштабних інвестицій у бізнес-проєкти з вбудованою аналітикою та автоматичним формуванням інвестиційних документів.',
          ],
        },
      },
      {
        title: {
          en: 'Front-end Developer',
          uk: 'Front-end Developer',
        },
        org: 'Tallium Inc.',
        type: {
          en: 'Full-time',
          uk: 'Повна зайнятість',
        },
        period: {
          en: 'Mar 2022 — Present · 4 yrs 4 mos',
          uk: 'бер. 2022 — дотепер · 4 р. 4 міс.',
        },
        location: {
          en: 'Hybrid · Kyiv, Ukraine',
          uk: 'Гібридно · Київ, Україна',
        },
        bullets: {
          en: [
            'Developed a service desk platform that significantly improved team efficiency and response times, earning industry recognition as one of the top solutions in its field.',
            'Developed a centralized internal system for a business center, integrating tenant services like cleaning, access control, parking management, analytics, and event space reservations.',
            'Worked on a MedTech ophthalmology platform, building retinal scan visualization, patient records, AI-driven disease risk analysis, and color-coded layer masks.',
            'Delivered an optimized InsurTech solution with frontend-generated insurance PDFs, minimizing back-office effort and accelerating vehicle policy issuance through automation.',
            'Developed a cruise booking platform in the Baltic Sea, enabling end-to-end travel packages including cruise itineraries, onboard services, and hotel reservations.',
          ],
          uk: [
            'Розробив сервіс-деск платформу, яка суттєво підвищила ефективність команди та швидкість реагування й отримала галузеве визнання як одне з найкращих рішень у своїй сфері.',
            'Розробив централізовану внутрішню систему для бізнес-центру, що обʼєднує сервіси для орендарів: прибирання, контроль доступу, керування паркінгом, аналітику та бронювання залів для заходів.',
            'Працював над офтальмологічною MedTech-платформою: візуалізація сканів сітківки, медичні картки пацієнтів, аналіз ризику захворювань на основі AI та кольорові маски шарів.',
            'Реалізував оптимізоване InsurTech-рішення з генерацією страхових PDF на фронтенді, що зменшило навантаження на бек-офіс і завдяки автоматизації пришвидшило оформлення автостраховок.',
            'Розробив платформу бронювання круїзів Балтійським морем із повними туристичними пакетами: маршрути круїзів, послуги на борту та бронювання готелів.',
          ],
        },
      },
      {
        title: {
          en: 'WordPress Developer',
          uk: 'WordPress Developer',
        },
        org: 'Tallium Inc.',
        type: {
          en: '',
          uk: '',
        },
        period: {
          en: 'Mar 2021 — Mar 2022 · 1 yr 1 mo',
          uk: 'бер. 2021 — бер. 2022 · 1 р. 1 міс.',
        },
        location: {
          en: 'On-site · Kyiv, Ukraine',
          uk: 'В офісі · Київ, Україна',
        },
        bullets: {
          en: [
            'Creation of informational sites and landing pages.',
            'Website integration to CMS WordPress.',
            'Website deployment to hosting.',
            'Supporting projects.',
          ],
          uk: [
            'Створення інформаційних сайтів і лендингів.',
            'Інтеграція сайтів із CMS WordPress.',
            'Розгортання сайтів на хостингу.',
            'Підтримка проєктів.',
          ],
        },
      },
      {
        title: {
          en: 'WordPress Developer',
          uk: 'WordPress Developer',
        },
        org: 'Laconic Design',
        type: {
          en: 'Full-time',
          uk: 'Повна зайнятість',
        },
        period: {
          en: 'Jan 2020 — Mar 2021 · 1 yr 3 mos',
          uk: 'січ. 2020 — бер. 2021 · 1 р. 3 міс.',
        },
        location: {
          en: 'Ukraine',
          uk: 'Україна',
        },
        bullets: {
          en: [
            'Creation of landing pages.',
            'Creation of informational sites.',
            'Website integration to CMS WordPress.',
            'Website deployment to hosting.',
            'Supporting projects.',
          ],
          uk: [
            'Створення лендингів.',
            'Створення інформаційних сайтів.',
            'Інтеграція сайтів із CMS WordPress.',
            'Розгортання сайтів на хостингу.',
            'Підтримка проєктів.',
          ],
        },
      },
    ],
  },
  recommendations: {
    items: [
      {
        name: {
          en: 'Kateryna Shcherbak',
          uk: 'Катерина Щербак',
        },
        role: {
          en: 'Senior Project Manager · Tallium Inc.',
          uk: 'Senior Project Manager · Tallium Inc.',
        },
        relation: {
          en: 'Managed Vladyslav directly · Jun 2026',
          uk: 'Безпосередня керівниця Владислава · черв. 2026',
        },
        quote: {
          en: [
            "Working with Vladyslav over a 5-month project was a genuinely great experience. He's a highly skilled front-end developer who also led our team with confidence — proactively improving the product, committing to team success, and setting a strong example throughout.",
            "What sets him apart is the balance he brings: he's ambitious and eager to learn, yet always grounded and analytical when it matters. He embraces new challenges without losing sight of what the project actually needs.",
            "Strong technically, excellent soft skills, and a real team player. I'd recommend Vladyslav without hesitation.",
          ],
          uk: [
            'Пʼять місяців роботи з Владиславом над проєктом були справді чудовим досвідом. Він висококваліфікований фронтенд-розробник, який до того ж упевнено керував нашою командою — проактивно покращував продукт, був відданий спільному успіху й увесь час подавав гідний приклад.',
            'Його вирізняє баланс: він амбітний і прагне вчитися, але водночас завжди виважений і аналітичний, коли це справді важливо. Він охоче береться за нові виклики, не втрачаючи з поля зору того, що насправді потрібно проєкту.',
            'Сильний технічно, з чудовими soft skills і справжній командний гравець. Без вагань рекомендую Владислава.',
          ],
        },
      },
      {
        name: {
          en: 'Artem Kazka',
          uk: 'Артем Казка',
        },
        role: {
          en: 'Senior Project Manager / Scrum Master · Tallium Inc.',
          uk: 'Senior Project Manager / Scrum Master · Tallium Inc.',
        },
        relation: {
          en: 'Managed Vladyslav directly · Feb 2026',
          uk: 'Безпосередній керівник Владислава · лют. 2026',
        },
        quote: {
          en: [
            'I had the pleasure of working with Vladyslav on a complex FinTech project, where he demonstrated strong professionalism and technical expertise as a Front-End Developer.',
            'Vladyslav consistently proved himself to be a reliable and forward-thinking engineer. He approaches challenges thoughtfully and is always able to propose multiple solutions to a problem, carefully considering trade-offs and best outcomes. His ability to think ahead and anticipate potential issues significantly contributed to the stability of our product.',
            'He is also highly adaptable and open to innovation. Whenever there was a need to adopt new technologies, Vladyslav proactively took the initiative and implemented them following industry best practices.',
            'I would confidently recommend Vladyslav as a skilled, versatile, and growth-oriented Front-End Developer.',
          ],
          uk: [
            'Мав задоволення працювати з Владиславом над складним FinTech-проєктом, де він як фронтенд-розробник продемонстрував високий професіоналізм і технічну експертизу.',
            'Владислав незмінно показував себе надійним і далекоглядним інженером. Він вдумливо підходить до викликів і завжди може запропонувати кілька варіантів розвʼязання проблеми, ретельно зважуючи компроміси та найкращі результати. Його вміння думати наперед і передбачати можливі проблеми суттєво вплинуло на стабільність нашого продукту.',
            'Крім того, він легко адаптується та відкритий до інновацій. Щоразу, коли потрібно було впровадити нові технології, Владислав проактивно брав ініціативу на себе й реалізовував їх відповідно до найкращих галузевих практик.',
            'Упевнено рекомендую Владислава як кваліфікованого, різнобічного й орієнтованого на розвиток фронтенд-розробника.',
          ],
        },
      },
      {
        name: {
          en: 'Viktoriia Nekrasova',
          uk: 'Вікторія Некрасова',
        },
        role: {
          en: 'React Developer · Tallium Inc.',
          uk: 'React Developer · Tallium Inc.',
        },
        relation: {
          en: 'Worked on the same team · Oct 2023',
          uk: 'Працювали в одній команді · жовт. 2023',
        },
        quote: {
          en: [
            "I worked with Vladyslav on the project for six months and was impressed with his level of knowledge and skills. He quickly navigates through other people's code and helps you find things you didn't notice. He explains his decisions well and helps to solve problems. Best partner!",
          ],
          uk: [
            'Я працювала з Владиславом над проєктом пів року, і мене вразив рівень його знань і навичок. Він швидко орієнтується в чужому коді та допомагає знайти те, чого ти не помітив. Він добре пояснює свої рішення й допомагає розвʼязувати проблеми. Найкращий напарник!',
          ],
        },
      },
    ],
  },
} satisfies Record<string, FieldValues>;

const { industries, experience, recommendations } = DEFAULT_GROUPS;

export const DEFAULT_PAGE_CONTENT: Record<PageKey, PageContent> = {
  home: {
    title: {
      en: 'Home',
      uk: 'Головна',
    },
    seo: {
      title: {
        en: 'Vladyslav Tsyvinda',
        uk: 'Владислав Цивінда',
      },
      socialTitle: {
        en: 'Vladyslav Tsyvinda',
        uk: 'Владислав Цивінда',
      },
      description: {
        en: 'Vladyslav Tsyvinda — Full-Stack Lead Developer with 6+ years building scalable React, Next.js, and TypeScript products across MedTech, FinTech, PropTech, TravelTech, and EdTech.',
        uk: 'Владислав Цивінда — Full-Stack Lead Developer із понад 6 роками досвіду створення масштабованих продуктів на React, Next.js і TypeScript у сферах MedTech, FinTech, PropTech, TravelTech та EdTech.',
      },
      keywords: {
        en: '',
        uk: '',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: 'f783acfa-c2ae-45d6-8e99-a326fdab5864',
        type: 'homeHero',
        anchor: null,
        data: {
          firstName: {
            en: 'Vladyslav',
            uk: 'Владислав',
          },
          lastName: {
            en: 'Tsyvinda',
            uk: 'Цивінда',
          },
          rolePrimary: {
            en: 'Software Engineer',
            uk: 'Software Engineer',
          },
          roleSecondary: {
            en: 'Full-Stack Lead Developer at Tallium Inc.',
            uk: 'Full-Stack Lead Developer у Tallium Inc.',
          },
          avatarAlt: {
            en: 'Vladyslav Tsyvinda',
            uk: 'Владислав Цивінда',
          },
          contactLabel: {
            en: 'Get in touch',
            uk: 'Звʼязатися',
          },
          contactAriaLabel: {
            en: 'Get in touch with Vladyslav Tsyvinda',
            uk: 'Звʼязатися з Владиславом Цивіндою',
          },
          contactLink: 'contacts',
          aboutLabel: {
            en: 'More about me',
            uk: 'Більше про мене',
          },
          aboutLink: 'about',
          scrollLabel: {
            en: 'Scroll',
            uk: 'Гортайте',
          },
        },
      },
      {
        id: '82de3ed3-ca87-4e5e-84fc-02c0e009ac71',
        type: 'homeAbout',
        anchor: null,
        data: {
          industries,
          tag: '01',
          title: {
            en: 'Who I am',
            uk: 'Хто я',
          },
          lede: {
            en: 'A full-stack lead who ships production-grade React and Next.js at scale.',
            uk: 'Full-stack лід, який створює продакшн-рішення на React і Next.js у великому масштабі.',
          },
          lead: {
            en: 'Six years building scalable products across MedTech, FinTech, PropTech, TravelTech and EdTech — from full-stack architecture to lead delivery.',
            uk: 'Шість років створюю масштабовані продукти у сферах MedTech, FinTech, PropTech, TravelTech та EdTech — від full-stack архітектури до керування розробкою.',
          },
        },
      },
      {
        id: 'b79ae835-6607-485d-940b-f1d67fcbcfb7',
        type: 'homeExperience',
        anchor: null,
        data: {
          experience,
          tag: '02',
          title: {
            en: "Where I've worked",
            uk: 'Де я працював',
          },
          lede: {
            en: 'Recent roles across lead, frontend, and full-stack delivery.',
            uk: 'Останні ролі: лідерство, фронтенд і full-stack розробка.',
          },
          count: 3,
          seeAllLabel: {
            en: 'See full experience',
            uk: 'Увесь досвід',
          },
          seeAllLink: 'about',
        },
      },
      {
        id: '63774d31-6025-4741-9cbf-9df3fa3b4bbb',
        type: 'homeRecommendation',
        anchor: null,
        data: {
          recommendations,
          tag: '03',
          title: {
            en: 'What people say',
            uk: 'Що про мене кажуть',
          },
          lede: {
            en: "A word from someone I've worked closely with.",
            uk: 'Слово від людини, з якою я тісно співпрацював.',
          },
          position: 1,
        },
      },
      {
        id: '4810272b-bff1-469a-851d-5742adaa3595',
        type: 'homeContact',
        anchor: null,
        data: {
          tag: '04',
          title: {
            en: "Let's talk",
            uk: 'Поговорімо',
          },
          lede: {
            en: 'Open to new projects — reach me on any channel.',
            uk: 'Відкритий до нових проєктів — пишіть у будь-який зручний канал.',
          },
          buttonLabel: {
            en: 'Get in touch',
            uk: 'Звʼязатися',
          },
          buttonAriaLabel: {
            en: 'Get in touch with Vladyslav Tsyvinda',
            uk: 'Звʼязатися з Владиславом Цивіндою',
          },
          buttonLink: 'contacts',
        },
      },
    ],
  },
  about: {
    title: {
      en: 'About',
      uk: 'Про мене',
    },
    seo: {
      title: {
        en: 'About',
        uk: 'Про мене',
      },
      socialTitle: {
        en: 'About — Vladyslav Tsyvinda',
        uk: 'Про мене — Владислав Цивінда',
      },
      description: {
        en: 'Full-Stack Lead Developer with 6+ years delivering scalable React, Next.js, and TypeScript products across MedTech, FinTech, PropTech, TravelTech, and EdTech industries.',
        uk: 'Full-Stack Lead Developer із понад 6 роками досвіду створення масштабованих продуктів на React, Next.js і TypeScript у сферах MedTech, FinTech, PropTech, TravelTech та EdTech.',
      },
      keywords: {
        en: 'Vladyslav Tsyvinda about, Bardin28, Software Engineer, Front-end Lead, Frontend Developer, React engineer, Next.js engineer, TypeScript engineer, Kyiv Software Engineer, Ukrainian frontend developer',
        uk: 'Владислав Цивінда, Vladyslav Tsyvinda, Bardin28, Software Engineer, Front-end Lead, фронтенд-розробник, React-розробник, Next.js-розробник, TypeScript-розробник, програміст Київ, український фронтенд-розробник',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: '8111b887-178b-45f1-83ec-2eb4ff4ad85f',
        type: 'aboutHero',
        anchor: null,
        data: {
          industries,
          headlineFirst: {
            en: 'Software',
            uk: 'Software',
          },
          headlineSecond: {
            en: 'Engineer',
            uk: 'Engineer',
          },
          lead: {
            en: 'Hands-on experience delivering scalable solutions across <accent>MedTech, FinTech, PropTech, TravelTech</accent> and <accent>EdTech</accent> industries.',
            uk: 'Практичний досвід створення масштабованих рішень у сферах <accent>MedTech, FinTech, PropTech, TravelTech</accent> та <accent>EdTech</accent>.',
          },
          avatarAlt: {
            en: 'Vladyslav Tsyvinda',
            uk: 'Владислав Цивінда',
          },
        },
      },
      {
        id: '96f21d27-2761-4d5c-be24-d6c8686decee',
        type: 'aboutStack',
        anchor: 'stack',
        data: {
          tag: '01',
          title: {
            en: 'Stack',
            uk: 'Стек',
          },
          lede: {
            en: 'Tools I reach for daily — from markup to delivery.',
            uk: 'Інструменти, якими я користуюся щодня, — від верстки до релізу.',
          },
          groups: [
            {
              name: {
                en: 'Markup',
                uk: 'Верстка',
              },
              items: ['HTML5', 'Pug', 'CSS3', 'CSS Modules', 'SCSS'],
            },
            {
              name: {
                en: 'Languages',
                uk: 'Мови',
              },
              items: ['JavaScript', 'TypeScript', 'PHP'],
            },
            {
              name: {
                en: 'Frameworks',
                uk: 'Фреймворки',
              },
              items: [
                'React',
                'Next.js',
                'Redux-Saga',
                'Redux-Toolkit',
                'Node.js',
                'Express',
                'NestJS',
              ],
            },
            {
              name: {
                en: 'Data',
                uk: 'Дані',
              },
              items: ['GraphQL', 'Apollo Client', 'Apollo Server', 'MongoDB'],
            },
            {
              name: {
                en: 'Testing',
                uk: 'Тестування',
              },
              items: ['Jest', 'Playwright', 'Storybook'],
            },
            {
              name: {
                en: 'Tooling',
                uk: 'Інструменти',
              },
              items: ['Git', 'GitHub', 'GitLab', 'Webpack', 'Gulp', 'Docker', 'Claude Code'],
            },
            {
              name: {
                en: 'Design',
                uk: 'Дизайн',
              },
              items: ['Figma', 'Photoshop'],
            },
            {
              name: {
                en: 'Infra',
                uk: 'Інфраструктура',
              },
              items: ['Digital Ocean', 'GoDaddy'],
            },
          ],
        },
      },
      {
        id: '47b9d486-6324-400d-a2c8-9eb353c13f6f',
        type: 'aboutExperience',
        anchor: 'experience',
        data: {
          experience,
          tag: '02',
          title: {
            en: 'Experience',
            uk: 'Досвід',
          },
          lede: {
            en: 'Six years of frontend, lead, and full-stack delivery.',
            uk: 'Шість років фронтенд-, full-stack розробки та лідерства в командах.',
          },
        },
      },
      {
        id: 'd8ce4445-6883-4be4-b21a-7f29713063d7',
        type: 'aboutRecommendations',
        anchor: 'recommendations',
        data: {
          recommendations,
          tag: '03',
          title: {
            en: 'Recommendations',
            uk: 'Рекомендації',
          },
          lede: {
            en: 'What teammates and managers say about working with me.',
            uk: 'Що кажуть колеги й менеджери про роботу зі мною.',
          },
        },
      },
      {
        id: '039fead1-42c4-448b-99d1-24145783d840',
        type: 'aboutEducation',
        anchor: 'education',
        data: {
          tag: '04',
          title: {
            en: 'Education',
            uk: 'Освіта',
          },
          lede: {
            en: 'Formal background and active credentials.',
            uk: 'Формальна освіта та чинні кваліфікації.',
          },
          items: [
            {
              school: {
                en: 'State University of Information and Communication Technologies',
                uk: 'Державний університет інформаційно-комунікаційних технологій',
              },
              degree: {
                en: "Master's degree · Computer Software Engineering",
                uk: 'Магістр · Інженерія програмного забезпечення',
              },
              period: {
                en: 'Sep 2024 — Jan 2026',
                uk: 'вер. 2024 — січ. 2026',
              },
              skills: {
                en: ['Amazon Web Services (AWS)', 'Google Cloud Platform (GCP)', 'Risk Management'],
                uk: [
                  'Amazon Web Services (AWS)',
                  'Google Cloud Platform (GCP)',
                  'Управління ризиками',
                ],
              },
            },
            {
              school: {
                en: 'State University of Trade and Economics',
                uk: 'Державний торговельно-економічний університет',
              },
              degree: {
                en: "Bachelor's degree · Hotel, Motel, and Restaurant Management",
                uk: 'Бакалавр · Готельно-ресторанна справа',
              },
              period: {
                en: '2016 — 2021',
                uk: '2016 — 2021',
              },
              skills: {
                en: [],
                uk: [],
              },
            },
          ],
        },
      },
      {
        id: '19c7d9a9-db18-4fe2-b4ec-95d82b4ca4e2',
        type: 'ctaBanner',
        anchor: null,
        data: {
          title: {
            en: 'Let’s build something.',
            uk: 'Створімо щось разом.',
          },
          text: {
            en: 'Open to discuss new projects. Reach me on any channel below.',
            uk: 'Відкритий до обговорення нових проєктів. Пишіть у будь-який канал нижче.',
          },
          linkLabel: {
            en: 'Get in touch',
            uk: 'Звʼязатися',
          },
          link: 'contacts',
        },
      },
    ],
  },
  contacts: {
    title: {
      en: 'Contacts',
      uk: 'Контакти',
    },
    seo: {
      title: {
        en: 'Contacts',
        uk: 'Контакти',
      },
      socialTitle: {
        en: 'Contacts — Vladyslav Tsyvinda',
        uk: 'Контакти — Владислав Цивінда',
      },
      description: {
        en: 'Get in touch with Vladyslav Tsyvinda — Full-Stack Lead Developer. Reach out on LinkedIn, Telegram, or by email.',
        uk: 'Звʼяжіться з Владиславом Цивіндою — Full-Stack Lead Developer. Пишіть у LinkedIn, Telegram або на email.',
      },
      keywords: {
        en: 'Vladyslav Tsyvinda contact, Bardin28 contact, hire frontend developer, contact React engineer, contact Next.js developer, Vladyslav Tsyvinda email, Vladyslav Tsyvinda LinkedIn',
        uk: 'Владислав Цивінда контакти, Vladyslav Tsyvinda contact, Bardin28, найняти фронтенд-розробника, звʼязатися з React-розробником, звʼязатися з Next.js-розробником, Владислав Цивінда email, Владислав Цивінда LinkedIn',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: '61d245c1-662c-4f23-b058-14898eb6ce1f',
        type: 'contactsHero',
        anchor: null,
        data: {
          title: {
            en: 'Let’s <accent>work together</accent>',
            uk: 'Працюймо <accent>разом</accent>',
          },
          lead: {
            en: 'Based in <accent>Kyiv, Ukraine</accent>, and work with teams across time zones. <br></br>Open to new projects and collaboration — reach me on any channel below and I’ll usually reply within a day.',
            uk: 'Я живу в <accent>Києві, Україна</accent>, і працюю з командами з різних часових поясів. <br></br>Відкритий до нових проєктів і співпраці — пишіть у будь-який канал нижче, зазвичай відповідаю протягом дня.',
          },
          mapLabel: {
            en: 'Map of Kyiv, Ukraine showing the city border',
            uk: 'Мапа Києва з позначеними межами міста',
          },
        },
      },
      {
        id: 'bcaddbca-87cf-4992-855a-202355393012',
        type: 'contactChannels',
        anchor: null,
        data: {},
      },
    ],
  },
  blog: {
    title: {
      en: 'Blog',
      uk: 'Блог',
    },
    seo: {
      title: {
        en: 'Blog',
        uk: 'Блог',
      },
      socialTitle: {
        en: 'Blog — Vladyslav Tsyvinda',
        uk: 'Блог — Владислав Цивінда',
      },
      description: {
        en: 'Notes on frontend engineering, React, Next.js, TypeScript, and product delivery from Vladyslav Tsyvinda.',
        uk: 'Нотатки Владислава Цивінди про фронтенд-розробку, React, Next.js, TypeScript і доставку продуктів.',
      },
      keywords: {
        en: 'Vladyslav Tsyvinda blog, Frontend engineering, React, Next.js, TypeScript, Software engineering notes, Web development blog',
        uk: 'блог Владислава Цивінди, фронтенд-розробка, React, Next.js, TypeScript, нотатки інженера, блог про веброзробку',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: 'c3d5487e-c609-40bd-a32c-2d9de056071f',
        type: 'blogHero',
        anchor: null,
        data: {
          titleStart: {
            en: 'Notes on',
            uk: 'Нотатки про',
          },
          titleAccent: {
            en: 'building software',
            uk: 'створення софту',
          },
          lead: {
            en: 'Articles on frontend engineering, React, Next.js, TypeScript, and shipping production-grade web products.',
            uk: 'Статті про фронтенд-розробку, React, Next.js, TypeScript і запуск вебпродуктів продакшн-рівня.',
          },
        },
      },
      {
        id: '3a902c82-5541-4f16-a603-01e1f0eae122',
        type: 'blogFeed',
        anchor: null,
        data: {},
      },
      {
        id: '079484f6-3a76-4a8c-8564-b2ca45bc5d1c',
        type: 'blogTopics',
        anchor: null,
        data: {
          heading: {
            en: 'What I write about',
            uk: 'Про що я пишу',
          },
          intro: {
            en: 'Posts here are practical rather than theoretical: problems hit on real client projects, the options weighed, what got chosen, and what it cost. Expect code, numbers, and the occasional retraction when a decision aged badly. Published when there is something worth writing down, not on a schedule.',
            uk: 'Тут — практика, а не теорія: проблеми з реальних клієнтських проєктів, варіанти, які ми зважували, що обрали і чого це коштувало. Буде код, цифри й інколи визнання помилок, коли рішення погано витримало час. Пишу, коли є що записати, а не за розкладом.',
          },
          topics: [
            {
              title: {
                en: 'React & Next.js in production',
                uk: 'React і Next.js у продакшні',
              },
              description: {
                en: 'App Router patterns, server and client component boundaries, data fetching, caching and revalidation, and the trade-offs behind rendering strategies on real products.',
                uk: 'Патерни App Router, межі між серверними та клієнтськими компонентами, отримання даних, кешування й ревалідація, а також компроміси стратегій рендерингу на реальних продуктах.',
              },
            },
            {
              title: {
                en: 'TypeScript at scale',
                uk: 'TypeScript у масштабі',
              },
              description: {
                en: 'Typing API layers and shared contracts, keeping generics readable, and the conventions that keep a growing codebase reviewable instead of clever.',
                uk: "Типізація API-шару та спільних контрактів, читабельні generics і домовленості, завдяки яким кодову базу, що росте, легко рев'юїти, а не захоплюватися її хитромудрістю.",
              },
            },
            {
              title: {
                en: 'Frontend architecture',
                uk: 'Фронтенд-архітектура',
              },
              description: {
                en: 'Folder conventions, state management with Redux Toolkit and React Query, design systems in Storybook, and where abstractions actually pay for themselves.',
                uk: 'Структура папок, керування станом через Redux Toolkit і React Query, дизайн-системи у Storybook і місця, де абстракції справді окуповуються.',
              },
            },
            {
              title: {
                en: 'Performance & Core Web Vitals',
                uk: 'Продуктивність і Core Web Vitals',
              },
              description: {
                en: 'Bundle budgets, image and font strategy, animation without jank, WebGL scenes that clean up after themselves, and measuring LCP, INP, and CLS on real devices.',
                uk: 'Бюджети бандла, стратегія для зображень і шрифтів, анімації без ривків, WebGL-сцени, що прибирають за собою, і вимірювання LCP, INP та CLS на реальних пристроях.',
              },
            },
            {
              title: {
                en: 'Testing & delivery',
                uk: 'Тестування й доставка',
              },
              description: {
                en: 'Jest and Testing Library where they earn their keep, end-to-end coverage of critical flows, Docker builds, and CI pipelines that stay fast enough to trust.',
                uk: 'Jest і Testing Library там, де вони виправдані, end-to-end покриття критичних сценаріїв, Docker-збірки та CI-пайплайни, достатньо швидкі, щоб їм довіряти.',
              },
            },
            {
              title: {
                en: 'Team & engineering practice',
                uk: 'Команда й інженерні практики',
              },
              description: {
                en: 'Lessons from leading frontend teams — code review that catches real problems, estimation that survives contact with a deadline, and shipping without burning the team.',
                uk: "Уроки керування фронтенд-командами — код-рев'ю, що ловить справжні проблеми, оцінки, які витримують зустріч із дедлайном, і релізи без вигорання команди.",
              },
            },
          ],
        },
      },
    ],
  },
  'privacy-policy': {
    title: {
      en: 'Privacy Policy',
      uk: 'Політика конфіденційності',
    },
    seo: {
      title: {
        en: 'Privacy Policy',
        uk: 'Політика конфіденційності',
      },
      socialTitle: {
        en: 'Privacy Policy — Vladyslav Tsyvinda',
        uk: 'Політика конфіденційності — Владислав Цивінда',
      },
      description: {
        en: 'How tsyvinda.com collects, uses, stores, and protects personal data, including cookies, accounts, third-party services, and contact details.',
        uk: 'Як tsyvinda.com збирає, використовує, зберігає та захищає персональні дані, зокрема файли cookie, облікові записи, сторонні сервіси й контактні дані.',
      },
      keywords: {
        en: '',
        uk: '',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: '567fbf26-a571-4683-bdea-629320a2ce82',
        type: 'legalHeader',
        anchor: null,
        data: {
          title: {
            en: 'Privacy Policy',
            uk: 'Політика конфіденційності',
          },
          lastUpdatedLabel: {
            en: 'Last updated:',
            uk: 'Останнє оновлення:',
          },
          updatedAt: '2026-08-06',
        },
      },
      {
        id: 'dda2c698-a18d-443c-90b0-f6cdd01cb435',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: '',
            uk: '',
          },
          html: {
            en: '<p>Welcome to <strong>tsyvinda.com</strong>.</p><p>By accessing or using this website, you acknowledge that you have read and accepted this Privacy Policy and the terms described below. If you do not agree with these terms, please leave the website and discontinue its use.</p><p>This website may collect information that you voluntarily provide, including your name, email address, and any information you submit through forms or other features. In addition, technical information such as your IP address, browser, operating system, device type, and anonymous usage statistics may be collected automatically.</p><p>The information collected is used to maintain the website, improve its functionality, analyze usage, enhance the user experience, detect abuse, and develop new features. Your information is not sold for advertising or marketing purposes.</p><p>All personal data is securely stored on servers located within the <strong>European Union (EU)</strong>. Appropriate technical and organizational measures are implemented to protect your information from unauthorized access, alteration, or loss. While every reasonable effort is made to ensure security, no online service can guarantee absolute protection.</p><p>In certain circumstances, your information may be shared with trusted third parties when reasonably necessary to operate the website, provide infrastructure or analytics services, comply with legal obligations, or protect the rights and security of the website and its users.</p><p>This website uses cookies and similar technologies to work properly, remember your language and, only with your consent, collect anonymous analytics. Which cookies are used, and how to change your choice at any time, is explained in the <a href="page:cookie-policy">Cookie Policy</a>.</p><p>The website provides the ability to create a user account. Registration does <strong>not</strong> guarantee access to all features of the website. Certain functionality, including but not limited to publishing content, creating public materials, or accessing restricted areas, may require additional approval, verification, invitation, or may remain unavailable at the sole discretion of the website administrator.</p><p>The website owner reserves the right to suspend, restrict, or terminate access to any account or feature at any time, with or without prior notice, where permitted by applicable law.</p><p>Any disputes, claims, or legal proceedings arising from the use of this website or this Privacy Policy shall be governed by the laws of <strong>Ukraine</strong> and resolved exclusively by the competent courts of Ukraine.</p><p>If you have any questions, requests, or concerns regarding this Privacy Policy or your personal data, you may contact:</p><p><a href="mailto:bardindeveloper@gmail.com"><strong>bardindeveloper@gmail.com</strong></a></p><p>This Privacy Policy may be updated at any time. The latest version will always be available on this page, and continued use of the website after changes are published constitutes acceptance of the updated policy.</p>',
            uk: '<p>Вітаємо на <strong>tsyvinda.com</strong>.</p><p>Відвідуючи цей вебсайт або користуючись ним, ви підтверджуєте, що ознайомилися з цією Політикою конфіденційності та умовами, викладеними нижче, і приймаєте їх. Якщо ви не погоджуєтеся з цими умовами, будь ласка, залиште вебсайт і припиніть ним користуватися.</p><p>Цей вебсайт може збирати інформацію, яку ви надаєте добровільно, зокрема ваше імʼя, адресу електронної пошти та будь-які дані, які ви надсилаєте через форми чи інші функції. Крім того, автоматично може збиратися технічна інформація: ваша IP-адреса, браузер, операційна система, тип пристрою та анонімна статистика використання.</p><p>Зібрана інформація використовується для підтримки роботи вебсайту, покращення його функціональності, аналізу використання, покращення користувацького досвіду, виявлення зловживань і розробки нових функцій. Ваша інформація не продається з рекламною чи маркетинговою метою.</p><p>Усі персональні дані надійно зберігаються на серверах, розташованих у <strong>Європейському Союзі (ЄС)</strong>. Для захисту вашої інформації від несанкціонованого доступу, зміни чи втрати вжито належних технічних та організаційних заходів. Хоча для забезпечення безпеки докладаються всі розумні зусилля, жоден онлайн-сервіс не може гарантувати абсолютного захисту.</p><p>За певних обставин вашу інформацію може бути передано надійним третім сторонам, якщо це обґрунтовано необхідно для роботи вебсайту, надання інфраструктурних чи аналітичних послуг, виконання вимог законодавства або захисту прав і безпеки вебсайту та його користувачів.</p><p>Сайт використовує cookie та подібні технології, щоб працювати належним чином, запамʼятовувати вашу мову та — лише з вашої згоди — збирати анонімну аналітику. Які саме cookie використовуються і як будь-коли змінити свій вибір, пояснено в <a href="page:cookie-policy">Політиці cookie</a>.</p><p>Вебсайт надає можливість створити обліковий запис користувача. Реєстрація <strong>не</strong> гарантує доступу до всіх функцій вебсайту. Окремі функції, зокрема, але не виключно, публікація контенту, створення публічних матеріалів або доступ до закритих розділів, можуть потребувати додаткового схвалення, перевірки, запрошення або залишатися недоступними на власний розсуд адміністратора вебсайту.</p><p>Власник вебсайту залишає за собою право будь-коли призупинити, обмежити або припинити доступ до будь-якого облікового запису чи функції з попереднім повідомленням або без нього, якщо це дозволено чинним законодавством.</p><p>Будь-які спори, претензії чи судові провадження, що виникають у звʼязку з використанням цього вебсайту або цієї Політики конфіденційності, регулюються законодавством <strong>України</strong> і розглядаються виключно компетентними судами України.</p><p>Якщо у вас є запитання, запити чи занепокоєння щодо цієї Політики конфіденційності або ваших персональних даних, ви можете звернутися на адресу:</p><p><a href="mailto:bardindeveloper@gmail.com"><strong>bardindeveloper@gmail.com</strong></a></p><p>Цю Політику конфіденційності може бути оновлено в будь-який час. Актуальна версія завжди доступна на цій сторінці, а продовження користування вебсайтом після публікації змін означає згоду з оновленою політикою.</p>',
          },
        },
      },
    ],
  },
  'cookie-policy': {
    title: {
      en: 'Cookie Policy',
      uk: 'Політика cookie',
    },
    seo: {
      title: {
        en: 'Cookie Policy',
        uk: 'Політика cookie',
      },
      socialTitle: {
        en: 'Cookie Policy — Vladyslav Tsyvinda',
        uk: 'Політика cookie — Владислав Цивінда',
      },
      description: {
        en: 'Which cookies and similar technologies tsyvinda.com uses, why, for how long, and how to change your cookie choice at any time.',
        uk: 'Які cookie та подібні технології використовує tsyvinda.com, навіщо, як довго, і як будь-коли змінити свій вибір щодо cookie.',
      },
      keywords: {
        en: '',
        uk: '',
      },
      ogImageUrl: null,
      noindex: false,
    },
    blocks: [
      {
        id: '241486b3-2d09-4c06-ae86-a71e1eae4962',
        type: 'legalHeader',
        anchor: null,
        data: {
          title: {
            en: 'Cookie Policy',
            uk: 'Політика cookie',
          },
          lastUpdatedLabel: {
            en: 'Last updated:',
            uk: 'Останнє оновлення:',
          },
          updatedAt: '2026-11-13',
        },
      },
      {
        id: '4e9ec7b5-3ee0-4cfe-a382-f12f8a079f08',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: '',
            uk: '',
          },
          html: {
            en: '<p>This Cookie Policy explains how <strong>tsyvinda.com</strong> uses cookies and similar technologies, what each of them does and how you can control them. It complements the <a href="page:privacy-policy">Privacy Policy</a>.</p>',
            uk: '<p>Ця Політика cookie пояснює, як <strong>tsyvinda.com</strong> використовує cookie та подібні технології, для чого кожна з них потрібна і як ви можете ними керувати. Вона доповнює <a href="page:privacy-policy">Політику конфіденційності</a>.</p>',
          },
        },
      },
      {
        id: 'e8832300-5813-4130-abc1-598259025f21',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: 'What are cookies?',
            uk: 'Що таке cookie?',
          },
          html: {
            en: '<p>Cookies are small text files a website stores in your browser. Similar technologies, such as localStorage, keep data in the browser in the same way. They let a site remember things between pages and visits, for example that you are signed in or which language you chose.</p>',
            uk: '<p>Cookie — це невеликі текстові файли, які сайт зберігає у вашому браузері. Подібні технології, як-от localStorage, так само зберігають дані в браузері. Вони дозволяють сайту запамʼятовувати інформацію між сторінками та візитами, наприклад, що ви увійшли в обліковий запис або яку мову обрали.</p>',
          },
        },
      },
      {
        id: '1f4af33a-90d4-4691-96f6-5c5582068117',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: 'Types of cookies we use',
            uk: 'Які типи cookie ми використовуємо',
          },
          html: {
            en: '<p><strong>Strictly necessary.</strong> Required for the site to work and to stay secure: they remember your cookie choice and your language, keep you signed in if you use an account, and let Cloudflare protect the site from bots and abuse. They are always on and are not used to track you.</p><p><strong>Analytics.</strong> Google Analytics counts visits and shows which pages are read, in aggregate. It is loaded only if you allow analytics cookies; until then nothing is requested from Google. You can withdraw your consent at any time, which stops Google Analytics and deletes its cookies.</p>',
            uk: '<p><strong>Обовʼязкові.</strong> Потрібні для роботи та безпеки сайту: запамʼятовують ваш вибір щодо cookie і вашу мову, підтримують вхід в обліковий запис, якщо ви ним користуєтеся, і дають Cloudflare захищати сайт від ботів і зловживань. Вони завжди увімкнені й не використовуються для відстеження.</p><p><strong>Аналітичні.</strong> Google Analytics рахує відвідування та показує, які сторінки читають, у загальному вигляді. Він завантажується лише якщо ви дозволили аналітичні cookie; доти нічого не запитується з Google. Ви можете будь-коли відкликати згоду — це зупиняє Google Analytics і видаляє його cookie.</p>',
          },
        },
      },
      {
        id: '391fb2a2-a5e5-4c01-b4d1-eda646ba073a',
        type: 'cookieTable',
        anchor: null,
        data: {
          heading: {
            en: 'Cookies on this site',
            uk: 'Cookie на цьому сайті',
          },
          intro: {
            en: 'The table lists every cookie and browser storage key used by tsyvinda.com.',
            uk: 'У таблиці наведено всі cookie та ключі сховища браузера, які використовує tsyvinda.com.',
          },
        },
      },
      {
        id: '0e0a689e-4e57-496f-b92b-50df1cd48a56',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: 'Third parties',
            uk: 'Треті сторони',
          },
          html: {
            en: '<p>Some cookies are set by third parties: Google for analytics (see <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google\'s cookie policy</a>) and Cloudflare for security (see <a href="https://www.cloudflare.com/cookie-policy/" target="_blank" rel="noopener noreferrer">Cloudflare\'s cookie policy</a>). The contact map loads tiles from OpenStreetMap, and images are served from our CDN; neither sets cookies.</p>',
            uk: '<p>Деякі cookie встановлюють треті сторони: Google для аналітики (див. <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">політику cookie Google</a>) і Cloudflare для безпеки (див. <a href="https://www.cloudflare.com/cookie-policy/" target="_blank" rel="noopener noreferrer">політику cookie Cloudflare</a>). Карта на сторінці контактів завантажує плитки з OpenStreetMap, а зображення надходять з нашого CDN; жоден із них не встановлює cookie.</p>',
          },
        },
      },
      {
        id: '803770dd-3a43-4878-a096-3da1dc34a552',
        type: 'cookieSettings',
        anchor: null,
        data: {
          heading: {
            en: 'How to change your choice',
            uk: 'Як змінити свій вибір',
          },
          text: {
            en: 'You can change or withdraw your consent at any time with the button below or the "Cookie settings" link in the footer of every page. You can also delete cookies or block them in your browser settings; blocking strictly necessary cookies may stop parts of the site from working.',
            uk: 'Ви можете будь-коли змінити або відкликати згоду кнопкою нижче чи посиланням «Налаштування cookie» внизу кожної сторінки. Також cookie можна видалити або заблокувати в налаштуваннях браузера; блокування обовʼязкових cookie може порушити роботу частини сайту.',
          },
          buttonLabel: {
            en: 'Change cookie settings',
            uk: 'Змінити налаштування cookie',
          },
        },
      },
      {
        id: '29ee269a-cd80-4f32-a3b8-314779930055',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: 'Changes to this policy',
            uk: 'Зміни цієї політики',
          },
          html: {
            en: '<p>This policy is updated when the cookies used by the site change. The date at the top shows the latest version. When new optional cookies are added, you will be asked for consent again.</p>',
            uk: '<p>Політика оновлюється, коли змінюються cookie, які використовує сайт. Дата вгорі показує актуальну версію. Якщо зʼявляться нові необовʼязкові cookie, вас знову попросять про згоду.</p>',
          },
        },
      },
      {
        id: '781ca2f7-16fb-46a3-9ad8-8eddd4c8aa8b',
        type: 'richText',
        anchor: null,
        data: {
          heading: {
            en: 'Contact',
            uk: 'Контакти',
          },
          html: {
            en: '<p>Questions about cookies or your data can be sent to:</p><p><a href="mailto:bardindeveloper@gmail.com"><strong>bardindeveloper@gmail.com</strong></a></p>',
            uk: '<p>Питання щодо cookie або ваших даних можна надсилати на адресу:</p><p><a href="mailto:bardindeveloper@gmail.com"><strong>bardindeveloper@gmail.com</strong></a></p>',
          },
        },
      },
    ],
  },
} as unknown as Record<PageKey, PageContent>;
