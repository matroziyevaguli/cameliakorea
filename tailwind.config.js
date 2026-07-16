/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:    '#FFF7F3',
        surface:  '#FFFFFF',
        rose:     '#F4628E',
        roseDark: '#E14B79',
        peach:    '#FFB088',
        lavender: '#B9A7F0',
        mint:     '#6FD8C0',
        sky:      '#7CC4F2',
        ink:      '#2D2433',
        muted:    '#8A7F8C',
        success:  '#2FBF8F',
        warning:  '#FFB020',
        danger:   '#F25C5C',
      },
      fontFamily: {
        display: ['var(--font-quicksand)', 'sans-serif'],
        sans:    ['var(--font-inter)', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'card': '0 8px 30px rgba(244,98,142,0.10)',
        'rose': '0 4px 20px rgba(244,98,142,0.30)',
      },
    },
  },
  plugins: [],
}
