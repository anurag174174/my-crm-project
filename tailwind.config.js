/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs", // Scans all EJS files in the views folder
    "./public/**/*.js", // Optional: Scan JS files in the public folder if needed
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
