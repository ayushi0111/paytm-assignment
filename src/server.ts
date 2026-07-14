import { createApp } from './app';
import { createDatabase, getDefaultDbPath } from './db';

const db = createDatabase(getDefaultDbPath());
const port = Number(process.env.PORT) || 3000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

const app = createApp(db, baseUrl);

app.listen(port, () => {
  console.log(`URL shortener listening on port ${port}`);
});
