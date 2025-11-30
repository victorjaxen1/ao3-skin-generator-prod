module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // WordFokus Brand Colors (Google Material Design)
      colors: {
        primary: {
          DEFAULT: '#1a73e8',
          dark: '#0d47a1',
          light: '#8ab4f8',
          bg: '#e8f0fe',
        },
        secondary: {
          DEFAULT: '#34a853',
        },
        accent: {
          DEFAULT: '#fbbc05',
        },
        danger: {
          DEFAULT: '#ea4335',
        },
        text: {
          dark: '#202124',
          gray: '#5f6368',
          light: '#e8eaed',
        },
        bg: {
          light: '#f8f9fa',
        },
        border: {
          light: '#dadce0',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'Arial', 'sans-serif'],
        heading: ['Google Sans', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'material-sm': '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'material-md': '0 2px 6px rgba(60,64,67,0.3), 0 1px 8px 1px rgba(60,64,67,0.15)',
        'material-lg': '0 4px 12px rgba(60,64,67,0.3), 0 1px 16px 2px rgba(60,64,67,0.15)',
      },
      borderRadius: {
        'material-sm': '4px',
        'material-md': '8px',
        'material-lg': '16px',
      },
    },
  },
  plugins: [],
};
