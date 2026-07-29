const { expo } = require('./app.json');

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

module.exports = {
  expo: {
    ...expo,
    experiments: {
      ...expo.experiments,
      ...(isGitHubPages ? { baseUrl: '/home-manual' } : {}),
    },
  },
};
