import fs from 'fs';
import { exec } from 'child_process';
import crypto from 'crypto';
import dayjs from 'dayjs';
import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';

function main() {
  const app = express();
  app.use(bodyParser.json());
  app.post('/api/run', (req, res) => {
    const lang = req.body.lang ?? 'ts';
    const script = req.body.script ?? '';
    let config = req.body.config ?? '';
    const timeout = req.body.timeout;
    const uuid = crypto.randomUUID().toString();
    const scriptFileName = `scripts/${uuid}.spec.${lang}`;
    const configFileName = `scripts/${uuid}.config.${lang}`;
    const reportJsonFileName = `scripts/${uuid}.report.json`;
    const reportHtmlFileDir = `scripts/${uuid}.report.html`;
    const reportHtmlFileName = `${reportHtmlFileDir}/index.html`;

    config = config.replaceAll("'${perfma_report}'", JSON.stringify([
      ['html', { open: 'never', outputFolder: reportHtmlFileDir.replace('scripts/', '') }],
      ['json', { outputFile: reportJsonFileName.replace('scripts/', '') }],
    ]));

    fs.writeFileSync(scriptFileName, script, 'utf8');
    fs.writeFileSync(configFileName, config, 'utf8');
    exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, (error, stdout, stderr) => {
      const info: any = { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), uuid, error, stdout, stderr };
      const json = (data: any = { }) => {
        const result = { ...info, ...data };
        console.log({ ...result, object: undefined });
        res.json(result);
      };
      const clean = () => {
        fs.unlink(scriptFileName, () => { });
        fs.unlink(configFileName, () => { });
        fs.unlink(reportJsonFileName, () => { });
        fs.unlink(reportHtmlFileName, () => {
          fs.rmdir(reportHtmlFileDir, () => { });
        });
      };
      try {
        json({
          success: true,
          object: {
            html: fs.readFileSync(reportHtmlFileName, 'utf8'),
            json: JSON.parse(fs.readFileSync(reportJsonFileName, 'utf8')),
          },
        });
      } catch (error: any) {
        json({ success: false, error });
      }
      clean();
    });
  });
  app.listen(6439);

  // setTimeout(() => {
  //   axios.post('http://localhost:6422/api/run', {
  //     lang: 'ts',
  //     script: fs.readFileSync('app/example.spec.ts', 'utf8'),
  //     config: fs.readFileSync('app/playwright.config.ts', 'utf8'),
  //   }).then(console.log);
  // }, 1000);
}

main();
