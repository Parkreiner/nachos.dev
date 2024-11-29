/** @type {import("prettier").Config} */
export default {
  tabWidth: 2,
  printWidth: 80,
  semi: true,
  arrowParens: "always",
  jsxSingleQuote: false,

  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
