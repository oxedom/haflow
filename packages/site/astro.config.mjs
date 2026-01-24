import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://oxedom.github.io',
  base: '/haflow',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
