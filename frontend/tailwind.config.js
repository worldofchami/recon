/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        surface: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        content: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        accent: {
          emerald: 'rgb(var(--accent-emerald) / <alpha-value>)',
          'emerald-dim': 'rgb(var(--accent-emerald-dim) / <alpha-value>)',
          amber: 'rgb(var(--accent-amber) / <alpha-value>)',
          rose: 'rgb(var(--accent-rose) / <alpha-value>)',
          sky: 'rgb(var(--accent-sky) / <alpha-value>)',
          violet: 'rgb(var(--accent-violet) / <alpha-value>)',
        },
        status: {
          success: 'rgb(var(--success) / <alpha-value>)',
          warning: 'rgb(var(--warning) / <alpha-value>)',
          error: 'rgb(var(--error) / <alpha-value>)',
          info: 'rgb(var(--info) / <alpha-value>)',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(52, 211, 153, 0.15)',
        'glow': '0 0 25px rgba(52, 211, 153, 0.2)',
        'glow-lg': '0 0 40px rgba(52, 211, 153, 0.25)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': `
          radial-gradient(at 40% 20%, rgba(52, 211, 153, 0.08) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(56, 189, 248, 0.06) 0px, transparent 50%),
          radial-gradient(at 0% 50%, rgba(167, 139, 250, 0.05) 0px, transparent 50%),
          radial-gradient(at 80% 50%, rgba(251, 191, 36, 0.04) 0px, transparent 50%),
          radial-gradient(at 0% 100%, rgba(52, 211, 153, 0.06) 0px, transparent 50%)
        `,
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
