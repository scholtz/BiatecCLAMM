const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(
  module.exports = {
    title: 'Biatec DEX',
    tagline: 'Concentrated Liquidity DEX on the Algorand Blockchain',
    url: 'https://beta.dex.biatec.io',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'img/favicon.ico',
    organizationName: 'scholtz', // Usually your GitHub org/user name.
    projectName: 'BiatecCLAMM', // Usually your repo name.
    i18n: {
      defaultLocale: 'en',
      locales: ['en', 'sk'],
      localeConfigs: {
        en: {
          label: 'English',
        },
        sk: {
          label: 'Slovensky',
        },
      },
    },
    presets: [
      [
        '@docusaurus/preset-classic',
        /** @type {import('@docusaurus/preset-classic').Options} */
        ({
          docs: {
            sidebarPath: require.resolve('./sidebars.js'),
            // Please change this to your repo.
            editUrl: 'https://github.com/scholtz/BiatecCLAMM/edit/main/docasaurs/',
          },
          blog: {
            showReadingTime: true,
            // Please change this to your repo.
            editUrl: 'https://github.com/scholtz/BiatecCLAMM/edit/main/docasaurs/blog/',
          },
          theme: {
            customCss: require.resolve('./src/css/custom.css'),
          },
        }),
      ],
    ],

    themeConfig:
      /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
      ({
        navbar: {
          title: 'Home',
          logo: {
            alt: 'Biatec DEX Logo',
            src: 'img/logo.svg',
          },
          items: [
            {
              type: 'doc',
              docId: 'intro',
              position: 'left',
              label: 'navbar.docs',
            },
            { to: '/blog', label: 'navbar.blog', position: 'left' },
            {
              type: 'localeDropdown',
              position: 'left',
            },
            {
              href: 'https://github.com/scholtz/BiatecCLAMM',
              label: 'navbar.github',
              position: 'right',
            },
          ],
        },
        footer: {
          style: 'dark',
          links: [
            {
              title: 'footer.docs.title',
              items: [
                {
                  label: 'footer.docs.intro',
                  to: '/docs/intro',
                },
              ],
            },
            {
              title: 'footer.community.title',
              items: [
                {
                  label: 'footer.community.discord',
                  href: 'https://discord.gg/gvGvmZ7c8s',
                },
                {
                  label: 'footer.community.twitter',
                  href: 'https://x.com/BiatecGroup',
                },
              ],
            },
            {
              title: 'footer.webs.title',
              items: [
                {
                  label: 'footer.webs.biatec',
                  href: 'https://www.biatec.io/',
                },
                {
                  label: 'footer.webs.dex',
                  href: 'https://dex.biatec.io/',
                },
                {
                  label: 'footer.webs.beta',
                  href: 'https://beta.dex.biatec.io/',
                },
              ],
            },
            {
              title: 'footer.more.title',
              items: [
                {
                  label: 'footer.more.blog',
                  to: '/blog',
                },
                {
                  label: 'footer.more.github.contracts',
                  href: 'https://github.com/scholtz/BiatecCLAMM',
                },
                {
                  label: 'footer.more.github.website',
                  href: 'https://github.com/scholtz/BiatecDEX',
                },
              ],
            },
          ],
          copyright: `Copyright © 2023-${new Date().getFullYear()} Biatec Group`,
        },
        prism: {
          theme: lightCodeTheme,
          darkTheme: darkCodeTheme,
        },
      }),
  }
);
