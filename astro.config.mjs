import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://trapstoner.github.io',
  base: '/fw16',
  integrations: [
    starlight({
      title: 'just some fw16 guides',
      description: 'Framework 16 AMD Fedora Linux guides',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/TrapStoner/fw16' },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            {
              label: 'Hibernate Setup — Framework 16 AMD (Fedora)',
              link: '/guides/hibernate-fedora-fw16/',
            },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
    }),
  ],
});
