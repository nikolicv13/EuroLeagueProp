
<h1 align="center">Prop Alley</h1>
A high-performance, data-driven sports analytics platform designed to evaluate Euroleague (soon Eurocup and NBA) player propositions and Euroleague Fantasy Challange. PropAlley aggregates historical box scores, defensive matchups, and bookmaker odds to deliver actionable betting insights, dynamic hit-rate breakdowns, and interactive data visualizations. 

<p>&nbsp;</p>

> _Off-Season Demo Mode  
Since the Euroleague season has concluded, the platform is currently operating in Demo Mode using historical data from the Finals. Live odds and daily suggestions will remain static until the next season begins. This allows users to explore the platform's features, test the analytics engine, and evaluate the tool before the official launch and subscription model goes live for the upcoming season._

<p>&nbsp;</p>

**Live Demo**: [prop-alley.vercel.app](https://prop-alley.vercel.app/)

## Key Features

- **Advanced Hit-Rate Breakdown:** Instantly see how often a player hits a specific statistical line (Over/Under) against specific opponents or in recent form.
- **Defensive Matchup Analysis:**  Visualizes how a player's specific position (e.g., Point Guard) historically performs against the upcoming opponent's defensive rankings
- **Contextual Lineup Stats:** Filter player performance based on whether a specific teammate is on the court ("With/Without" analysis) or against a specific opposing defender.
- **Interactive Data Visualization:** Powered by Recharts, featuring color-coded bar charts that instantly highlight games where a player beat or missed the bookmaker's line.
- **Comprehensive Game Logs:** Paginated, filterable historical game logs allowing deep dives into a player's season (Home/Away, Regular Season vs. Playoffs).

## TechStack

<table>
  <tr>
    <th>Category</th>
    <th>Technologies</th>
  </tr>
  <tr>
    <td><strong>Frontend</strong></td>
    <td>React 18, TypeScript, Vite, React Router v6</td>
  </tr>
  <tr>
    <td><strong>Styling</strong></td>
    <td>CSS Modules</td>
  </tr>
  <tr>
    <td><strong>Backend</strong></td>
    <td>Node.js, Express.js</td>
  </tr>
  <tr>
    <td><strong>Database</strong></td>
    <td>Supabase (PostgreSQL)</td>
  </tr>
  <tr>
    <td><strong>Data Sources</strong></td>
    <td>Custom odds scraping, Euroleague historical datasets</td>
  </tr>
  <tr>
    <td><strong>Hosting</strong></td>
    <td>Vercel (Frontend), Render (Backend)</td>
  </tr>
</table>


## Infrastructure & Scaling

_**Current Deployment**: PropAlley is currently deployed using the free tiers of Vercel, Render, and Supabase to maintain a cost-effective portfolio environment during the off-season._

_**Production Considerations**: Because the backend runs on a free Render instance, initial API requests may experience a ~30-second cold start. **However, prior to the start of the next season, the infrastructure will be drastically upgraded to production-grade paid tiers**. This will include dedicated server instances, database connection pooling, and caching layers to ensure zero cold starts, real-time data processing, and seamless performance under heavy traffic._

## Future Roadmap
As PropAlley transitions from a portfolio project to a live product for the upcoming season, the following features are in active development:
- **Euroleague Fantasy Hub**: A dedicated, separate page featuring optimized lineup suggestions, player value metrics, and injury tracking specifically for the Euroleague Fantasy Challenge.
- **Mobile-First Optimization**: Comprehensive UI/UX improvements to ensure a flawless, responsive experience for mobile users.
- **User Accounts & Watchlists**: Secure authentication allowing users to save custom prop tracking dashboards, favorite players, and historical betting performance.
- **League Expansion**: Integration of automated data pipelines for the NBA and Eurocup.
- **Smart Parlay Builder:** An automated accumulator tool that aggregates high-confidence prop tips based on user-defined filters (e.g., minimum 70% hit rate, specific odds range). Generates a unified bet slip with deep-links for one-click placement on supported bookmaker platforms.
  
