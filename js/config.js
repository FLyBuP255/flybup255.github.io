window.NFC_CITY = window.NFC_CITY || {};

/**
 * Rainy-night interactive city config:
 * District labels, bio files, audio presets, secret track & garage specs.
 */
window.NFC_CITY.CONFIG = {
  brand: {
    tag: "FLYCI // RAINY NIGHT",
    title: "FLyCi",
    subtitle: "night ride",
    startButton: "START ENGINE →"
  },

  districts: {
    about: {
      id: "about",
      badge: "DISTRICT 01 // CENTER",
      title: "ABOUT_ME.EXE",
      pill: "ABOUT // CENTER",
      color: "#d4a35d",
      initials: "0_0",
      name: "sweden(0_0)",
      tagline: "Arch Linux · Dota 2 · Rainy Night",
      files: {
        "bio.md": "// bio.md\nchill guy",
        "vibe.md": "// vibe.md\nChill music, cats, kotl, and overcast evenings without the noise.",
        "city.md": "// city.md\nInteractive FLyCi city — cruise around, swap cars in the garage, and hunt down the secret."
      }
    },

    vibes: {
      id: "vibes",
      badge: "DISTRICT 02 // STATION",
      title: "VIBES // ATMOSPHERE",
      pill: "VIBES // STATION",
      color: "#a87278",
      description: "Pick your rainy-night soundtrack — pure rain, soft piano, or quiet highway.",
      tracks: [
        { title: "Night Rain Only", bpm: "RAIN", genre: "Steady rain & distant thunder", preset: "rain_only" },
        { title: "Warm Electric Piano", bpm: "70 BPM", genre: "Chill Lo-Fi in the rain", preset: "lofi_piano" },
        { title: "Quiet Night Highway", bpm: "AMBIENT", genre: "Soft atmospheric drone", preset: "night_ambient" }
      ],
      likes: ["kotl", "rain", "lilp", "7.36", "cats"]
    },

    contact: {
      id: "contact",
      badge: "DISTRICT 03 // HARBOR",
      title: "CONTACT // LINKS",
      pill: "CONTACT // HARBOR",
      color: "#7c8c6e",
      description: "Steam profile — tap the card to open.",
      links: [
        { label: "Steam", handle: "sweden(0 0)", url: "https://steamcommunity.com/profiles/76561199152566558" }
      ]
    },

    setup: {
      id: "setup",
      badge: "DISTRICT 04 // QUARTER",
      title: "SETUP // SPECS",
      pill: "SETUP // QUARTER",
      color: "#b87c5d",
      tabs: [
        {
          id: "devices",
          label: "Devices",
          items: [
            { k: "Laptop", v: "Redmi Book 14 (TM2205)" },
            { k: "Phone", v: "Samsung S21" }
          ]
        },
        {
          id: "os",
          label: "System",
          items: [
            { k: "OS", v: "Arch Linux" },
            { k: "WM", v: "Hyprland (Wayland)" },
            { k: "Login", v: "SDDM + hyprlock" }
          ]
        }
      ]
    },

    secret: {
      id: "secret",
      badge: "SECRET ALLEY // 04",
      title: "QUIET LIGHTHOUSE (SECRET)",
      pill: "★ QUIET LIGHTHOUSE",
      color: "#e8c782",
      description: "All 4 districts discovered — the quiet lighthouse beyond the ring has lit up.",
      reward: "Warm golden headlights enabled · now playing: Lil Peep — ghost girl",
      note: "Pause and volume controls appeared in the bottom-right corner.",
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
      title: "GARAGE // SELECT CAR",
      pill: "GARAGE // CARS",
      color: "#a89d90",
      description: "A warm dry bay inside the courtyard where the roof muffles the rain. Pick a car for the mood.",
      cars: [
        {
          id: "sedan",
          name: "Night Sedan",
          desc: "Balanced graphite sedan — smooth and agile.",
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
          name: "Estate Wagon",
          desc: "Heavy olive body — pushes through traffic with ease.",
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
          name: "Night Taxi",
          desc: "Dusty ochre cab with roof sign — impossible to miss in the rain.",
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
          name: "Rain Coupe",
          desc: "Short burgundy coupe — fast and sharp in the corners.",
          len: 25,
          wid: 15,
          mass: 1.0,
          maxSpd: 308,
          accel: 405,
          color: "#7a474c",
          taxi: false
        }
      ],
      note: "Pull into this southeast courtyard anytime to swap your ride."
    }
  }
};
