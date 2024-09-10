import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import bodyParser from 'body-parser';

function main() {
  const app = express();
  app.use(bodyParser.json());
  app.post('/api/run', (req, res) => {
    const lang = req.body.lang ?? 'ts';
    const script = req.body.script ?? '';
    const config = req.body.config ?? '';
    const uuid = crypto.randomUUID().toString();
    const scriptFileName = `tests/${uuid}.${lang}`;
    const configFileName = `configs/${uuid}.${lang}`;
    fs.writeFileSync(scriptFileName, script, 'utf8');
    fs.writeFileSync(configFileName, config, 'utf8');
    res.json({ });
  });
  app.listen(6422);
}

main();
