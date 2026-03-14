/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        artisan: {
          green: '#30D158',
          cyan: '#5AC8FA',
          violet: '#5E5CE6',
          success: '#30D158',
          warning: '#FFD60A',
          error: '#FF453A',
          info: '#5AC8FA',
        },
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
