window.NFC_CITY = window.NFC_CITY || {};

/**
 * ЕДИНЫЙ КОНФИГ ДОЖДЛИВОГО ГОРОДА
 * Здесь собраны все подписи районов, тексты, ссылки, звуковые атмосферы и секрет.
 */
window.NFC_CITY.CONFIG = {
  brand: {
    tag: "FLYCI // RAINY NIGHT",
    title: "FLyCi",
    subtitle: "машинка",
    startButton: "ЗАВЕСТИ МАШИНУ →"
  },

  districts: {
    about: {
      id: "about",
      badge: "DISTRICT 01 // ЦЕНТР",
      title: "ABOUT_ME.EXE",
      pill: "ABOUT // ЦЕНТР",
      color: "#d4a35d",
      initials: "0_0",
      name: "sweden(0_0)",
      tagline: "Arch Linux · Dota 2 · Rainy Night",
      files: {
        "bio.md": "// bio.md\nchill guy",
        "vibe.md": "// vibe.md\nСпокойная музыка, котики, kotl и пасмурные вечера без лишнего шума.",
        "city.md": "// city.md\nИнтерактивный город FLyCi — можно кататься, менять авто в гараже и искать секрет."
      }
    },

    vibes: {
      id: "vibes",
      badge: "DISTRICT 02 // СТАНЦИЯ",
      title: "VIBES // АТМОСФЕРА",
      pill: "VIBES // СТАНЦИЯ",
      color: "#a87278",
      description: "Выбери звуковой фон поездки — дождь, пиано или тихую трассу.",
      tracks: [
        { title: "Только ночной дождь", bpm: "RAIN", genre: "Шум дождя и редкий гром", preset: "rain_only" },
        { title: "Тёплое электропиано", bpm: "70 BPM", genre: "Спокойный Lo-Fi под дождём", preset: "lofi_piano" },
        { title: "Тихая ночная трасса", bpm: "AMBIENT", genre: "Мягкий атмосферный фон", preset: "night_ambient" }
      ],
      likes: ["kotl", "rain", "lilp", "7.36", "kotiki"]
    },

    contact: {
      id: "contact",
      badge: "DISTRICT 03 // НАБЕРЕЖНАЯ",
      title: "CONTACT // СВЯЗЬ",
      pill: "CONTACT // НАБЕРЕЖНАЯ",
      color: "#7c8c6e",
      description: "Профиль Steam — жми на карточку, чтобы открыть.",
      links: [
        { label: "Steam", handle: "sweden(0 0)", url: "https://steamcommunity.com/profiles/76561199152566558" }
      ]
    },

    setup: {
      id: "setup",
      badge: "DISTRICT 04 // КВАРТАЛ",
      title: "SETUP // ДЕТАЛИ",
      pill: "SETUP // КВАРТАЛ",
      color: "#b87c5d",
      tabs: [
        {
          id: "devices",
          label: "Девайсы",
          items: [
            { k: "Ноутбук", v: "Redmi Book 14 (TM2205)" },
            { k: "Телефон", v: "Samsung S21" }
          ]
        },
        {
          id: "os",
          label: "Система",
          items: [
            { k: "ОС", v: "Arch Linux" },
            { k: "Окна", v: "Hyprland (Wayland)" },
            { k: "Вход", v: "SDDM + hyprlock" }
          ]
        }
      ]
    },

    secret: {
      id: "secret",
      badge: "SECRET ALLEY // 04",
      title: "ТИХИЙ МАЯК (СЕКРЕТ)",
      pill: "★ ТИХИЙ МАЯК",
      color: "#e8c782",
      description: "Все 4 района открыты — во дворе за кольцом зажёгся тихий маяк.",
      reward: "Включены тёплые золотые фары и тихо играет: Lil Peep — ghost girl",
      note: "Пауза и громкость трека появились в правом нижнем углу. (При желании можно также положить свой audio/ghost-girl.mp3 для офлайн-воспроизведения.)",
      track: {
        title: "Lil Peep — ghost girl",
        localSrc: "audio/ghost-girl.mp3",
        youtubeId: "1Woqr8nhWrY",
        youtubeUrl: "https://www.youtube.com/watch?v=1Woqr8nhWrY",
        volume: 0.22
      }
    },

    garage: {
      id: "garage",
      badge: "GARAGE // SE-02",
      title: "ГАРАЖ // ВЫБОР АВТО",
      pill: "GARAGE // АВТО",
      color: "#a89d90",
      description: "Тёплый сухой бокс во внутреннем дворе: шум дождя приглушён крышей. Выбери машину под настроение поездки.",
      cars: [
        {
          id: "sedan",
          name: "Ночной Седан",
          desc: "Сбалансированный графитовый седан — комфортный и манёвренный.",
          len: 28,
          wid: 16,
          mass: 1.25,
          maxSpd: 268,
          accel: 345,
          color: "#6e6865",
          taxi: false
        },
        {
          id: "wagon",
          name: "Универсал",
          desc: "Тяжёлый оливковый кузов — уверенно толкает поток.",
          len: 32,
          wid: 17,
          mass: 1.75,
          maxSpd: 245,
          accel: 315,
          color: "#54614d",
          taxi: false
        },
        {
          id: "taxi",
          name: "Ночное Такси",
          desc: "Пыльно-охристый кузов с шашкой — заметный на плёнке.",
          len: 27,
          wid: 15,
          mass: 1.2,
          maxSpd: 282,
          accel: 365,
          color: "#c89b4f",
          taxi: true
        },
        {
          id: "coupe",
          name: "Дождевое Купе",
          desc: "Бордовое короткое купе — быстрое и резкое в поворотах.",
          len: 25,
          wid: 15,
          mass: 1.0,
          maxSpd: 308,
          accel: 405,
          color: "#7a474c",
          taxi: false
        }
      ],
      note: "Подъезжай в этот двор на юго-востоке в любой момент, чтобы сменить машину."
    }
  }
};
