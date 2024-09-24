import fsSync from 'fs';
import crypto from 'crypto';
import fs from 'fs/promises';
import { exec } from 'child_process';
import axios from 'axios';
import dayjs from 'dayjs';
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';

process.on('uncaughtException', () => { });
process.on('unhandledRejection', () => { });

const PORT = 6419;

function main() {
  const app = express();
  app.use(compression());
  app.use(bodyParser.json());
  app.post('/api/run', async (req, res) => {
    const lang = req.body.lang ?? 'ts';
    const script = '// @ts-ignore\n' + (req.body.script ?? '');
    let config = req.body.config ?? '';
    const timeout = req.body.timeout;
    const uuid = crypto.randomUUID().toString();
    const scriptFileName = `scripts/${uuid}.spec.${lang}`;
    const configFileName = `scripts/${uuid}.config.${lang}`;
    const reportHtmlFileDir = `scripts/${uuid}.report.html`;
    const reportHtmlFileName = `${reportHtmlFileDir}/index.html`;
    config = config.replaceAll("'${perfma_report}'", JSON.stringify([
      ['html', { open: 'never', outputFolder: reportHtmlFileDir.replace('scripts/', '') }],
    ]));
    await Promise.all([fs.writeFile(scriptFileName, script, 'utf8'), fs.writeFile(configFileName, config, 'utf8')]);
    let finished = false;
    const json = (data: any) => {
      if (finished) return;
      console.log(JSON.stringify({ ...data, object: undefined }, null, 2));
      res.json(data);
      finished = true;
    };
    const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss');
    let info: any = { uuid, startTime: now() };
    let timer: any = null;
    const child = exec(`npx playwright test ${scriptFileName} --config ${configFileName}`, async (error, stdout, stderr) => {
      clearTimeout(timer);
      info = { ...info, endTime: now(), error, stdout, stderr, success: !error };
      try {
        info = { ...info, object: await fs.readFile(reportHtmlFileName, 'utf8') };
      } catch (error) {
        info = { ...info, error, success: false };
      }
      info = { ...info, message: info.error?.message };
      json(info);
      fs.unlink(scriptFileName);
      fs.unlink(configFileName);
      fs.unlink(reportHtmlFileName).then(() => fs.rmdir(reportHtmlFileDir));
    });
    if (timeout) timer = setTimeout(() => {
      const message = `timeout ${timeout}ms`;
      json({ ...info, endTime: now(), error: new Error(message), message, success: false });
      child.kill();
    }, timeout);
  });
  app.listen(PORT, () => console.log(`xen-playwright works on ${PORT} port...`));

  // setTimeout(() => {
  //   axios.post(`http://localhost:${PORT}/api/run`, {
  //     lang: 'ts',
  //     script: fsSync.readFileSync('app/example.spec.ts', 'utf8'),
  //     config: fsSync.readFileSync('app/playwright.config.ts', 'utf8'),
  //     timeout: 5000,
  //   });
  // }, 1000);
}

main();
