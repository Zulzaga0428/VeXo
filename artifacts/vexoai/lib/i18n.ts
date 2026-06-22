export type Locale = "en" | "mn"

export const translations = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How it works",
      pricing: "Pricing",
      signIn: "Sign in",
      getStarted: "Get Started",
    },
    hero: {
      badge: "Powered by Claude AI + Kling",
      title1: "Create Video Ads",
      title2: "in Seconds",
      description: "A good prompt creates amazing content",
      startCreating: "Start Creating",
      watchDemo: "Watch Demo",
    },
    howItWorks: {
      title: "Three Simple Steps",
      subtitle: "Our AI-powered workflow makes video ad creation effortless",
      step1: {
        label: "Step 01",
        title: "Upload Image",
        description: "Upload your product image or any visual that you want to bring to life",
      },
      step2: {
        label: "Step 02",
        title: "Describe Your Vision",
        description: "Write a simple description and AI will enhance it into a professional prompt",
      },
      step3: {
        label: "Step 03",
        title: "Select Voice",
        description: "Choose a voice style for your video narration and generate your ad",
      },
    },
    features: {
      title1: "YOUR IDEA",
      title2: "EDITED AT DIRECTOR LEVEL",
      description: "Our AI understands what makes great video ads. Just describe your idea in your own words - no technical skills required.",
      fast: {
        title: "Lightning Fast",
        description: "Generate video ads in under 60 seconds",
      },
      aiPrompts: {
        title: "AI-Enhanced Prompts",
        description: "Claude AI transforms simple text into optimized prompts",
      },
      quality: {
        title: "High-Quality Output",
        description: "Kling AI produces cinematic video content",
      },
      preview: {
        imagePlaceholder: "Your image here",
        promptExample: '"Create an energetic ad for my coffee brand..."',
        voice: "Voice: Professional",
        duration: "Duration: 15s",
      },
    },
    cta: {
      title: "Ready to Create?",
      description: "Start creating professional video ads today. No credit card required.",
      button: "Get Started Free",
    },
    footer: {
      powered: "Powered by Claude AI + Kling API",
    },
  },
  mn: {
    nav: {
      features: "Онцлог",
      howItWorks: "Хэрхэн ажилладаг",
      pricing: "Үнэ",
      signIn: "Нэвтрэх",
      getStarted: "Эхлэх",
    },
    hero: {
      badge: "Claude AI + Kling дээр ажилладаг",
      title1: "Видео Реклам",
      title2: "Секундэд Бүтээ",
      description: "Сайн промпт гайхалтай бүтээл үүсгэнэ",
      startCreating: "Эхлэх",
      watchDemo: "Демо Үзэх",
    },
    howItWorks: {
      title: "Гурван Энгийн Алхам",
      subtitle: "Манай AI систем видео реклам хийхэд хялбар болгоно",
      step1: {
        label: "Алхам 01",
        title: "Зураг Оруулах",
        description: "Бүтээгдэхүүний зураг эсвэл амилуулахыг хүссэн дүрсээ оруулна уу",
      },
      step2: {
        label: "Алхам 02",
        title: "Санаагаа Бичих",
        description: "Энгийн тайлбар бичээрэй, AI үүнийг мэргэжлийн prompt болгоно",
      },
      step3: {
        label: "Алхам 03",
        title: "Дуу Сонгох",
        description: "Видеоны дуу хоолойн хэв маягийг сонгоод рекламаа үүсгээрэй",
      },
    },
    features: {
      title1: "ТАНЫ САНААГ",
      title2: "НАЙРУУЛАГЧИЙН ТҮВШИНД ЗАСВАРЛАНА",
      description: "Манай AI гайхалтай видео рекламын нууцыг мэднэ. Санаагаа өөрийн үгээр л бичээрэй - техникийн мэдлэг шаардлагагүй.",
      fast: {
        title: "Хурдан",
        description: "60 секундэд видео реклам үүсгэнэ",
      },
      aiPrompts: {
        title: "AI Prompt Сайжруулалт",
        description: "Claude AI энгийн текстийг оновчтой prompt болгоно",
      },
      quality: {
        title: "Өндөр Чанар",
        description: "Kling AI кино чанарын видео контент үүсгэнэ",
      },
      preview: {
        imagePlaceholder: "Таны зураг энд",
        promptExample: '"Миний кофе брэндийн идэвхтэй реклам хий..."',
        voice: "Дуу: Мэргэжлийн",
        duration: "Үргэлжлэх: 15с",
      },
    },
    cta: {
      title: "Бүтээхэд Бэлэн үү?",
      description: "Өнөөдрөөс мэргэжлийн видео реклам бүтээж эхэл. Карт шаардлагагүй.",
      button: "Үнэгүй Эхлэх",
    },
    footer: {
      powered: "Claude AI + Kling API дээр ажилладаг",
    },
  },
} as const

export type Translations = typeof translations.en
