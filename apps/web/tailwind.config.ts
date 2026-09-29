import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        surface: {
          DEFAULT: '#111827',
          elevated: '#172033',
        },
        border: '#263248',
        text: {
          DEFAULT: '#F3F4F6',
          muted: '#9CA3AF',
        },
        primary: {
          DEFAULT: '#7C6CF2',
          hover: '#8F82F5',
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          high: '#F97316',
          critical: '#EF4444',
          info: '#38BDF8',
        },
      },
    },
  },
  plugins: [],
};

export default config;
