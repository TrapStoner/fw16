import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const bashPromptPlugin = {
  name: 'bash-prompt-sign',
  hooks: {
    postprocessRenderedLine({ codeBlock, line, renderData }) {
      if (codeBlock.language !== 'bash') return;
      const text = line.text;
      const isScript = codeBlock.getLine(0)?.text.trimStart().startsWith('#!');
      const isComment = text.trimStart().startsWith('#')
      if (isScript || isComment || text.trim() === '') {
        const el = renderData.lineAst;
        if (!el.properties) el.properties = {};
        const cls = el.properties.className;
        if (Array.isArray(cls)) {
          cls.push('no-prompt');
        } else {
          el.properties.className = cls ? [cls, 'no-prompt'] : ['no-prompt'];
        }
      }
    },
  },
};

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
      expressiveCode: {
        themes: ['vitesse-black', 'one-light'],
        styleOverrides: {
          borderRadius: '8px',
          frames: {
            frameBoxShadowCssValue: '0 4px 20px rgba(12, 10, 20, 0.35)',
          },
          borderColor: ({ theme }) =>
            theme.type === 'dark' ? '#ccc9e730' : '#7876ab30',
        },
        plugins: [bashPromptPlugin],
      },
      components: {
        SocialIcons: './src/components/RepoBadge.astro',
      },
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
    }),
  ],
});
