/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        nex: {
          navy: '#0F2547',
          navyLight: '#173461',
          navyDark: '#09172E',
          teal: '#3596B0',
          tealLight: '#49AFCB',
          tealDark: '#28788E',
        },
        // Map primary accent (indigo) to the NexInt Navy + Cyan-Teal brand palette
        indigo: {
          50: '#EEF8FA',
          100: '#D6EEF4',
          200: '#B0E0EC',
          300: '#7BC8DC',
          400: '#49AFCB',
          500: '#3596B0',
          600: '#0F2547',
          700: '#173461',
          800: '#1E3F73',
          900: '#0B1C36',
          950: '#071224',
        },
      },
    },
  },
  plugins: [],
};
