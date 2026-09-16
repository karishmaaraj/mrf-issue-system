/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        mcc: {
          maroon: '#800000',
          secondary: '#9A1B2F',
          dark: '#171717',
          light: '#F7F7F7',
          soft: '#F4E8EA',
          border: '#E5E5E5',
          success: '#159447',
        },
        maroon: {
          50: '#F4E8EA',
          100: '#EBD0D4',
          500: '#9A1B2F',
          600: '#800000',
          700: '#800000',
          800: '#5C0000',
        },
        brand: {
          50: '#F4E8EA',
          500: '#800000',
          600: '#9A1B2F',
          700: '#800000',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
