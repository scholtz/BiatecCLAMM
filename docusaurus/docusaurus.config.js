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
    markdown: {
      hooks: {
        onBrokenMarkdownLinks: 'warn',
      },
    },
    favicon: 'img/favicon.ico',
    organizationName: 'scholtz', // Usually your GitHub org/user name.
    projectName: 'BiatecCLAMM', // Usually your repo name.
    i18n: {
      defaultLocale: 'en',
      locales: ['en', 'sk', 'pl'],
      localeConfigs: {
        en: {
          label: 'English',
        },
        sk: {
          label: 'Slovensky',
        },
        pl: {
          label: 'Polski',
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
            editUrl: 'https://github.com/scholtz/BiatecCLAMM/edit/main/docusaurus/',
          },
          blog: {
            showReadingTime: true,
            // Please change this to your repo.
            editUrl: 'https://github.com/scholtz/BiatecCLAMM/edit/main/docusaurus/blog/',
          },
          theme: {
            customCss: require.resolve('./src/css/custom.css'),
          },
        }),
      ],
    ],

    plugins: [
      // Add local search for development
      [
        require.resolve('@easyops-cn/docusaurus-search-local'),
        {
          // `hashed` is recommended as long-term caching strategy for your search index
          hashed: true,
          // For Docs
          docsRouteBasePath: '/docs',
          // For Blog
          blogRouteBasePath: '/blog',
          // Whether to index blog pages
          indexBlog: true,
          // Whether to index docs pages
          indexDocs: true,
          // Whether to index static pages
          // /404.html
          indexPages: false,
        },
      ],
      // API Documentation with TypeDoc
      [
        'docusaurus-plugin-typedoc',
        {
          id: 'api',
          plugin: ['typedoc-plugin-markdown'],
          out: 'docs/api',
          entryPoints: ['../src/index.ts'],
          tsconfig: '../tsconfig.json',
          readme: 'none',
          includeVersion: false,
          excludeExternals: true,
          excludePrivate: true,
          excludeProtected: true,
          excludeInternal: true,
          hideGenerator: true,
          disableSources: true,
          sort: ['source-order'],
          skipErrorChecking: true,
        },
      ],
    ],

    themeConfig:
      /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
      ({
        // Enable Algolia DocSearch
        algolia: {
          // The application ID provided by Algolia
          appId: 'YOUR_ALGOLIA_APP_ID',
          // Public API key: it is safe to commit it
          apiKey: 'YOUR_ALGOLIA_SEARCH_API_KEY',
          indexName: 'biatec-dex',
          // Optional: see doc section below
          contextualSearch: true,
          // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
          externalUrlRegex: 'external\\.com|domain\\.com',
          // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
          replaceSearchResultPathname: {
            from: '/docs/', // or as RegExp: /\/docs\//
            to: '/',
          },
          // Optional: Algolia search parameters
          searchParameters: {},
          // Optional: path for search page that enabled by default (`false` to disable it)
          searchPagePath: false,
        },
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
