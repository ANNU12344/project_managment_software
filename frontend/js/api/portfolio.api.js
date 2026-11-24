/* Portfolio-level reads.  Backend: routes/portfolio.routes.js */
import { get, query } from './client.js';

/* { projects: [...] } — one row per project the user can see, with every dashboard figure */
export const getPortfolio = () => get('/portfolio');

/* { items: [...] } — open client issues and dependencies across the portfolio */
export const getClientItems = () => get('/clients');

/* { weeks, projects } — every visible project's weekly history, last `weeks` weeks (4–52) */
export const getPortfolioHistory = (weeks) => get('/history/portfolio' + query({ weeks }));
