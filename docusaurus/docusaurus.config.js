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
              // Use plain label; translation extraction will create item.label.Docs key
              label: 'Docs',
            },
            { to: '/blog', label: 'Blog', position: 'left' },
            {
              type: 'localeDropdown',
              position: 'left',
            },
            {
              href: 'https://github.com/scholtz/BiatecCLAMM',
              label: 'GitHub',
              position: 'right',
            },
          ],
        },
        footer: {
          style: 'dark',
          links: [
            {
              title: 'Docs',
              items: [
                {
                  label: 'Intro',
                  to: '/docs/intro',
                },
              ],
            },
            {
              title: 'Community',
              items: [
                {
                  label: 'Discord',
                  href: 'https://discord.gg/gvGvmZ7c8s',
                },
                {
                  label: 'Twitter',
                  href: 'https://x.com/BiatecGroup',
                },
              ],
            },
            {
              title: 'Webs',
              items: [
                {
                  label: 'Biatec',
                  href: 'https://www.biatec.io/',
                },
                {
                  label: 'DEX',
                  href: 'https://dex.biatec.io/',
                },
                {
                  label: 'Beta release',
                  href: 'https://beta.dex.biatec.io/',
                },
              ],
            },
            {
              title: 'More',
              items: [
                {
                  label: 'Blog',
                  to: '/blog',
                },
                {
                  label: 'GitHub Smart Contracts',
                  href: 'https://github.com/scholtz/BiatecCLAMM',
                },
                {
                  label: 'GitHub DEX Website',
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
