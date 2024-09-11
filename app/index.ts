import fs from 'fs';
import { exec } from 'child_process';
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
    // const uuid = crypto.randomUUID().toString();
    const uuid = '48e54080-5b47-46f9-9b1a-3bb4823411d4';
    const scriptFileName = `scripts/${uuid}.spec.${lang}`;
    const configFileName = `scripts/${uuid}.config.${lang}`;
    const reportJsonFileName = `scripts/${uuid}.report.json`;
    const reportHtmlFileName = `scripts/${uuid}.report.html/index.html`;
    // fs.writeFileSync(scriptFileName, script, 'utf8');
    // fs.writeFileSync(configFileName, config, 'utf8');
    exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, (error, stdout, stderr) => {
      if (error) {
        res.json({ uuid, success: false, message: error.message ?? 'script running error', stdout, stderr });
        return;
      }
      try {
        res.json({
          uuid,
          success: true,
          object: {
            html: fs.readFileSync(reportHtmlFileName, 'utf8'),
            json: JSON.parse(fs.readFileSync(reportJsonFileName, 'utf8')),
          },
          stdout, stderr,
        });
      } catch (error: any) {
        res.json({ uuid, success: false, message: error.message ?? 'report read error', stdout, stderr });
      }
    });
  });
  app.listen(6422);
}

main();
